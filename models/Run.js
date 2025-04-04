const mongoose = require('mongoose');

const runSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  sourceText: String,
  targetText: String,
  sourceLang: String,
  targetLang: String,
  mqmScore: Number,
  issues: Array,
  ip: String,
  summary: String,
    wordCount: Number,
  location: {
    city: String,
    region: String,
    country: String,
    org: String
  }
});

module.exports = mongoose.model('Run', runSchema);
