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
  deleteAddress
} from '../controllers/customerController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Middleware to protect and authorize customers
router.use(protect, authorizeRoles("customer"));

// Dashboard & Profile
router.get('/dashboard', getDashboardData);
router.put('/profile', updateProfile);

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

export default router;
