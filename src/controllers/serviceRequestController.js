// controllers/serviceRequestController.js
import ServiceRequest from '../models/ServiceRequest.js';
import Customer from '../models/Customer.js';
import Servian from '../models/Servian.js';
import Notification from '../models/notificationModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Create new service request
// @route   POST /api/customer/service-requests
// @access  Private (Customer only)
export const createServiceRequest = asyncHandler(async (req, res) => {
    const {
        title,
        description,
        serviceCategory,
        location,
        budget,
        urgency,
        preferredDate,
        images
    } = req.body;

    const customer = await Customer.findById(req.user.id);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    // Validate budget
    if (budget.min >= budget.max) {
        res.status(400);
        throw new Error('Maximum budget must be greater than minimum budget');
    }

    // Create service request
    const serviceRequest = await ServiceRequest.create({
        customer: req.user.id,
        title,
        description,
        serviceCategory,
        location,
        budget,
        urgency: urgency || 'MEDIUM',
        preferredDate,
        images: images || []
    });

    // Add to customer's service requests
    customer.serviceRequests.push(serviceRequest._id);
    await customer.save();

    const populatedRequest = await ServiceRequest.findById(serviceRequest._id)
        .populate('customer', 'name profileImage customerTier');

    res.status(201).json({
        success: true,
        message: 'Service request created successfully',
        data: populatedRequest
    });
});

// @desc    Get customer's service requests
// @route   GET /api/customer/service-requests
// @access  Private (Customer only)
export const getServiceRequests = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { customer: req.user.id };
    if (status) query.status = status;

    const totalRequests = await ServiceRequest.countDocuments(query);
    const requests = await ServiceRequest.find(query)
        .populate('bids.servian', 'name profileImage averageRating phone serviceCategory')
        .populate('awardedBid', 'name profileImage phone')
        .sort({ createdAt: -1 })
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

// @desc    Get single service request details
// @route   GET /api/customer/service-requests/:id
// @access  Private (Customer only)
export const getServiceRequestDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const request = await ServiceRequest.findOne({
        _id: id,
        customer: req.user.id
    })
        .populate('customer', 'name profileImage customerTier')
        .populate('bids.servian', 'name profileImage averageRating phone serviceCategory experienceYears')
        .populate('awardedBid', 'name profileImage phone');

    if (!request) {
        res.status(404);
        throw new Error('Service request not found');
    }

    res.json({ success: true, data: request });
});

// @desc    Update service request
// @route   PUT /api/customer/service-requests/:id
// @access  Private (Customer only)
export const updateServiceRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const request = await ServiceRequest.findOne({
        _id: id,
        customer: req.user.id
    });

    if (!request) {
        res.status(404);
        throw new Error('Service request not found');
    }

    // Only allow updates on active requests with no bids
    if (request.status !== 'ACTIVE' || request.totalBids > 0) {
        res.status(400);
        throw new Error('Cannot update request with current status or existing bids');
    }

    // Update allowed fields
    const allowedFields = ['title', 'description', 'budget', 'urgency', 'preferredDate', 'images'];
    allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
            request[field] = updateData[field];
        }
    });

    // Validate budget if updated
    if (updateData.budget && updateData.budget.min >= updateData.budget.max) {
        res.status(400);
        throw new Error('Maximum budget must be greater than minimum budget');
    }

    const updatedRequest = await request.save();

    res.json({
        success: true,
        message: 'Service request updated successfully',
        data: updatedRequest
    });
});

