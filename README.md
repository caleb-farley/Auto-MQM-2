# Auto-MQM 

**Auto-MQM** is an advanced, AI-powered translation quality analysis tool designed for professional use in localization and content QA workflows. Built with a sleek UI and powered by LLMs, it provides users with accurate and automated translation quality assessments using the [MQM framework](https://themqm.org/).

## 🌍 Overview

FastFin supports both **bilingual** and **monolingual** modes, allowing you to assess translation accuracy, fluency, and terminology across a wide range of languages. It also integrates with Excel templates for structured QA documentation and supports usage tracking and subscription plans through Stripe.

## ✨ Features

- 🔍 **Translation Quality Analysis** using Multidimensional Quality Metrics (MQM)
- 🤖 **LLM-Powered Engines** (Claude 3 Sonnet, Haiku, Opus)
- 💬 **Bilingual & Monolingual Modes**
- 📊 **Score Calculation** with breakdown by issue type
- ✅ **Accept/Reject UI** for translation issues
- 📥 **Excel Upload Support** for batch processing
- 🔐 **Secure Authentication** with email verification and password reset
- 💳 **Stripe Integration** for subscriptions and usage-based access
- 🧪 **Model Selection** and cached result retrieval
- 📈 **Dashboard View** to monitor previous assessments
- 🌐 **Bidirectional Text Support** for RTL languages

## 🔒 Authentication System

### Email Verification

Auto-MQM implements a secure email verification system for new account registration:

1. **Registration Process**:
   - When a user registers, a verification email is sent to their email address
   - The account remains in an unverified state until the email is confirmed
   - Unverified users have limited access to the application

2. **Verification Flow**:
   - Verification emails contain a secure, time-limited token (valid for 24 hours)
   - Clicking the verification link confirms the email address
   - Upon successful verification, the user receives a welcome email

3. **Login Handling**:
   - Unverified users receive a notification to check their email when attempting to log in
   - Option to resend verification email if needed

### Password Reset

The password reset functionality allows users to securely recover their accounts:

1. **Reset Request**:
   - Users can request a password reset from the login page
   - A secure reset link is sent to the user's registered email
   - Reset tokens expire after 1 hour for security

2. **Reset Process**:
   - The reset page validates the token before allowing password changes
   - New passwords must meet security requirements (length, complexity)
   - Upon successful reset, the user can log in with their new password

### Admin User Management

Administrators have access to a user management dashboard:

1. **User Verification**:
   - View verification status of all users
   - Manually resend verification emails
   - Filter and search users by verification status

2. **Account Management**:
   - View all registered users and their account details
   - Delete user accounts if necessary
   - View usage statistics

## 🛠 Tech Stack

- HTML / CSS (Custom Dark Theme, Inter & Gothic Fonts)
- JavaScript (Vanilla JS, DOM Manipulation)
- Stripe JS v3
- Auth UI via `/auth-components.js`
- Claude 3 Integration (via backend API – not included in this repo)

## 🚀 Getting Started

1. Clone this repo:
   ```bash
   git clone https://github.com/your-username/auto-mqm.git
   cd auto-mqm
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.sample` to `.env`
   - Update with your configuration

4. Start the server:
   ```bash
   npm start
   ```

## 💰 Environment Variables

```
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/auto-mqm

# JWT Secret for authentication
JWT_SECRET=your_jwt_secret_here

# Claude API key for AI analysis
CLAUDE_API_KEY=your_claude_api_key

# Stripe API keys for payment processing
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Email Configuration for Verification
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=noreply@auto-mqm.com
