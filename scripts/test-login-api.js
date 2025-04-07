import 'dotenv/config';
import fetch from 'node-fetch';

// Test credentials
const testCredentials = [
  {
    email: 'superadmin@example.com',
    password: 'password123'
  },
  {
    email: 'admin@example.com',
    password: 'admin123'
  },
  // Add a test user with a very simple password
  {
    email: 'test@example.com',
    password: 'test123'
  }
];

async function testLoginAPI() {
  try {
    console.log('Testing login API with different credentials...');
    
    for (const creds of testCredentials) {
      console.log(`\nTesting login with: ${creds.email}`);
      
      try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: creds.email,
            password: creds.password
          })
        });
        
        const data = await response.json();
        
        console.log(`Status: ${response.status}`);
        console.log('Response:', data);
        
        if (response.ok) {
          console.log('✅ Login successful!');
        } else {
          console.log('❌ Login failed!');
        }
      } catch (error) {
        console.error(`Error testing login for ${creds.email}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error testing login API:', error);
  }
}

// Create a test user first
async function createTestUser() {
  try {
    const mongoose = require('mongoose');
    const bcrypt = require('bcryptjs');
    const User = require('../models/User');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Create a test user with very simple credentials
    const testUser = {
      email: 'test@example.com',
      password: 'test123',
      name: 'Test User',
      accountType: 'admin'
    };
    
    // Check if test user already exists
    const existingUser = await User.findOne({ email: testUser.email });
    
    if (existingUser) {
      // Update password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(testUser.password, salt);
      existingUser.password = hashedPassword;
      await existingUser.save();
      console.log(`Updated test user: ${testUser.email} with password: ${testUser.password}`);
    } else {
      // Create new user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(testUser.password, salt);
      
      const newUser = new User({
        email: testUser.email,
        password: hashedPassword,
        name: testUser.name,
        accountType: testUser.accountType,
        lastLogin: new Date()
      });
      
      await newUser.save();
      console.log(`Created test user: ${testUser.email} with password: ${testUser.password}`);
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    // Now test the login API
    await testLoginAPI();
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

// Run the functions
createTestUser();
