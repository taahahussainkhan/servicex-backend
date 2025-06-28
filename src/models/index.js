import mongoose from 'mongoose';
import User from './User.js';
import Customer from './Customer.js';
import Servian from './Servian.js';
import Booking from './bookingModel.js';
import Review from './reviewModel.js';
import Notification from './notificationModel.js';
import ServiceRequest from './ServiceRequest.js';

// Ensure all models are properly registered
const models = {
  User,
  Customer,
  Servian,
  Booking,
  Review,
  Notification,
  ServiceRequest
};

// Explicitly register models to prevent "Schema hasn't been registered" errors
Object.values(models).forEach(model => {
  if (model && model.modelName) {
    console.log(`✅ Model registered: ${model.modelName}`);
  }
});

export {
  User,
  Customer,
  Servian,
  Booking,
  Review,
  Notification,
  ServiceRequest
};

console.log('✅ All models registered successfully');