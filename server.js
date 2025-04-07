// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Readable } = require('stream');

// Import models
const Run = require('./models/Run');
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/authRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const runRoutes = require('./routes/runRoutes');
const adminLoginRoute = require('./routes/adminLoginRoute');
const adminRoutes = require('./routes/adminRoutes');

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
app.use('/api', adminLoginRoute);
app.use('/api/admin', adminRoutes);
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

// Import segmentation utility
const { getSegments, generateExcelReport } = require('./utils/segment');

// MQM analysis endpoint using Claude API
app.post('/api/mqm-analysis', 
  authMiddleware.optionalAuth, 
  authMiddleware.checkUsageLimit,
  authMiddleware.trackUsage,
  async (req, res) => {
    try {
      const { sourceText, targetText, sourceLang, targetLang, mode, llmModel, fileBuffer, fileType } = req.body;
      const isMonolingual = mode === 'monolingual';
      const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
      
      // Use the segmentation utility to get segments
      const segments = await getSegments({
        sourceText,
        targetText,
        sourceLang,
        targetLang,
        fileBuffer,
        fileType
      });
      
      // Extract source and target text from segments if file was uploaded
      let processedSourceText = sourceText;
      let processedTargetText = targetText;
      let processedSourceLang = sourceLang;
      let processedTargetLang = targetLang;
      
      // If segments were obtained from a file, extract the text
      if (fileBuffer && segments && segments.length > 0) {
        // Combine all segments into a single text
        processedSourceText = segments.map(segment => segment.source).join('\n');
        processedTargetText = segments.map(segment => segment.target).join('\n');
        
        // Use language codes from segments if available
        if (segments[0].sourceLang) {
          processedSourceLang = segments[0].sourceLang;
        }
        
        if (segments[0].targetLang) {
          processedTargetLang = segments[0].targetLang;
        }
        
        // Force bilingual mode for file uploads
        if (isMonolingual && fileBuffer) {
          console.log('Forcing bilingual mode for file upload');
          isMonolingual = false;
        }
        
        console.log(`Extracted ${segments.length} segments from ${fileType} file`);
      }
      
      // Default to Claude-3-Sonnet if no model is specified
      const modelToUse = llmModel || "claude-3-sonnet-20240229";
      
      // Check if we have a cached assessment for the same text pair and model
      const cachedRun = await Run.findOne({
        sourceText: isMonolingual ? null : processedSourceText,
        targetText: processedTargetText,
        sourceLang: isMonolingual ? null : processedSourceLang,
        targetLang: processedTargetLang,
        analysisMode: isMonolingual ? 'monolingual' : 'bilingual',
        llmModel: modelToUse // Match the specific LLM model used
      }).sort({ timestamp: -1 }); // Get the most recent match
      
      if (cachedRun) {
        console.log('✅ Found cached assessment, reusing results');
        // Return the cached results
        return res.json({
          mqmIssues: cachedRun.issues,
          wordCount: cachedRun.wordCount,
          overallScore: cachedRun.mqmScore,
          summary: cachedRun.summary,
          _id: cachedRun._id,
          sourceText: processedSourceText,
          targetText: processedTargetText,
          sourceLang: processedSourceLang,
          targetLang: processedTargetLang,
          cached: true // Flag to indicate this is a cached result
        });
      }
      
      console.log('🔄 No cached assessment found, running new analysis');

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
      const WORD_COUNT_LIMIT = 500;
      
      if (isMonolingual) {
        // For monolingual mode, check target text word count
        const targetWords = targetText.trim().split(/\s+/);
        const targetWordCount = targetWords.length > 0 && targetWords[0] !== '' ? targetWords.length : 0;
        
        if (targetWordCount > WORD_COUNT_LIMIT) {
          return res.status(400).json({ error: `Target text exceeds the ${WORD_COUNT_LIMIT} word limit` });
        }
      } else {
        // For bilingual mode, check source text word count
        const sourceWords = sourceText.trim().split(/\s+/);
        const sourceWordCount = sourceWords.length > 0 && sourceWords[0] !== '' ? sourceWords.length : 0;
        
        if (sourceWordCount > WORD_COUNT_LIMIT) {
          return res.status(400).json({ error: `Source text exceeds the ${WORD_COUNT_LIMIT} word limit` });
        }
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
        prompt = "You are a localization QA expert using the MQM (Multidimensional Quality Metrics) framework to evaluate content quality. Please analyze the following text and provide a detailed quality assessment. This is a MONOLINGUAL assessment, so you will only evaluate the inherent quality of the content without comparing to any source text.\n\nIMPORTANT GUIDELINES FOR MONOLINGUAL ASSESSMENT:\n1. ONLY analyze the EXACT text provided in the submission. Do NOT invent or hallucinate errors that don't appear in the text.\n2. Be thorough in your analysis - even small or subtle issues can be important for quality assessment.\n3. For each issue identified, provide SPECIFIC EVIDENCE from the text - quote the exact problematic section.\n4. Include both objective errors and potentially problematic stylistic issues that may affect readability.\n5. Consider language-specific conventions and cultural context when evaluating the text.\n6. For each issue, indicate your confidence level (HIGH, MEDIUM, LOW).\n7. Focus on fluency, grammar, spelling, punctuation, and overall readability.\n8. Evaluate terminology consistency within the text itself.\n9. When multiple interpretations are possible, note this and explain the potential issue.\n10. Since this is a monolingual assessment, do NOT look for translation errors like mistranslations or omissions.\n\nLanguage: " + processedTargetLang + "\n\nText to analyze:\n\"\"\"\n" + processedTargetText + "\n\"\"\"\n\nPerform a detailed MQM analysis using the following error categories, but only if you find actual errors with concrete evidence:\n1. Fluency\n   - Grammar: Issues related to grammar, syntax, or morphology\n   - Spelling: Spelling errors or typos\n   - Punctuation: Incorrect or inconsistent punctuation\n   - Typography: Issues with formatting, capitalization, or other typographical elements\n   \n2. Terminology\n   - Inconsistent: Terminology used inconsistently within the text\n   - Inappropriate: Wrong terms used for the context or domain\n\n3. Style\n   - Awkward: Text sounds unnatural or awkward\n   - Cultural: Cultural references incorrectly used\n\n4. Design\n   - Length: Text is too verbose or too concise for effective communication\n   - Markup/Code: Issues with tags, placeholders, or code elements\n\nFor each issue found, provide:\n- Category and subcategory\n- Severity (Minor=1, Major=5, Critical=10)\n- Explanation\n- Location (if possible, provide specific information like character positions or word indices)\n- The exact problematic text segment\n- A suggested fix (textual description of what needs to be changed)\n- A fully corrected version of the entire segment with the fix applied (this is critical as it will be displayed to users)\n- Provide the exact **start and end character positions** of the segment in the text.\n\nAlso provide an MQM score calculated as:\nMQM Score = 100 - (sum of error points / word count * 100)\nWhere:\n- Minor issues = 1 point\n- Major issues = 5 points\n- Critical issues = 10 points\n\nReturn ONLY valid JSON without any other text. Use this exact structure:\n{\n  \"mqmIssues\": [\n    {\n      \"category\": \"Fluency\",\n      \"subcategory\": \"Grammar\",\n      \"severity\": \"MAJOR\",\n      \"explanation\": \"...\",\n      \"location\": \"...\",\n      \"segment\": \"...\",\n      \"suggestion\": \"...\",\n      \"correctedSegment\": \"...\",\n      \"startIndex\": 45,\n      \"endIndex\": 68\n    },\n    ...\n  ],\n  \"categories\": {\n    \"Accuracy\": { \"count\": 0, \"points\": 0 },\n    \"Fluency\": { \"count\": 0, \"points\": 0 },\n    \"Terminology\": { \"count\": 0, \"points\": 0 },\n    \"Style\": { \"count\": 0, \"points\": 0 },\n    \"Design\": { \"count\": 0, \"points\": 0 }\n  },\n  \"wordCount\": 120,\n  \"overallScore\": 95,\n  \"summary\": \"...\"\n}\n\nFor the location field, try to be as specific as possible. Preferred format is:\n- For specific words: \"Word 5-7 in sentence 2\" or \"Characters 120-135\"\n- For sentences: \"Sentence 3 in paragraph 2\"\n- For paragraphs: \"Paragraph 4\"\n\nFor the segment field, include ONLY the exact problematic text.\nFor the correctedSegment field, provide the complete fixed version of the segment with all corrections applied. This corrected segment will be displayed directly to users, so ensure it maintains the full context and represents a high-quality correction.";
      } 
      else {
        // Bilingual mode prompt - traditional translation quality assessment
        prompt = "You are a localization QA expert using the MQM (Multidimensional Quality Metrics) framework to evaluate translations. Please analyze the following source and target text pair and provide a detailed quality assessment.\n\nIMPORTANT GUIDELINES FOR BILINGUAL ASSESSMENT:\n1. ONLY analyze the EXACT text provided in the submission. Do NOT invent or hallucinate errors that don't appear in the text.\n2. Be thorough in your analysis - even small or subtle issues can be important for quality assessment.\n3. For each issue identified, provide SPECIFIC EVIDENCE from the text - quote the exact problematic section.\n4. Include both objective errors and potentially problematic stylistic issues that may affect readability.\n5. Consider language-specific conventions and cultural context when evaluating translations.\n6. For each issue, indicate your confidence level (HIGH, MEDIUM, LOW).\n7. Compare corresponding sections of source and target to identify translation issues.\n8. Be aware of domain-specific terminology, but flag terms that seem inconsistent or incorrectly translated.\n9. When multiple interpretations are possible, note this and explain the potential issue.\n10. Evaluate for both accuracy and fluency - both are important components of translation quality.\n\nSource language: " + processedSourceLang + "\nTarget language: " + processedTargetLang + "\n\nSource text:\n\"\"\"\n" + processedSourceText + "\n\"\"\"\n\nTarget text:\n\"\"\"\n" + processedTargetText + "\n\"\"\"\n\nPerform a detailed MQM analysis using the following error categories, but only if you find actual errors with concrete evidence:\n1. Accuracy\n   - Mistranslation: Content in target language that misrepresents source content\n   - Omission: Content missing from translation that is present in source\n   - Addition: Content added to translation that is not present in source\n   - Untranslated: Source content not translated that should be\n\n2. Fluency\n   - Grammar: Issues related to grammar, syntax, or morphology\n   - Spelling: Spelling errors or typos\n   - Punctuation: Incorrect or inconsistent punctuation\n   - Typography: Issues with formatting, capitalization, or other typographical elements\n   \n3. Terminology\n   - Inconsistent: Terminology used inconsistently within the text\n   - Inappropriate: Wrong terms used for the context or domain\n\n4. Style\n   - Awkward: Translation sounds unnatural or awkward\n   - Cultural: Cultural references incorrectly adapted\n\n5. Design\n   - Length: Target text is too long or too short relative to space constraints\n   - Markup/Code: Issues with tags, placeholders, or code elements\n\nFor each issue found, provide:\n- Category and subcategory\n- Severity (Minor=1, Major=5, Critical=10)\n- Explanation\n- Location (if possible, provide specific information like character positions or word indices)\n- The exact problematic text segment from the target translation\n- A suggested fix (textual description of what needs to be changed)\n- A fully corrected version of the entire segment with the fix applied (this is critical as it will be displayed to users)\n- Provide the exact **start and end character positions** of the segment in the target text.\n\nAlso provide an MQM score calculated as:\nMQM Score = 100 - (sum of error points / word count * 100)\nWhere:\n- Minor issues = 1 point\n- Major issues = 5 points\n- Critical issues = 10 points\n\nReturn ONLY valid JSON without any other text. Use this exact structure:\n{\n  \"mqmIssues\": [\n    {\n      \"category\": \"Accuracy\",\n      \"subcategory\": \"Mistranslation\",\n      \"severity\": \"MAJOR\",\n      \"explanation\": \"...\",\n      \"location\": \"...\",\n      \"segment\": \"...\",\n      \"suggestion\": \"...\",\n      \"correctedSegment\": \"...\",\n      \"startIndex\": 45,\n      \"endIndex\": 68\n    },\n    ...\n  ],\n  \"categories\": {\n    \"Accuracy\": { \"count\": 0, \"points\": 0 },\n    \"Fluency\": { \"count\": 0, \"points\": 0 },\n    \"Terminology\": { \"count\": 0, \"points\": 0 },\n    \"Style\": { \"count\": 0, \"points\": 0 },\n    \"Design\": { \"count\": 0, \"points\": 0 }\n  },\n  \"wordCount\": 120,\n  \"overallScore\": 95,\n  \"summary\": \"...\"\n}\n\nFor the location field, try to be as specific as possible. Preferred format is:\n- For specific words: \"Word 5-7 in sentence 2\" or \"Characters 120-135\"\n- For sentences: \"Sentence 3 in paragraph 2\"\n- For paragraphs: \"Paragraph 4\"\n\nFor the segment field, include ONLY the exact problematic text from the target translation.\nFor the correctedSegment field, provide the complete fixed version of the segment with all corrections applied. This corrected segment will be displayed directly to users, so ensure it maintains the full context and represents a high-quality correction.\n\nFor example, if the segment is \"The internationale women day\" and the issue is terminology inconsistency, then correctedSegment might be \"La journée internationale des femmes\".";
      }

      // If no segments were found, return an error
      if (!segments || segments.length === 0) {
        return res.status(400).json({ error: 'No valid segments found for analysis' });
      }

      // Check for cached assessment
      try {
        // Try to find a recent assessment with the same parameters
        const cachedRun = await Run.findOne({
          sourceText: isMonolingual ? null : processedSourceText,
          targetText: processedTargetText,
          sourceLang: isMonolingual ? null : processedSourceLang,
          targetLang: processedTargetLang,
          analysisMode: isMonolingual ? 'monolingual' : 'bilingual',
          llmModel: modelToUse // Match the specific LLM model used
        }).sort({ timestamp: -1 });

        // If found and not too old (within 24 hours), use it
        if (cachedRun && (Date.now() - cachedRun.timestamp) < 24 * 60 * 60 * 1000) {
          console.log('🔄 Using cached assessment');
          return res.json({
            runId: cachedRun._id,
            result: cachedRun.result,
            cached: true
          });
        }
      
      // Initialize arrays to store processed segments and results
      const processedSegments = [];
      const segmentResults = [];
      
      // Process segments in batches to avoid overwhelming the API
      const batchSize = 5; // Adjust based on segment size and API limits
      
      for (let i = 0; i < segments.length; i += batchSize) {
        const batch = segments.slice(i, i + batchSize);
        const batchPromises = batch.map(async (segment) => {
          // Prepare segment-specific prompt
          let segmentPrompt;
          
          if (isMonolingual) {
            segmentPrompt = prompt.replace(targetText, segment.target);
          } else {
            segmentPrompt = prompt
              .replace(sourceText, segment.source)
              .replace(targetText, segment.target);
          }
          
          // Call Claude API for this segment
          const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
              model: llmModel || "claude-3-sonnet-20240229",
              max_tokens: 4000,
              messages: [
                {
                  role: "user",
                  content: segmentPrompt
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
          
          return { segment, response };
        });
        
        // Wait for all segments in the batch to be processed
        const batchResults = await Promise.all(batchPromises);
        
        // Process results for each segment
        for (const { segment, response } of batchResults) {
          // Extract the content from Claude's response
          const content = response.data.content[0].text;
          console.log('🧠 Claude response:', content);
        
          // Find and parse the JSON in the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            console.error('❌ No JSON match found in Claude response');
            return res.status(500).json({ error: 'Could not parse analysis results' });
          }
        
          try {
            const mqmResults = JSON.parse(jsonMatch[0]);
            
            // Add segment information to results
            mqmResults.segment_id = segment.segment_id;
            mqmResults.source = segment.source;
            mqmResults.target = segment.target;
            
            // Add to processed segments
            processedSegments.push({
              ...segment,
              mqmScore: mqmResults.overallScore,
              mqmIssues: mqmResults.mqmIssues,
              categories: mqmResults.categories,
              wordCount: mqmResults.wordCount,
              summary: mqmResults.summary
            });
            
            // Add to segment results
            segmentResults.push(mqmResults);
          } catch (error) {
            console.error('Error parsing JSON:', error);
            return res.status(500).json({ error: 'Could not parse analysis results' });
          }
        }
      }
      
      // Calculate aggregate metrics
      const totalWordCount = processedSegments.reduce((sum, segment) => sum + (segment.wordCount || 0), 0);
      const totalIssues = processedSegments.reduce((sum, segment) => sum + (segment.mqmIssues?.length || 0), 0);
      const weightedScore = processedSegments.reduce((sum, segment) => {
        const weight = segment.wordCount / totalWordCount;
        return sum + (segment.mqmScore * weight);
      }, 0);
      
      // Aggregate categories
      const aggregateCategories = {
        Accuracy: { count: 0, points: 0 },
        Fluency: { count: 0, points: 0 },
        Terminology: { count: 0, points: 0 },
        Style: { count: 0, points: 0 },
        Design: { count: 0, points: 0 }
      };
      processedSegments.forEach(segment => {
        if (segment.categories) {
          Object.keys(segment.categories).forEach(category => {
            aggregateCategories[category].count += segment.categories[category].count;
            aggregateCategories[category].points += segment.categories[category].points;
          });
        }
      });
      
      // Generate summary
      const summary = `Analyzed ${segments.length} segments with ${totalWordCount} words. Found ${totalIssues} issues across all segments.`;
      
      // Save the run to database
      const run = new Run({
        sourceText: isMonolingual ? null : processedSourceText,
        targetText: processedTargetText,
        sourceLang: isMonolingual ? null : processedSourceLang,
        targetLang: processedTargetLang,
        mqmScore: weightedScore,
        issues: processedSegments.flatMap(s => s.mqmIssues || []),
        summary,
        wordCount: totalWordCount,
        ip,
        llmModel: llmModel || 'claude-3-sonnet-20240229',
        analysisMode: isMonolingual ? 'monolingual' : 'bilingual',
        user: req.user ? req.user._id : undefined,
        anonymousSessionId: !req.user ? req.cookies.sessionId : undefined,
        segments: processedSegments
      });
      
      await run.save();
      
      // Log the QA action
      await ActionLog.create({
        actionType: 'qa',
        user: req.user ? req.user._id : null,
        anonymousSessionId: !req.user ? req.cookies.sessionId : undefined,
        ip,
        sourceLang: processedSourceLang,
        targetLang: processedTargetLang,
        sourceTextLength: processedSourceText ? processedSourceText.length : 0,
        targetTextLength: processedTargetText ? processedTargetText.length : 0,
        llmModel: llmModel || 'claude-3-sonnet-20240229',
        analysisMode: isMonolingual ? 'monolingual' : 'bilingual',
        run: run._id,
        location: req.geoip // If you have geoip middleware
      });
      
      // Return the results
      return res.json({
        runId: run._id,
        segments: processedSegments,
        mqmIssues: processedSegments.flatMap(s => s.mqmIssues || []),
        categories: aggregateCategories,
        wordCount: totalWordCount,
        overallScore: weightedScore,
        summary,
        sourceText: processedSourceText,
        targetText: processedTargetText,
        sourceLang: processedSourceLang,
        targetLang: processedTargetLang
      });
    } catch (error) {
      console.error('Error parsing JSON or processing Claude response:', error);
      return res.status(500).json({ error: 'Could not parse analysis results' });
    }
  } catch (error) {
    console.error('MQM analysis error:', error);
    
    // Provide more specific error messages based on the context
    if (fileBuffer && error.message.includes('file')) {
      return res.status(500).json({ 
        error: 'Failed to process Excel file',
        message: error.message
      });
    } else {
      return res.status(500).json({ 
        error: 'Failed to process text analysis',
        message: error.message
      });
    }
  }
});

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

// Import S3 service
const s3Service = require('./utils/s3Service');

// Excel report download endpoint
app.get('/api/download-report/:id/excel', authMiddleware.optionalAuth, async (req, res) => {
  try {
    const run = await Run.findById(req.params.id);
    
    // Check if run exists first
    if (!run) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Check authorization
    if (run.user && req.user && (run.user.toString() !== req.user.id && req.user.accountType !== 'admin')) {
      return res.status(403).json({ error: 'You do not have permission to access this report' });
    }

    if (!run.user && run.anonymousSessionId && run.anonymousSessionId !== req.cookies.anonymousSessionId) {
      return res.status(403).json({ error: 'You do not have permission to access this report' });
    }
    
    // Check if report already exists in S3 and redirect to it (unless force=true is specified)
    if (run.excelReportUrl && req.query.force !== 'true') {
      // If the report is already in S3, generate a signed URL and redirect
      try {
        const signedUrl = await s3Service.getSignedUrl(run.excelReportKey);
        return res.redirect(signedUrl);
      } catch (s3Error) {
        console.error('Error getting signed URL, falling back to generating report:', s3Error);
        // If there's an error with S3, fall back to generating the report directly
      }
    }
    
    const workbook = new ExcelJS.Workbook();
    // Check if run.analysisMode exists, if not, fallback to run.mode, and if that doesn't exist, default to 'bilingual'
    const isMonolingual = (run.analysisMode === 'monolingual' || run.mode === 'monolingual');
    
    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 50 }
    ];
    
    // Add summary information
    summarySheet.addRow({ metric: 'Analysis Type', value: isMonolingual ? 'Monolingual' : 'Bilingual' });
    if (!isMonolingual && run.sourceLang) {
      summarySheet.addRow({ metric: 'Source Language', value: run.sourceLang });
    }
    summarySheet.addRow({ metric: 'Target Language', value: run.targetLang || 'Unknown' });
    summarySheet.addRow({ metric: 'Overall Score', value: run.mqmScore || 100 });
    summarySheet.addRow({ metric: 'Word Count', value: run.wordCount || 0 });
    summarySheet.addRow({ metric: 'Total Issues', value: run.issues ? run.issues.length : 0 });
    summarySheet.addRow({ metric: 'Summary', value: run.summary || 'N/A' });
    summarySheet.addRow({ metric: 'Assessment Date', value: new Date(run.timestamp || Date.now()).toLocaleString() });
    
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
    
    // Add segments sheet if segments are available
    if (run.segments && run.segments.length > 0) {
      const segmentsSheet = workbook.addWorksheet('Segments');
      
      // Define columns based on analysis type (monolingual or bilingual)
      if (isMonolingual) {
        segmentsSheet.columns = [
          { header: 'Segment ID', key: 'segmentId', width: 10 },
          { header: 'Text', key: 'target', width: 50 },
          { header: 'MQM Score', key: 'mqmScore', width: 12 },
          { header: 'Issue Count', key: 'issueCount', width: 12 },
          { header: 'Issues', key: 'issues', width: 30 },
          { header: 'Explanations', key: 'explanations', width: 40 },
          { header: 'Suggested Fixes', key: 'fixes', width: 40 }
        ];
      } else {
        segmentsSheet.columns = [
          { header: 'Segment ID', key: 'segmentId', width: 10 },
          { header: 'Source', key: 'source', width: 40 },
          { header: 'Target', key: 'target', width: 40 },
          { header: 'MQM Score', key: 'mqmScore', width: 12 },
          { header: 'Issue Count', key: 'issueCount', width: 12 },
          { header: 'Issues', key: 'issues', width: 30 },
          { header: 'Explanations', key: 'explanations', width: 40 },
          { header: 'Suggested Fixes', key: 'fixes', width: 40 }
        ];
      }
      
      // Add segment data
      run.segments.forEach(segment => {
        if (!segment) return; // Skip null/undefined segments
        
        const issues = segment.mqmIssues || [];
        
        try {
          if (isMonolingual) {
            segmentsSheet.addRow({
              segmentId: segment.segment_id || '',
              target: segment.target || '',
              mqmScore: segment.mqmScore || 100,
              issueCount: issues.length,
              issues: issues.map(issue => `${issue?.category || 'Unknown'} > ${issue?.subcategory || 'Unknown'} (${issue?.severity || 'MINOR'})`).join('\n'),
              explanations: issues.map(issue => issue?.explanation || '').join('\n'),
              fixes: issues.map(issue => issue?.suggestion || '').join('\n')
            });
          } else {
            segmentsSheet.addRow({
              segmentId: segment.segment_id || '',
              source: segment.source || '',
              target: segment.target || '',
              mqmScore: segment.mqmScore || 100,
              issueCount: issues.length,
              issues: issues.map(issue => `${issue?.category || 'Unknown'} > ${issue?.subcategory || 'Unknown'} (${issue?.severity || 'MINOR'})`).join('\n'),
              explanations: issues.map(issue => issue?.explanation || '').join('\n'),
              fixes: issues.map(issue => issue?.suggestion || '').join('\n')
            });
          }
        } catch (err) {
          console.error('Error adding segment row:', err, segment);
          // Add a placeholder row with error information
          segmentsSheet.addRow({
            segmentId: segment.segment_id || 'Error',
            source: isMonolingual ? '' : 'Error processing segment',
            target: 'Error processing segment',
            mqmScore: 0,
            issueCount: 0,
            issues: 'Error',
            explanations: err.message,
            fixes: ''
          });
        }
      });
      
      // Format the header row
      const segmentsHeaderRow = segmentsSheet.getRow(1);
      segmentsHeaderRow.font = { bold: true };
      segmentsHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4F81BD' }
      };
      segmentsHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      
      // Apply wrap text to all text cells
      for (let i = 2; i <= segmentsSheet.rowCount; i++) {
        const row = segmentsSheet.getRow(i);
        if (!isMonolingual) {
          row.getCell('source').alignment = { wrapText: true };
        }
        row.getCell('target').alignment = { wrapText: true };
        row.getCell('issues').alignment = { wrapText: true };
        row.getCell('explanations').alignment = { wrapText: true };
        row.getCell('fixes').alignment = { wrapText: true };
      }
    }
    
    // Add issues sheet
    const issuesSheet = workbook.addWorksheet('Issues');
    issuesSheet.columns = [
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Subcategory', key: 'subcategory', width: 15 },
      { header: 'Severity', key: 'severity', width: 10 },
      { header: 'Segment', key: 'segment', width: 40 },
      { header: 'Explanation', key: 'explanation', width: 40 },
      { header: 'Suggestion', key: 'suggestion', width: 40 },
      { header: 'Corrected', key: 'corrected', width: 40 }
    ];
    
    // Add issues data
    if (run.issues && Array.isArray(run.issues)) {
      run.issues.forEach(issue => {
        if (!issue) return; // Skip null/undefined issues
        
        try {
          issuesSheet.addRow({
            category: issue.category || 'Unknown',
            subcategory: issue.subcategory || 'Unknown',
            severity: issue.severity || 'MINOR',
            segment: issue.segment || '',
            explanation: issue.explanation || '',
            suggestion: issue.suggestion || '',
            corrected: issue.correctedSegment || ''
          });
        } catch (err) {
          console.error('Error adding issue row:', err, issue);
          // Add a placeholder row with error information
          issuesSheet.addRow({
            category: 'Error',
            subcategory: 'Processing Error',
            severity: 'MINOR',
            segment: 'Error processing issue',
            explanation: err.message,
            suggestion: '',
            corrected: ''
          });
        }
      });
    } else {
      // If no issues exist, add a placeholder row
      issuesSheet.addRow({
        category: 'Info',
        subcategory: 'No Issues',
        severity: 'NONE',
        segment: 'No issues found',
        explanation: 'The analysis did not identify any issues with the text.',
        suggestion: '',
        corrected: ''
      });
    }
    
    // Format the header row
    const issuesHeaderRow = issuesSheet.getRow(1);
    issuesHeaderRow.font = { bold: true };
    issuesHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' }
    };
    issuesHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    
    // Apply wrap text to all text cells in the issues sheet
    for (let i = 2; i <= issuesSheet.rowCount; i++) {
      const row = issuesSheet.getRow(i);
      row.getCell('segment').alignment = { wrapText: true };
      row.getCell('explanation').alignment = { wrapText: true };
      row.getCell('suggestion').alignment = { wrapText: true };
      row.getCell('corrected').alignment = { wrapText: true };
    }
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Upload to S3 if environment variables are configured
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET) {
      try {
        // Create a unique key for the file
        const key = `reports/${run._id}/${Date.now()}_mqm_report.xlsx`;
        
        // Upload the buffer to S3
        const url = await s3Service.uploadBuffer(buffer, key);
        
        // Update the run with the S3 URL and key
        run.excelReportUrl = url;
        run.excelReportKey = key;
        await run.save();
        
        // Redirect to the S3 URL
        return res.redirect(url);
      } catch (s3Error) {
        console.error('Error uploading to S3, falling back to direct download:', s3Error);
        // Fall back to direct download if S3 upload fails
      }
    }
    
    // If S3 upload fails or is not configured, send the file directly
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=mqm_report_${run._id}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Excel report generation error:', err);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
});

