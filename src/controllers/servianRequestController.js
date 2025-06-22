// controllers/servianRequestController.js
import ServiceRequest from '../models/ServiceRequest.js';
import Servian from '../models/Servian.js';
import Customer from '../models/Customer.js';
import Notification from '../models/notificationModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Get available service requests for servians
// @route   GET /api/servian/service-requests
// @access  Private (Servian only)
export const getAvailableRequests = asyncHandler(async (req, res) => {
    const { 
        category, 
        urgency, 
        budgetMin, 
        budgetMax,
        city,
        area,
        page = 1, 
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    const servian = await Servian.findById(req.user.id);
    if (!servian) {
        res.status(404);
        throw new Error('Servian not found');
    }

    // Build query
    const query = { status: 'ACTIVE' };

    // Filter by service category - match with servian's service categories
    if (category) {
        query.serviceCategory = category;
    } else if (servian.serviceCategory && servian.serviceCategory.length > 0) {
        // Show requests that match servian's service categories
        query.serviceCategory = { $in: servian.serviceCategory };
    }

    // Filter by urgency
    if (urgency) {
        query.urgency = urgency;
    }

    // Filter by budget range
    if (budgetMin || budgetMax) {
        query['budget.max'] = {};
        if (budgetMin) query['budget.max'].$gte = Number(budgetMin);
        if (budgetMax) query['budget.min'] = { $lte: Number(budgetMax) };
    }

    // Filter by location
    if (city) {
        query['location.city'] = new RegExp(city, 'i');
    }
    if (area) {
        query['location.area'] = new RegExp(area, 'i');
    }

    // Exclude requests where this servian has already bid
    query['bids.servian'] = { $ne: req.user.id };

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const totalRequests = await ServiceRequest.countDocuments(query);
    const requests = await ServiceRequest.find(query)
        .populate('customer', 'name profileImage customerTier averageRating totalReviews')
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(Number(limit));

    const pagination = {
        currentPage: Number(page),
        totalPages: Math.ceil(totalRequests / limit),
        totalRequests,
        hasNext: page * limit < totalRequests,
        hasPrev: page > 1
    };

    res.json({ 
        success: true, 
        data: { 
            requests, 
            pagination 
        } 
    });
});

// @desc    Get nearby service requests using geolocation
// @route   GET /api/servian/service-requests/nearby
// @access  Private (Servian only)
export const getNearbyRequests = asyncHandler(async (req, res) => {
    const { longitude, latitude, radius = 10, category, urgency } = req.query;

    if (!longitude || !latitude) {
        res.status(400);
        throw new Error('Longitude and latitude are required');
    }

    const servian = await Servian.findById(req.user.id);
    if (!servian) {
        res.status(404);
        throw new Error('Servian not found');
    }

    const filters = {};
    if (category) filters.category = category;
    if (urgency) filters.urgency = urgency;

    const requests = await ServiceRequest.findNearbyRequests(
        Number(longitude), 
        Number(latitude), 
        Number(radius),
        filters
    );

    // Filter out requests where this servian has already bid
    const availableRequests = requests.filter(request => 
        !request.bids.some(bid => bid.servian.toString() === req.user.id.toString())
    );

    res.json({
        success: true,
        data: {
            requests: availableRequests,
            location: { longitude: Number(longitude), latitude: Number(latitude) },
            radius: Number(radius)
        }
    });
});

// @desc    Get single service request details for servians
// @route   GET /api/servian/service-requests/:id
// @access  Private (Servian only)
export const getRequestDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const request = await ServiceRequest.findOne({
        _id: id,
        status: 'ACTIVE'
    })
        .populate('customer', 'name profileImage customerTier averageRating totalReviews memberSince')
        .populate('bids.servian', 'name profileImage averageRating');

    if (!request) {
        res.status(404);
        throw new Error('Service request not found or no longer available');
    }

    // Check if servian has already bid
    const existingBid = request.bids.find(
        bid => bid.servian._id.toString() === req.user.id.toString()
    );

    // Increment views
    await request.incrementViews();

    res.json({ 
        success: true, 
        data: {
            ...request.toObject(),
            hasUserBid: !!existingBid,
            userBid: existingBid || null
        }
    });
});

