require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Admin user details - you can modify these
const adminUser = {
  email: 'admin@example.com',
  password: 'Admin123!',  // This will be hashed before saving
  name: 'Admin User',
  accountType: 'admin'
};

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Check if admin user already exists
    const existingUser = await User.findOne({ email: adminUser.email });
    
    if (existingUser) {
      // If user exists but is not admin, update to admin
      if (existingUser.accountType !== 'admin') {
        existingUser.accountType = 'admin';
        await existingUser.save();
        console.log(`User ${adminUser.email} updated to admin account`);
      } else {
        console.log(`Admin user ${adminUser.email} already exists`);
      }
    } else {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminUser.password, salt);
      
      // Create new admin user
      const newAdmin = new User({
        email: adminUser.email,
        password: hashedPassword,
        name: adminUser.name,
        accountType: adminUser.accountType,
        lastLogin: new Date()
      });
      
      await newAdmin.save();
      console.log(`Admin user created successfully:\nEmail: ${adminUser.email}\nPassword: ${adminUser.password}`);
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Run the function
createAdminUser();