// Admin route to view runs data - no auth required for development
app.get('/admin/runs', async (req, res) => {
  try {
    // Render the admin page with the runs data
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } catch (error) {
    console.error('Error serving admin page:', error);
    res.status(500).send('Error serving admin page');
  }
});

// API endpoint to get runs data as JSON - no auth required for development
app.get('/api/admin/runs', async (req, res) => {
  try {
    
    // Get query parameters for filtering
    const { page = 1, limit = 20, search, startDate, endDate, analysisMode } = req.query;
    
    // Build query object
    const query = {};
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { sourceLang: new RegExp(search, 'i') },
        { targetLang: new RegExp(search, 'i') },
        { summary: new RegExp(search, 'i') }
      ];
    }
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    // Add analysis mode filter if provided
    if (analysisMode) {
      query.analysisMode = analysisMode;
    }
    
    // Count total documents matching the query
    const total = await Run.countDocuments(query);
    
    // Fetch paginated runs data
    const runs = await Run.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
      // Including sourceText and targetText fields
    
    // Return JSON response with pagination info
    res.json({
      runs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching runs data:', error);
    res.status(500).json({ error: 'Error fetching runs data' });
  }
});

// API endpoint to get action logs - no auth required for development
app.get('/api/admin/actions', async (req, res) => {
  try {
    // Get query parameters for filtering
    const { page = 1, limit = 20, actionType, startDate, endDate, search } = req.query;
    
    // Build query object
    const query = {};
    
    // Add action type filter if provided
    if (actionType) {
      query.actionType = actionType;
    }
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { sourceLang: new RegExp(search, 'i') },
        { targetLang: new RegExp(search, 'i') },
        { engineUsed: new RegExp(search, 'i') },
        { llmModel: new RegExp(search, 'i') }
      ];
    }
    
    // Count total documents matching the query
    const total = await ActionLog.countDocuments(query);
    
    // Fetch paginated action logs
    const actions = await ActionLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'email name')
      .populate('run', 'mqmScore wordCount');
    
    // Return JSON response with pagination info
    res.json({
      actions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching action logs:', error);
    res.status(500).json({ error: 'Error fetching action logs' });
  }
});

