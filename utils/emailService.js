const nodemailer = require('nodemailer');
const cryptoRandomString = require('crypto-random-string');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Generate verification token
const generateToken = () => {
  return cryptoRandomString({length: 32, type: 'url-safe'});
};

// Send verification email
const sendVerificationEmail = async (user, origin) => {
  const token = generateToken();
  const expiryTime = 24; // hours
  
  // Set verification token and expiry
  user.verificationToken = token;
  user.verificationTokenExpires = new Date(Date.now() + expiryTime * 60 * 60 * 1000);
  await user.save();
  
  // Create verification URL
  const verificationUrl = `${origin}/verify-email?token=${token}`;
  
  // Email content
  const subject = 'Auto-MQM - Verify Your Email';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d3748;">Verify Your Email Address</h2>
      <p>Thank you for registering with Auto-MQM. Please click the button below to verify your email address:</p>
      <div style="margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email</a>
      </div>
      <p>This link will expire in ${expiryTime} hours.</p>
      <p>If you did not create an account, you can safely ignore this email.</p>
      <p>If you're having trouble clicking the button, copy and paste the URL below into your web browser:</p>
      <p style="word-break: break-all; color: #718096;">${verificationUrl}</p>
    </div>
  `;
  
  // Send email
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Auto-MQM" <${process.env.EMAIL_FROM}>`,
    to: user.email,
    subject,
    html
  });
};

// Send password reset email
const sendPasswordResetEmail = async (user, origin) => {
  const token = generateToken();
  const expiryTime = 1; // hours
  
  // Set reset token and expiry
  user.resetPasswordToken = token;
  user.resetPasswordExpires = new Date(Date.now() + expiryTime * 60 * 60 * 1000);
  await user.save();
  
  // Create reset URL
  const resetUrl = `${origin}/reset-password?token=${token}`;
  
  // Email content
  const subject = 'Auto-MQM - Reset Your Password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d3748;">Reset Your Password</h2>
      <p>You are receiving this email because you (or someone else) requested a password reset. Please click the button below to reset your password:</p>
      <div style="margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
      </div>
      <p>This link will expire in ${expiryTime} hour.</p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
      <p>If you're having trouble clicking the button, copy and paste the URL below into your web browser:</p>
      <p style="word-break: break-all; color: #718096;">${resetUrl}</p>
    </div>
  `;
  
  // Send email
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Auto-MQM" <${process.env.EMAIL_FROM}>`,
    to: user.email,
    subject,
    html
  });
};

// Send welcome email after verification
const sendWelcomeEmail = async (user) => {
  // Email content
  const subject = 'Welcome to Auto-MQM!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d3748;">Welcome to Auto-MQM!</h2>
      <p>Thank you for verifying your email address. Your account is now fully activated.</p>
      <p>With Auto-MQM, you can:</p>
      <ul>
        <li>Perform automated MQM assessments on translations</li>
        <li>Save and track your assessment history</li>
        <li>Export detailed reports</li>
      </ul>
      <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
      <p>Happy translating!</p>
      <p>The Auto-MQM Team</p>
    </div>
  `;
  
  // Send email
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Auto-MQM" <${process.env.EMAIL_FROM}>`,
    to: user.email,
    subject,
    html
  });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  generateToken
};
