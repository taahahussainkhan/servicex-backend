// routes/adminRoutes.js
import express from 'express';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Servian from '../models/Servian.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';
import { sendApprovalEmail, sendRejectionEmail } from '../services/emailService.js';

const router = express.Router();

// Get all pending users with full details
router.get('/pending-users', adminMiddleware, async (req, res) => {
  try {
    const { role, search, page = 1, limit = 10 } = req.query;
    
    let query = { isVerified: false };
    
    // Filter by role if specified
    if (role && role !== 'all') {
      query.__t = role;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    // Get users with populated data based on discriminator
    const users = await User.find(query)
      .select('-password -otp -otpExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalUsers = await User.countDocuments(query);
    
    // Get detailed info for each user type
    const detailedUsers = await Promise.all(
      users.map(async (user) => {
        let userDetails = user.toObject();
        
        if (user.__t === 'customer') {
          const customerData = await Customer.findById(user._id);
          userDetails = { ...userDetails, ...customerData.toObject() };
        } else if (user.__t === 'servian') {
          const servianData = await Servian.findById(user._id);
          userDetails = { ...userDetails, ...servianData.toObject() };
        }
        
        return userDetails;
      })
    );
    
    // Get statistics
    const stats = {
      total: await User.countDocuments({ isVerified: false }),
      customers: await Customer.countDocuments({ isVerified: false }),
      servians: await Servian.countDocuments({ isVerified: false }),
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: parseInt(page)
    };
    
    res.json({
      success: true,
      data: detailedUsers,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending users',
      error: error.message
    });
  }
});

// Verify user (approve/reject)
router.patch('/verify-user/:userId', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { approved, rejectionReason } = req.body;
    
    // Find user with full details
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (approved) {
      // Approve user
      user.isVerified = true;
      await user.save();
      
      // Send approval email
      try {
        await sendApprovalEmail(user.email, user.name, user.__t || 'user');
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
        // Don't fail the approval if email fails
      }
      
      res.json({
        success: true,
        message: `${user.name} has been approved successfully`,
        data: { userId: user._id, approved: true }
      });
      
    } else {
      // Reject user - we'll soft delete instead of hard delete
      // to maintain records and allow user to reapply
      user.isVerified = false;
      user.rejectionReason = rejectionReason || 'Application did not meet requirements';
      user.rejectedAt = new Date();
      user.isRejected = true;
      await user.save();
      
      // Send rejection email with feedback
      try {
        await sendRejectionEmail(user.email, user.name, rejectionReason, user.__t || 'user');
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
        // Don't fail the rejection if email fails
      }
      
      res.json({
        success: true,
        message: `${user.name} has been rejected. Feedback email sent.`,
        data: { userId: user._id, approved: false, rejectionReason }
      });
    }
    
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify user',
      error: error.message
    });
  }
});

// Get user details by ID
router.get('/user/:userId', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-password -otp -otpExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    let userDetails = user.toObject();
    
    // Get additional details based on user type
    if (user.__t === 'customer') {
      const customerData = await Customer.findById(userId);
      userDetails = { ...userDetails, ...customerData.toObject() };
    } else if (user.__t === 'servian') {
      const servianData = await Servian.findById(userId);
      userDetails = { ...userDetails, ...servianData.toObject() };
    }
    
    res.json({
      success: true,
      data: userDetails
    });
    
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
      error: error.message
    });
  }
});

// Get admin dashboard stats
router.get('/dashboard-stats', adminMiddleware, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today.setDate(today.getDate() - 7));
    const startOfMonth = new Date(today.setMonth(today.getMonth() - 1));
    
    const stats = {
      pending: {
        total: await User.countDocuments({ isVerified: false, isRejected: { $ne: true } }),
        customers: await Customer.countDocuments({ isVerified: false, isRejected: { $ne: true } }),
        servians: await Servian.countDocuments({ isVerified: false, isRejected: { $ne: true } }),
        today: await User.countDocuments({ 
          isVerified: false, 
          isRejected: { $ne: true },
          createdAt: { $gte: startOfDay } 
        })
      },
      approved: {
        total: await User.countDocuments({ isVerified: true }),
        thisWeek: await User.countDocuments({ 
          isVerified: true, 
          updatedAt: { $gte: startOfWeek } 
        }),
        thisMonth: await User.countDocuments({ 
          isVerified: true, 
          updatedAt: { $gte: startOfMonth } 
        })
      },
      rejected: {
        total: await User.countDocuments({ isRejected: true }),
        thisWeek: await User.countDocuments({ 
          isRejected: true, 
          rejectedAt: { $gte: startOfWeek } 
        }),
        thisMonth: await User.countDocuments({ 
          isRejected: true, 
          rejectedAt: { $gte: startOfMonth } 
        })
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
});

// Bulk actions for multiple users
router.patch('/bulk-verify', adminMiddleware, async (req, res) => {
  try {
    const { userIds, action, rejectionReason } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }
    
    const users = await User.find({ _id: { $in: userIds } }).select('-password');
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found'
      });
    }
    
    const results = [];
    
    for (const user of users) {
      try {
        if (action === 'approve') {
          user.isVerified = true;
          await user.save();
          await sendApprovalEmail(user.email, user.name, user.__t || 'user');
          results.push({ userId: user._id, status: 'approved', name: user.name });
        } else if (action === 'reject') {
          user.isVerified = false;
          user.rejectionReason = rejectionReason || 'Application did not meet requirements';
          user.rejectedAt = new Date();
          user.isRejected = true;
          await user.save();
          await sendRejectionEmail(user.email, user.name, rejectionReason, user.__t || 'user');
          results.push({ userId: user._id, status: 'rejected', name: user.name });
        }
      } catch (error) {
        console.error(`Error processing user ${user._id}:`, error);
        results.push({ userId: user._id, status: 'error', name: user.name, error: error.message });
      }
    }
    
    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      data: results
    });
    
  } catch (error) {
    console.error('Error in bulk verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk action',
      error: error.message
    });
  }
});

export default router;

