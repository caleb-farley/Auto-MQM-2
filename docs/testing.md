# Testing Guide for Auto-MQM

## Running Tests

### 1. Start the Server
```bash
PORT=5001 node src/server.js
```

### 2. Test Monolingual Review

#### a. Test XLIFF Files
```bash
# Test XLIFF monolingual review
curl -X POST -F "file=@test.xlf" -F "targetLang=es" -F "mode=monolingual" http://localhost:5001/api/mqm-analysis
```

#### b. Test TMX Files
```bash
# Test TMX monolingual review
curl -X POST -F "file=@test.tmx" -F "targetLang=es" -F "mode=monolingual" http://localhost:5001/api/mqm-analysis
```

#### c. Test Plain Text
```bash
# Test plain text monolingual review
curl -X POST -H "Content-Type: application/json" -d '{
  "targetText": "¡Bienvenido a nuestra aplicación!\nEste es un archivo de ejemplo.\nPor favor, configure sus ajustes a continuación.",
  "targetLang": "es",
  "mode": "monolingual"
}' http://localhost:5001/api/mqm-analysis
```

### 3. Test User Authentication

#### a. Register User
```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "name": "Test User",
  "email": "test@example.com",
  "password": "testpassword123"
}' http://localhost:5001/api/users/register
```

#### b. Login User
```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "email": "test@example.com",
  "password": "testpassword123"
}' http://localhost:5001/api/users/login
```

## Adding Support for New File Types

To add support for a new file type, you need to modify these files:

1. **Run Model** (`src/models/Run.js`):
```javascript
// Add new file type to the enum
fileType: {
  type: String,
  enum: ['tmx', 'xlf', 'xliff', 'your_new_type'],
  required: true
}
```

2. **Analysis Controller** (`src/controllers/analysisController.js`):
```javascript
// Normalize file type if needed
if (fileType === 'your_short_type') {
  fileType = 'your_full_type';
}
```

3. **Segmentation Utility** (`src/utils/segment.js`):
```javascript
// Add new case for parsing
switch (fileType) {
  case 'tmx':
    return parseTMX(fileBuffer);
  case 'xliff':
  case 'xlf':
    return parseXLIFF(fileBuffer);
  case 'your_new_type':
    return parseYourNewType(fileBuffer);
}

// Add parser function
function parseYourNewType(fileBuffer) {
  // Implementation for parsing your file type
  return {
    sourceText: '',
    targetText: '',
    sourceLang: '',
    targetLang: ''
  };
}
```

4. **API Routes** (`src/api/analysis.js`):
```javascript
// Update multer file type validation
const upload = multer({
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'your/mime-type' || 
        file.originalname.endsWith('.your_extension')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

### Testing New File Types

After adding support for a new file type:

1. Create a test file with your new format
2. Test monolingual review:
```bash
curl -X POST -F "file=@test.your_extension" -F "targetLang=es" -F "mode=monolingual" http://localhost:5001/api/mqm-analysis
```
3. Test bilingual review:
```bash
curl -X POST -F "file=@test.your_extension" -F "sourceLang=en" -F "targetLang=es" -F "mode=bilingual" http://localhost:5001/api/mqm-analysis
```

### Current Limitations

- File size limit: 50MB
- Supported languages: Check ISO 639-1 codes
- Word count limits by account type:
  - Anonymous: 500 words
  - Premium: 1,000 words
  - Professional: 2,000 words
  - Enterprise: 5,000 words
  - Admin: 10,000 words
