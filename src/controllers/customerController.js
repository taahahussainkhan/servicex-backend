import Customer from '../models/Customer.js';
import Servian from '../models/Servian.js';
import Booking from '../models/bookingModel.js';
import Review from '../models/reviewModel.js';
import Notification from '../models/notificationModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Get customer dashboard data
// @route   GET /api/customer/dashboard
// @access  Private (Customer only)
export const getDashboardData = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.user.id)
        .select('-password -otp -otpExpires')
        .populate('favoriteServians.servian', 'name averageRating serviceCategory profileImage role');

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    // Get recent bookings
    const recentBookings = await Booking.find({ customer: req.user.id })
        .populate('servian', 'name profileImage averageRating role')
        .sort({ createdAt: -1 })
        .limit(5);

    // Get pending bookings
    const pendingBookings = await Booking.find({
        customer: req.user.id,
        status: { $in: ['pending', 'confirmed', 'in_progress'] }
    })
        .populate('servian', 'name profileImage phone role')
        .sort({ scheduledDate: 1 });

    const dashboardData = {
        profile: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            profileImage: customer.profileImage,
            customerTier: customer.customerTier,
            loyaltyPoints: customer.loyaltyPoints,
            experienceLevel: customer.experienceLevel,
            joinDate: customer.customerStats.joinDate,
            location: customer.location
        },
        stats: {
            totalBookings: customer.customerStats.totalBookings,
            completedBookings: customer.customerStats.completedBookings,
            totalSpent: customer.totalSpent,
            monthlySpending: customer.monthlySpending,
            completionRate: customer.completionRate,
            averageBookingValue: customer.customerStats.averageBookingValue
        },
        recentBookings,
        pendingBookings,
        favoriteServians: customer.favoriteServians,
        defaultAddress: customer.defaultAddress
    };

    res.json({ success: true, data: dashboardData });
});

// @desc    Update customer profile
// @route   PUT /api/customer/profile
// @access  Private (Customer only)
export const updateProfile = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.user.id);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    const {
        name,
        phone,
        preferredServices,
        preferences,
        emergencyContact
    } = req.body;

    // Update allowed fields
    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    if (preferredServices) customer.preferredServices = preferredServices;
    if (preferences) {
        customer.preferences = { ...customer.preferences, ...preferences };
    }
    if (emergencyContact) {
        customer.preferences.emergencyContact = emergencyContact;
    }

    const updatedCustomer = await customer.save();

    res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
            name: updatedCustomer.name,
            phone: updatedCustomer.phone,
            preferredServices: updatedCustomer.preferredServices,
            preferences: updatedCustomer.preferences
        }
    });
});

// @desc    Get customer bookings
// @route   GET /api/customer/bookings
// @access  Private (Customer only)
export const getBookings = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { customer: req.user.id };
    if (status) query.status = status;

    const totalBookings = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
        .populate('servian', 'name profileImage averageRating phone serviceCategory role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

    const pagination = {
        currentPage: Number(page),
        totalPages: Math.ceil(totalBookings / limit),
        totalBookings,
        hasNext: page * limit < totalBookings,
        hasPrev: page > 1
    };

    res.json({ success: true, data: { bookings, pagination } });
});

// @desc    Create new booking
// @route   POST /api/customer/bookings
// @access  Private (Customer only)
export const createBooking = asyncHandler(async (req, res) => {
    const {
        servianId,
        service,
        description,
        scheduledDate,
        scheduledTime,
        amount,
        location,
        notes
    } = req.body;

    const customer = await Customer.findById(req.user.id);
    const servian = await Servian.findById(servianId);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    if (!servian) {
        res.status(404);
        throw new Error('Servian not found');
    }

    if (!customer.canBookServian(servianId)) {
        res.status(403);
        throw new Error('You have blocked this servian');
    }

    // if (!servian.isAvailable()) {
    //     res.status(400);
    //     throw new Error('Servian is not available at the moment');
    // }

    const booking = await Booking.create({
        customer: req.user.id,
        servian: servianId,
        service,
        description,
        scheduledDate,
        scheduledTime,
        amount,
        location,
        notes
    });


    customer.updateBookingStats('book');
    await customer.save();


    // await Notification.create({
    //     user: servianId,
    //     type: 'new_booking',
    //     title: 'New Booking Request',
    //     message: `You have a new booking request from ${customer.name}`,
    //     data: { bookingId: booking._id }
    // });

    const populatedBooking = await Booking.findById(booking._id)
        .populate('servian', 'name profileImage averageRating phone role')
        .populate('customer', 'name profileImage');

    res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: populatedBooking
    });
});