// @desc    Place a bid on service request
// @route   POST /api/servian/service-requests/:id/bid
// @access  Private (Servian only)
export const placeBid = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        amount,
        message,
        estimatedDuration,
        materials,
        proposedDate
    } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
        res.status(400);
        throw new Error('Valid bid amount is required');
    }

    const servian = await Servian.findById(req.user.id);
    if (!servian) {
        res.status(404);
        throw new Error('Servian not found');
    }

    const request = await ServiceRequest.findOne({
        _id: id,
        status: 'ACTIVE'
    });

    if (!request) {
        res.status(404);
        throw new Error('Service request not found or no longer accepting bids');
    }

    // Check if servian has required service category
    if (servian.serviceCategory && servian.serviceCategory.length > 0) {
        if (!servian.serviceCategory.includes(request.serviceCategory)) {
            res.status(400);
            throw new Error('This service request is outside your service categories');
        }
    }

    // Validate bid amount is within budget range
    if (amount < request.budget.min || amount > request.budget.max) {
        res.status(400);
        throw new Error(`Bid amount must be between PKR ${request.budget.min} and PKR ${request.budget.max}`);
    }

    // Validate proposed date
    if (proposedDate) {
        const proposed = new Date(proposedDate);
        const preferred = new Date(request.preferredDate);
        const today = new Date();
        
        if (proposed < today) {
            res.status(400);
            throw new Error('Proposed date cannot be in the past');
        }
    }

    const bidData = {
        servian: req.user.id,
        amount: Number(amount),
        message: message || '',
        estimatedDuration: estimatedDuration || '',
        materials: materials || [],
        proposedDate: proposedDate ? new Date(proposedDate) : null
    };

    try {
        await request.addBid(bidData);

        // Create notification for customer
        await Notification.create({
            user: request.customer,
            type: 'new_bid',
            title: 'New Bid Received',
            message: `${servian.name} placed a bid of PKR ${amount.toLocaleString()} on your request "${request.title}"`,
            data: { 
                requestId: request._id, 
                servianId: req.user.id,
                bidAmount: amount 
            }
        });

        const updatedRequest = await ServiceRequest.findById(request._id)
            .populate('customer', 'name profileImage customerTier')
            .populate('bids.servian', 'name profileImage averageRating phone');

        res.status(201).json({
            success: true,
            message: 'Bid placed successfully',
            data: updatedRequest
        });

    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
});

// @desc    Update servian's bid on service request
// @route   PUT /api/servian/service-requests/:id/bid
// @access  Private (Servian only)
export const updateBid = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const request = await ServiceRequest.findOne({
        _id: id,
        status: 'ACTIVE'
    });

    if (!request) {
        res.status(404);
        throw new Error('Service request not found or no longer accepting bids');
    }

    // Validate bid amount if being updated
    if (updateData.amount) {
        if (updateData.amount <= 0) {
            res.status(400);
            throw new Error('Valid bid amount is required');
        }
        
        if (updateData.amount < request.budget.min || updateData.amount > request.budget.max) {
            res.status(400);
            throw new Error(`Bid amount must be between PKR ${request.budget.min} and PKR ${request.budget.max}`);
        }
    }

    // Validate proposed date if being updated
    if (updateData.proposedDate) {
        const proposed = new Date(updateData.proposedDate);
        const today = new Date();
        
        if (proposed < today) {
            res.status(400);
            throw new Error('Proposed date cannot be in the past');
        }
    }

    try {
        await request.updateBid(req.user.id, updateData);

        // Create notification for customer about bid update
        if (updateData.amount) {
            const servian = await Servian.findById(req.user.id);
            await Notification.create({
                user: request.customer,
                type: 'bid_updated',
                title: 'Bid Updated',
                message: `${servian.name} updated their bid to PKR ${updateData.amount.toLocaleString()} on your request "${request.title}"`,
                data: { 
                    requestId: request._id, 
                    servianId: req.user.id,
                    newBidAmount: updateData.amount 
                }
            });
        }

        const updatedRequest = await ServiceRequest.findById(request._id)
            .populate('customer', 'name profileImage customerTier')
            .populate('bids.servian', 'name profileImage averageRating phone');

        res.json({
            success: true,
            message: 'Bid updated successfully',
            data: updatedRequest
        });

    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
});

// @desc    Withdraw bid from service request
// @route   DELETE /api/servian/service-requests/:id/bid
// @access  Private (Servian only)
export const withdrawBid = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const request = await ServiceRequest.findOne({
        _id: id,
        status: 'ACTIVE'
    });

    if (!request) {
        res.status(404);
        throw new Error('Service request not found');
    }

    const bidIndex = request.bids.findIndex(
        bid => bid.servian.toString() === req.user.id.toString()
    );

    if (bidIndex === -1) {
        res.status(404);
        throw new Error('Bid not found');
    }

    const bid = request.bids[bidIndex];
    if (bid.status !== 'PENDING') {
        res.status(400);
        throw new Error('Cannot withdraw bid with current status');
    }

    // Remove the bid
    request.bids.splice(bidIndex, 1);
    request.totalBids = request.bids.length;
    await request.save();

    // Create notification for customer
    const servian = await Servian.findById(req.user.id);
    await Notification.create({
        user: request.customer,
        type: 'bid_withdrawn',
        title: 'Bid Withdrawn',
        message: `${servian.name} has withdrawn their bid from your request "${request.title}"`,
        data: { 
            requestId: request._id, 
            servianId: req.user.id
        }
    });

    res.json({
        success: true,
        message: 'Bid withdrawn successfully',
        data: { requestId: id }
    });
});

