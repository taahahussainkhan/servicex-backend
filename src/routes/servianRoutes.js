import express from 'express';
import {
  getDashboardData,
  updateProfile,
  updateAvailability,
  getEarnings,
  getReviews,
  getBookings,
  updateBookingStatus,
  getNotifications,
  markNotificationRead,
  uploadProfileImage,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  
} from '../controllers/servianController.js';
import {
  getAvailableRequests,
  getNearbyRequests,
  getRequestDetails,
  placeBid,
  updateBid,
  withdrawBid,
  getBidHistory,
  getAwardedJobs,
  getServianStats,
} from '../controllers/servianRequestController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Protect and restrict to servian users only
router.use(protect, authorizeRoles("servian"));
router.get('/dashboard', getDashboardData);
router.put('/profile', updateProfile);
router.put('/availability', updateAvailability);
router.get('/earnings', getEarnings);
router.get('/reviews', getReviews);
router.get('/bookings', getBookings);
router.put('/bookings/:id/status', updateBookingStatus);

// Notifications
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationRead);


// Service request routes
router.get('/service-requests', getAvailableRequests);
router.get('/service-requests/nearby', getNearbyRequests);
router.get('/service-requests/:id', getRequestDetails);

// Bidding routes
router.post('/service-requests/:id/bid', placeBid);
router.put('/service-requests/:id/bid', updateBid);
router.delete('/service-requests/:id/bid', withdrawBid);


// Profile and portfolio management routes
router.post('/profile/image', upload.single('profileImage'), uploadProfileImage);
router.post('/portfolio', upload.array('images', 5), addPortfolioItem); // Max 5 images
router.put('/portfolio/:itemId', updatePortfolioItem);
router.delete('/portfolio/:itemId', deletePortfolioItem);

// History and job management routes
router.get('/bids', getBidHistory);
router.get('/jobs', getAwardedJobs);
router.get('/stats', getServianStats);

export default router;