// @desc    Cancel booking
// @route   PUT /api/customer/bookings/:id/cancel
// @access  Private (Customer only)
export const cancelBooking = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!req.body) {
        res.status(400);
        throw new Error('Request body is required');
    }

    const { reason } = req.body;

    const booking = await Booking.findOne({ _id: id, customer: req.user.id });
    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
        res.status(400);
        throw new Error('Cannot cancel booking in current status');
    }

    booking.status = 'cancelled';
    booking.notes = reason || 'Cancelled by customer';
    await booking.save();

    // Update customer stats
    const customer = await Customer.findById(req.user.id);
    customer.updateBookingStats('cancel');
    await customer.save();

    // Create notification for servian
    await Notification.create({
        user: booking.servian,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `Booking has been cancelled by the customer`,
        data: { bookingId: booking._id }
    });

    res.json({
        success: true,
        message: 'Booking cancelled successfully',
        data: { bookingId: id, status: 'cancelled' }
    });
});

// @desc    Create review for servian
// @route   POST /api/customer/reviews
// @access  Private (Customer only)
export const createReview = asyncHandler(async (req, res) => {
    const { bookingId, rating, comment } = req.body;

    const booking = await Booking.findOne({
        _id: bookingId,
        customer: req.user.id,
        status: 'completed'
    });

    if (!booking) {
        res.status(404);
        throw new Error('Completed booking not found');
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
        booking: bookingId,
        author: req.user.id,
        role: 'customer_to_servian'
    });

    if (existingReview) {
        res.status(400);
        throw new Error('Review already exists for this booking');
    }

    const review = await Review.create({
        booking: bookingId,
        author: req.user.id,
        target: booking.servian,
        role: 'customer_to_servian',
        rating,
        comment
    });

    // Update servian's average rating
    const servian = await Servian.findById(booking.servian);
    const allReviews = await Review.find({
        target: booking.servian,
        role: 'customer_to_servian'
    });

    const totalRating = allReviews.reduce((sum, rev) => sum + rev.rating, 0);
    servian.averageRating = totalRating / allReviews.length;
    servian.totalReviews = allReviews.length;
    await servian.save();

    // Create notification for servian
    await Notification.create({
        user: booking.servian,
        type: 'new_review',
        title: 'New Review',
        message: `You received a ${rating}-star review`,
        data: { reviewId: review._id, bookingId }
    });

    const populatedReview = await Review.findById(review._id)
        .populate('target', 'name profileImage');

    res.status(201).json({
        success: true,
        message: 'Review created successfully',
        data: populatedReview
    });
});

// @desc    Get customer reviews (given by customer)
// @route   GET /api/customer/reviews
// @access  Private (Customer only)
export const getReviews = asyncHandler(async (req, res) => {
    const reviews = await Review.find({
        author: req.user.id,
        role: 'customer_to_servian'
    })
        .populate('target', 'name profileImage serviceCategory')
        .populate('booking', 'service scheduledDate')
        .sort({ createdAt: -1 });

    res.json({ success: true, data: reviews });
});



export const searchServians = asyncHandler(async (req, res) => {
    const { category, location, available = 'false' } = req.query;
    const query = { isVerified: true };

    if (category) query.serviceCategory = category;
    if (available === 'true') query['availability.status'] = 'AVAILABLE';

    try {
        let servians;

        if (location) {
            const [lat, lng] = location.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng) && typeof Servian.findNearbyServians === 'function') {
                servians = await Servian.findNearbyServians(lat, lng, 10, category);
            } else {
                servians = await Servian.find(query).limit(20);
            }
        } else {
            servians = await Servian.find(query).limit(20);
        }

        const serviansData = servians.map(s => ({
            _id: s._id,
            name: s.name,
            serviceCategory: s.serviceCategory,
            averageRating: s.averageRating || 0,
            profileImage: s.profileImage,
            availability: s.availability,
            isVerified: s.isVerified,
        }));

        res.json({
            success: true,
            data: { servians: serviansData, total: serviansData.length }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Something went wrong.',
        });
    }
});

// @desc    Update booking request
// @route   PUT /api/customer/bookings/:id
// @access  Private (Customer only)
export const updateBooking = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        service,
        description,
        scheduledDate,
        scheduledTime,
        amount,
        location,
        notes
    } = req.body;

    const booking = await Booking.findOne({ _id: id, customer: req.user.id });
    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }

    if (!['pending'].includes(booking.status)) {
        res.status(400);
        throw new Error('Cannot update booking in current status');
    }

    // Update fields
    if (service) booking.service = service;
    if (description) booking.description = description;
    if (scheduledDate) booking.scheduledDate = scheduledDate;
    if (scheduledTime) booking.scheduledTime = scheduledTime;
    if (amount) booking.amount = amount;
    if (location) booking.location = { ...booking.location, ...location };
    if (notes) booking.notes = notes;

    await booking.save();

    // Notify servian about update
    await Notification.create({
        user: booking.servian,
        type: 'booking_updated',
        title: 'Booking Updated',
        message: `Customer has updated their booking request`,
        data: { bookingId: booking._id }
    });

    res.json({
        success: true,
        message: 'Booking updated successfully',
        data: booking
    });
});

