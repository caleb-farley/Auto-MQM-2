// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');

// Import models
const Run = require('./models/Run');
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/authRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const runRoutes = require('./routes/runRoutes');

// Import middleware
const authMiddleware = require('./middleware/authMiddleware');

// Load environment variables
dotenv.config();

mongoose.connection.on('connected', () => {
  console.log('🔌 Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

// 🔥 MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// Initialize Express app
const app = express();

// CORS setup
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || true
    : true,
  credentials: true // Allow cookies to be sent with requests
}));

// Special middleware for Stripe webhook (must be before express.json())
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Regular middleware
app.use(express.json());
app.use(cookieParser());
// Mount route handlers
app.use('/api/auth', authRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/runs', runRoutes);
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'public')));

// Language detection endpoint
app.post('/api/detect-language', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.length < 10) {
      return res.status(400).json({ error: 'Text too short for reliable detection' });
    }

    const detectLanguageApiKey = process.env.DETECT_LANGUAGE_API_KEY;

    if (!detectLanguageApiKey) {
      return res.status(500).json({ error: 'Language detection API key not configured' });
    }

    const response = await axios.post(
      'https://ws.detectlanguage.com/0.2/detect',
      new URLSearchParams({ q: text }), // detectlanguage.com expects form-encoded params
      {
        headers: {
          'Authorization': `Bearer ${detectLanguageApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const detections = response.data?.data?.detections;

    if (!detections || detections.length === 0) {
      return res.status(500).json({ error: 'No language detected' });
    }

    const topDetection = detections[0];

    return res.json({
      detectedLanguage: topDetection.language,
      confidence: topDetection.confidence,
      reliable: topDetection.isReliable
    });
  } catch (error) {
    console.error('Language detection error:', error);
    return res.status(500).json({ error: 'Language detection failed' });
  }
});

// Source/Target Alignment Check Endpoint
app.post('/api/check-alignment', authMiddleware.optionalAuth, async (req, res) => {
  try {
    const { sourceText, targetText, sourceLang, targetLang } = req.body;

    if (!sourceText || !targetText) {
      return res.status(400).json({ error: 'Both sourceText and targetText are required' });
    }

    const claudeApiKey = process.env.CLAUDE_API_KEY;

    if (!claudeApiKey) {
      return res.status(500).json({ error: 'Claude API key not configured' });
    }

    const alignmentPrompt = `
You are a bilingual language expert. Determine if the following source text and target text are accurate translations of each other.

Source language: ${sourceLang || 'undetermined'}
Target language: ${targetLang || 'undetermined'}

Source text:
"""
${sourceText}
"""

Target text:
"""
${targetText}
"""

Please respond in **valid JSON** format like this:
{
  "match": true,
  "confidence": 87,
  "reason": "The texts align closely with only minor stylistic differences."
}
`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: "claude-3-sonnet-20240229",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: alignmentPrompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const alignmentText = response.data?.content?.[0]?.text;
    const jsonMatch = alignmentText.match(/\{[\s\S]*?\}/);

    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse alignment result' });
    }

    const alignmentResult = JSON.parse(jsonMatch[0]);

    if (!alignmentResult.match || alignmentResult.confidence < 60) {
      return res.status(400).json({
        error: 'Assessment cannot be conducted because the source and target do not appear to match.',
        matchConfidence: alignmentResult.confidence,
        reason: alignmentResult.reason
      });
    }

    return res.json({
      match: true,
      confidence: alignmentResult.confidence,
      reason: alignmentResult.reason
    });
  } catch (error) {
    console.error('Alignment check error:', error);
    return res.status(500).json({
      error: 'Alignment check failed',
      message: error.message
    });
  }
});

// Excel template download endpoint
app.get('/api/download-template', authMiddleware.optionalAuth, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // Add an instructions sheet
    const instructionsSheet = workbook.addWorksheet('Instructions');
    
    // Configure columns for instructions
    instructionsSheet.columns = [
      { header: '', key: 'instructions', width: 100 }
    ];
    
    // Add instruction content with formatting
    instructionsSheet.addRow(['Bilingual MQM Assessment Template']);
    const titleRow = instructionsSheet.lastRow;
    titleRow.font = { bold: true, size: 16 };
    titleRow.height = 30;
    
    instructionsSheet.addRow(['']);
    instructionsSheet.addRow(['HOW TO USE THIS TEMPLATE']);
    const howToUseRow = instructionsSheet.lastRow;
    howToUseRow.font = { bold: true, size: 14 };
    
    instructionsSheet.addRow(['']);
    instructionsSheet.addRow(['1. Fill in source and target language information in the Settings sheet']);
    instructionsSheet.addRow(['2. Enter your source text and target text in the Content sheet']);
    instructionsSheet.addRow(['3. For each segment that has quality issues, add entries in the Issues sheet']);
    instructionsSheet.addRow(['4. Use the categories and severity levels as defined in the MQM framework']);
    instructionsSheet.addRow(['5. Save the file and upload it through the web interface for automated processing']);
    instructionsSheet.addRow(['']);
    
    instructionsSheet.addRow(['MQM CATEGORIES AND DEFINITIONS']);
    const mqmCatRow = instructionsSheet.lastRow;
    mqmCatRow.font = { bold: true, size: 14 };
    
    instructionsSheet.addRow(['']);
    instructionsSheet.addRow(['Accuracy']);
    instructionsSheet.lastRow.font = { bold: true };
    instructionsSheet.addRow(['- Mistranslation: Content in target language that misrepresents source content']);
    instructionsSheet.addRow(['- Omission: Content missing from translation that is present in source']);
    instructionsSheet.addRow(['- Addition: Content added to translation that is not present in source']);
    instructionsSheet.addRow(['- Untranslated: Source content not translated that should be']);
    
    instructionsSheet.addRow(['']);
    instructionsSheet.addRow(['Fluency']);
    instructionsSheet.lastRow.font = { bold: true };
    instructionsSheet.addRow(['- Grammar: Issues related to grammar, syntax, or morphology']);
    instructionsSheet.addRow(['- Spelling: Spelling errors or typos']);
    instructionsSheet.addRow(['- Punctuation: Incorrect or inconsistent punctuation']);
    instructionsSheet.addRow(['- Typography: Issues with formatting, capitalization, or other typographical elements']);
    
    instructionsSheet.addRow(['']);
    instructionsSheet.addRow(['Terminology']);
    instructionsSheet.lastRow.font = { bold: true };
    instructionsSheet.addRow(['- Inconsistent: Terminology used inconsistently within the text']);
    instructionsSheet.addRow(['- Inappropriate: Wrong terms used for the context or domain']);
    
    instructionsSheet.addRow(['']);
    instructionsSheet.addRow(['Style']);
    instructionsSheet.lastRow.font = { bold: true };
    instructionsSheet.addRow(['- Awkward: Translation sounds unnatural or awkward']);
    instructionsSheet.addRow(['- Cultural: Cultural references incorrectly adapted']);
    
    instructionsSheet.addRow(['']);
    instructionsSheet.addRow(['SEVERITY LEVELS']);
    const severityRow = instructionsSheet.lastRow;
    severityRow.font = { bold: true, size: 14 };
    
    instructionsSheet.addRow(['']);
    instructionsSheet.addRow(['Minor (1 point): Issues that don\'t significantly impact understanding']);
    instructionsSheet.addRow(['Major (5 points): Issues that significantly impact understanding but don\'t completely change meaning']);
    instructionsSheet.addRow(['Critical (10 points): Issues that completely change the meaning or could lead to serious consequences']);
    
    // Add settings sheet for language selection
    const settingsSheet = workbook.addWorksheet('Settings');
    settingsSheet.columns = [
      { header: 'Setting', key: 'setting', width: 30 },
      { header: 'Value', key: 'value', width: 30 }
    ];
    
    const headerRow = settingsSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    
    settingsSheet.addRow(['Source Language', '']);
    settingsSheet.addRow(['Target Language', '']);
    
    // Add content sheet for source and target content
    const contentSheet = workbook.addWorksheet('Content');
    contentSheet.columns = [
      { header: 'Source Text', key: 'source', width: 50 },
      { header: 'Target Text', key: 'target', width: 50 }
    ];
    
    const contentHeaderRow = contentSheet.getRow(1);
    contentHeaderRow.font = { bold: true };
    contentHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    contentHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    
    // Add assessment sheet for issues
    const issuesSheet = workbook.addWorksheet('Issues');
    issuesSheet.columns = [
      { header: 'Segment', key: 'segment', width: 40 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Subcategory', key: 'subcategory', width: 20 },
      { header: 'Severity', key: 'severity', width: 15 },
      { header: 'Explanation', key: 'explanation', width: 40 },
      { header: 'Suggested Fix', key: 'suggestion', width: 40 }
    ];
    
    const issuesHeaderRow = issuesSheet.getRow(1);
    issuesHeaderRow.font = { bold: true };
    issuesHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    issuesHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    
    // Add validation for Category column
    issuesSheet.getCell('B2').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Accuracy,Fluency,Terminology,Style,Design"']
    };
    
    // Add validation for Severity column
    issuesSheet.getCell('D2').dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Minor,Major,Critical"']
    };
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="mqm_template.xlsx"');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel template generation error:', err);
    res.status(500).json({ error: 'Failed to generate Excel template' });
  }
});

// MQM analysis endpoint using Claude API
app.post('/api/mqm-analysis', 
  authMiddleware.optionalAuth, 
  authMiddleware.checkUsageLimit,
  authMiddleware.trackUsage,
  async (req, res) => {
  try {
    const { sourceText, targetText, sourceLang, targetLang } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

let location = {};
try {
  const geoResponse = await axios.get(`https://ipapi.co/${ip}/json/`);
  location = {
    ip,
    city: geoResponse.data.city,
    region: geoResponse.data.region,
    country: geoResponse.data.country_name,
    org: geoResponse.data.org
  };
} catch (err) {
  console.warn('🌐 Could not fetch geolocation:', err.message);
}
    
    if (!sourceText || !targetText || !sourceLang || !targetLang) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Check word count limit
    const words = sourceText.trim().split(/\s+/);
    const wordCount = words.length > 0 && words[0] !== '' ? words.length : 0;
    const WORD_COUNT_LIMIT = 500;
    
    if (wordCount > WORD_COUNT_LIMIT) {
      return res.status(400).json({ error: `Source text exceeds the ${WORD_COUNT_LIMIT} word limit` });
    }
    
    // API key from environment variable
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    
    if (!claudeApiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    // Construct prompt for Claude using MQM framework
    const prompt = `
You are a localization QA expert using the MQM (Multidimensional Quality Metrics) framework to evaluate translations. Please analyze the following source and target text pair and provide a detailed quality assessment.

Source language: ${sourceLang}
Target language: ${targetLang}

Source text:
"""
${sourceText}
"""

Target text:
"""
${targetText}
"""

Perform a detailed MQM analysis using the following error categories:
1. Accuracy
   - Mistranslation: Content in target language that misrepresents source content
   - Omission: Content missing from translation that is present in source
   - Addition: Content added to translation that is not present in source
   - Untranslated: Source content not translated that should be

2. Fluency
   - Grammar: Issues related to grammar, syntax, or morphology
   - Spelling: Spelling errors or typos
   - Punctuation: Incorrect or inconsistent punctuation
   - Typography: Issues with formatting, capitalization, or other typographical elements
   
3. Terminology
   - Inconsistent: Terminology used inconsistently within the text
   - Inappropriate: Wrong terms used for the context or domain

4. Style
   - Awkward: Translation sounds unnatural or awkward
   - Cultural: Cultural references incorrectly adapted

5. Design
   - Length: Target text is too long or too short relative to space constraints
   - Markup/Code: Issues with tags, placeholders, or code elements

For each issue found, provide:
- Category and subcategory
- Severity (Minor=1, Major=5, Critical=10)
- Explanation
- Location (if possible, provide specific information like character positions or word indices)
- The exact problematic text segment from the target translation
- A suggested fix (textual description of what needs to be changed)
- A fully corrected version of the entire segment with the fix applied
- Provide the exact **start and end character positions** of the segment in the target text.

Also provide an MQM score calculated as:
MQM Score = 100 - (sum of error points / word count * 100)
Where:
- Minor issues = 1 point
- Major issues = 5 points
- Critical issues = 10 points

Return ONLY valid JSON without any other text. Use this exact structure:
{
  "mqmIssues": [
    {
      "category": "Accuracy",
      "subcategory": "Mistranslation",
      "severity": "MAJOR",
      "explanation": "...",
      "location": "...",
      "segment": "...",
      "suggestion": "...",
      "correctedSegment": "..."
      "startIndex": 45,
      "endIndex": 68
    },
    ...
  ],
  "categories": {
    "Accuracy": { "count": 0, "points": 0 },
    "Fluency": { "count": 0, "points": 0 },
    "Terminology": { "count": 0, "points": 0 },
    "Style": { "count": 0, "points": 0 },
    "Design": { "count": 0, "points": 0 }
  },
  "wordCount": 120,
  "overallScore": 95,
  "summary": "..."
}

For the location field, try to be as specific as possible. Preferred format is:
- For specific words: "Word 5-7 in sentence 2" or "Characters 120-135"
- For sentences: "Sentence 3 in paragraph 2"
- For paragraphs: "Paragraph 4"

For the segment field, include ONLY the exact problematic text from the target translation.
For the correctedSegment field, provide the complete fixed version of the segment with all corrections applied.

For example, if the segment is "The internationale women day" and the issue is terminology inconsistency, then correctedSegment might be "La journée internationale des femmes".
`;

    // Call Claude API
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: "claude-3-sonnet-20240229", // Or your preferred model
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    // Extract the content from Claude's response
    const content = response.data.content[0].text;
    console.log('🧠 Claude response:', content);
    
    // Find and parse the JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON match found in Claude response');
      return res.status(500).json({ error: 'Could not parse analysis results' });
    }
    
    console.log('📦 Parsed JSON string:', jsonMatch[0]);    
    
    try {
      const mqmResults = JSON.parse(jsonMatch[0]);

      // Prepare run document with user info if authenticated
      const runData = {
        sourceText,
        targetText,
        sourceLang,
        targetLang,
        alignmentConfidence: req.body.matchConfidence || 100,
        alignmentReason: req.body.reason || 'N/A',
        mqmScore: mqmResults.overallScore,
        issues: mqmResults.mqmIssues,
        ip: location.ip,
        location,
        wordCount: mqmResults.wordCount
      };

      // Add user association if authenticated
      if (req.user) {
        runData.user = req.user.id;
      } else if (req.cookies.anonymousSessionId) {
        runData.anonymousSessionId = req.cookies.anonymousSessionId;
      }

      const runDoc = await Run.create(runData);

      // ✅ Include _id in the response
      return res.json({ ...mqmResults, _id: runDoc._id });
      
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return res.status(500).json({ error: 'Could not parse analysis results' });
    }
    
  } catch (error) {
    console.error('MQM analysis error:', error);
    return res.status(500).json({ 
      error: 'Analysis failed',
      message: error.message
    });
  }
});

