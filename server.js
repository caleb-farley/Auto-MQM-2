// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const Run = require('./models/Run');

// Load environment variables
dotenv.config();

const mongoose = require('mongoose');

// 🔥 MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

const app = express();
app.use(cors());
app.use(express.json());

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
app.post('/api/check-alignment', async (req, res) => {
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

// MQM analysis endpoint using Claude API
app.post('/api/mqm-analysis', async (req, res) => {
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
    
    // Find and parse the JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse analysis results' });
    }
    
    try {
      const mqmResults = JSON.parse(jsonMatch[0]);

await Run.create({
  sourceText,
  targetText,
  sourceLang,
  targetLang,
  alignmentConfidence: req.body.matchConfidence || 100, // optional, can be passed from previous endpoint
  alignmentReason: req.body.reason || 'N/A',
  mqmScore: mqmResults.overallScore,
  issues: mqmResults.mqmIssues,
  mqmScore: mqmResults.overallScore,
  issues: mqmResults.mqmIssues,
  ip: location.ip,
  location
});
      return res.json(mqmResults);
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

// Add this at the top of your routes in server.js
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