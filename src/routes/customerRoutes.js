import express from 'express';
import {
  getDashboardData,
  updateProfile,
  getBookings,
  createBooking,
  cancelBooking,
  createReview,
  getReviews,
  searchServians,
  getServianDetails,
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  blockServian,
  unblockServian,
  addAddress,
  updateAddress,
  deleteAddress,
  updateBooking
} from '../controllers/customerController.js';
import {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestDetails,
  updateServiceRequest,
  cancelServiceRequest,
  acceptBid,
  markCompleted,
  getRequestStats,
  getRequestLimits
} from '../controllers/serviceRequestController.js';

import { addServiceRequestReview } from '../controllers/reviewController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Middleware to protect and authorize customers
router.use(protect, authorizeRoles("customer"));

// Dashboard & Profile
router.get('/dashboard', getDashboardData);
router.put('/profile', updateProfile);
router.get('/service-requests/limits', getRequestLimits);
router.post(
  '/service-requests/:id/review', addServiceRequestReview
);
// Bookings
router.get('/bookings', getBookings);
router.post('/bookings', createBooking);
router.put('/bookings/:id/cancel', cancelBooking);

// Reviews
router.post('/reviews', createReview);
router.get('/reviews', getReviews);

// Servians
router.get('/search/servians', searchServians);
router.get('/servians/:id', getServianDetails);
router.put('/bookings/:id', updateBooking);

// Favorites
router.post('/favorites/:servianId', addToFavorites);
router.delete('/favorites/:servianId', removeFromFavorites);
router.get('/favorites', getFavorites);


// Blocking
router.post('/block/:servianId', blockServian);
router.delete('/block/:servianId', unblockServian);

// Addresses
router.post('/addresses', addAddress);
router.put('/addresses/:addressId', updateAddress);
router.delete('/addresses/:addressId', deleteAddress);



// @route   POST /api/customer/service-requests
// @desc    Create new service request
router.post('/service-requests', createServiceRequest);

// @route   GET /api/customer/service-requests
// @desc    Get customer's service requests with pagination and filtering
router.get('/service-requests', getServiceRequests);

// @route   GET /api/customer/service-requests/stats
// @desc    Get service request statistics for customer
router.get('/service-requests/stats', getRequestStats);

// @route   GET /api/customer/service-requests/:id
// @desc    Get single service request details
router.get('/service-requests/:id', getServiceRequestDetails);

// @route   PUT /api/customer/service-requests/:id
// @desc    Update service request
router.put('/service-requests/:id', updateServiceRequest);

// @route   PUT /api/customer/service-requests/:id/cancel
// @desc    Cancel service request
router.put('/service-requests/:id/cancel', cancelServiceRequest);

// @route   PUT /api/customer/service-requests/:id/accept-bid/:bidId
// @desc    Accept bid on service request
router.put('/service-requests/:id/accept-bid/:bidId', acceptBid);

// @route   PUT /api/customer/service-requests/:id/complete
// @desc    Mark service request as completed
router.put('/service-requests/:id/complete', markCompleted);

export default router;
