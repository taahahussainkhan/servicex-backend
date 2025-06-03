import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  servian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Servian',
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
    city: String
  },
  notes: String
}, {
  timestamps: true
});

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
