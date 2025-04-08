# Auto-MQM Project Structure

This document outlines the reorganized structure of the Auto-MQM codebase, designed to improve maintainability and collaboration.

## Directory Structure

```
Auto-MQM/
├── public/               # Frontend static assets
│   ├── css/             # Stylesheets
│   ├── js/              # Client-side JavaScript
│   ├── images/          # Images and icons
│   └── index.html       # Main HTML file
├── src/                 # Backend source code
│   ├── api/             # API route definitions
│   │   ├── analysis.js  # Analysis-related endpoints
│   │   ├── translation.js # Translation-related endpoints
│   │   ├── user.js      # User authentication endpoints
│   │   └── index.js     # API routes aggregator
│   ├── controllers/     # Business logic
│   │   ├── analysisController.js  # Analysis logic
│   │   ├── translationController.js # Translation logic
│   │   └── userController.js     # User management logic
│   ├── middleware/      # Express middleware
│   │   ├── auth.js      # Authentication middleware
│   │   └── errorHandler.js # Global error handler
│   ├── models/          # Database models
│   │   ├── User.js      # User model
│   │   ├── Run.js       # Analysis run model
│   │   └── ActionLog.js # Usage tracking model
│   ├── utils/           # Utility functions
│   │   ├── languageUtils.js # Language code utilities
│   │   ├── s3Service.js # AWS S3 integration
│   │   └── segment.js   # Text segmentation utilities
│   ├── app.js           # Express app configuration
│   └── server.js        # Server entry point
├── tests/               # Test files
├── .env                 # Environment variables
├── .env.sample          # Sample environment variables
├── package.json         # Project dependencies
└── README.md           # Project documentation
```

## Key Components

### Frontend

The frontend code is organized in the `public` directory with separate folders for CSS, JavaScript, and images to improve maintainability.

### Backend

The backend code follows a modular structure:

1. **API Routes**: Defined in the `src/api` directory, these files handle HTTP routing and parameter validation.

2. **Controllers**: Located in `src/controllers`, these contain the business logic for each feature area.

3. **Models**: Mongoose schemas in `src/models` define the database structure.

4. **Middleware**: Common middleware functions in `src/middleware` handle authentication, error handling, etc.

5. **Utilities**: Helper functions in `src/utils` provide reusable functionality.

## Running the Application

1. Install dependencies:
   ```
   npm install
   ```

2. Set up environment variables by copying `.env.sample` to `.env` and filling in your values.

3. Start the development server:
   ```
   npm run dev
   ```

4. For production:
   ```
   npm start
   ```

## Monolingual Mode

The application supports both bilingual and monolingual analysis modes:

- In **bilingual mode**, both source and target text are analyzed for translation quality.
- In **monolingual mode**, only the target text is analyzed for content quality.

The UI adapts to hide the source text input when in monolingual mode, and the backend uses different prompts for each mode.
