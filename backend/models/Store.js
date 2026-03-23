const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required']
  },
  storeName: {
    type: String,
    required: [true, 'Store name is required'],
    trim: true,
    maxlength: [100, 'Store name cannot exceed 100 characters']
  },
  domain: {
    type: String,
    required: [true, 'Domain is required'],
    unique: true,
    lowercase: true,
    match: [/^[a-z0-9]+([.-]?[a-z0-9]+)*$/, 'Please enter a valid domain format'],
    maxlength: [50, 'Domain cannot exceed 50 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  theme: {
    type: Object,
    default: null
  },
  layout: {
    type: Object,
    default: null
  },
  currency: {
    type: String,
    default: 'USD'
  },
  locale: {
    type: String,
    default: 'en-US'
  },
  // JSON layout for publishing (AI generated + user edited)
  jsonLayout: {
    type: Object,
    default: null
  },
  // Published URL from Vercel
  publishedUrl: {
    type: String,
    default: null
  },
  // Vercel deployment ID for management
  vercelDeploymentId: {
    type: String,
    default: null
  },
  // Vercel project tracking for stable redeploys
  vercelProjectName: {
    type: String,
    default: null
  },
  vercelAlias: {
    type: String,
    default: null
  },
  // Last published timestamp
  lastPublished: {
    type: Date,
    default: null
  },
  approved: {
    type: Boolean,
    default: false
  },
  // ID of the currently chosen theme (frontend/editor may use this to open editor)
  chosenThemeId: {
    type: String,
    default: null
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Index for faster queries
storeSchema.index({ ownerId: 1 });

module.exports = mongoose.model('Store', storeSchema);
