// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

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
    
    // For a production app, you would use a language detection service here
    // For this example, we'll use the Google Cloud Translation API
    // This is just a placeholder - you'll need to implement real detection
    
    // Simulated language detection
    const detectLanguage = (text) => {
      // This is a very simplified detection 
      const firstChar = text.trim()[0].toLowerCase();
      
      if (/[áéíóúüñ¿¡]/.test(text.slice(0, 10))) return 'es';
      if (/[àâçéèêëîïôùûüÿ]/.test(text.slice(0, 10))) return 'fr';
      if (/[äöüß]/.test(text.slice(0, 10))) return 'de';
      if (/[\u4e00-\u9fff]/.test(text.slice(0, 10))) return 'zh';
      if (/[\u3040-\u30ff]/.test(text.slice(0, 10))) return 'ja';
      if (/[\uAC00-\uD7AF]/.test(text.slice(0, 10))) return 'ko';
      if (/[\u0400-\u04FF]/.test(text.slice(0, 10))) return 'ru';
      
      // Default to English
      return 'en';
    };
    
    const detectedLanguage = detectLanguage(text);
    
    return res.json({ detectedLanguage });
  } catch (error) {
    console.error('Language detection error:', error);
    return res.status(500).json({ error: 'Language detection failed' });
  }
});

// MQM analysis endpoint using Claude API
app.post('/api/mqm-analysis', async (req, res) => {
  try {
    const { sourceText, targetText, sourceLang, targetLang } = req.body;
    
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
- Location (if possible)
- Suggested fix

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
      "suggestion": "..."
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