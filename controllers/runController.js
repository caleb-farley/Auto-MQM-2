const Run = require('../models/Run');
const User = require('../models/User');

// Get runs by user (authenticated user's runs)
exports.getUserRuns = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-timestamp'; // Default to newest first
    
    // Query runs for this user
    const runs = await Run.find({ user: userId })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('timestamp sourceLang targetLang mqmScore summary wordCount title tags isSaved');
    
    // Get total count
    const total = await Run.countDocuments({ user: userId });
    
    res.status(200).json({
      success: true,
      runs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Get user runs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch runs',
      error: error.message
    });
  }
};

// Get a specific run by ID
exports.getRunById = async (req, res) => {
  try {
    const { runId } = req.params;
    
    // Find the run
    const run = await Run.findById(runId);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Run not found'
      });
    }
    
    // Check authorization - only the owner or admin can access the run
    if (
      req.user && 
      (
        (run.user && run.user.toString() === req.user.id) ||
        req.user.accountType === 'admin'
      )
    ) {
      return res.status(200).json({
        success: true,
        run
      });
    } else if (run.anonymousSessionId && req.cookies.anonymousSessionId === run.anonymousSessionId) {
      // Allow access to anonymous users if they have the matching session ID
      return res.status(200).json({
        success: true,
        run
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this run'
      });
    }
  } catch (error) {
    console.error('Get run by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch run',
      error: error.message
    });
  }
};

// Save/unsave a run
exports.toggleSaveRun = async (req, res) => {
  try {
    const { runId } = req.params;
    const userId = req.user.id;
    
    // Find the run
    const run = await Run.findById(runId);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Run not found'
      });
    }
    
    // Check if run belongs to user or if it's an anonymous run
    if (run.user && run.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this run'
      });
    }
    
    // If it's an anonymous run, associate it with the user
    if (!run.user) {
      run.user = userId;
      run.anonymousSessionId = null; // Remove anonymous association
    }
    
    // Toggle saved status
    run.isSaved = !run.isSaved;
    await run.save();
    
    // Update user's savedRuns array
    const user = await User.findById(userId);
    
    if (run.isSaved) {
      // Add to savedRuns if not already there
      if (!user.savedRuns.includes(runId)) {
        user.savedRuns.push(runId);
      }
    } else {
      // Remove from savedRuns
      user.savedRuns = user.savedRuns.filter(id => id.toString() !== runId);
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: run.isSaved ? 'Run saved successfully' : 'Run unsaved successfully',
      isSaved: run.isSaved
    });
  } catch (error) {
    console.error('Toggle save run error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle save status',
      error: error.message
    });
  }
};

// Get saved runs for a user
exports.getSavedRuns = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-timestamp'; // Default to newest first
    
    // Get user with populated savedRuns
    const user = await User.findById(userId).select('savedRuns');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Query saved runs
    const runs = await Run.find({ 
      _id: { $in: user.savedRuns },
      isSaved: true 
    })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('timestamp sourceLang targetLang mqmScore summary wordCount title tags');
    
    // Get total count
    const total = await Run.countDocuments({ 
      _id: { $in: user.savedRuns },
      isSaved: true 
    });
    
    res.status(200).json({
      success: true,
      runs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Get saved runs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved runs',
      error: error.message
    });
  }
};

// Update run metadata (title, tags, notes)
exports.updateRunMetadata = async (req, res) => {
  try {
    const { runId } = req.params;
    const userId = req.user.id;
    const { title, tags, notes } = req.body;
    
    // Find the run
    const run = await Run.findById(runId);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Run not found'
      });
    }
    
    // Check if run belongs to user
    if (run.user && run.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this run'
      });
    }
    
    // If it's an anonymous run, associate it with the user
    if (!run.user) {
      run.user = userId;
      run.anonymousSessionId = null; // Remove anonymous association
    }
    
    // Update metadata fields
    if (title !== undefined) run.title = title;
    if (tags !== undefined) run.tags = tags;
    if (notes !== undefined) run.notes = notes;
    
    await run.save();
    
    res.status(200).json({
      success: true,
      message: 'Run metadata updated successfully',
      run: {
        _id: run._id,
        title: run.title,
        tags: run.tags,
        notes: run.notes
      }
    });
  } catch (error) {
    console.error('Update run metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update run metadata',
      error: error.message
    });
  }
};

// Get recent runs (for dashboard)
exports.getRecentRuns = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;
    
    // Get recent runs for this user
    const runs = await Run.find({ user: userId })
      .sort('-timestamp')
      .limit(limit)
      .select('timestamp sourceLang targetLang mqmScore summary wordCount title');
    
    res.status(200).json({
      success: true,
      runs
    });
  } catch (error) {
    console.error('Get recent runs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent runs',
      error: error.message
    });
  }
};

// Delete a run
exports.deleteRun = async (req, res) => {
  try {
    const { runId } = req.params;
    const userId = req.user.id;
    
    // Find the run
    const run = await Run.findById(runId);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Run not found'
      });
    }
    
    // Check if run belongs to user or if user is admin
    if (
      run.user && 
      run.user.toString() !== userId && 
      req.user.accountType !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this run'
      });
    }
    
    // If the run is saved, remove it from user's savedRuns array
    if (run.user && run.isSaved) {
      await User.updateOne(
        { _id: run.user },
        { $pull: { savedRuns: runId } }
      );
    }
    
    // Delete the run
    await Run.deleteOne({ _id: runId });
    
    res.status(200).json({
      success: true,
      message: 'Run deleted successfully'
    });
  } catch (error) {
    console.error('Delete run error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete run',
      error: error.message
    });
  }
};