// Updated notificationModel.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'booking', 
      'payment', 
      'review', 
      'system',
      'new_bid',
      'bid_updated',
      'bid_withdrawn',
      'bid_accepted',
      'bid_rejected',
      'request_cancelled',
      'service_completed'
    ],
    required: true
  },
  title: String,
  message: String,
  data: mongoose.Schema.Types.Mixed,
  isRead: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;