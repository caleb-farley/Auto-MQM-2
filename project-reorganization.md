# Auto-MQM Project Reorganization Plan

## Current Issues
- Frontend code (HTML, CSS, JS) is mixed in with backend code
- Large monolithic server.js file with complex nested try-catch blocks
- CSS is embedded in HTML rather than in separate files
- No clear separation between API routes and business logic
- Limited documentation for new developers or UX designers

## Proposed Structure

```
Auto-MQM/
├── src/                    # Backend source code
│   ├── api/                # API route definitions
│   │   ├── analysis.js     # MQM analysis endpoints
│   │   ├── auth.js         # Authentication endpoints
│   │   ├── translation.js  # Translation endpoints
│   │   └── index.js        # API router setup
│   ├── controllers/        # Business logic
│   │   ├── analysisController.js
│   │   ├── authController.js
│   │   └── translationController.js
│   ├── models/             # Database models
│   │   └── index.js
│   ├── middleware/         # Express middleware
│   │   ├── auth.js
│   │   └── errorHandler.js
│   └── utils/              # Utility functions
│       ├── segment.js
│       ├── languageUtils.js
│       ├── s3Service.js
│       └── emailService.js
├── public/                 # Frontend assets
│   ├── css/                # Separated CSS files
│   │   ├── main.css        # Main styles
│   │   ├── analysis.css    # Analysis-specific styles
│   │   └── responsive.css  # Responsive design styles
│   ├── js/                 # Frontend JavaScript
│   │   ├── main.js         # Core functionality
│   │   ├── analysis.js     # Analysis-specific code
│   │   ├── translation.js  # Translation-specific code
│   │   └── ui.js           # UI interactions
│   ├── images/             # Image assets
│   └── index.html          # Main HTML (much cleaner)
├── tests/                  # Test files
│   ├── api/                # API tests
│   ├── controllers/        # Controller tests
│   └── utils/              # Utility tests
├── docs/                   # Documentation
│   ├── api.md              # API documentation
│   ├── setup.md            # Setup instructions
│   └── frontend.md         # Frontend documentation for UX designers
├── server.js               # Entry point (much simpler)
├── package.json
└── README.md
```

## Implementation Plan

### Phase 1: Backend Reorganization
1. Split server.js into modular components
2. Move API routes to separate files
3. Extract business logic into controllers
4. Organize middleware

### Phase 2: Frontend Reorganization
1. Extract CSS from index.html into separate files
2. Split JavaScript into modular files
3. Clean up HTML structure
4. Implement better responsive design

### Phase 3: Documentation
1. Create API documentation
2. Add setup instructions
3. Create frontend documentation for UX designers

### Phase 4: Testing
1. Set up testing framework
2. Write tests for critical functionality

## Benefits
- **Easier Maintenance**: Smaller, focused files are easier to understand and modify
- **Better Collaboration**: UX designers can work on frontend without touching backend code
- **Improved Debugging**: Isolated components make it easier to identify and fix issues
- **Faster Development**: Clear structure reduces time spent navigating the codebase
- **Scalability**: Modular design makes it easier to add new features
