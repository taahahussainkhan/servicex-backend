import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'customer', // Changed from 'User' to 'Customer'
        required: true
    },
    servian: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'servian', // Changed from 'User' to 'Servian'
        required: true
    },
    service: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    scheduledDate: {
        type: Date,
        required: true
    },
    scheduledTime: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    actualAmount: {
        type: Number,
        min: 0
    },
    location: {
        address: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            index: '2dsphere'
        }
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'rejected', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    notes: {
        type: String,
        trim: true
    },
    servianComments: {
        type: String,
        trim: true
    },
    completionNotes: {
        type: String,
        trim: true
    },
    
    // Timestamps for different status changes
    confirmedAt: Date,
    rejectedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,

    // Payment related
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'online'],
        default: 'cash'
    }
}, {
    timestamps: true
});

// Indexes for better query performance
bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ servian: 1, status: 1 });
bookingSchema.index({ scheduledDate: 1 });
bookingSchema.index({ createdAt: -1 });

// Virtual for booking duration (if completed)
bookingSchema.virtual('duration').get(function() {
    if (this.startedAt && this.completedAt) {
        return Math.round((this.completedAt - this.startedAt) / (1000 * 60)); // in minutes
    }
    return null;
});

// Instance method to check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function() {
    return ['pending', 'confirmed'].includes(this.status);
};

// Instance method to check if booking can be started
bookingSchema.methods.canBeStarted = function() {
    return this.status === 'confirmed';
};

// Instance method to check if booking can be completed
bookingSchema.methods.canBeCompleted = function() {
    return this.status === 'in_progress';
};

// Static method to get booking stats for a servian
bookingSchema.statics.getServianStats = async function(servianId) {
    const stats = await this.aggregate([
        { $match: { servian: new mongoose.Types.ObjectId(servianId) } }, // Fixed deprecated ObjectId usage
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$actualAmount' }
            }
        }
    ]);
    
    return stats.reduce((acc, stat) => {
        acc[stat._id] = {
            count: stat.count,
            totalAmount: stat.totalAmount || 0
        };
        return acc;
    }, {});
};

export default mongoose.model('Booking', bookingSchema);