
import User from "./User.js";
import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  preferredServices: [String],
  address: String,
  serviceRequests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
    },
  ],
  totalSpent: {
    type: Number,
    default: 0,
  },
});
const Customer = User.discriminator("customer", customerSchema);
export default Customer;