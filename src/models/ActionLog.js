/**
 * ActionLog Model
 * Tracks user actions and API usage
 */

const mongoose = require('mongoose');

const ActionLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  ip: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ActionLog', ActionLogSchema);
