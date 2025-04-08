/**
 * Language Utilities
 * Provides functions for language code normalization and validation
 */

/**
 * Normalize language code to ISO format
 * @param {string} langCode - Language code to normalize
 * @returns {string} - Normalized language code
 */
function normalizeLanguageCode(langCode) {
  if (!langCode) return 'en';
  
  // Convert to lowercase
  let normalizedCode = langCode.toLowerCase();
  
  // Remove any whitespace
  normalizedCode = normalizedCode.trim();
  
  // Handle common variations
  const codeMap = {
    'english': 'en',
    'french': 'fr',
    'spanish': 'es',
    'german': 'de',
    'italian': 'it',
    'portuguese': 'pt',
    'chinese': 'zh',
    'japanese': 'ja',
    'korean': 'ko',
    'russian': 'ru',
    'arabic': 'ar',
    'hindi': 'hi',
    'bengali': 'bn',
    'dutch': 'nl',
    'turkish': 'tr',
    'vietnamese': 'vi',
    'thai': 'th',
    'indonesian': 'id',
    'malay': 'ms',
    'persian': 'fa',
    'hebrew': 'he',
    'polish': 'pl',
    'ukrainian': 'uk',
    'czech': 'cs',
    'swedish': 'sv',
    'finnish': 'fi',
    'norwegian': 'no',
    'danish': 'da',
    'greek': 'el',
    'hungarian': 'hu',
    'romanian': 'ro',
    'slovak': 'sk',
    'bulgarian': 'bg',
    'croatian': 'hr',
    'lithuanian': 'lt',
    'latvian': 'lv',
    'estonian': 'et',
    'slovenian': 'sl',
    'serbian': 'sr',
    'catalan': 'ca',
    'basque': 'eu',
    'galician': 'gl',
    'maltese': 'mt',
    'irish': 'ga',
    'welsh': 'cy',
    'icelandic': 'is',
    'albanian': 'sq',
    'macedonian': 'mk',
    'georgian': 'ka',
    'armenian': 'hy',
    'azerbaijani': 'az',
    'kazakh': 'kk',
    'uzbek': 'uz',
    'turkmen': 'tk',
    'kyrgyz': 'ky',
    'tajik': 'tg',
    'mongolian': 'mn',
    'burmese': 'my',
    'khmer': 'km',
    'lao': 'lo',
    'nepali': 'ne',
    'sinhala': 'si',
    'tamil': 'ta',
    'telugu': 'te',
    'kannada': 'kn',
    'malayalam': 'ml',
    'marathi': 'mr',
    'punjabi': 'pa',
    'gujarati': 'gu',
    'oriya': 'or',
    'urdu': 'ur',
    'amharic': 'am',
    'somali': 'so',
    'swahili': 'sw',
    'zulu': 'zu',
    'xhosa': 'xh',
    'afrikaans': 'af',
    'hausa': 'ha',
    'yoruba': 'yo',
    'igbo': 'ig',
    'malagasy': 'mg',
    'hawaiian': 'haw',
    'samoan': 'sm',
    'tongan': 'to',
    'fijian': 'fj',
    'maori': 'mi',
    'en-us': 'en',
    'en-gb': 'en',
    'fr-fr': 'fr',
    'fr-ca': 'fr-ca',
    'es-es': 'es',
    'es-mx': 'es-mx',
    'es-419': 'es-419',
    'pt-br': 'pt-br',
    'pt-pt': 'pt',
    'zh-cn': 'zh-hans',
    'zh-tw': 'zh-hant',
    'zh-hk': 'zh-hant',
    'zh-sg': 'zh-hans',
    'zh-mo': 'zh-hant'
  };
  
  // Check if we have a mapping for this code
  if (codeMap[normalizedCode]) {
    return codeMap[normalizedCode];
  }
  
  // Handle BCP 47 style codes (e.g., en-US)
  if (normalizedCode.includes('-')) {
    const parts = normalizedCode.split('-');
    const primaryCode = parts[0];
    
    // For Chinese, we want to preserve the variant
    if (primaryCode === 'zh') {
      const variant = parts[1];
      if (['cn', 'sg'].includes(variant)) {
        return 'zh-hans';
      } else if (['tw', 'hk', 'mo'].includes(variant)) {
        return 'zh-hant';
      }
    }
    
    // For most languages, just return the primary code
    return primaryCode;
  }
  
  // If no special handling needed, return as is
  return normalizedCode;
}

/**
 * Check if a language code is valid
 * @param {string} langCode - Language code to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidLanguageCode(langCode) {
  if (!langCode) return false;
  
  // Normalize first
  const normalizedCode = normalizeLanguageCode(langCode);
  
  // List of valid ISO 639-1 codes
  const validCodes = [
    'aa', 'ab', 'ae', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az',
    'ba', 'be', 'bg', 'bh', 'bi', 'bm', 'bn', 'bo', 'br', 'bs',
    'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy',
    'da', 'de', 'dv', 'dz',
    'ee', 'el', 'en', 'eo', 'es', 'et', 'eu',
    'fa', 'ff', 'fi', 'fj', 'fo', 'fr', 'fy',
    'ga', 'gd', 'gl', 'gn', 'gu', 'gv',
    'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz',
    'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu',
    'ja', 'jv',
    'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky',
    'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv',
    'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my',
    'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny',
    'oc', 'oj', 'om', 'or', 'os',
    'pa', 'pi', 'pl', 'ps', 'pt',
    'qu',
    'rm', 'rn', 'ro', 'ru', 'rw',
    'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw',
    'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty',
    'ug', 'uk', 'ur', 'uz',
    've', 'vi', 'vo',
    'wa', 'wo',
    'xh',
    'yi', 'yo',
    'za', 'zh', 'zu',
    // Common variants
    'zh-hans', 'zh-hant', 'en-us', 'en-gb', 'fr-ca', 'es-mx', 'pt-br', 'es-419'
  ];
  
  return validCodes.includes(normalizedCode);
}

module.exports = {
  normalizeLanguageCode,
  isValidLanguageCode
};
