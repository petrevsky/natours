const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = id =>
    jwt.sign({ id: id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);

    const cookieOptions = {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
    };

    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

    res.cookie('jwt', token, cookieOptions);

    // Remove password from output
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user: user,
        },
    });
};

exports.signup = catchAsync(async (req, res, next) => {
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
        passwordChangedAt: req.body.passwordChangedAt,
    });

    const url = `${req.protocol}://${req.get('host')}/me`;
    await new Email(newUser, url).sendWelcome();

    createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
        return next(new AppError('Please provide email and password!', 400));
    }

    // 2) Check if user exists && password is okay
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    // 3) If everything is ok, send token to client
    createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });

    res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
    // 1) Getting token and check if it's there
    let token;
    const { authorization } = req.headers;

    if (authorization && authorization.startsWith('Bearer')) {
        token = authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token)
        return next(
            new AppError(
                'You are not logged in! Please log in to get access.',
                401
            )
        );

    // 2) Verification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const freshUser = await User.findById(decoded.id);
    if (!freshUser)
        return next(
            new AppError(
                'The user belonging to this token does not exist.',
                401
            )
        );

    // 4) Check if user changed password after the JWT token was issued
    if (freshUser.changedPasswordAfter(decoded.iat))
        return next(
            new AppError(
                'User recently changed password! Please log in again.',
                401
            )
        );

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = freshUser;
    res.locals.user = freshUser;
    next();
});

// Only for rendered pages, no errors
exports.isLoggedIn = async (req, res, next) => {
    if (req.cookies.jwt) {
        try {
            // 1) Verify token
            const decoded = await promisify(jwt.verify)(
                req.cookies.jwt,
                process.env.JWT_SECRET
            );

            // 2) Check if user still exists
            const freshUser = await User.findById(decoded.id);
            if (!freshUser) return next();

            // 3) Check if user changed password after the JWT token was issued
            if (freshUser.changedPasswordAfter(decoded.iat)) next();

            // THERE IS A LOGGED IN USER

            res.locals.user = freshUser;
            return next();
        } catch (err) {
            return next();
        }
    }
    next();
};

exports.restrictTo =
    (...roles) =>
    (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(
                new AppError('User does not have sufficient permissions', 403)
            );
        }

        next();
    };

exports.forgotPassword = catchAsync(async (req, res, next) => {
    // 1) Get user based on POSTed email

    const { email } = req.body;

    if (!email) return next(new AppError('You have to specify email', 401));

    const user = await User.findOne({ email: email });

    if (!user)
        return next(new AppError('There is no user with email address', 404));

    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // 3) Send it back as an email
    try {
        const resetURL = `${req.protocol}://${req.get(
            'host'
        )}/api/v1/users/resetPassword/${resetToken}`;

        await new Email(user, resetURL).sendPasswordRest();
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(err);
    }

    res.status(200).json({
        status: 'success',
        message: 'Token sent to email!',
    });

    next();
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    // 1) Get user based on the token
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
    });

    // 2) If token has not expired, and there is user, set the new password
    if (!user) return next(new AppError('Token invalid or has expired', 400));

    const { password, passwordConfirm } = req.body;
    if (!password || !passwordConfirm)
        return next(
            new AppError('You must specify password and passwordConfirm', 400)
        );

    user.password = password;
    user.passwordConfirm = passwordConfirm;
    user.passwordResetExpires = undefined;
    user.passwordResetToken = undefined;

    // 3) Update changedPassword property for the user

    await user.save();

    // 4) Log the user in, send JWT

    createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
    // 1) Get user from collection
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    // 2) Check if POSTed current password is correct
    const isCorrect = await user.correctPassword(
        currentPassword,
        user.password
    );

    // console.log(isCorrect);

    if (!isCorrect) {
        return next(
            new AppError('Invalid currentPassword, please try agian.', 401)
        );
    }

    // 3) If so, update password
    user.password = newPassword;
    user.passwordConfirm = newPasswordConfirm;
    await user.save();

    // 4) Log user in, send JWT
    createSendToken(user, 200, res);
});