const { Readable } = require('stream');

app.get('/api/download-report/:id/pdf', authMiddleware.optionalAuth, async (req, res) => {
  try {
    const run = await Run.findById(req.params.id);
    // Check authorization
    if (run.user && req.user && (run.user.toString() !== req.user.id && req.user.accountType !== 'admin')) {
      return res.status(403).json({ error: 'You do not have permission to access this report' });
    }

    if (!run.user && run.anonymousSessionId && run.anonymousSessionId !== req.cookies.anonymousSessionId) {
      return res.status(403).json({ error: 'You do not have permission to access this report' });
    }
    if (!run) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const doc = new PDFDocument();
    const filename = `mqm_report_${run._id}.pdf`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');

    doc.pipe(res);

    doc.fontSize(18).text('MQM Quality Report', { underline: true });
    doc.moveDown();

    doc.fontSize(12).text(`Source Language: ${run.sourceLang}`);
    doc.text(`Target Language: ${run.targetLang}`);
    doc.text(`Word Count: ${run.wordCount || 'N/A'}`);
    doc.text(`Overall Score: ${run.mqmScore}`);
    doc.text(`Summary: ${run.summary || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('Issues:', { underline: true });
    doc.moveDown();

    run.issues.forEach((issue, index) => {
      doc.fontSize(12).text(`${index + 1}. [${issue.category} > ${issue.subcategory}]`);
      doc.text(`Severity: ${issue.severity}`);
      doc.text(`Explanation: ${issue.explanation}`);
      doc.text(`Segment: "${issue.segment}"`);
      doc.text(`Suggestion: ${issue.suggestion}`);
      doc.text(`Corrected: ${issue.correctedSegment}`);
      doc.text(`Location: ${issue.location || `${issue.startIndex}-${issue.endIndex}`}`);
      doc.moveDown();
    });

    doc.end();
  } catch (err) {
    console.error('PDF download error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Add multer for file uploads
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx) are allowed'), false);
    }
  }
});

// Upload and process Excel template
app.post('/api/upload-excel', 
  upload.single('excelFile'),
  authMiddleware.optionalAuth,
  authMiddleware.checkUsageLimit,
  authMiddleware.trackUsage,
  async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    // Extract settings
    const settingsSheet = workbook.getWorksheet('Settings');
    if (!settingsSheet) {
      return res.status(400).json({ error: 'Invalid template: Settings sheet not found' });
    }

    let sourceLang = '';
    let targetLang = '';

    // Extract source and target languages
    settingsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        const setting = row.getCell(1).value;
        const value = row.getCell(2).value;
        
        if (setting === 'Source Language') {
          sourceLang = value;
        } else if (setting === 'Target Language') {
          targetLang = value;
        }
      }
    });

    if (!sourceLang || !targetLang) {
      return res.status(400).json({ error: 'Source or target language not specified in the template' });
    }

    // Extract content
    const contentSheet = workbook.getWorksheet('Content');
    if (!contentSheet) {
      return res.status(400).json({ error: 'Invalid template: Content sheet not found' });
    }

    let sourceText = '';
    let targetText = '';

    // Extract source and target text
    contentSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        const source = row.getCell(1).value || '';
        const target = row.getCell(2).value || '';
        
        sourceText += source + '\n';
        targetText += target + '\n';
      }
    });

    sourceText = sourceText.trim();
    targetText = targetText.trim();

    if (!sourceText || !targetText) {
      return res.status(400).json({ error: 'Source or target text is empty' });
    }

    // Check word count limit
    const words = sourceText.trim().split(/\s+/);
    const wordCount = words.length > 0 && words[0] !== '' ? words.length : 0;
    const WORD_COUNT_LIMIT = 500;
    
    if (wordCount > WORD_COUNT_LIMIT) {
      return res.status(400).json({ error: `Source text exceeds the ${WORD_COUNT_LIMIT} word limit` });
    }

    // Extract issues from Excel file (if any)
    const issuesSheet = workbook.getWorksheet('Issues');
    if (!issuesSheet) {
      return res.status(400).json({ error: 'Invalid template: Issues sheet not found' });
    }

    const userProvidedIssues = [];

    // Extract issue details from Excel
    issuesSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        const segment = row.getCell(1).value || '';
        const category = row.getCell(2).value || '';
        const subcategory = row.getCell(3).value || '';
        const severityText = row.getCell(4).value || '';
        const explanation = row.getCell(5).value || '';
        const suggestion = row.getCell(6).value || '';

        if (segment && category && subcategory && severityText) {
          // Map severity text to severity level
          let severity;
          
          switch (severityText.trim().toLowerCase()) {
            case 'minor':
              severity = 'MINOR';
              break;
            case 'major':
              severity = 'MAJOR';
              break;
            case 'critical':
              severity = 'CRITICAL';
              break;
            default:
              severity = 'MINOR'; // Default to minor if not specified correctly
          }

          // Create issue object
          userProvidedIssues.push({
            category,
            subcategory,
            severity,
            explanation,
            segment,
            suggestion,
            correctedSegment: suggestion // Use suggestion as corrected segment if provided
          });
        }
      }
    });

    // Run Claude MQM analysis on the extracted text, just like /api/mqm-analysis endpoint
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    
    if (!claudeApiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    // Construct prompt for Claude using MQM framework (same as in /api/mqm-analysis)
    const prompt = `
You are a localization QA expert using the MQM (Multidimensional Quality Metrics) framework to evaluate translations. Please analyze the following source and target text pair and provide a detailed quality assessment.

Source language: ${sourceLang}
Target language: ${targetLang}

Source text:
"""
${sourceText}
"""

Target text:
"""
${targetText}
"""

Perform a detailed MQM analysis using the following error categories:
1. Accuracy
   - Mistranslation: Content in target language that misrepresents source content
   - Omission: Content missing from translation that is present in source
   - Addition: Content added to translation that is not present in source
   - Untranslated: Source content not translated that should be

2. Fluency
   - Grammar: Issues related to grammar, syntax, or morphology
   - Spelling: Spelling errors or typos
   - Punctuation: Incorrect or inconsistent punctuation
   - Typography: Issues with formatting, capitalization, or other typographical elements
   
3. Terminology
   - Inconsistent: Terminology used inconsistently within the text
   - Inappropriate: Wrong terms used for the context or domain

4. Style
   - Awkward: Translation sounds unnatural or awkward
   - Cultural: Cultural references incorrectly adapted

5. Design
   - Length: Target text is too long or too short relative to space constraints
   - Markup/Code: Issues with tags, placeholders, or code elements

For each issue found, provide:
- Category and subcategory
- Severity (Minor=1, Major=5, Critical=10)
- Explanation
- Location (if possible, provide specific information like character positions or word indices)
- The exact problematic text segment from the target translation
- A suggested fix (textual description of what needs to be changed)
- A fully corrected version of the entire segment with the fix applied
- Provide the exact **start and end character positions** of the segment in the target text.

Also provide an MQM score calculated as:
MQM Score = 100 - (sum of error points / word count * 100)
Where:
- Minor issues = 1 point
- Major issues = 5 points
- Critical issues = 10 points

Return ONLY valid JSON without any other text. Use this exact structure:
{
  "mqmIssues": [
    {
      "category": "Accuracy",
      "subcategory": "Mistranslation",
      "severity": "MAJOR",
      "explanation": "...",
      "location": "...",
      "segment": "...",
      "suggestion": "...",
      "correctedSegment": "..."
      "startIndex": 45,
      "endIndex": 68
    },
    ...
  ],
  "categories": {
    "Accuracy": { "count": 0, "points": 0 },
    "Fluency": { "count": 0, "points": 0 },
    "Terminology": { "count": 0, "points": 0 },
    "Style": { "count": 0, "points": 0 },
    "Design": { "count": 0, "points": 0 }
  },
  "wordCount": 120,
  "overallScore": 95,
  "summary": "..."
}

For the location field, try to be as specific as possible. Preferred format is:
- For specific words: "Word 5-7 in sentence 2" or "Characters 120-135"
- For sentences: "Sentence 3 in paragraph 2"
- For paragraphs: "Paragraph 4"

For the segment field, include ONLY the exact problematic text from the target translation.
For the correctedSegment field, provide the complete fixed version of the segment with all corrections applied.

For example, if the segment is "The internationale women day" and the issue is terminology inconsistency, then correctedSegment might be "La journée internationale des femmes".
`;

    // Call Claude API
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: "claude-3-sonnet-20240229",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    // Extract the content from Claude's response
    const content = response.data.content[0].text;
    console.log('🧠 Claude response for Excel upload:', content);
    
    // Find and parse the JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON match found in Claude response');
      return res.status(500).json({ error: 'Could not parse analysis results' });
    }
    
    let mqmResults;
    try {
      mqmResults = JSON.parse(jsonMatch[0]);
      
      // Merge Claude's issues with user-provided issues from Excel (if any)
      if (userProvidedIssues.length > 0) {
        mqmResults.mqmIssues = [...mqmResults.mqmIssues, ...userProvidedIssues];
        
        // Recalculate category counts and points
        mqmResults.categories = {
          "Accuracy": { count: 0, points: 0 },
          "Fluency": { count: 0, points: 0 },
          "Terminology": { count: 0, points: 0 },
          "Style": { count: 0, points: 0 },
          "Design": { count: 0, points: 0 }
        };
        
        let totalPoints = 0;
        mqmResults.mqmIssues.forEach(issue => {
          if (mqmResults.categories[issue.category]) {
            mqmResults.categories[issue.category].count++;
            
            let points = 0;
            if (issue.severity === 'MINOR') points = 1;
            else if (issue.severity === 'MAJOR') points = 5;
            else if (issue.severity === 'CRITICAL') points = 10;
            
            mqmResults.categories[issue.category].points += points;
            totalPoints += points;
          }
        });
        
        // Recalculate overall score
        mqmResults.overallScore = Math.max(0, Math.min(100, 100 - (totalPoints / wordCount * 100)));
        
        // Update summary based on new score
        if (mqmResults.overallScore >= 90) {
          mqmResults.summary = "The translation is generally good with only minor issues. It accurately conveys the source content with a few small improvements possible.";
        } else if (mqmResults.overallScore >= 70) {
          mqmResults.summary = "The translation has a few issues that should be addressed, but is generally acceptable. Some accuracy and fluency improvements would enhance quality.";
        } else {
          mqmResults.summary = "The translation has several significant issues that need addressing. Major improvements in accuracy and fluency are recommended.";
        }
      }
      
      // Save to database
      const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
      let location = {};
      
      try {
        const geoResponse = await axios.get(`https://ipapi.co/${ip}/json/`);
        location = {
          ip,
          city: geoResponse.data.city,
          region: geoResponse.data.region,
          country: geoResponse.data.country_name,
          org: geoResponse.data.org
        };
      } catch (err) {
        console.warn('🌐 Could not fetch geolocation:', err.message);
      }

      // Prepare run document
      const runData = {
        sourceText,
        targetText,
        sourceLang,
        targetLang,
        mqmScore: mqmResults.overallScore,
        issues: mqmResults.mqmIssues,
        ip: location.ip,
        location,
        summary: mqmResults.summary,
        wordCount: mqmResults.wordCount || wordCount
      };

      // Add user association if authenticated
      if (req.user) {
        runData.user = req.user.id;
      } else if (req.cookies.anonymousSessionId) {
        runData.anonymousSessionId = req.cookies.anonymousSessionId;
      }

      const runDoc = await Run.create(runData);

      // Return the results with the database ID
      return res.json({ 
        ...mqmResults, 
        _id: runDoc._id,
        sourceText,  // Include source and target text in response
        targetText,
        sourceLang,
        targetLang
      });
      
    } catch (error) {
      console.error('Error parsing JSON or processing Claude response:', error);
      return res.status(500).json({ error: 'Could not parse analysis results' });
    }

  } catch (error) {
    console.error('Excel upload error:', error);
    return res.status(500).json({ 
      error: 'Failed to process Excel file',
      message: error.message
    });
  }
});

