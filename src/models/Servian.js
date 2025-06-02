
import User from "./User.js";
import mongoose from "mongoose";

const servianSchema = new mongoose.Schema({
  experienceYears: { type: Number, required: true },
  skills: [String],
  serviceCategory: String,
  availableForHomeVisit: { type: Boolean, default: true },
});

const Servian = User.discriminator("servian", servianSchema);
export default Servian;
