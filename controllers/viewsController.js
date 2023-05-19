const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Booking = require('../models/bookingModel');

exports.getOverview = catchAsync(async (req, res, next) => {
    // 1) Get all tour data from collection
    const tours = await Tour.find({});

    // 2) Build template

    // 3) Render template using tour data from 1)

    res.status(200).render('overview', {
        title: 'All Tours',
        tours,
    });
});

exports.getTour = catchAsync(async (req, res, next) => {
    const tourSlug = req.params.slug;

    const tour = await Tour.findOne({ slug: tourSlug }).populate({
        path: 'reviews ',
        fields: 'review rating user',
    });

    if (!tour) {
        return next(new AppError('There is no tour with that name', 404));
    }

    res.status(200).render('tour', {
        title: `${tour.name} Tour`,
        tour,
    });
});

exports.getLoginForm = (req, res) => {
    res.status(200).render('login', { title: 'Login to your account' });
};

exports.getAccount = (req, res) => {
    res.status(200).render('account', { title: 'Your account' });
};

exports.updateUserData = catchAsync(async (req, res) => {
    const { name, email } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        {
            name: name,
            email: email,
        },
        { new: true, runValidators: true }
    );

    res.status(200).render('account', {
        title: 'Your account',
        user: updatedUser,
    });
});

exports.getMyTours = catchAsync(async (req, res) => {
    // 1) Find all bookings
    const bookings = await Booking.find({
        user: req.user.id,
    });

    // 2) Find tours with the returned IDs
    const tourIDs = bookings.map(el => el.tour);

    const tours = await Tour.find({ _id: { $in: tourIDs } });

    res.status(200).render('overview', {
        title: 'My tours',
        tours,
    });
});
