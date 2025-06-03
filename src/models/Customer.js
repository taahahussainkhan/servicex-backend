import User from "./User.js";
import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  // Service Preferences
  preferredServices: {
    type: [String],
    enum: ['HOME_MAINTENANCE', 'ELECTRICAL', 'PLUMBING', 'CARPENTRY', 'CLEANING', 'PAINTING', 'AC_REPAIR', 'APPLIANCE_REPAIR', 'GARDENING', 'OTHER'],
    default: []
  },
  
  // Address Information
  addresses: [{
    label: {
      type: String,
      required: true,
      enum: ['Home', 'Office', 'Other']
    },
    street: { type: String, required: true },
    area: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: String,
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
    },
    isDefault: { type: Boolean, default: false },
    instructions: String 
  }],
  

  address: String,
  

  serviceRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceRequest"
  }],

  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking"
  }],
  
  // Financial Information
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  
  monthlySpending: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Customer Preferences
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    serviceReminders: { type: Boolean, default: true },
    preferredTimeSlots: {
      type: [String],
      enum: ['Morning', 'Afternoon', 'Evening'],
      default: ['Morning', 'Afternoon']
    },
    emergencyContact: {
      name: String,
      phone: String,
      relation: String
    }
  },
  

  customerStats: {
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    cancelledBookings: { type: Number, default: 0 },
    averageBookingValue: { type: Number, default: 0 },
    favoriteServices: [String],
    lastBookingDate: Date,
    joinDate: { type: Date, default: Date.now }
  },
  
  // Customer Status
  customerTier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    default: 'Bronze'
  },
  
  loyaltyPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Payment Information
  paymentMethods: [{
    type: {
      type: String,
      enum: ['card', 'bank', 'wallet'],
      required: true
    },
    provider: String, 
    last4Digits: String,
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    addedAt: { type: Date, default: Date.now }
  }],
  
 
  favoriteServians: [{
    servian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', 
      required: true
    },
    addedAt: { type: Date, default: Date.now },
    notes: String
  }],
  
  blockedServians: [{
    servian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', 
      required: true
    },
    reason: String,
    blockedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});


customerSchema.index({ 'addresses.coordinates': '2dsphere' });
customerSchema.index({ customerTier: 1 });
customerSchema.index({ 'customerStats.totalBookings': -1 });
customerSchema.index({ loyaltyPoints: -1 });
customerSchema.index({ totalSpent: -1 });


customerSchema.virtual('experienceLevel').get(function() {
  const bookings = this.customerStats.totalBookings;
  if (bookings >= 50) return 'Expert';
  if (bookings >= 20) return 'Experienced';
  if (bookings >= 5) return 'Regular';
  return 'New';
});


customerSchema.virtual('completionRate').get(function() {
  const total = this.customerStats.totalBookings;
  const completed = this.customerStats.completedBookings;
  return total > 0 ? Math.round((completed / total) * 100) : 0;
});


customerSchema.virtual('defaultAddress').get(function() {
  return this.addresses.find(addr => addr.isDefault) || this.addresses[0];
});


customerSchema.pre('save', function(next) {

  if (this.totalSpent >= 50000) {
    this.customerTier = 'Platinum';
  } else if (this.totalSpent >= 25000) {
    this.customerTier = 'Gold';
  } else if (this.totalSpent >= 10000) {
    this.customerTier = 'Silver';
  } else {
    this.customerTier = 'Bronze';
  }
  

  if (this.customerStats.totalBookings > 0) {
    this.customerStats.averageBookingValue = Math.round(
      this.totalSpent / this.customerStats.totalBookings
    );
  }
  
  next();
});

// Instance methods
customerSchema.methods.updateBookingStats = function(action, amount = 0) {
  switch(action) {
    case 'book':
      this.customerStats.totalBookings += 1;
      this.customerStats.lastBookingDate = new Date();
      break;
    case 'complete':
      this.customerStats.completedBookings += 1;
      this.totalSpent += amount;
      this.monthlySpending += amount;
      // Award loyalty points (1 point per 100 PKR spent)
      this.loyaltyPoints += Math.floor(amount / 100);
      break;
    case 'cancel':
      this.customerStats.cancelledBookings += 1;
      break;
  }
};

customerSchema.methods.addToFavorites = function(servianId, notes = '') {
  const existing = this.favoriteServians.find(
    fav => fav.servian.toString() === servianId.toString()
  );
  
  if (!existing) {
    this.favoriteServians.push({
      servian: servianId,
      notes: notes
    });
  }
  
  return this.save();
};

customerSchema.methods.removeFromFavorites = function(servianId) {
  this.favoriteServians = this.favoriteServians.filter(
    fav => fav.servian.toString() !== servianId.toString()
  );
  
  return this.save();
};

customerSchema.methods.blockServian = function(servianId, reason = '') {
  const existing = this.blockedServians.find(
    blocked => blocked.servian.toString() === servianId.toString()
  );
  
  if (!existing) {
    this.blockedServians.push({
      servian: servianId,
      reason: reason
    });
  }
  
  return this.save();
};

customerSchema.methods.unblockServian = function(servianId) {
  this.blockedServians = this.blockedServians.filter(
    blocked => blocked.servian.toString() !== servianId.toString()
  );
  
  return this.save();
};

customerSchema.methods.canBookServian = function(servianId) {
  return !this.blockedServians.some(
    blocked => blocked.servian.toString() === servianId.toString()
  );
};

customerSchema.methods.addAddress = function(addressData) {
  // If this is the first address or marked as default, make it default
  if (this.addresses.length === 0 || addressData.isDefault) {
    this.addresses.forEach(addr => addr.isDefault = false);
    addressData.isDefault = true;
  }
  
  this.addresses.push(addressData);
  return this.save();
};

customerSchema.methods.updateAddress = function(addressId, updateData) {
  const address = this.addresses.id(addressId);
  if (!address) throw new Error('Address not found');
  
  // If setting as default, remove default from others
  if (updateData.isDefault) {
    this.addresses.forEach(addr => addr.isDefault = false);
  }
  
  Object.assign(address, updateData);
  return this.save();
};

customerSchema.methods.deleteAddress = function(addressId) {
  const address = this.addresses.id(addressId);
  if (!address) throw new Error('Address not found');
  
  const wasDefault = address.isDefault;
  this.addresses.pull(addressId);
  
  // If deleted address was default, make first address default
  if (wasDefault && this.addresses.length > 0) {
    this.addresses[0].isDefault = true;
  }
  
  return this.save();
};

// Static methods
customerSchema.statics.getTopCustomers = function(limit = 10) {
  return this.find({ isVerified: true })
    .select('-password -otp -otpExpires')
    .sort({ totalSpent: -1, 'customerStats.totalBookings': -1 })
    .limit(limit);
};

customerSchema.statics.getCustomersByTier = function(tier) {
  return this.find({ customerTier: tier, isVerified: true })
    .select('-password -otp -otpExpires')
    .sort({ totalSpent: -1 });
};

customerSchema.statics.findNearbyCustomers = function(longitude, latitude, radius = 10) {
  return this.find({
    isVerified: true,
    'addresses.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: radius * 1000 // Convert km to meters
      }
    }
  }).select('-password -otp -otpExpires');
};

const Customer = User.discriminator("customer", customerSchema);
export default Customer;