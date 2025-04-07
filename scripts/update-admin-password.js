require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Admin user details
const adminEmail = 'admin@example.com';
const newPassword = 'admin123';

async function updateAdminPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Find admin user
    const user = await User.findOne({ email: adminEmail });
    
    if (!user) {
      console.log(`User with email ${adminEmail} not found`);
      return;
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    user.password = hashedPassword;
    await user.save();
    
    console.log(`Password updated successfully for ${adminEmail}`);
    console.log(`New password: ${newPassword}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error updating password:', error);
  }
}

// Run the function
updateAdminPassword();
