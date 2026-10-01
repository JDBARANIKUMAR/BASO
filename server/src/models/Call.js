import mongoose from 'mongoose';

const callSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['voice', 'video'],
      required: true,
    },
    status: {
      type: String,
      enum: ['missed', 'declined', 'completed', 'busy', 'no_answer', 'ongoing'],
      default: 'ongoing',
      index: true,
    },
    duration: {
      type: Number,
      default: 0, // duration in seconds
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

callSchema.index({ caller: 1, recipient: 1, createdAt: -1 });

export const Call = mongoose.model('Call', callSchema);
