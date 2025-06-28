// models/User.js - Fixed version
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const options = { discriminatorKey: "role", timestamps: true };

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { 
    type: String, 
    required: true
  },
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
  profileImage: { 
    type: String, 
    required: function() {
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
  // location: String,
  location: {
    area: String,
    street: String,
    city: String
  },
  
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


userSchema.pre('save', function(next) {
  // Only run this for new documents
  if (this.isNew) {
    // Initialize subscription for customers and servians
    if (this.role === 'customer' || this.role === 'servian') {
      this.subscription = {
        tier: 'FREE',
        status: 'ACTIVE',
        startDate: new Date()
      };
    }
  }
  next();
});

// Instance method for password matching
userSchema.methods.matchPassword = async function (enteredPassword) {
  console.log("🔐 matchPassword called with:", {
    enteredPassword: enteredPassword ? "provided" : "missing",
    storedPassword: this.password ? "exists" : "missing",
    storedPasswordLength: this.password ? this.password.length : 0
  });
  
  if (!this.password) {
    throw new Error("User password not found in document");
  }
  
  return await bcrypt.compare(enteredPassword, this.password);
};


userSchema.methods.canReapply = function () {
  if (!this.isRejected) return false;
  

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




userSchema.index({ isVerified: 1, isRejected: 1, __t: 1 });
userSchema.index({ createdAt: -1 });

// Create the base User model
const User = mongoose.model("User", userSchema);

// Ensure the model is properly registered
console.log('✅ Base User model registered:', User.modelName);

export default User;