// @desc    Get servian's bid history
// @route   GET /api/servian/bids
// @access  Private (Servian only)
export const getBidHistory = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query;

    // Build match query for aggregation
    const matchQuery = {
        'bids.servian': req.user.id
    };

    if (status) {
        matchQuery['bids.status'] = status;
    }

    const pipeline = [
        { $match: matchQuery },
        { $unwind: '$bids' },
        { $match: { 'bids.servian': req.user.id } },
        ...(status ? [{ $match: { 'bids.status': status } }] : []),
        {
            $lookup: {
                from: 'users',
                localField: 'customer',
                foreignField: '_id',
                as: 'customer'
            }
        },
        { $unwind: '$customer' },
        {
            $project: {
                _id: 1,
                title: 1,
                serviceCategory: 1,
                status: 1,
                budget: 1,
                location: 1,
                createdAt: 1,
                'customer.name': 1,
                'customer.profileImage': 1,
                'customer.customerTier': 1,
                bid: '$bids'
            }
        },
        { $sort: { 'bid.submittedAt': -1 } },
        { $skip: (page - 1) * limit },
        { $limit: Number(limit) }
    ];

    const bids = await ServiceRequest.aggregate(pipeline);

    // Get total count for pagination
    const countPipeline = [
        { $match: matchQuery },
        { $unwind: '$bids' },
        { $match: { 'bids.servian': req.user.id } },
        ...(status ? [{ $match: { 'bids.status': status } }] : []),
        { $count: 'total' }
    ];

    const countResult = await ServiceRequest.aggregate(countPipeline);
    const totalBids = countResult.length > 0 ? countResult[0].total : 0;

    const pagination = {
        currentPage: Number(page),
        totalPages: Math.ceil(totalBids / limit),
        totalBids,
        hasNext: page * limit < totalBids,
        hasPrev: page > 1
    };

    res.json({
        success: true,
        data: {
            bids,
            pagination
        }
    });
});

// @desc    Get servian's awarded jobs
// @route   GET /api/servian/jobs
// @access  Private (Servian only)
export const getAwardedJobs = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { awardedBid: req.user.id };
    
    if (status) {
        query.status = status;
    } else {
        query.status = { $in: ['AWARDED', 'COMPLETED'] };
    }

    const totalJobs = await ServiceRequest.countDocuments(query);
    const jobs = await ServiceRequest.find(query)
        .populate('customer', 'name profileImage customerTier phone email')
        .populate('awardedBid', 'name profileImage phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

    const pagination = {
        currentPage: Number(page),
        totalPages: Math.ceil(totalJobs / limit),
        totalJobs,
        hasNext: page * limit < totalJobs,
        hasPrev: page > 1
    };

    res.json({
        success: true,
        data: {
            jobs,
            pagination
        }
    });
});

// @desc    Get servian statistics
// @route   GET /api/servian/stats
// @access  Private (Servian only)
export const getServianStats = asyncHandler(async (req, res) => {
    const servianId = req.user.id;

    // Get bid statistics
    const bidStats = await ServiceRequest.aggregate([
        { $unwind: '$bids' },
        { $match: { 'bids.servian': servianId } },
        {
            $group: {
                _id: '$bids.status',
                count: { $sum: 1 }
            }
        }
    ]);

    // Get job statistics
    const jobStats = await ServiceRequest.aggregate([
        { $match: { awardedBid: servianId } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    // Format statistics
    const formattedStats = {
        bids: {
            total: 0,
            pending: 0,
            accepted: 0,
            rejected: 0,
            withdrawn: 0
        },
        jobs: {
            total: 0,
            awarded: 0,
            completed: 0
        }
    };

    bidStats.forEach(stat => {
        formattedStats.bids.total += stat.count;
        formattedStats.bids[stat._id.toLowerCase()] = stat.count;
    });

    jobStats.forEach(stat => {
        formattedStats.jobs.total += stat.count;
        formattedStats.jobs[stat._id.toLowerCase()] = stat.count;
    });

    res.json({ 
        success: true, 
        data: formattedStats 
    });
});