// @desc    Get servian details
// @route   GET /api/customer/servians/:id
// @access  Private (Customer only)
export const getServianDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const servian = await Servian.findById(id)
        .select('-password -otp -otpExpires');

    if (!servian) {
        res.status(404);
        throw new Error('Servian not found');
    }


    const reviews = await Review.find({
        target: id,
        role: 'customer_to_servian'
    })
        .populate('author', 'name profileImage')
        .populate('booking', 'service scheduledDate')
        .sort({ createdAt: -1 })
        .limit(10);



    const servianData = {
        _id: servian._id,
        name: servian.name,
        email: servian.email,
        phone: servian.phone,
        profileImage: servian.profileImage,
        serviceCategory: servian.serviceCategory,
        location: servian.location,
        bio: servian.bio,
        experienceYears: servian.experienceYears,
        skills: servian.skills,
        averageRating: servian.averageRating,
        totalReviews: servian.totalReviews,
        isVerified: servian.isVerified,
        availability: servian.availability,
        pricing: servian.pricing,
        portfolio: servian.portfolio,
        equipment: servian.equipment,
        certifications: servian.certifications,
        emergencyService: servian.emergencyService,
        recentReviews: reviews,
        isAvailable: servian.isAvailable(),
        canTakeEmergencyJobs: servian.canTakeEmergencyJobs()
    };

    res.json({ success: true, data: servianData });
});

// @desc    Add servian to favorites
// @route   POST /api/customer/favorites/:servianId
// @access  Private (Customer only)
export const addToFavorites = asyncHandler(async (req, res) => {
    const { servianId } = req.params;

    const customer = await Customer.findById(req.user.id);
    const servian = await Servian.findById(servianId);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    if (!servian) {
        res.status(404);
        throw new Error('Servian not found');
    }

    await customer.addToFavorites(servianId);

    res.json({
        success: true,
        message: 'Servian added to favorites',
        data: { servianId }
    });
});


// @desc    Remove servian from favorites
// @route   DELETE /api/customer/favorites/:servianId
// @access  Private (Customer only)
export const removeFromFavorites = asyncHandler(async (req, res) => {
    const { servianId } = req.params;

    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    await customer.removeFromFavorites(servianId);

    res.json({
        success: true,
        message: 'Servian removed from favorites',
        data: { servianId }
    });
});

// @desc    Get favorite servians
// @route   GET /api/customer/favorites
// @access  Private (Customer only)
export const getFavorites = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.user.id)
        .populate('favoriteServians.servian', 'name profileImage averageRating serviceCategory pricing availability role');

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    res.json({ success: true, data: customer.favoriteServians });
});

// @desc    Block servian
// @route   POST /api/customer/block/:servianId
// @access  Private (Customer only)
export const blockServian = asyncHandler(async (req, res) => {
    const { servianId } = req.params;
    const { reason } = req.body;

    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    await customer.blockServian(servianId, reason);

    res.json({
        success: true,
        message: 'Servian blocked successfully',
        data: { servianId, reason }
    });
});

// @desc    Unblock servian
// @route   DELETE /api/customer/block/:servianId
// @access  Private (Customer only)
export const unblockServian = asyncHandler(async (req, res) => {
    const { servianId } = req.params;

    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    await customer.unblockServian(servianId);

    res.json({
        success: true,
        message: 'Servian unblocked successfully',
        data: { servianId }
    });
});

// @desc    Manage addresses
// @route   POST /api/customer/addresses
// @access  Private (Customer only)
export const addAddress = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    const addressData = req.body;
    await customer.addAddress(addressData);

    res.status(201).json({
        success: true,
        message: 'Address added successfully',
        data: customer.addresses
    });
});

// @desc    Update address
// @route   PUT /api/customer/addresses/:addressId
// @access  Private (Customer only)
export const updateAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;
    const updateData = req.body;

    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    await customer.updateAddress(addressId, updateData);

    res.json({
        success: true,
        message: 'Address updated successfully',
        data: customer.addresses
    });
});

// @desc    Delete address
// @route   DELETE /api/customer/addresses/:addressId
// @access  Private (Customer only)
export const deleteAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;

    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    await customer.deleteAddress(addressId);

    res.json({
        success: true,
        message: 'Address deleted successfully',
        data: customer.addresses
    });
});