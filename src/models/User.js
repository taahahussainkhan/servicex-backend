// // models/User.js
// import mongoose from "mongoose";
// import bcrypt from "bcryptjs";

// const options = { discriminatorKey: "role", timestamps: true };

// const userSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   phone: {
//     type: String,
//     required: false,
//     unique: true,
//   },
//   otp: {
//     type: String,
//   },
//   otpExpires: {
//     type: Date,
//   },
//   isEmailVerified: {
//     type: Boolean,
//     default: false,
//   },

//   isVerified: { type: Boolean, default: false },
//   profileImage: { type: String, required: true },
//   cnicFront: { type: String, required: true },
//   cnicBack: { type: String, required: true },
//   location: String,
// }, options);

// userSchema.virtual('role').get(function () {
//   return this.__t || 'user'; 
// });


// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

// userSchema.methods.matchPassword = async function (enteredPassword) {
//   return await bcrypt.compare(enteredPassword, this.password);
// };

// const User = mongoose.model("User", userSchema);
// export default User;



// models/User.js - Updated version
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const options = { discriminatorKey: "role", timestamps: true };

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: {
    type: String,
    required: false,
    unique: true,
  },
  otp: {
    type: String,
  },
  otpExpires: {
    type: Date,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  // New rejection fields
  isRejected: {
    type: Boolean,
    default: false
  },
  rejectionReason: {
    type: String
  },
  rejectedAt: {
    type: Date
  },
  // Profile images - make them not required initially to avoid validation issues
  profileImage: { 
    type: String, 
    required: function() {
      // Only required if user is being verified (not during rejection)
      return this.isVerified && !this.isRejected;
    }
  },
  cnicFront: { 
    type: String, 
    required: function() {
      return this.isVerified && !this.isRejected;
    }
  },
  cnicBack: { 
    type: String, 
    required: function() {
      return this.isVerified && !this.isRejected;
    }
  },
  location: String,
  
  // Admin tracking
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Application attempt tracking
  applicationAttempts: {
    type: Number,
    default: 1
  },
  lastApplicationDate: {
    type: Date,
    default: Date.now
  }
}, options);

// Virtual for getting user role
userSchema.virtual('role').get(function () {
  return this.__t || 'user'; 
});

// Virtual for application status
userSchema.virtual('applicationStatus').get(function () {
  if (this.isVerified) return 'approved';
  if (this.isRejected) return 'rejected';
  return 'pending';
});

// Pre-save middleware for password hashing
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Pre-save middleware to track verification
userSchema.pre("save", function (next) {
  if (this.isModified('isVerified') && this.isVerified) {
    this.verifiedAt = new Date();
  }
  next();
});

// Instance method for password matching
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to check if user can reapply
userSchema.methods.canReapply = function () {
  if (!this.isRejected) return false;
  
  // Allow reapplication after 24 hours
  const daysSinceRejection = (Date.now() - this.rejectedAt) / (1000 * 60 * 60 * 24);
  return daysSinceRejection >= 1;
};

// Static method to get pending users with filters
userSchema.statics.getPendingUsers = function (filters = {}) {
  const query = { 
    isVerified: false, 
    isRejected: { $ne: true } 
  };
  
  if (filters.role) {
    query.__t = filters.role;
  }
  
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { email: { $regex: filters.search, $options: 'i' } },
      { phone: { $regex: filters.search, $options: 'i' } }
    ];
  }
  
  return this.find(query)
    .select('-password -otp -otpExpires')
    .sort({ createdAt: -1 });
};

// Index for better query performance
userSchema.index({ isVerified: 1, isRejected: 1, __t: 1 });
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model("User", userSchema);
export default User;

// Updated adminApi.js for frontend
export const adminApi = {
  // Get pending users
  getPendingUsers: async (filters = {}) => {
    const queryParams = new URLSearchParams();
    
    if (filters.role && filters.role !== 'all') {
      queryParams.append('role', filters.role);
    }
    if (filters.search) {
      queryParams.append('search', filters.search);
    }
    if (filters.page) {
      queryParams.append('page', filters.page);
    }
    if (filters.limit) {
      queryParams.append('limit', filters.limit);
    }
    
    const response = await fetch(`/api/admin/pending-users?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch pending users');
    }
    
    return response.json();
  },

  // Verify user (approve/reject)
  verifyUser: async (userId, approved, rejectionReason = '') => {
    const response = await fetch(`/api/admin/verify-user/${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        approved,
        rejectionReason: approved ? undefined : rejectionReason
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify user');
    }
    
    return response.json();
  },

  // Get user details
  getUserDetails: async (userId) => {
    const response = await fetch(`/api/admin/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user details');
    }
    
    return response.json();
  },

  // Get dashboard stats
  getDashboardStats: async () => {
    const response = await fetch('/api/admin/dashboard-stats', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }
    
    return response.json();
  },

  // Bulk verify users
  bulkVerifyUsers: async (userIds, action, rejectionReason = '') => {
    const response = await fetch('/api/admin/bulk-verify', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userIds,
        action,
        rejectionReason: action === 'reject' ? rejectionReason : undefined
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to perform bulk action');
    }
    
    return response.json();
  }
};

// Environment variables needed in .env file:
/*
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
APP_NAME=Your App Name
ADMIN_EMAIL=admin@yourapp.com
FRONTEND_URL=http://localhost:3000

# JWT
JWT_SECRET=your-jwt-secret

# Database
MONGODB_URI=your-mongodb-connection-string
*/