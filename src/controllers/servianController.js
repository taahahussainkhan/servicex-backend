import Servian from '../models/Servian.js';
import Customer from '../models/Customer.js'; // Add this import
import asyncHandler from 'express-async-handler';
import Booking from '../models/bookingModel.js';
import Review from '../models/reviewModel.js';
import Notification from '../models/notificationModel.js';
import ServiceRequest from '../models/ServiceRequest.js'
import jwt from 'jsonwebtoken';

// @desc    Get servian dashboard data
// @route   GET /api/servian/dashboard
// @access  Private (Servian only)
export const getDashboardData = asyncHandler(async (req, res) => {
  const servian = await Servian.findById(req.user.id).select('-password -otp -otpExpires');

  if (!servian) {
    res.status(404);
    throw new Error('Servian not found');
  }

  const dashboardData = {
    profile: {
      name: servian.name,
      email: servian.email,
      phone: servian.phone,
      profileImage: servian.profileImage,
      location: servian.location,
      isVerified: servian.isVerified,
      rating: servian.averageRating,
      totalReviews: servian.totalReviews,
      experienceYears: servian.experienceYears,
      skills: servian.skills,
      serviceCategory: servian.serviceCategory,
      availability: servian.availability,
      profileCompleteness: servian.profileCompleteness,
      bio: servian.bio,
      languages: servian.languages,
      certifications: servian.certifications,
      portfolio: servian.portfolio
    },
    stats: {
      completedJobs: servian.jobStats.completedJobs,
      totalEarnings: servian.totalEarnings,
      monthlyEarnings: servian.monthlyEarnings,
      responseTime: servian.performance.responseTime,
      completionRate: servian.performance.completionRate,
      customerSatisfaction: servian.performance.customerSatisfaction
    },
    availability: servian.availability,
    pricing: servian.pricing
  };

  res.json({ success: true, data: dashboardData });
});

// @desc    Update servian profile
// @route   PUT /api/servian/profile
// @access  Private (Servian only)
export const updateProfile = asyncHandler(async (req, res) => {
  const servian = await Servian.findById(req.user.id);

  if (!servian) {
    res.status(404);
    throw new Error('Servian not found');
  }

  const {
    name,
    phone,
    location,
    experienceYears,
    skills,
    serviceCategory,
    availableForHomeVisit,
    serviceRadius,
    pricing,
    availability,
    certifications,
    equipment,
    emergencyService,
    bio,
    specializations,
    languages
  } = req.body;

  // Update all allowed fields
  if (name) servian.name = name;
  if (phone) servian.phone = phone;

  // Handle location properly
  if (location) {
    if (typeof location === "string") {
      // If location is a string, parse it or store as is
      servian.location = location;
    } else if (typeof location === "object") {
      servian.location = {
        area: location.area || "",
        street: location.street || "",
        city: location.city || ""
      };
    }
  }

  if (experienceYears !== undefined) servian.experienceYears = experienceYears;
  if (skills) servian.skills = skills;
  if (serviceCategory) servian.serviceCategory = serviceCategory;
  if (availableForHomeVisit !== undefined) servian.availableForHomeVisit = availableForHomeVisit;
  if (serviceRadius) servian.serviceRadius = serviceRadius;
  if (pricing) servian.pricing = { ...servian.pricing, ...pricing };

  // Handle availability update
  if (availability) {
    servian.availability = { ...servian.availability, ...availability };
  }

  if (certifications) servian.certifications = certifications;
  if (equipment) servian.equipment = equipment;
  if (emergencyService) servian.emergencyService = { ...servian.emergencyService, ...emergencyService };
  if (bio) servian.bio = bio;
  if (specializations) servian.specializations = specializations;
  if (languages) servian.languages = languages;

  // Calculate and update profile completeness
  servian.profileCompleteness = calculateProfileCompleteness(servian);

  const updatedServian = await servian.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      name: updatedServian.name,
      phone: updatedServian.phone,
      location: updatedServian.location,
      experienceYears: updatedServian.experienceYears,
      skills: updatedServian.skills,
      serviceCategory: updatedServian.serviceCategory,
      availableForHomeVisit: updatedServian.availableForHomeVisit,
      serviceRadius: updatedServian.serviceRadius,
      pricing: updatedServian.pricing,
      availability: updatedServian.availability,
      bio: updatedServian.bio,
      specializations: updatedServian.specializations,
      languages: updatedServian.languages,
      certifications: updatedServian.certifications,
      profileCompleteness: updatedServian.profileCompleteness
    }
  });
});


