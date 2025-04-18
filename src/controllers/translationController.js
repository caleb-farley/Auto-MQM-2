/**
 * Translation Controller
 * Handles business logic for translation services
 */

const axios = require('axios');

/**
 * Translate text using configured translation service
 */
exports.translateText = async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    
    if (!text || !sourceLang || !targetLang) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get the preferred translation engine from environment variables
    console.log('Available API Keys:', {
      deepl: process.env.DEEPL_API_KEY ? 'set' : 'not set',
      google: process.env.GOOGLE_TRANSLATE_API_KEY ? 'set' : 'not set',
      claude: process.env.CLAUDE_API_KEY ? 'set' : 'not set'
    });
    const translationEngine = process.env.DEFAULT_TRANSLATION_ENGINE || 'google';
    
    let translatedText = '';
    
    // Use the appropriate translation service
    switch (translationEngine.toLowerCase()) {
      case 'deepl':
        translatedText = await translateWithDeepL(text, sourceLang, targetLang);
        break;
      case 'google':
        translatedText = await translateWithGoogle(text, sourceLang, targetLang);
        break;
      case 'claude':
      default:
        translatedText = await translateWithClaude(text, sourceLang, targetLang);
        break;
    }
    
    return res.json({
      translatedText,
      engine: translationEngine
    });
  } catch (error) {
    console.error('Translation error:', error);
    return res.status(500).json({ error: 'Translation failed', message: error.message });
  }
};

/**
 * Translate text using DeepL API
 */
async function translateWithDeepL(text, sourceLang, targetLang) {
  const deeplApiKey = process.env.DEEPL_API_KEY;
  
  if (!deeplApiKey) {
    throw new Error('DeepL API key not configured');
  }
  
  // Map language codes to DeepL format if needed
  const deeplSourceLang = mapToDeepLCode(sourceLang);
  const deeplTargetLang = mapToDeepLCode(targetLang);
  
  const response = await axios.post(
    'https://api-free.deepl.com/v2/translate',
    {
      text: [text],
      source_lang: deeplSourceLang,
      target_lang: deeplTargetLang
    },
    {
      headers: {
        'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data.translations[0].text;
}

/**
 * Translate text using Google Translate API
 */
async function translateWithGoogle(text, sourceLang, targetLang) {
  console.log('Environment variables:', {
    GOOGLE_TRANSLATE_API_KEY: process.env.GOOGLE_TRANSLATE_API_KEY ? 'present' : 'missing',
    DEEPL_API_KEY: process.env.DEEPL_API_KEY ? 'present' : 'missing',
    NODE_ENV: process.env.NODE_ENV
  });

  const googleApiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  
  if (!googleApiKey) {
    throw new Error('Google Translate API key not configured');
  }
  
  console.log('Using Google API key:', googleApiKey.substring(0, 5) + '...');
  
  // Map language codes to Google format if needed
  const googleSourceLang = mapToGoogleCode(sourceLang);
  const googleTargetLang = mapToGoogleCode(targetLang);
  
  const url = `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`;
  const response = await axios.post(url, {
    q: text,
    source: googleSourceLang,
    target: googleTargetLang,
    format: 'text'
  });
  
  return response.data.data.translations[0].translatedText;
}

/**
 * Translate text using Claude API
 */
async function translateWithClaude(text, sourceLang, targetLang) {
  const claudeApiKey = process.env.CLAUDE_API_KEY;
  
  if (!claudeApiKey) {
    throw new Error('Claude API key not configured');
  }
  
  // Get language names for better prompting
  const sourceLanguageName = getLanguageName(sourceLang);
  const targetLanguageName = getLanguageName(targetLang);
  
  // Construct prompt for Claude
  const prompt = `Translate the following text from ${sourceLanguageName} to ${targetLanguageName}. Provide ONLY the translation without any explanations, notes, or other text.

Text to translate:
${text}`;
  
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      temperature: 0,
      system: "You are a professional translator. Provide only the translated text without any explanations or additional text.",
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2024-01-01'
      }
    }
  );
  
  return response.data.content.trim();
}

/**
 * Map ISO language code to DeepL format
 */
function mapToDeepLCode(langCode) {
  // DeepL uses uppercase for language codes
  const code = langCode.toLowerCase();
  
  // Map specific codes that differ
  const mapping = {
    'zh': 'ZH',
    'zh-cn': 'ZH',
    'zh-hans': 'ZH',
    'zh-tw': 'ZH',
    'zh-hant': 'ZH',
    'en': 'EN',
    'en-us': 'EN-US',
    'en-gb': 'EN-GB',
    'pt': 'PT',
    'pt-br': 'PT-BR',
    'pt-pt': 'PT-PT'
  };
  
  return mapping[code] || code.toUpperCase();
}

/**
 * Map ISO language code to Google Translate format
 */
function mapToGoogleCode(langCode) {
  // Google uses lowercase for language codes
  const code = langCode.toLowerCase();
  
  // Map specific codes that differ
  const mapping = {
    'zh-hans': 'zh-CN',
    'zh-hant': 'zh-TW',
    'zh': 'zh-CN',
    'en': 'en',
    'en-us': 'en',
    'en-gb': 'en',
    'pt': 'pt',
    'pt-br': 'pt',
    'pt-pt': 'pt-PT'
  };
  
  return mapping[code] || code;
}

/**
 * Get human-readable language name from ISO code
 */
function getLanguageName(langCode) {
  const code = langCode.toLowerCase();
  
  const languageNames = {
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'cs': 'Czech',
    'da': 'Danish',
    'nl': 'Dutch',
    'fi': 'Finnish',
    'el': 'Greek',
    'he': 'Hebrew',
    'hi': 'Hindi',
    'hu': 'Hungarian',
    'id': 'Indonesian',
    'lv': 'Latvian',
    'lt': 'Lithuanian',
    'no': 'Norwegian',
    'pl': 'Polish',
    'ro': 'Romanian',
    'sk': 'Slovak',
    'sv': 'Swedish',
    'th': 'Thai',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'vi': 'Vietnamese'
  };
  
  return languageNames[code] || `language with code ${langCode}`;
}

/**
 * Detect language of text
 */
exports.detectLanguage = async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length < 5) {
      return res.status(400).json({ error: 'Text too short for language detection' });
    }
    
    // Use Detect Language API
    const apiKey = process.env.DETECT_LANGUAGE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Detect Language API key not configured' });
    }

    console.log('API Key:', apiKey);
    try {
      const response = await axios.post(
        'https://ws.detectlanguage.com/0.2/detect',
        { q: text },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('API Response:', response.data);

      console.log('Full API Response:', JSON.stringify(response.data, null, 2));
      
      if (!response.data || !response.data.data || !response.data.data.detections || response.data.data.detections.length === 0) {
        return res.status(400).json({ error: 'Unable to detect language' });
      }

      const detection = response.data.data.detections[0];
      return res.json({
        language: detection.language,
        confidence: detection.confidence
      });
    } catch (apiError) {
      console.error('API error:', apiError);
      return res.status(500).json({ error: 'Language detection API error', message: apiError.message });
    }
  } catch (error) {
    console.error('Language detection error:', error);
    return res.status(500).json({ error: 'Language detection failed', message: error.message });
  }
};
