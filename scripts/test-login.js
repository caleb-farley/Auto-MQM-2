require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const axios = require('axios');

// Test credentials
const testUser = {
  email: 'test@example.com',
  password: 'test123',
  name: 'Test User',
  accountType: 'admin'
};

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Check if test user already exists
    let user = await User.findOne({ email: testUser.email });
    
    if (user) {
      console.log(`User ${testUser.email} already exists, updating password`);
      // Update password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(testUser.password, salt);
      user.password = hashedPassword;
      user.accountType = 'admin'; // Ensure admin privileges
      await user.save();
    } else {
      console.log(`Creating new user: ${testUser.email}`);
      // Create new user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(testUser.password, salt);
      
      user = new User({
        email: testUser.email,
        password: hashedPassword,
        name: testUser.name,
        accountType: testUser.accountType,
        lastLogin: new Date()
      });
      
      await user.save();
    }
    
    console.log(`Test user ready: ${testUser.email} / ${testUser.password}`);
    console.log(`Account type: ${user.accountType}`);
    
    // Check password validation directly
    const isValidPassword = await user.validatePassword(testUser.password);
    console.log(`Password validation test: ${isValidPassword ? 'PASSED' : 'FAILED'}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    console.log('\nPlease try logging in with these credentials:');
    console.log(`Email: ${testUser.email}`);
    console.log(`Password: ${testUser.password}`);
    
  } catch (error) {
    console.error('Error:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

// Run the function
createTestUser();