// @desc    Cancel service request
// @route   PUT /api/customer/service-requests/:id/cancel
// @access  Private (Customer only)
export const cancelServiceRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const request = await ServiceRequest.findOne({
        _id: id,
        customer: req.user.id
    });

    if (!request) {
        res.status(404);
        throw new Error('Service request not found');
    }

    if (!['ACTIVE', 'AWARDED'].includes(request.status)) {
        res.status(400);
        throw new Error('Cannot cancel request with current status');
    }

    request.status = 'CANCELLED';
    request.cancelledAt = new Date();
    if (reason) {
        request.description += `\n\nCancellation reason: ${reason}`;
    }

    await request.save();

    // Notify servians who placed bids
    const bidders = request.bids.map(bid => bid.servian);
    for (const servianId of bidders) {
        await Notification.create({
            user: servianId,
            type: 'request_cancelled',
            title: 'Service Request Cancelled',
            message: `The service request "${request.title}" has been cancelled by the customer`,
            data: { requestId: request._id }
        });
    }

    res.json({
        success: true,
        message: 'Service request cancelled successfully',
        data: { requestId: id, status: 'CANCELLED' }
    });
});

// @desc    Accept bid on service request
// @route   PUT /api/customer/service-requests/:id/accept-bid/:bidId
// @access  Private (Customer only)
export const acceptBid = asyncHandler(async (req, res) => {
    const { id, bidId } = req.params;

    const request = await ServiceRequest.findOne({
        _id: id,
        customer: req.user.id,
        status: 'ACTIVE'
    });

    if (!request) {
        res.status(404);
        throw new Error('Active service request not found');
    }

    const bid = request.bids.id(bidId);
    if (!bid) {
        res.status(404);
        throw new Error('Bid not found');
    }

    if (bid.status !== 'PENDING') {
        res.status(400);
        throw new Error('Bid is no longer available');
    }

    // Accept the bid
    await request.acceptBid(bidId);

    // Create notification for accepted servian
    await Notification.create({
        user: bid.servian,
        type: 'bid_accepted',
        title: 'Bid Accepted!',
        message: `Your bid for "${request.title}" has been accepted`,
        data: { requestId: request._id, bidId: bid._id }
    });

    // Create notifications for rejected servians
    const rejectedBids = request.bids.filter(
        b => b._id.toString() !== bidId.toString()
    );
    
    for (const rejectedBid of rejectedBids) {
        await Notification.create({
            user: rejectedBid.servian,
            type: 'bid_rejected',
            title: 'Bid Not Selected',
            message: `Your bid for "${request.title}" was not selected`,
            data: { requestId: request._id, bidId: rejectedBid._id }
        });
    }

    const updatedRequest = await ServiceRequest.findById(request._id)
        .populate('bids.servian', 'name profileImage phone')
        .populate('awardedBid', 'name profileImage phone');

    res.json({
        success: true,
        message: 'Bid accepted successfully',
        data: updatedRequest
    });
});

// @desc    Mark service request as completed
// @route   PUT /api/customer/service-requests/:id/complete
// @access  Private (Customer only)
export const markCompleted = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const request = await ServiceRequest.findOne({
        _id: id,
        customer: req.user.id,
        status: 'AWARDED'
    });

    if (!request) {
        res.status(404);
        throw new Error('Awarded service request not found');
    }

    request.status = 'COMPLETED';
    request.completedAt = new Date();
    await request.save();

    // Create notification for servian
    await Notification.create({
        user: request.awardedBid,
        type: 'service_completed',
        title: 'Service Marked Complete',
        message: `The service "${request.title}" has been marked as completed`,
        data: { requestId: request._id }
    });

    res.json({
        success: true,
        message: 'Service request marked as completed',
        data: { requestId: id, status: 'COMPLETED' }
    });
});

// @desc    Get service request statistics for customer
// @route   GET /api/customer/service-requests/stats
// @access  Private (Customer only)
export const getRequestStats = asyncHandler(async (req, res) => {
    const customerId = req.user.id;

    const stats = await ServiceRequest.aggregate([
        { $match: { customer: customerId } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalBids: { $sum: '$totalBids' }
            }
        }
    ]);

    const formattedStats = {
        total: 0,
        active: 0,
        awarded: 0,
        completed: 0,
        cancelled: 0,
        closed: 0,
        totalBidsReceived: 0
    };

    stats.forEach(stat => {
        formattedStats.total += stat.count;
        formattedStats.totalBidsReceived += stat.totalBids;
        formattedStats[stat._id.toLowerCase()] = stat.count;
    });

    res.json({ success: true, data: formattedStats });
});