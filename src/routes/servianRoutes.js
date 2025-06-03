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
  markNotificationRead
} from '../controllers/servianController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Protect and restrict to servian users only
router.use(protect, authorizeRoles("servian"));

// Dashboard
router.get('/dashboard', getDashboardData);

// Profile
router.put('/profile', updateProfile);

// Availability
router.put('/availability', updateAvailability);

// Earnings
router.get('/earnings', getEarnings);

// Reviews
router.get('/reviews', getReviews);

// Bookings
router.get('/bookings', getBookings);
router.put('/bookings/:id/status', updateBookingStatus);

// Notifications
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationRead);

export default router;
