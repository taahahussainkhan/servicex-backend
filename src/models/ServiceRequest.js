const serviceRequestSchema = new mongoose.Schema({
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    servian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Servian",
      required: true,
    },
    serviceType: String,
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    requestDate: {
      type: Date,
      default: Date.now,
    },
    completionDate: Date,
    cost: Number,
  });
  