export const uploadProfileImage = asyncHandler(async (req, res) => {
  const servian = await Servian.findById(req.user.id);

  if (!servian) {
    res.status(404);
    throw new Error('Servian not found');
  }

  if (!req.file?.path) {
    res.status(400);
    throw new Error('No image file provided');
  }

  servian.profileImage = req.file.path;

  servian.profileCompleteness = calculateProfileCompleteness(servian);
  await servian.save();

  res.json({
    success: true,
    message: 'Profile image updated successfully',
    data: {
      profileImage: servian.profileImage,
    },
  });
});



// @desc    Add portfolio item
// @route   POST /api/servian/portfolio
// @access  Private (Servian only)
export const addPortfolioItem = asyncHandler(async (req, res) => {
  const servian = await Servian.findById(req.user.id);

  if (!servian) {
    res.status(404);
    throw new Error('Servian not found');
  }

  const { title, description, category, completionDate } = req.body;
  const images = req.files || []; // Assuming multiple file upload

  if (!title || !description) {
    res.status(400);
    throw new Error('Title and description are required');
  }

  const portfolioItem = {
    title,
    description,
    category: category || 'general',
    images: images.map(file => file.path || file.filename),
    completionDate: completionDate ? new Date(completionDate) : new Date(),
    createdAt: new Date()
  };

  // Initialize portfolio array if it doesn't exist
  if (!servian.portfolio) {
    servian.portfolio = [];
  }

  servian.portfolio.push(portfolioItem);
  await servian.save();

  res.json({
    success: true,
    message: 'Portfolio item added successfully',
    data: portfolioItem
  });
});



// @desc    Update portfolio item
// @route   PUT /api/servian/portfolio/:itemId
// @access  Private (Servian only)
export const updatePortfolioItem = asyncHandler(async (req, res) => {
  const servian = await Servian.findById(req.user.id);
  const { itemId } = req.params;

  if (!servian) {
    res.status(404);
    throw new Error('Servian not found');
  }

  const portfolioItemIndex = servian.portfolio?.findIndex(
    item => item._id.toString() === itemId
  );

  if (portfolioItemIndex === -1) {
    res.status(404);
    throw new Error('Portfolio item not found');
  }

  const { title, description, category } = req.body;

  // Update the portfolio item
  if (title) servian.portfolio[portfolioItemIndex].title = title;
  if (description) servian.portfolio[portfolioItemIndex].description = description;
  if (category) servian.portfolio[portfolioItemIndex].category = category;

  await servian.save();

  res.json({
    success: true,
    message: 'Portfolio item updated successfully',
    data: servian.portfolio[portfolioItemIndex]
  });
});

// @desc    Delete portfolio item
// @route   DELETE /api/servian/portfolio/:itemId
// @access  Private (Servian only)
export const deletePortfolioItem = asyncHandler(async (req, res) => {
  const servian = await Servian.findById(req.user.id);
  const { itemId } = req.params;

  if (!servian) {
    res.status(404);
    throw new Error('Servian not found');
  }

  if (!servian.portfolio) {
    res.status(404);
    throw new Error('No portfolio found');
  }

  servian.portfolio = servian.portfolio.filter(
    item => item._id.toString() !== itemId
  );

  await servian.save();

  res.json({
    success: true,
    message: 'Portfolio item deleted successfully'
  });
});

// @desc    Update availability status
// @route   PUT /api/servian/availability
// @access  Private (Servian only)
export const updateAvailability = asyncHandler(async (req, res) => {
  const servian = await Servian.findById(req.user.id);

  if (!servian) {
    res.status(404);
    throw new Error('Servian not found');
  }

  const { status, workingHours, workingDays } = req.body;

  if (status) {
    if (!['AVAILABLE', 'BUSY', 'OFFLINE'].includes(status)) {
      res.status(400);
      throw new Error('Invalid availability status');
    }
    servian.availability.status = status;
  }

  if (workingHours) {
    servian.availability.workingHours = { ...servian.availability.workingHours, ...workingHours };
  }

  if (workingDays) {
    servian.availability.workingDays = workingDays;
  }

  await servian.save();

  res.json({
    success: true,
    message: 'Availability updated successfully',
    data: servian.availability
  });
});

