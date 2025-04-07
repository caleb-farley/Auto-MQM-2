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

IMPORTANT GUIDELINES FOR OBJECTIVE ALIGNMENT ASSESSMENT:
1. ONLY analyze the EXACT text provided in the submission. Never invent or hallucinate differences.
2. Focus on meaning alignment, not stylistic differences. Different languages express ideas differently.
3. Consider cultural adaptations as valid when they preserve the intended meaning for the target audience.
4. Respect domain-specific terminology and conventions that may appear non-standard.
5. Allow for reasonable additions that provide necessary cultural context in the target language.
6. When assessing confidence, be conservative - if you're not certain about alignment, provide a lower confidence score.
7. Recognize that translations rarely maintain perfect one-to-one correspondence with source text.
8. Be specific about any actual misalignments - quote the exact sections that differ in meaning.

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
  "reason": "The texts align closely with only minor stylistic differences. [Include specific evidence supporting your conclusion]"
}

If there are significant mismatches, clearly specify which parts don't align and why, with exact quotes.
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
    instructionsSheet.addRow(['3. For whole text assessment, use the Content sheet']);
    instructionsSheet.addRow(['4. For sentence-level assessment, use the Segments sheet']);
    instructionsSheet.addRow(['5. For identified issues, add entries in the Issues sheet']);
    instructionsSheet.addRow(['6. Use the categories and severity levels as defined in the MQM framework']);
    instructionsSheet.addRow(['7. Save the file and upload it through the web interface for automated processing']);
    instructionsSheet.addRow(['']);
    
    instructionsSheet.addRow(['NEW SEGMENT-LEVEL ASSESSMENT']);
    const segmentRow = instructionsSheet.lastRow;
    segmentRow.font = { bold: true, size: 14 };
    
    instructionsSheet.addRow(['']);
    instructionsSheet.addRow(['The Segments sheet allows you to work with sentence-level segmentation:']);
    instructionsSheet.addRow(['- Enter source and target text for each segment']);
    instructionsSheet.addRow(['- Add feedback for each segment, even those without issues']);
    instructionsSheet.addRow(['- Identify segment status (No Issues, Minor, Major, Critical)']);
    instructionsSheet.addRow(['- For each issue, provide a corrected version of the segment']);
    instructionsSheet.addRow(['- This enables more precise, context-aware quality assessment']);
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
    
    // Add content sheet for whole source and target content
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
    
    // Add segments sheet for sentence-level assessment
    const segmentsSheet = workbook.addWorksheet('Segments');
    segmentsSheet.columns = [
      { header: 'Segment #', key: 'number', width: 10 },
      { header: 'Source Text', key: 'source', width: 40 },
      { header: 'Target Text', key: 'target', width: 40 },
      { header: 'Feedback', key: 'feedback', width: 50 },
      { header: 'Status', key: 'status', width: 15 }
    ];
    
    const segmentsHeaderRow = segmentsSheet.getRow(1);
    segmentsHeaderRow.font = { bold: true };
    segmentsHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    segmentsHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    
    // Add example rows
    segmentsSheet.addRow({
      number: 1,
      source: 'Example source sentence 1.',
      target: 'Example target sentence 1.',
      feedback: 'No issues found in this segment.',
      status: 'No Issues'
    });
    
    segmentsSheet.addRow({
      number: 2,
      source: 'Example source sentence 2 with technical term.',
      target: 'Example target sentence 2 with incorrect term.',
      feedback: 'Terminology>Inappropriate (MINOR): The technical term was translated incorrectly.',
      status: 'Minor'
    });
    
    // Add validation for Status column
    segmentsSheet.getCell('E3').dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"No Issues,Minor,Major,Critical"']
    };
    
    // Format example rows
    const noIssuesRow = segmentsSheet.getRow(2);
    noIssuesRow.getCell('status').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'CCFFCC' } // Light green
    };
    
    const minorIssueRow = segmentsSheet.getRow(3);
    minorIssueRow.getCell('status').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCC' } // Light yellow
    };
    
    // Add assessment sheet for issues
    const issuesSheet = workbook.addWorksheet('Issues');
    issuesSheet.columns = [
      { header: 'Segment', key: 'segment', width: 40 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Subcategory', key: 'subcategory', width: 20 },
      { header: 'Severity', key: 'severity', width: 15 },
      { header: 'Explanation', key: 'explanation', width: 40 },
      { header: 'Suggested Fix', key: 'suggestion', width: 40 },
      { header: 'Corrected Segment', key: 'correctedSegment', width: 40 }
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
    const { sourceText, targetText, sourceLang, targetLang, mode } = req.body;
    const isMonolingual = mode === 'monolingual';
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
    
    // Validate parameters based on mode
    if (isMonolingual) {
      if (!targetText || !targetLang) {
        return res.status(400).json({ error: 'Missing required parameters for monolingual mode' });
      }
    } else {
      if (!sourceText || !targetText || !sourceLang || !targetLang) {
        return res.status(400).json({ error: 'Missing required parameters for bilingual mode' });
      }
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
    
    // Construct prompt for Claude using MQM framework based on mode
    let prompt;
    
    if (isMonolingual) {
      // Monolingual mode prompt - focuses on content quality without source comparison
      prompt = `
You are a localization QA expert using the MQM (Multidimensional Quality Metrics) framework to evaluate content quality. Please analyze the following text and provide a detailed quality assessment. This is a MONOLINGUAL assessment, so you will only evaluate the inherent quality of the content without comparing to any source text.

IMPORTANT GUIDELINES FOR MONOLINGUAL ASSESSMENT:
1. ONLY analyze the EXACT text provided in the submission. Do NOT invent or hallucinate errors that don't appear in the text.
2. Be thorough in your analysis - even small or subtle issues can be important for quality assessment.
3. For each issue identified, provide SPECIFIC EVIDENCE from the text - quote the exact problematic section.
4. Include both objective errors and potentially problematic stylistic issues that may affect readability.
5. Consider language-specific conventions and cultural context when evaluating the text.
6. For each issue, indicate your confidence level (HIGH, MEDIUM, LOW).
7. Focus on fluency, grammar, spelling, punctuation, and overall readability.
8. Evaluate terminology consistency within the text itself.
9. When multiple interpretations are possible, note this and explain the potential issue.
10. Since this is a monolingual assessment, do NOT look for translation errors like mistranslations or omissions.

Language: ${targetLang}

Text to analyze:
"""
${targetText}
"""

Perform a detailed MQM analysis using the following error categories, but only if you find actual errors with concrete evidence:
1. Fluency
   - Grammar: Issues related to grammar, syntax, or morphology
   - Spelling: Spelling errors or typos
   - Punctuation: Incorrect or inconsistent punctuation
   - Typography: Issues with formatting, capitalization, or other typographical elements
   
2. Terminology
   - Inconsistent: Terminology used inconsistently within the text
   - Inappropriate: Wrong terms used for the context or domain

3. Style
   - Awkward: Text sounds unnatural or awkward
   - Cultural: Cultural references incorrectly used

4. Design
   - Length: Text is too verbose or too concise for effective communication
   - Markup/Code: Issues with tags, placeholders, or code elements

For each issue found, provide:
- Category and subcategory
- Severity (Minor=1, Major=5, Critical=10)
- Explanation
- Location (if possible, provide specific information like character positions or word indices)
- The exact problematic text segment
- A suggested fix (textual description of what needs to be changed)
- A fully corrected version of the entire segment with the fix applied (this is critical as it will be displayed to users)
- Provide the exact **start and end character positions** of the segment in the text.

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
      "category": "Fluency",
      "subcategory": "Grammar",
      "severity": "MAJOR",
      "explanation": "...",
      "location": "...",
      "segment": "...",
      "suggestion": "...",
      "correctedSegment": "...",
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

For the segment field, include ONLY the exact problematic text.
For the correctedSegment field, provide the complete fixed version of the segment with all corrections applied. This corrected segment will be displayed directly to users, so ensure it maintains the full context and represents a high-quality correction.
`;
    } else {
      // Bilingual mode prompt - traditional translation quality assessment
      prompt = `
You are a localization QA expert using the MQM (Multidimensional Quality Metrics) framework to evaluate translations. Please analyze the following source and target text pair and provide a detailed quality assessment.

IMPORTANT GUIDELINES FOR BILINGUAL ASSESSMENT:
1. ONLY analyze the EXACT text provided in the submission. Do NOT invent or hallucinate errors that don't appear in the text.
2. Be thorough in your analysis - even small or subtle issues can be important for quality assessment.
3. For each issue identified, provide SPECIFIC EVIDENCE from the text - quote the exact problematic section.
4. Include both objective errors and potentially problematic stylistic issues that may affect readability.
5. Consider language-specific conventions and cultural context when evaluating translations.
6. For each issue, indicate your confidence level (HIGH, MEDIUM, LOW).
7. Compare corresponding sections of source and target to identify translation issues.
8. Be aware of domain-specific terminology, but flag terms that seem inconsistent or incorrectly translated.
9. When multiple interpretations are possible, note this and explain the potential issue.
10. Evaluate for both accuracy and fluency - both are important components of translation quality.

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
`;

Perform a detailed MQM analysis using the following error categories, but only if you find actual errors with concrete evidence:
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
- A fully corrected version of the entire segment with the fix applied (this is critical as it will be displayed to users)
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
      "correctedSegment": "...",
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
For the correctedSegment field, provide the complete fixed version of the segment with all corrections applied. This corrected segment will be displayed directly to users, so ensure it maintains the full context and represents a high-quality correction.

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

    // Extract issue details from Issues sheet
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

    // Look for Segments sheet to extract segment-level feedback
    const segmentsSheet = workbook.getWorksheet('Segments');
    if (segmentsSheet) {
      // Process segment-level feedback from the Segments sheet
      segmentsSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip header row
          const segmentNumber = row.getCell(1).value;
          const sourceSegment = row.getCell(2).value || '';
          const targetSegment = row.getCell(3).value || '';
          const feedback = row.getCell(4).value || '';
          const status = row.getCell(5).value || '';
          
          // Only process rows with actual feedback and not the default "No issues found"
          if (targetSegment && feedback && status && 
              feedback.trim() !== 'No issues found in this segment.' && 
              status.trim() !== 'No Issues') {
            
            // Parse the feedback to extract MQM details
            // Format is expected to be like: "Category>Subcategory (SEVERITY): Explanation"
            const feedbackLines = feedback.split('\n\n');
            
            for (const line of feedbackLines) {
              const categoryMatch = line.match(/(.*?)>(.*?)\s+\((.*?)\):(.*)/);
              
              if (categoryMatch) {
                const [_, category, subcategory, severityText, explanationText] = categoryMatch;
                
                // Get suggestion if present (typically follows "Suggestion: " on a new line)
                let suggestion = '';
                const suggestionMatch = line.match(/Suggestion:\s*(.*)/);
                if (suggestionMatch) {
                  suggestion = suggestionMatch[1].trim();
                }
                
                // Map severity text to severity level
                let severity;
                switch (severityText.trim().toUpperCase()) {
                  case 'MINOR':
                    severity = 'MINOR';
                    break;
                  case 'MAJOR':
                    severity = 'MAJOR';
                    break;
                  case 'CRITICAL':
                    severity = 'CRITICAL';
                    break;
                  default:
                    severity = 'MINOR'; // Default to minor if not specified correctly
                }
                
                // Create issue object from segment feedback
                userProvidedIssues.push({
                  category: category.trim(),
                  subcategory: subcategory.trim(),
                  severity,
                  explanation: explanationText.trim(),
                  segment: targetSegment, // Use the entire segment
                  suggestion,
                  correctedSegment: suggestion || targetSegment // Use suggestion or original if not provided
                });
              }
            }
          }
        }
      });
    }

    // Run Claude MQM analysis on the extracted text, just like /api/mqm-analysis endpoint
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    
    if (!claudeApiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    // Construct prompt for Claude using MQM framework (same as in /api/mqm-analysis)
    const prompt = `
You are a localization QA expert using the MQM (Multidimensional Quality Metrics) framework to evaluate translations. Please analyze the following source and target text pair and provide a detailed quality assessment.

IMPORTANT GUIDELINES FOR OBJECTIVE ASSESSMENT:
1. ONLY analyze the EXACT text provided in the submission. Do NOT invent or hallucinate errors that don't actually exist in the text.
2. If you don't find any genuine errors, return an empty mqmIssues array. Never fabricate issues.
3. For each issue identified, provide SPECIFIC EVIDENCE from the text - quote the exact problematic section.
4. Distinguish between objective errors and subjective stylistic preferences. Focus primarily on clear errors.
5. Consider language-specific conventions and cultural context when evaluating translations.
6. For each issue, assign a confidence level (HIGH, MEDIUM, LOW) based on how certain you are about the error.
7. Compare corresponding sections of source and target to verify actual translation issues.
8. Respect domain-specific terminology and conventions that may appear non-standard in general language.
9. When multiple interpretations are possible, select the most charitable interpretation that makes sense in context.
10. Evaluate the translation based on its communicative purpose, not just literal accuracy.

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

Perform a detailed MQM analysis using the following error categories, but only if you find actual errors with concrete evidence:
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
      "correctedSegment": "...",
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
        sourceText: isMonolingual ? '' : sourceText,
        targetText,
        sourceLang: isMonolingual ? '' : sourceLang,
        targetLang,
        mqmScore: mqmResults.overallScore,
        issues: mqmResults.mqmIssues,
        ip: location.ip,
        location,
        summary: mqmResults.summary,
        wordCount: mqmResults.wordCount || wordCount,
        analysisMode: isMonolingual ? 'monolingual' : 'bilingual'
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
        sourceText: isMonolingual ? '' : sourceText,  // Include source and target text in response based on mode
        targetText,
        sourceLang: isMonolingual ? '' : sourceLang,
        targetLang,
        analysisMode: isMonolingual ? 'monolingual' : 'bilingual'
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

// Helper function to segment text into sentences while preserving code elements
function segmentText(text) {
  if (!text) return [];
  
  // This regex splits on sentence boundaries while trying to preserve code elements
  // It looks for: 
  // - periods, question marks, exclamation points followed by space or end of string
  // - but ignores these when inside quotes, brackets, or code blocks
  const sentenceRegex = /(?<![A-Z][a-z]\.)(?<=\.|\?|\!|\;\n|\:\n)(?:\s+|$)/g;
  
  // Split the text by sentence boundaries
  let segments = text.split(sentenceRegex).filter(s => s.trim());
  
  // Further processing to handle edge cases like code blocks, variables, etc.
  const processedSegments = [];
  let currentSegment = '';
  let inCodeBlock = false;
  let bracketCount = 0;
  
  for (const segment of segments) {
    // Count opening and closing brackets/braces to detect code elements
    const openBrackets = (segment.match(/[\(\{\[<]/g) || []).length;
    const closeBrackets = (segment.match(/[\)\}\]>]/g) || []).length;
    
    bracketCount += openBrackets - closeBrackets;
    
    // Check for code block indicators
    if (segment.includes('```') || segment.includes('~~~')) {
      inCodeBlock = !inCodeBlock;
    }
    
    // If we're in a code block or have unclosed brackets, append to current segment
    if (inCodeBlock || bracketCount > 0) {
      currentSegment += segment + ' ';
    } else {
      // Add the completed segment
      if (currentSegment) {
        currentSegment += segment;
        processedSegments.push(currentSegment.trim());
        currentSegment = '';
      } else {
        processedSegments.push(segment.trim());
      }
    }
  }
  
  // Add any remaining segment
  if (currentSegment) {
    processedSegments.push(currentSegment.trim());
  }
  
  return processedSegments;
}

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
    
    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 50 }
    ];
    
    // Add summary information
    summarySheet.addRow({ metric: 'Source Language', value: run.sourceLang });
    summarySheet.addRow({ metric: 'Target Language', value: run.targetLang });
    summarySheet.addRow({ metric: 'Overall Score', value: run.mqmScore });
    summarySheet.addRow({ metric: 'Word Count', value: run.wordCount });
    summarySheet.addRow({ metric: 'Total Issues', value: run.issues.length });
    summarySheet.addRow({ metric: 'Summary', value: run.summary || 'N/A' });
    summarySheet.addRow({ metric: 'Assessment Date', value: new Date(run.timestamp).toLocaleString() });
    
    // Format the header row
    const headerRow = summarySheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    
    // Apply wrap text to value column
    for (let i = 2; i <= summarySheet.rowCount; i++) {
      summarySheet.getRow(i).getCell('value').alignment = { wrapText: true };
    }
    
    // Add issues sheet
    const issuesSheet = workbook.addWorksheet('Issues');
    issuesSheet.columns = [
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Subcategory', key: 'subcategory', width: 20 },
      { header: 'Severity', key: 'severity', width: 10 },
      { header: 'Explanation', key: 'explanation', width: 40 },
      { header: 'Segment', key: 'segment', width: 40 },
      { header: 'Suggestion', key: 'suggestion', width: 40 },
      { header: 'Corrected', key: 'correctedSegment', width: 40 },
      { header: 'Location', key: 'location', width: 20 },
    ];
    
    // Format the header row
    const issuesHeaderRow = issuesSheet.getRow(1);
    issuesHeaderRow.font = { bold: true };
    issuesHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    issuesHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    
    run.issues.forEach((issue) => {
      issuesSheet.addRow({
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
    
    // Apply wrap text to all text cells in the issues sheet
    for (let i = 2; i <= issuesSheet.rowCount; i++) {
      const row = issuesSheet.getRow(i);
      row.getCell('explanation').alignment = { wrapText: true };
      row.getCell('segment').alignment = { wrapText: true };
      row.getCell('suggestion').alignment = { wrapText: true };
      row.getCell('correctedSegment').alignment = { wrapText: true };
    }
    
    // Segment the source and target text
    const sourceSegments = segmentText(run.sourceText);
    const targetSegments = segmentText(run.targetText);
    
    // Create a map of segments to issues
    const segmentIssues = new Map();
    
    // Add segments worksheet with sentence-level feedback
    const segmentsSheet = workbook.addWorksheet('Segments');
    segmentsSheet.columns = [
      { header: 'Segment #', key: 'number', width: 10 },
      { header: 'Source Text', key: 'source', width: 40 },
      { header: 'Target Text', key: 'target', width: 40 },
      { header: 'Feedback', key: 'feedback', width: 50 },
      { header: 'Status', key: 'status', width: 15 }
    ];
    
    // Format the header row
    const segmentsHeaderRow = segmentsSheet.getRow(1);
    segmentsHeaderRow.font = { bold: true };
    segmentsHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    segmentsHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    
    // Match issues to segments based on character positions or content similarity
    run.issues.forEach(issue => {
      // Try to find which segment contains this issue
      let foundSegmentIndex = -1;
      
      // First try using startIndex/endIndex if available
      if (issue.startIndex !== undefined && issue.endIndex !== undefined) {
        // Find which segment contains these indices
        let currentPos = 0;
        for (let i = 0; i < targetSegments.length; i++) {
          const segmentLength = targetSegments[i].length;
          const segmentEnd = currentPos + segmentLength;
          
          if (issue.startIndex >= currentPos && issue.startIndex < segmentEnd) {
            foundSegmentIndex = i;
            break;
          }
          
          currentPos += segmentLength + 1; // +1 for the separator
        }
      }
      
      // If we couldn't find by position, try by content
      if (foundSegmentIndex === -1 && issue.segment) {
        for (let i = 0; i < targetSegments.length; i++) {
          if (targetSegments[i].includes(issue.segment)) {
            foundSegmentIndex = i;
            break;
          }
        }
      }
      
      // If we found a segment, add this issue to its feedback
      if (foundSegmentIndex !== -1) {
        if (!segmentIssues.has(foundSegmentIndex)) {
          segmentIssues.set(foundSegmentIndex, []);
        }
        segmentIssues.get(foundSegmentIndex).push(issue);
      }
    });
    
    // Add all segments to the sheet with their corresponding feedback
    const maxSegments = Math.max(sourceSegments.length, targetSegments.length);
    for (let i = 0; i < maxSegments; i++) {
      const source = i < sourceSegments.length ? sourceSegments[i] : '';
      const target = i < targetSegments.length ? targetSegments[i] : '';
      
      // Get issues for this segment
      const issues = segmentIssues.get(i) || [];
      let feedback = '';
      let status = 'No Issues';
      
      if (issues.length > 0) {
        // Format feedback for this segment's issues
        feedback = issues.map(issue => {
          return `${issue.category}>${issue.subcategory} (${issue.severity}): ${issue.explanation}\nSuggestion: ${issue.suggestion || 'N/A'}`;
        }).join('\n\n');
        
        // Determine status based on highest severity
        if (issues.some(issue => issue.severity === 'CRITICAL')) {
          status = 'Critical';
        } else if (issues.some(issue => issue.severity === 'MAJOR')) {
          status = 'Major';
        } else if (issues.some(issue => issue.severity === 'MINOR')) {
          status = 'Minor';
        }
      } else {
        feedback = 'No issues found in this segment.';
      }
      
      // Add row with segment information
      segmentsSheet.addRow({
        number: i + 1,
        source,
        target,
        feedback,
        status
      });
      
      // Apply conditional formatting based on status
      const row = segmentsSheet.lastRow;
      if (status === 'Critical') {
        row.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFCCCC' } // Light red
        };
      } else if (status === 'Major') {
        row.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEECC' } // Light orange
        };
      } else if (status === 'Minor') {
        row.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCC' } // Light yellow
        };
      } else {
        row.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'CCFFCC' } // Light green
        };
      }
      
      // Apply wrap text to text cells
      row.getCell('source').alignment = { wrapText: true };
      row.getCell('target').alignment = { wrapText: true };
      row.getCell('feedback').alignment = { wrapText: true };
    }
    
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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});