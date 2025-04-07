/**
 * Language code utilities for Auto-MQM
 * 
 * Provides functions to normalize and validate language codes
 * and handle fallbacks for language variants.
 */

// Map of language codes to their base codes
const languageVariantMap = {
  // Chinese variants
  'zh-CN': 'zh',
  'zh-TW': 'zh',
  'zh-HK': 'zh',
  'zh-SG': 'zh',
  'zh-MO': 'zh',
  
  // Spanish variants
  'es-ES': 'es',
  'es-MX': 'es',
  'es-AR': 'es',
  'es-CO': 'es',
  'es-CL': 'es',
  'es-PE': 'es',
  'es-VE': 'es',
  'es-419': 'es',
  
  // English variants
  'en-US': 'en',
  'en-GB': 'en',
  'en-CA': 'en',
  'en-AU': 'en',
  'en-NZ': 'en',
  'en-IE': 'en',
  'en-ZA': 'en',
  'en-IN': 'en',
  
  // French variants
  'fr-FR': 'fr',
  'fr-CA': 'fr',
  'fr-BE': 'fr',
  'fr-CH': 'fr',
  'fr-LU': 'fr',
  
  // Portuguese variants
  'pt-BR': 'pt',
  'pt-PT': 'pt',
  
  // German variants
  'de-DE': 'de',
  'de-AT': 'de',
  'de-CH': 'de',
  'de-LU': 'de',
  'de-LI': 'de',
  
  // Arabic variants
  'ar-SA': 'ar',
  'ar-EG': 'ar',
  'ar-DZ': 'ar',
  'ar-MA': 'ar',
  'ar-TN': 'ar',
  'ar-LB': 'ar',
  'ar-AE': 'ar',
  
  // Russian variants
  'ru-RU': 'ru',
  'ru-BY': 'ru',
  'ru-KZ': 'ru',
  'ru-UA': 'ru',
  
  // Japanese variants
  'ja-JP': 'ja',
  
  // Korean variants
  'ko-KR': 'ko',
  
  // Italian variants
  'it-IT': 'it',
  'it-CH': 'it',
  
  // Dutch variants
  'nl-NL': 'nl',
  'nl-BE': 'nl',
  
  // Swedish variants
  'sv-SE': 'sv',
  'sv-FI': 'sv',
  
  // Norwegian variants
  'no-NO': 'no',
  'nb-NO': 'no',
  'nn-NO': 'no',
  
  // Danish variants
  'da-DK': 'da',
  
  // Finnish variants
  'fi-FI': 'fi',
  
  // Polish variants
  'pl-PL': 'pl',
  
  // Turkish variants
  'tr-TR': 'tr',
  
  // Greek variants
  'el-GR': 'el',
  
  // Hungarian variants
  'hu-HU': 'hu',
  
  // Czech variants
  'cs-CZ': 'cs',
  
  // Slovak variants
  'sk-SK': 'sk',
  
  // Romanian variants
  'ro-RO': 'ro',
  
  // Bulgarian variants
  'bg-BG': 'bg',
  
  // Ukrainian variants
  'uk-UA': 'uk',
  
  // Croatian variants
  'hr-HR': 'hr',
  
  // Serbian variants
  'sr-RS': 'sr',
  'sr-Latn-RS': 'sr',
  'sr-Cyrl-RS': 'sr',
  
  // Slovenian variants
  'sl-SI': 'sl',
  
  // Estonian variants
  'et-EE': 'et',
  
  // Latvian variants
  'lv-LV': 'lv',
  
  // Lithuanian variants
  'lt-LT': 'lt',
  
  // Thai variants
  'th-TH': 'th',
  
  // Vietnamese variants
  'vi-VN': 'vi',
  
  // Indonesian variants
  'id-ID': 'id',
  
  // Malay variants
  'ms-MY': 'ms',
  'ms-SG': 'ms',
  'ms-BN': 'ms',
  
  // Hindi variants
  'hi-IN': 'hi',
  
  // Bengali variants
  'bn-IN': 'bn',
  'bn-BD': 'bn',
  
  // Tamil variants
  'ta-IN': 'ta',
  'ta-LK': 'ta',
  'ta-SG': 'ta',
  'ta-MY': 'ta',
  
  // Urdu variants
  'ur-PK': 'ur',
  'ur-IN': 'ur',
  
  // Farsi/Persian variants
  'fa-IR': 'fa',
  'fa-AF': 'fa',
  
  // Hebrew variants
  'he-IL': 'he',
  'iw-IL': 'he', // Java legacy code
  
  // Tagalog/Filipino variants
  'tl-PH': 'tl',
  'fil-PH': 'tl',
  
  // Swahili variants
  'sw-KE': 'sw',
  'sw-TZ': 'sw',
  'sw-UG': 'sw',
};

/**
 * Normalize a language code to a format recognized by the system
 * Handles variants like zh-CN -> zh, en-US -> en, etc.
 * 
 * @param {string} langCode - The language code to normalize
 * @returns {string} - The normalized language code
 */
function normalizeLanguageCode(langCode) {
  if (!langCode) return '';
  
  // Convert to lowercase for consistency
  const normalizedCode = langCode.trim().toLowerCase();
  
  // Check if it's a variant we know about
  if (languageVariantMap[normalizedCode]) {
    return languageVariantMap[normalizedCode];
  }
  
  // If it's a code with a region (e.g., xx-YY format), try to get the base code
  if (normalizedCode.includes('-')) {
    const baseCode = normalizedCode.split('-')[0];
    return baseCode;
  }
  
  // Return as is if no mapping found
  return normalizedCode;
}

/**
 * Check if a language code is valid in our system
 * 
 * @param {string} langCode - The language code to validate
 * @returns {boolean} - Whether the language code is valid
 */
function isValidLanguageCode(langCode) {
  if (!langCode) return false;
  
  // Normalize the code first
  const normalizedCode = normalizeLanguageCode(langCode);
  
  // List of all supported base language codes
  // This should match the options in your language dropdowns
  const supportedCodes = [
    'en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko', 
    'ar', 'hi', 'bn', 'tr', 'vi', 'pl', 'uk', 'fa', 'sv', 'da', 'fi', 'no', 
    'id', 'ms', 'th', 'he', 'el', 'ro', 'hu', 'cs', 'sk', 'bg', 'sr', 'hr', 
    'sl', 'et', 'lv', 'lt', 'ta', 'ur', 'sw', 'tl'
  ];
  
  return supportedCodes.includes(normalizedCode);
}

module.exports = {
  normalizeLanguageCode,
  isValidLanguageCode
};
