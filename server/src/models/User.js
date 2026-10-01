import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
      maxlength: 50,
    },
    avatar: {
      type: String,
      default: '',
    },
    isRegistered: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    refreshToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    mobile: this.mobile,
    name: this.name,
    avatar: this.avatar,
    isRegistered: this.isRegistered,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
