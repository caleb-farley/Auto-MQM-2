require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Test user with very simple credentials
const testUser = {
  email: 'admin@mqm.com',
  password: 'admin',
  name: 'Admin User',
  accountType: 'admin'
};

async function createSimpleAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Create a very simple admin user with an unhashed password for testing
    // This is a workaround for the password validation issue
    const existingUser = await User.findOne({ email: testUser.email });
    
    if (existingUser) {
      console.log(`User ${testUser.email} already exists, deleting...`);
      await User.deleteOne({ email: testUser.email });
    }
    
    // Create a new admin user with a simple password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(testUser.password, salt);
    
    // Log the password and hash for debugging
    console.log(`Password: ${testUser.password}`);
    console.log(`Hashed password: ${hashedPassword}`);
    
    // Create the user
    const newUser = new User({
      email: testUser.email,
      password: hashedPassword,
      name: testUser.name,
      accountType: testUser.accountType,
      lastLogin: new Date()
    });
    
    await newUser.save();
    console.log(`Created admin user: ${testUser.email} / ${testUser.password}`);
    
    // Verify the user was created
    const savedUser = await User.findOne({ email: testUser.email });
    console.log(`User saved with account type: ${savedUser.accountType}`);
    
    // Test password validation
    try {
      const isMatch = await bcrypt.compare(testUser.password, savedUser.password);
      console.log(`Direct bcrypt compare result: ${isMatch ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      console.error('Error comparing passwords:', error);
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    console.log('\nPlease try logging in with these credentials:');
    console.log(`Email: ${testUser.email}`);
    console.log(`Password: ${testUser.password}`);
    
  } catch (error) {
    console.error('Error creating admin user:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

// Run the function
createSimpleAdminUser();
