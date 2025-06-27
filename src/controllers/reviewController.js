import Review from '../models/reviewModel.js';
import ServiceRequest from '../models/ServiceRequest.js';
import Servian from '../models/Servian.js';
import Notification from '../models/notificationModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Add review to servian after service request completion
// @route   POST /api/customer/service-requests/:id/review
// @access  Private (Customer only)
export const addServiceRequestReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  const serviceRequest = await ServiceRequest.findById(id)
    .populate('awardedBid.servian', 'id name');
  
  if (!serviceRequest) {
    res.status(404);
    throw new Error('Service request not found');
  }

  if (serviceRequest.status !== 'COMPLETED') {
    res.status(400);
    throw new Error('Only completed requests can be reviewed');
  }

  if (serviceRequest.reviewed) {
    res.status(400);
    throw new Error('This request has already been reviewed');
  }

  if (!serviceRequest.awardedBid || !serviceRequest.awardedBid.servian) {
    res.status(400);
    throw new Error('No servian awarded for this request');
  }

  // Update service request with review
  serviceRequest.reviewed = true;
  serviceRequest.review = {
    rating,
    comment,
    createdAt: new Date()
  };
  
  await serviceRequest.save();

  // Create separate review document
  const review = new Review({
    serviceRequest: serviceRequest._id,
    author: req.user.id,
    target: serviceRequest.awardedBid.servian._id,
    role: 'customer_to_servian',
    rating,
    comment
  });

  await review.save();

  // Update servian's average rating
  const servian = await Servian.findById(serviceRequest.awardedBid.servian._id);
  const allReviews = await Review.find({
    target: servian._id,
    role: 'customer_to_servian'
  });

  const totalRating = allReviews.reduce((sum, rev) => sum + rev.rating, 0);
  servian.averageRating = totalRating / allReviews.length;
  servian.totalReviews = allReviews.length;
  await servian.save();

  // Create notification for servian
  await Notification.create({
    user: servian._id,
    type: 'new_review',
    title: 'New Review',
    message: `You received a ${rating}-star review from ${req.user.name}`,
    data: { 
      reviewId: review._id,
      serviceRequestId: serviceRequest._id
    }
  });

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    data: review
  });
});