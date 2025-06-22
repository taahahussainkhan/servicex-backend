// models/ServiceRequest.js
import mongoose from 'mongoose';

const serviceRequestSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  serviceCategory: {
    type: String,
    required: true,
    enum: ['HOME_MAINTENANCE', 'ELECTRICAL', 'PLUMBING', 'CARPENTRY', 'CLEANING', 'PAINTING', 'AC_REPAIR', 'APPLIANCE_REPAIR', 'GARDENING', 'OTHER']
  },
  
  location: {
    address: {
      type: String,
      required: true
    },
    area: String,
    city: String,
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    }
  },
  
  budget: {
    min: {
      type: Number,
      required: true,
      min: 0
    },
    max: {
      type: Number,
      required: true,
      min: 0
    }
  },
  
  urgency: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'],
    default: 'MEDIUM'
  },
  
  preferredDate: {
    type: Date,
    required: true
  },
  
  images: [{
    type: String // URLs to uploaded images
  }],
  
  status: {
    type: String,
    enum: ['ACTIVE', 'CLOSED', 'AWARDED', 'CANCELLED', 'COMPLETED'],
    default: 'ACTIVE'
  },
  
  bids: [{
    servian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    message: {
      type: String,
      maxlength: 500
    },
    estimatedDuration: {
      type: String 
    },
    materials: [{
      item: String,
      cost: Number
    }],
    proposedDate: Date,
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
      default: 'PENDING'
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  awardedBid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' 
  },
  
  completedAt: Date,
  cancelledAt: Date,
  
  // Metadata
  views: {
    type: Number,
    default: 0
  },
  
  totalBids: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
serviceRequestSchema.index({ customer: 1, status: 1 });
serviceRequestSchema.index({ serviceCategory: 1, status: 1 });
serviceRequestSchema.index({ 'location.coordinates': '2dsphere' });
serviceRequestSchema.index({ urgency: 1, createdAt: -1 });
serviceRequestSchema.index({ status: 1, createdAt: -1 });

// Virtuals
serviceRequestSchema.virtual('isActive').get(function() {
  return this.status === 'ACTIVE';
});

serviceRequestSchema.virtual('budgetRange').get(function() {
  return `${this.budget.min} - ${this.budget.max} PKR`;
});

serviceRequestSchema.virtual('timeLeft').get(function() {
  if (!this.isActive) return null;
  const now = new Date();
  const created = this.createdAt;
  const daysPassed = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, 7 - daysPassed); // Requests active for 7 days
  return daysLeft;
});

// Pre-save middleware
serviceRequestSchema.pre('save', function(next) {
  // Update totalBids count
  this.totalBids = this.bids.length;
  
  // Auto-close requests after 7 days if no bids accepted
  if (this.isActive && this.timeLeft === 0 && this.totalBids === 0) {
    this.status = 'CLOSED';
  }
  
  next();
});

// Instance Methods
serviceRequestSchema.methods.addBid = function(bidData) {
  // Check if servian already bid
  const existingBid = this.bids.find(
    bid => bid.servian.toString() === bidData.servian.toString()
  );
  
  if (existingBid) {
    throw new Error('You have already placed a bid on this request');
  }
  
  if (!this.isActive) {
    throw new Error('This request is no longer accepting bids');
  }
  
  this.bids.push(bidData);
  this.totalBids = this.bids.length;
  
  return this.save();
};

serviceRequestSchema.methods.updateBid = function(servianId, updateData) {
  const bid = this.bids.find(
    bid => bid.servian.toString() === servianId.toString()
  );
  
  if (!bid) {
    throw new Error('Bid not found');
  }
  
  if (bid.status !== 'PENDING') {
    throw new Error('Cannot update bid with current status');
  }
  
  Object.assign(bid, updateData);
  return this.save();
};

serviceRequestSchema.methods.acceptBid = function(bidId) {
  const bid = this.bids.id(bidId);
  if (!bid) {
    throw new Error('Bid not found');
  }
  
  // Set all other bids as rejected
  this.bids.forEach(b => {
    if (b._id.toString() !== bidId.toString()) {
      b.status = 'REJECTED';
    }
  });
  
  bid.status = 'ACCEPTED';
  this.status = 'AWARDED';
  this.awardedBid = bid.servian;
  
  return this.save();
};

serviceRequestSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Static Methods
serviceRequestSchema.statics.findActiveRequests = function(filters = {}) {
  const query = { status: 'ACTIVE' };
  
  if (filters.category) {
    query.serviceCategory = filters.category;
  }
  
  if (filters.urgency) {
    query.urgency = filters.urgency;
  }
  
  if (filters.budget) {
    query['budget.max'] = { $gte: filters.budget };
  }
  
  return this.find(query)
    .populate('customer', 'name profileImage customerTier')
    .sort({ urgency: -1, createdAt: -1 });
};

serviceRequestSchema.statics.findNearbyRequests = function(longitude, latitude, radius = 10, filters = {}) {
  const query = {
    status: 'ACTIVE',
    'location.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: radius * 1000 
      }
    }
  };
  
  if (filters.category) {
    query.serviceCategory = filters.category;
  }
  
  return this.find(query)
    .populate('customer', 'name profileImage customerTier')
    .sort({ urgency: -1, createdAt: -1 });
};

const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);
export default ServiceRequest;