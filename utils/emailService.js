const nodemailer = require('nodemailer');
const crypto = require('crypto');
// Use native crypto module instead of crypto-random-string
const generateRandomString = (length) => {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};

// Create a transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Email templates
const emailTemplates = {
  // Verification email template
  verification: (name, verificationLink) => {
    return {
      subject: 'Verify Your Email - Auto-MQM',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4299e1;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f8fafc;
              padding: 30px;
              border-radius: 0 0 5px 5px;
              border: 1px solid #e2e8f0;
              border-top: none;
            }
            .button {
              display: inline-block;
              background-color: #4299e1;
              color: white;
              text-decoration: none;
              padding: 12px 25px;
              border-radius: 4px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #718096;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification</h1>
            </div>
            <div class="content">
              <p>Hello${name ? ' ' + name : ''},</p>
              <p>Thank you for registering with Auto-MQM. To complete your registration and verify your email address, please click the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verificationLink}" class="button">Verify Email Address</a>
              </div>
              
              <p>If the button above doesn't work, you can also click on the link below or copy and paste it into your browser:</p>
              <p><a href="${verificationLink}">${verificationLink}</a></p>
              
              <p>This verification link will expire in 24 hours.</p>
              
              <p>If you did not create an account, you can safely ignore this email.</p>
              
              <p>Best regards,<br>The Auto-MQM Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Auto-MQM. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },
  
  // Welcome email template
  welcome: (name) => {
    return {
      subject: 'Welcome to Auto-MQM!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Auto-MQM</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4299e1;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f8fafc;
              padding: 30px;
              border-radius: 0 0 5px 5px;
              border: 1px solid #e2e8f0;
              border-top: none;
            }
            .feature {
              margin: 20px 0;
              padding: 15px;
              background-color: white;
              border-radius: 5px;
              border: 1px solid #e2e8f0;
            }
            .button {
              display: inline-block;
              background-color: #4299e1;
              color: white;
              text-decoration: none;
              padding: 12px 25px;
              border-radius: 4px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #718096;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Auto-MQM!</h1>
            </div>
            <div class="content">
              <p>Hello${name ? ' ' + name : ''},</p>
              <p>Thank you for verifying your email address and joining Auto-MQM. We're excited to have you on board!</p>
              
              <p>With Auto-MQM, you can:</p>
              
              <div class="feature">
                <h3>🔍 Analyze Translation Quality</h3>
                <p>Evaluate translation quality using the MQM framework with AI-powered assistance.</p>
              </div>
              
              <div class="feature">
                <h3>📊 Generate Reports</h3>
                <p>Get detailed reports on translation quality with error categorization and severity levels.</p>
              </div>
              
              <div class="feature">
                <h3>🌐 Support for Multiple Languages</h3>
                <p>Analyze translations across various language pairs with bidirectional text support.</p>
              </div>
              
              <div style="text-align: center;">
                <a href="https://auto-mqm.com" class="button">Get Started Now</a>
              </div>
              
              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              
              <p>Best regards,<br>The Auto-MQM Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Auto-MQM. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },
  
  // Password reset email template
  passwordReset: (name, resetLink) => {
    return {
      subject: 'Reset Your Password - Auto-MQM',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4299e1;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f8fafc;
              padding: 30px;
              border-radius: 0 0 5px 5px;
              border: 1px solid #e2e8f0;
              border-top: none;
            }
            .button {
              display: inline-block;
              background-color: #4299e1;
              color: white;
              text-decoration: none;
              padding: 12px 25px;
              border-radius: 4px;
              margin: 20px 0;
              font-weight: bold;
            }
            .warning {
              background-color: #fff5f5;
              border-left: 4px solid #f56565;
              padding: 10px 15px;
              margin: 20px 0;
              color: #c53030;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #718096;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset</h1>
            </div>
            <div class="content">
              <p>Hello${name ? ' ' + name : ''},</p>
              <p>We received a request to reset your password for your Auto-MQM account. To reset your password, please click the button below:</p>
              
              <div style="text-align: center;">
                <a href="${resetLink}" class="button">Reset Password</a>
              </div>
              
              <p>If the button above doesn't work, you can also click on the link below or copy and paste it into your browser:</p>
              <p><a href="${resetLink}">${resetLink}</a></p>
              
              <div class="warning">
                <p><strong>Important:</strong> This password reset link will expire in 1 hour.</p>
                <p>If you did not request a password reset, please ignore this email or contact support if you have concerns about your account security.</p>
              </div>
              
              <p>Best regards,<br>The Auto-MQM Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Auto-MQM. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }
};

// Generate token
const generateToken = () => {
  return generateRandomString(32);
};

// Generate verification token
const generateVerificationToken = async (user) => {
  // Generate a random token
  const token = generateRandomString(32);
  
  // Set token and expiration (24 hours)
  user.verificationToken = token;
  user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  // Save the user
  await user.save();
  
  return token;
};

// Generate password reset token
const generatePasswordResetToken = async (user) => {
  // Generate a random token
  const token = generateRandomString(32);
  
  // Set token and expiration (1 hour)
  user.resetPasswordToken = token;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  
  // Save the user
  await user.save();
  
  return token;
};

// Send verification email
const sendVerificationEmail = async (user, origin) => {
  const token = await generateVerificationToken(user);
  const verificationUrl = `${origin}/verify-email.html?token=${token}`;
  
  // Get email template
  const template = emailTemplates.verification(user.name, verificationUrl);
  
  // Create email content
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: template.subject,
    html: template.html
  };
  
  // Send email
  return transporter.sendMail(mailOptions);
};

// Send welcome email
const sendWelcomeEmail = async (user) => {
  // Get email template
  const template = emailTemplates.welcome(user.name);
  
  // Create email content
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: template.subject,
    html: template.html
  };
  
  // Send email
  return transporter.sendMail(mailOptions);
};

// Send password reset email
const sendPasswordResetEmail = async (user, origin) => {
  const token = await generatePasswordResetToken(user);
  const resetUrl = `${origin}/reset-password.html?token=${token}`;
  
  // Get email template
  const template = emailTemplates.passwordReset(user.name, resetUrl);
  
  // Create email content
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: template.subject,
    html: template.html
  };
  
  // Send email
  return transporter.sendMail(mailOptions);
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  generateToken
};
