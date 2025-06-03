import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true
  },
  target: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true
  },
  role: {
    type: String,
    enum: ['customer_to_servian', 'servian_to_customer'],
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate reviews per booking per role
reviewSchema.index({ booking: 1, author: 1, role: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);
export default Review;
