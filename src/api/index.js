/**
 * API Routes Index
 * Combines all API routes and exports a single router
 */

const express = require('express');
const router = express.Router();

// Import route modules
const analysisRoutes = require('./analysis');
const translationRoutes = require('./translation');
const userRoutes = require('./user');

// Mount routes
router.use('/api', analysisRoutes);
router.use('/api', translationRoutes);
router.use('/api/users', userRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

module.exports = router;
