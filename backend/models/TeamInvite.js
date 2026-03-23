const mongoose = require('mongoose');
const crypto = require('crypto');

const teamInviteSchema = new mongoose.Schema({
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/, 'Please enter a valid email']
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days
  },
  acceptedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

teamInviteSchema.index({ teamId: 1, email: 1 }, { unique: false });
teamInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { acceptedAt: null } });

teamInviteSchema.statics.generateToken = function () {
  return crypto.randomBytes(24).toString('hex');
};

module.exports = mongoose.model('TeamInvite', teamInviteSchema);