// @desc    Get servian earnings
// @route   GET /api/servian/earnings
// @access  Private (Servian only)
export const getEarnings = asyncHandler(async (req, res) => {
  const servian = await Servian.findById(req.user.id).select('totalEarnings monthlyEarnings jobStats');

  if (!servian) {
    res.status(404);
    throw new Error('Servian not found');
  }

  const earnings = {
    totalEarnings: servian.totalEarnings,
    monthlyEarnings: servian.monthlyEarnings,
    completedJobs: servian.jobStats.completedJobs,
    averageJobValue: servian.jobStats.completedJobs > 0 ?
      Math.round(servian.totalEarnings / servian.jobStats.completedJobs) : 0,
    monthlyBreakdown: servian.monthlyEarningsBreakdown || []
  };

  res.json({ success: true, data: earnings });
});

// @desc    Get servian reviews
// @route   GET /api/servian/reviews
// @access  Private (Servian only)
export const getReviews = asyncHandler(async (req, res) => {
  const servian = await Servian.findById(req.user.id).select('averageRating totalReviews');

  if (!servian) {
    res.status(404);
    throw new Error('Servian not found');
  }

  const reviews = await Review.find({ servian: req.user.id })
    .populate('customer', 'name profileImage') // Populate customer details
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      averageRating: servian.averageRating,
      totalReviews: servian.totalReviews,
      recentReviews: reviews
    }
  });
});

// @desc    Get servian bookings
// @route   GET /api/servian/bookings
// @access  Private (Servian only)
export const getBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const query = { servian: req.user.id };
  if (status) query.status = status;

  const totalBookings = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate('customer', 'name phone profileImage') // Populate customer details
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

// @desc    Update booking status
// @route   PUT /api/servian/bookings/:id/status
// @access  Private (Servian only)
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const validStatuses = ['accepted', 'rejected', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error('Invalid booking status');
  }

  const booking = await Booking.findOne({ _id: id, servian: req.user.id });
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  booking.status = status;
  if (notes) booking.notes = notes;

  await booking.save();

  // Update job stats
  const servian = await Servian.findById(req.user.id);
  if (status === 'completed') servian.updateJobStats('complete');
  if (status === 'cancelled') servian.updateJobStats('cancel');
  if (status === 'in_progress') servian.updateJobStats('start');
  await servian.save();

  res.json({
    success: true,
    message: `Booking ${status} successfully`,
    data: { bookingId: id, status, notes: notes || null }
  });
});

// @desc    Get notifications
// @route   GET /api/servian/notifications
// @access  Private (Servian only)
export const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user.id })
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount: notifications.filter(n => !n.isRead).length
    }
  });
});

// @desc    Mark notification as read
// @route   PUT /api/servian/notifications/:id/read
// @access  Private (Servian only)
export const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { _id: id, user: req.user.id },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: {
      notificationId: id,
      isRead: true
    }
  });
});



const calculateProfileCompleteness = (servian) => {
  const requiredFields = [
    'name', 'phone', 'location', 'serviceCategory', 'experienceYears',
    'skills', 'bio', 'profileImage'
  ];

  const bonusFields = [
    'portfolio', 'certifications', 'languages'
  ];

  let completedFields = 0;
  let totalFields = requiredFields.length;

  // Check required fields
  requiredFields.forEach(field => {
    if (field === 'skills') {
      if (servian.skills && Array.isArray(servian.skills) && servian.skills.length > 0) {
        completedFields++;
      }
    } else if (field === 'location') {
      if (servian.location && servian.location !== '') {
        completedFields++;
      }
    } else if (field === 'experienceYears') {
      if (servian.experienceYears && servian.experienceYears > 0) {
        completedFields++;
      }
    } else if (servian[field] && servian[field] !== '') {
      completedFields++;
    }
  });

  // Add bonus points for additional fields (each worth 0.5 points)
  bonusFields.forEach(field => {
    if (field === 'portfolio') {
      if (servian.portfolio && Array.isArray(servian.portfolio) && servian.portfolio.length > 0) {
        completedFields += 0.5;
        totalFields += 0.5;
      }
    } else if (field === 'certifications') {
      if (servian.certifications && Array.isArray(servian.certifications) && servian.certifications.length > 0) {
        completedFields += 0.5;
        totalFields += 0.5;
      }
    } else if (field === 'languages') {
      if (servian.languages && Array.isArray(servian.languages) && servian.languages.length > 0) {
        completedFields += 0.5;
        totalFields += 0.5;
      }
    }
  });

  // Availability status bonus
  if (servian.availability && servian.availability.status && servian.availability.status !== 'OFFLINE') {
    completedFields += 0.5;
    totalFields += 0.5;
  }

  return Math.min(100, Math.round((completedFields / totalFields) * 100));
};