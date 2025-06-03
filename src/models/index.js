import User from './User.js';
import Customer from './Customer.js';
import Servian from './Servian.js';


import Booking from './bookingModel.js';
import Review from './reviewModel.js';
import Notification from './notificationModel.js';


export {
  User,
  Customer,
  Servian,
  Booking,
  Review,
  Notification
};


console.log('✅ Models registered:', {
  User: User.modelName,
  Customer: Customer.modelName,
  Servian: Servian.modelName
});