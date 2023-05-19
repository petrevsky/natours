const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(
            new AppError('Not an image! Please upload only images.', 400),
            false
        );
    }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

exports.uploadTourImages = upload.fields([
    { name: 'imageCover', maxCount: 1 },
    { name: 'images', maxCount: 3 },
]);

const uploadImage = async (file, fileName) =>
    await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${fileName}`);

exports.resizeTourImage = catchAsync(async (req, res, next) => {
    if (!req.files.imageCover || !req.files.images) return next();

    // 1) Cover image
    const coverImage = req.files.imageCover[0];

    const imageCoverFilename = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;

    await uploadImage(coverImage, imageCoverFilename);
    req.body.imageCover = imageCoverFilename;

    // 2) Other images
    req.body.images = [];

    await Promise.all(
        req.files.images.map(async (file, i) => {
            const imageFilename = `tour-${req.params.id}-${Date.now()}-${
                i + 1
            }.jpeg`;

            await uploadImage(file, imageFilename);

            req.body.images.push(imageFilename);
        })
    );

    console.log(req.body.images);

    next();
});

exports.aliasTopTours = (req, res, next) => {
    req.query = {
        limit: 5,
        sort: '-ratingsAverage,price',
        fields: 'name,price,ratingsAverage,summary,difficulty',
    };

    next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
    const stats = await Tour.aggregate([
        {
            $match: { ratingsAverage: { $gte: 4.4 } },
        },
        {
            $group: {
                _id: { $toUpper: '$difficulty' },
                // _id: '$difficulty',
                numTours: { $sum: 1 },
                numRatings: { $sum: '$ratingsQuantity' },
                avgRating: { $avg: '$ratingsAverage' },
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
            },
        },
        {
            $sort: { avgPrice: 1 },
        },
        // {
        //     $match: { _id: { $ne: 'EASY' } },
        // },
    ]);

    res.status(200).json({
        status: 'succcess',
        data: stats,
    });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
    const year = req.params.year * 1; // 2021

    const stats = await Tour.aggregate([
        {
            $unwind: '$startDates',
        },
        {
            $match: {
                startDates: {
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31`),
                },
            },
        },
        {
            $group: {
                _id: { $month: '$startDates' },
                numTourStarts: { $sum: 1 },
                tours: { $push: '$name' },
            },
        },
        {
            $addFields: { month: '$_id' },
        },
        {
            $project: {
                _id: 0,
            },
        },
        {
            $sort: { numTourStarts: -1 },
        },
        {
            $limit: 12,
        },
    ]);

    res.status(200).json({
        status: 'succcess',
        data: stats,
    });
});

exports.getToursWithin = catchAsync(async (req, res, next) => {
    // /tours-within/:distance/center/:latlng/unit/:unit
    // /tours within/233/center/34.137508, -118.167194/unit/mi

    const { distance, latlng, unit } = req.params;
    const [lat, lng] = latlng.split(',');

    const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

    if (!lat || !lng) {
        return next(
            new AppError(
                'Please provide latitude and longitude in the format lat,lng',
                400
            )
        );
    }

    const tours = await Tour.find({
        startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
    });

    res.status(200).json({
        status: 'success',
        results: tours.length,
        data: {
            data: tours,
        },
    });
});

exports.getDistances = catchAsync(async (req, res, next) => {
    const { latlng, unit } = req.params;
    const [lat, lng] = latlng.split(',');

    if (!lat || !lng) {
        return next(
            new AppError(
                'Please provide latitude and longitude in the format lat,lng',
                400
            )
        );
    }

    const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

    const distances = await Tour.aggregate([
        {
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [lng * 1, lat * 1],
                },
                distanceField: 'distance',
                distanceMultiplier: multiplier,
            },
        },
        {
            $project: {
                distance: 1,
                name: 1,
            },
        },
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            data: distances,
        },
    });
});
