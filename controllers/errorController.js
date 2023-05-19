const AppError = require('../utils/appError');

const handleCastErrorDB = err =>
    new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateFieldsDB = err =>
    new AppError(
        `Duplicate field value ${
            Object.keys(err.keyValue)[0]
        }. Please use another value.`,
        400
    );

const handleValidationErrorDB = err => {
    const errors = Object.values(err.errors).map(el => el.message);

    return new AppError(`Invalid input data. ${errors.join('. ')}`, 400);
};

const handleJWTError = () =>
    new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
    new AppError('Your token has expired! Please log in again.', 401);

const sendErrorDev = (err, res, req) => {
    // API
    if (req.originalUrl.startsWith('/api')) {
        return res.status(err.statusCode).json({
            status: err.status,
            err: err,
            message: err.message,
            stack: err.stack,
        });
    }

    // RENDERED WEBSITE
    console.error('ERROR 💥', err);
    return res.status(err.statusCode).render('error', {
        title: 'Something went wrong',
        msg: err.message,
    });
};

const sendErrorProd = (err, res, req) => {
    // APIs
    if (req.originalUrl.startsWith('/api')) {
        // Operational, trusted error: send message to client
        if (err.isOperational) {
            return res.status(err.statusCode).json({
                status: err.status,
                message: err.message,
            });

            // Programming or other unknown error: don't leak error details
        }

        // 1) Log error
        console.error('ERROR 💥', err);

        // 2) Send generic message
        return res.status(500).json({
            status: 'error',
            message: 'Something went very wrong!',
        });
    }

    // RENDERED WEBSITE
    // A) Operrational, trusted error
    if (err.isOperational) {
        return res.status(err.statusCode).render('error', {
            title: 'Something went wrong',
            msg: err.message,
        });
    }

    // B) Programming errro

    // 1) Log error
    console.error('ERROR 💥', err);

    // 2) Send generic message
    return res.status(err.statusCode).render('error', {
        title: 'Something went wrong',
        msg: 'Please try again later',
    });
};

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res, req);
    } else if (process.env.NODE_ENV === 'production') {
        let error = { ...err };
        error.message = err.message;

        if (error.name === 'CastError') error = handleCastErrorDB(error);

        if (error.code === 11000) error = handleDuplicateFieldsDB(error);

        if (error.name === 'ValidationError')
            error = handleValidationErrorDB(error);

        if (error.name === 'JsonWebTokenError') error = handleJWTError();

        if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

        sendErrorProd(error, res, req);
    }
};
