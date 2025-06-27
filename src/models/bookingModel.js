import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Changed from 'Customer' to 'User' to match your user model
    required: true
  },
  servian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Changed from 'Servian' to 'User' to match your user model
    required: true
  },
  service: {
    type: String,
    required: true
  },
  description: String,
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  location: {
    address: String,
    city: String,
    coordinates: {  // Added coordinates for geospatial queries
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    }
  },
  notes: String,
  // New fields to support service request flow
  source: {
    type: String,
    enum: ['direct', 'service_request'],
    default: 'direct'
  },
  sourceRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest'
  },
  // Additional fields for better tracking
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending'
  },
  completionDate: Date,
  customerRating: {
    type: Number,
    min: 1,
    max: 5
  },
  servianRating: {
    type: Number,
    min: 1,
    max: 5
  }
}, {
  timestamps: true
});

// Index for geospatial queries
bookingSchema.index({ 'location.coordinates': '2dsphere' });

// Index for faster queries by source and status
bookingSchema.index({ source: 1, status: 1 });
bookingSchema.index({ sourceRequest: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;