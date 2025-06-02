import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["Photography", "Plumbing", "Electrician", "Beauty", "Tutoring", "Event Planning", "Other"],
      default: "Other",
    },
    price: {
      type: Number,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    images: [
      {
        type: String, 
      },
    ],
    availableDays: [String], 
    availableTime: String,   

    servian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Service = mongoose.model("Service", serviceSchema);
export default Service;