const ExcelJS = require('exceljs');

app.get('/api/download-report/:id/excel', authMiddleware.optionalAuth, async (req, res) => {
  try {
    const run = await Run.findById(req.params.id);
    // Check authorization
    if (run.user && req.user && (run.user.toString() !== req.user.id && req.user.accountType !== 'admin')) {
      return res.status(403).json({ error: 'You do not have permission to access this report' });
    }

    if (!run.user && run.anonymousSessionId && run.anonymousSessionId !== req.cookies.anonymousSessionId) {
      return res.status(403).json({ error: 'You do not have permission to access this report' });
    }
    if (!run) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('MQM Report');

    sheet.columns = [
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Subcategory', key: 'subcategory', width: 20 },
      { header: 'Severity', key: 'severity', width: 10 },
      { header: 'Explanation', key: 'explanation', width: 40 },
      { header: 'Segment', key: 'segment', width: 40 },
      { header: 'Suggestion', key: 'suggestion', width: 40 },
      { header: 'Corrected', key: 'correctedSegment', width: 40 },
      { header: 'Location', key: 'location', width: 20 },
    ];

    run.issues.forEach((issue) => {
      sheet.addRow({
        category: issue.category,
        subcategory: issue.subcategory,
        severity: issue.severity,
        explanation: issue.explanation,
        segment: issue.segment,
        suggestion: issue.suggestion,
        correctedSegment: issue.correctedSegment,
        location: issue.location || `${issue.startIndex}-${issue.endIndex}`
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="mqm_report_${run._id}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel download error:', err);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
});

// Serve index.html for all routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route for frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});