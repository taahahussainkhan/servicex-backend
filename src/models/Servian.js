import User from "./User.js";
import mongoose from "mongoose";

const servianSchema = new mongoose.Schema({
  // Professional Information
  experienceYears: { 
    type: Number, 
    required: [true, 'Experience years is required'],
    min: [0, 'Experience cannot be negative'],
    max: [50, 'Experience cannot exceed 50 years']
  },
  
  skills: {
    type: [String],
    required: [true, 'At least one skill is required'],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one skill must be provided'
    }
  },
  
  serviceCategory: {
    type: String,
    required: [true, 'Service category is required'],
    enum: {
      values: ['HOME_MAINTENANCE', 'ELECTRICAL', 'PLUMBING', 'CARPENTRY', 'CLEANING', 'PAINTING', 'AC_REPAIR', 'APPLIANCE_REPAIR', 'GARDENING', 'OTHER'],
      message: 'Invalid service category'
    }
  },
  
  availableForHomeVisit: { 
    type: Boolean, 
    default: true 
  },
  
  // Service Area
  serviceRadius: {
    type: Number,
    default: 10, // kilometers
    min: [1, 'Service radius must be at least 1km'],
    max: [100, 'Service radius cannot exceed 100km']
  },
  
  // Availability
  availability: {
    status: {
      type: String,
      enum: ['AVAILABLE', 'BUSY', 'OFFLINE'],
      default: 'AVAILABLE'
    },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' }
    },
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }
  },
  
  // Pricing
  pricing: {
    hourlyRate: {
      type: Number,
      min: [0, 'Hourly rate cannot be negative']
    },
    minimumCharge: {
      type: Number,
      min: [0, 'Minimum charge cannot be negative']
    },
    calloutFee: {
      type: Number,
      default: 0,
      min: [0, 'Callout fee cannot be negative']
    }
  },
  
  // Job Statistics
  jobStats: {
    completedJobs: { type: Number, default: 0 },
    cancelledJobs: { type: Number, default: 0 },
    ongoingJobs: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 }
  },
  
  // Professional Details
  certifications: [{
    name: String,
    issuer: String,
    dateObtained: Date,
    expiryDate: Date,
    certificateImage: String
  }],
  
  portfolio: [{
    title: String,
    description: String,
    images: [String],
    completionDate: Date,
    clientTestimonial: String
  }],
  
  // Equipment and Tools
  equipment: [{
    name: String,
    description: String,
    owned: { type: Boolean, default: true }
  }],
  
  // Emergency Services
  emergencyService: {
    available: { type: Boolean, default: false },
    additionalCharge: { type: Number, default: 0 }
  },
  
  // Profile Completeness Score
  profileCompleteness: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 100
  },
  
  // Verification Documents Status
  documentsStatus: {
    cnicVerified: { type: Boolean, default: false },
    skillCertificatesVerified: { type: Boolean, default: false },
    backgroundCheckCompleted: { type: Boolean, default: false }
  },
  
  // Performance Metrics
  performance: {
    responseTime: { type: Number, default: 0 }, // in minutes
    completionRate: { type: Number, default: 0 }, // percentage
    customerSatisfaction: { type: Number, default: 0 }, // 0-5 scale
    repeatCustomers: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
servianSchema.index({ serviceCategory: 1, 'availability.status': 1 });
servianSchema.index({ 'jobStats.completedJobs': -1 });
servianSchema.index({ profileCompleteness: -1 });
servianSchema.index({ experienceYears: -1 });

// Virtual for completion rate percentage
servianSchema.virtual('completionRatePercentage').get(function() {
  const total = this.jobStats.completedJobs + this.jobStats.cancelledJobs;
  return total > 0 ? Math.round((this.jobStats.completedJobs / total) * 100) : 0;
});

// Virtual for average rating (inherited from User schema)
servianSchema.virtual('displayRating').get(function() {
  return this.averageRating ? this.averageRating.toFixed(1) : '0.0';
});

// Pre-save middleware to calculate profile completeness
servianSchema.pre('save', function(next) {
  let score = 0;
  const weights = {
    basicInfo: 20, // name, email, phone, location
    skills: 15,
    experience: 10,
    pricing: 15,
    availability: 10,
    portfolio: 15,
    certifications: 10,
    documents: 5
  };
  
  // Basic info (from User schema) - assume complete if servian exists
  score += weights.basicInfo;
  
  // Skills
  if (this.skills && this.skills.length > 0) score += weights.skills;
  
  // Experience
  if (this.experienceYears > 0) score += weights.experience;
  
  // Pricing
  if (this.pricing && this.pricing.hourlyRate > 0) score += weights.pricing;
  
  // Availability
  if (this.availability && this.availability.workingHours) score += weights.availability;
  
  // Portfolio
  if (this.portfolio && this.portfolio.length > 0) score += weights.portfolio;
  
  // Certifications
  if (this.certifications && this.certifications.length > 0) score += weights.certifications;
  
  // Documents
  if (this.documentsStatus.cnicVerified) score += weights.documents;
  
  this.profileCompleteness = Math.min(score, 100);
  next();
});

// Instance methods
servianSchema.methods.updateJobStats = function(action) {
  switch(action) {
    case 'complete':
      this.jobStats.completedJobs += 1;
      this.jobStats.ongoingJobs = Math.max(0, this.jobStats.ongoingJobs - 1);
      break;
    case 'cancel':
      this.jobStats.cancelledJobs += 1;
      this.jobStats.ongoingJobs = Math.max(0, this.jobStats.ongoingJobs - 1);
      break;
    case 'start':
      this.jobStats.ongoingJobs += 1;
      this.jobStats.totalBookings += 1;
      break;
  }
  
  // Update completion rate
  const totalCompleted = this.jobStats.completedJobs + this.jobStats.cancelledJobs;
  this.performance.completionRate = totalCompleted > 0 ? 
    Math.round((this.jobStats.completedJobs / totalCompleted) * 100) : 0;
};

servianSchema.methods.isAvailable = function() {
  if (this.availability.status !== 'AVAILABLE') return false;
  if (!this.isVerified) return false;
  
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentTime = now.toTimeString().slice(0, 5);
  
  return this.availability.workingDays.includes(currentDay) &&
         currentTime >= this.availability.workingHours.start &&
         currentTime <= this.availability.workingHours.end;
};

servianSchema.methods.canTakeEmergencyJobs = function() {
  return this.emergencyService.available && this.isAvailable();
};

// Static methods
servianSchema.statics.findNearbyServians = function(latitude, longitude, radius = 10, category = null) {
  const query = {
    isVerified: true,
    'availability.status': 'AVAILABLE',
    'location.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: radius * 1000 // Convert km to meters
      }
    }
  };
  
  if (category) {
    query.serviceCategory = category;
  }
  
  return this.find(query)
    .select('-password -otp -otpExpires')
    .sort({ averageRating: -1, 'jobStats.completedJobs': -1 });
};

servianSchema.statics.getTopRatedServians = function(category = null, limit = 10) {
  const query = {
    isVerified: true,
    averageRating: { $gte: 4.0 },
    totalReviews: { $gte: 5 }
  };
  
  if (category) {
    query.serviceCategory = category;
  }
  
  return this.find(query)
    .select('-password -otp -otpExpires')
    .sort({ averageRating: -1, totalReviews: -1 })
    .limit(limit);
};

const Servian = User.discriminator("servian", servianSchema);
export default Servian;