// Traffic analytics API endpoint
app.get('/api/admin/traffic', async (req, res) => {
  try {
    // Get query parameters for date range
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days if no date range provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Query for user activity (daily active and new users)
    const userActivityPipeline = [
      {
        $match: {
          timestamp: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          activeUsers: { $addToSet: { $cond: [{ $ifNull: ['$user', false] }, '$user', '$anonymousSessionId'] } },
          // Count as new user if this is their first action
          newUsers: { 
            $addToSet: { 
              $cond: [
                { $eq: [{ $min: '$timestamp' }, '$timestamp'] },
                { $cond: [{ $ifNull: ['$user', false] }, '$user', '$anonymousSessionId'] },
                null
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          activeUsers: { $size: '$activeUsers' },
          newUsers: { $size: '$newUsers' }
        }
      },
      {
        $sort: { date: 1 }
      }
    ];
    
    // Query for geographic distribution
    const geoPipeline = [
      {
        $match: {
          timestamp: { $gte: start, $lte: end },
          'location.country': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$location.country',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          country: '$_id',
          count: 1
        }
      },
      {
        $sort: { count: -1 }
      }
    ];
    
    // Query for actions by type
    const actionsPipeline = [
      {
        $match: {
          timestamp: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$actionType',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          count: 1
        }
      }
    ];
    
    // Query for language pairs
    const languagePipeline = [
      {
        $match: {
          timestamp: { $gte: start, $lte: end },
          sourceLang: { $exists: true, $ne: null },
          targetLang: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: { sourceLang: '$sourceLang', targetLang: '$targetLang' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          sourceLang: '$_id.sourceLang',
          targetLang: '$_id.targetLang',
          count: 1
        }
      },
      {
        $sort: { count: -1 }
      }
    ];
    
    // Execute all aggregation pipelines
    const [userActivity, geoDistribution, actionsByTypeArray, topLanguagePairs] = await Promise.all([
      ActionLog.aggregate(userActivityPipeline),
      ActionLog.aggregate(geoPipeline),
      ActionLog.aggregate(actionsPipeline),
      ActionLog.aggregate(languagePipeline)
    ]);
    
    // Convert actions by type array to object
    const actionsByType = {};
    actionsByTypeArray.forEach(item => {
      actionsByType[item.type] = item.count;
    });
    
    // Count total users, active users today, and new users today
    const totalUsersPipeline = [
      {
        $group: {
          _id: null,
          uniqueUsers: { $addToSet: { $cond: [{ $ifNull: ['$user', false] }, '$user', '$anonymousSessionId'] } }
        }
      },
      {
        $project: {
          _id: 0,
          count: { $size: '$uniqueUsers' }
        }
      }
    ];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeUsersTodayPipeline = [
      {
        $match: {
          timestamp: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          uniqueUsers: { $addToSet: { $cond: [{ $ifNull: ['$user', false] }, '$user', '$anonymousSessionId'] } }
        }
      },
      {
        $project: {
          _id: 0,
          count: { $size: '$uniqueUsers' }
        }
      }
    ];
    
    const newUsersTodayPipeline = [
      {
        $match: {
          timestamp: { $gte: today }
        }
      },
      {
        $group: {
          _id: { $cond: [{ $ifNull: ['$user', false] }, '$user', '$anonymousSessionId'] },
          firstAction: { $min: '$timestamp' }
        }
      },
      {
        $match: {
          firstAction: { $gte: today }
        }
      },
      {
        $count: 'count'
      }
    ];
    
    // Execute user count aggregations
    const [totalUsersResult, activeUsersTodayResult, newUsersTodayResult] = await Promise.all([
      ActionLog.aggregate(totalUsersPipeline),
      ActionLog.aggregate(activeUsersTodayPipeline),
      ActionLog.aggregate(newUsersTodayPipeline)
    ]);
    
    // Extract counts from results
    const totalUsers = totalUsersResult.length > 0 ? totalUsersResult[0].count : 0;
    const activeUsers = activeUsersTodayResult.length > 0 ? activeUsersTodayResult[0].count : 0;
    const newUsers = newUsersTodayResult.length > 0 ? newUsersTodayResult[0].count : 0;
    
    // Count total translations and analyses
    const totalTranslations = actionsByType['translate'] || 0;
    const totalAnalyses = actionsByType['qa'] || 0;
    
    // Return the traffic analytics data
    res.json({
      userActivity,
      geoDistribution,
      actionsByType,
      topLanguagePairs,
      totalUsers,
      activeUsers,
      newUsers,
      totalTranslations,
      totalAnalyses
    });
  } catch (error) {
    console.error('Error fetching traffic analytics:', error);
    res.status(500).json({ error: 'Error fetching traffic analytics' });
  }
});

// API endpoint to get a specific run by ID - no auth required for development
app.get('/api/admin/runs/:id', async (req, res) => {
  try {
    
    const runId = req.params.id;
    
    // Fetch the run data
    const run = await Run.findById(runId);
    
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Return the run data
    res.json(run);
  } catch (error) {
    console.error('Error fetching run details:', error);
    res.status(500).json({ error: 'Error fetching run details' });
  }
});

// Import ActionLog model
const ActionLog = require('./models/ActionLog');

// Machine Translation API endpoint
app.post('/api/translate', authMiddleware.optionalAuth, async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    
    if (!text || !sourceLang || !targetLang) {
      return res.status(400).json({ error: 'Missing required parameters: text, sourceLang, targetLang' });
    }
    
    // Track usage for authenticated users
    if (req.user) {
      await authMiddleware.trackUsage(req, res, () => {});
    }
    
    // Get base language codes (e.g., 'en' from 'en-US')
    const sourceBase = sourceLang.split('-')[0];
    const targetBase = targetLang.split('-')[0];
    
    let translatedText = '';
    let engineUsed = '';
    
    // DeepL supported languages (as of April 2025)
    // This list should be updated as DeepL adds more languages
    const deeplSupportedLanguages = [
      'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'hu', 'id',
      'it', 'ja', 'ko', 'lt', 'lv', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk',
      'sl', 'sv', 'tr', 'uk', 'zh'
    ];
    
    // Check if both source and target languages are supported by DeepL
    const useDeepL = deeplSupportedLanguages.includes(sourceBase) && 
                    deeplSupportedLanguages.includes(targetBase) && 
                    process.env.DEEPL_API_KEY;
    
    // Try DeepL first if supported
    if (useDeepL) {
      try {
        const deeplApiKey = process.env.DEEPL_API_KEY;
        console.log(`Attempting DeepL translation: ${sourceLang} -> ${targetLang}`);
        console.log(`Languages base codes: ${sourceBase} -> ${targetBase}`);
        console.log(`DeepL supported: Source=${deeplSupportedLanguages.includes(sourceBase)}, Target=${deeplSupportedLanguages.includes(targetBase)}`);
        
        // Validate API key format before making the request
        if (!deeplApiKey || deeplApiKey.trim() === '' || deeplApiKey.includes('your_deepl_api_key')) {
          console.error('Invalid DeepL API key format');
          throw new Error('Invalid DeepL API key');
        }
        
        const url = 'https://api-free.deepl.com/v2/translate';  // Use the paid API URL if using a paid account
        
        console.log(`Making DeepL API request to ${url}`);
        const response = await axios.post(url, 
          {
            text: [text],
            source_lang: sourceBase.toUpperCase(),
            target_lang: targetBase.toUpperCase(),
            formality: 'default'  // Can be 'more', 'less', or 'default'
          },
          {
            headers: {
              'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data && response.data.translations && response.data.translations.length > 0) {
          translatedText = response.data.translations[0].text;
          engineUsed = 'DeepL';
          console.log(`DeepL Translation: ${sourceLang} -> ${targetLang}, ${text.length} chars`);
          
          // Log the translation action
          await ActionLog.create({
            actionType: 'translate',
            user: req.user ? req.user.id : null,
            anonymousSessionId: req.cookies.anonymousSessionId,
            ip,
            sourceLang,
            targetLang,
            sourceTextLength: text.length,
            targetTextLength: translatedText.length,
            engineUsed,
            location: req.geoip // If you have geoip middleware
          });
          
          return res.json({
            translatedText,
            sourceLang,
            targetLang,
            engine: engineUsed
          });
        }
      } catch (deeplError) {
        console.error('DeepL translation error:', deeplError);
        if (deeplError.response) {
          console.error('DeepL API response error:', {
            status: deeplError.response.status,
            statusText: deeplError.response.statusText,
            data: deeplError.response.data
          });
        } else if (deeplError.request) {
          console.error('DeepL API request error (no response received)');
        } else {
          console.error('DeepL API error message:', deeplError.message);
        }
        // Continue to fallback options if DeepL fails
      }
    }
    
    // Fallback to Google Translate if DeepL is not supported or failed
    const googleApiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (googleApiKey) {
      try {
        const url = `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`;
        const response = await axios.post(url, {
          q: text,
          source: sourceBase,
          target: targetBase,
          format: 'text'
        });
        
        if (response.data && response.data.data && response.data.data.translations && response.data.data.translations.length > 0) {
          translatedText = response.data.data.translations[0].translatedText;
          engineUsed = 'Google Translate';
          console.log(`Google Translation: ${sourceLang} -> ${targetLang}, ${text.length} chars`);
          
          // Log the translation action
          await ActionLog.create({
            actionType: 'translate',
            user: req.user ? req.user.id : null,
            anonymousSessionId: req.cookies.anonymousSessionId,
            ip,
            sourceLang,
            targetLang,
            sourceTextLength: text.length,
            targetTextLength: translatedText.length,
            engineUsed,
            location: req.geoip // If you have geoip middleware
          });
          
          return res.json({
            translatedText,
            sourceLang,
            targetLang,
            engine: engineUsed
          });
        }
      } catch (googleError) {
        console.error('Google translation error:', googleError);
        // Continue to final fallback if Google Translate fails
      }
    }
    
    // Final fallback to Claude for translation if no other engine is available or working
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    if (claudeApiKey) {
      const prompt = `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}. Provide ONLY the translated text without any explanations, notes, or original text.

Text to translate:
${text}`;
      
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-haiku-20240307',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeApiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      if (response.data && response.data.content && response.data.content.length > 0) {
        translatedText = response.data.content[0].text;
        engineUsed = 'Claude AI';
        console.log(`Claude Translation: ${sourceLang} -> ${targetLang}, ${text.length} chars`);
        
        // Log the translation action
        await ActionLog.create({
          actionType: 'translate',
          user: req.user ? req.user.id : null,
          anonymousSessionId: req.cookies.anonymousSessionId,
          ip,
          sourceLang,
          targetLang,
          sourceTextLength: text.length,
          targetTextLength: translatedText.length,
          engineUsed,
          llmModel: 'claude-3-haiku-20240307',
          location: req.geoip // If you have geoip middleware
        });
        
        return res.json({
          translatedText,
          sourceLang,
          targetLang,
          engine: engineUsed
        });
      }
    }
    
    // If we get here, all translation engines failed
    throw new Error('All translation engines failed or are not configured');
  } catch (error) {
    console.error('Translation error:', error);
    return res.status(500).json({ 
      error: 'Translation failed', 
      message: error.message 
    });
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

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});