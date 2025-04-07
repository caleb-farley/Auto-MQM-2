require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// New admin user details
const newAdminUser = {
  email: 'superadmin@example.com',
  password: 'password123',
  name: 'Super Admin',
  accountType: 'admin'
};

async function debugAdminAccount() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Check existing admin user
    const existingAdmin = await User.findOne({ email: 'admin@example.com' });
    
    if (existingAdmin) {
      console.log('Found existing admin user:');
      console.log(`Email: ${existingAdmin.email}`);
      console.log(`Account Type: ${existingAdmin.accountType}`);
      console.log(`Password hash exists: ${!!existingAdmin.password}`);
      console.log(`Password hash length: ${existingAdmin.password ? existingAdmin.password.length : 0}`);
      
      // Try to manually validate a test password
      const testPassword = 'admin123';
      try {
        const isMatch = await bcrypt.compare(testPassword, existingAdmin.password);
        console.log(`Password 'admin123' matches: ${isMatch}`);
      } catch (error) {
        console.log('Error comparing passwords:', error.message);
      }
      
      // Delete the existing admin user to start fresh
      await User.deleteOne({ email: 'admin@example.com' });
      console.log('Deleted existing admin user');
    } else {
      console.log('No existing admin user found');
    }
    
    // Create a completely new admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newAdminUser.password, salt);
    
    const newAdmin = new User({
      email: newAdminUser.email,
      password: hashedPassword,
      name: newAdminUser.name,
      accountType: newAdminUser.accountType,
      lastLogin: new Date()
    });
    
    await newAdmin.save();
    console.log('Created new admin user:');
    console.log(`Email: ${newAdminUser.email}`);
    console.log(`Password: ${newAdminUser.password}`);
    console.log(`Account Type: ${newAdminUser.accountType}`);
    
    // Verify the new user can be found
    const verifyUser = await User.findOne({ email: newAdminUser.email });
    console.log(`Verified user exists: ${!!verifyUser}`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error debugging admin account:', error);
  }
}

// Run the function
debugAdminAccount();
