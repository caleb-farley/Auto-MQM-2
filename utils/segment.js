/**
 * SRX-based segmentation utility for Auto-MQM
 * 
 * Provides standardized segmentation for both raw text input and uploaded files
 * (.tmx, .xliff), using a CAT-tool-aligned method based on SRX principles.
 */

const fs = require('fs');
const path = require('path');
// Import sentence-splitter or provide a simple fallback if it fails
let sentenceSplitter, split, Syntax;
try {
  sentenceSplitter = require('sentence-splitter');
  split = sentenceSplitter.split;
  Syntax = sentenceSplitter.Syntax;
} catch (error) {
  console.warn('Warning: sentence-splitter module not available, using fallback splitter');
  // Simple fallback implementation
  split = (text) => {
    // Simple sentence splitting by punctuation with lookbehind for abbreviations
    const sentences = text.split(/(?<![A-Z]\.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s/g).filter(s => s.trim());
    return sentences.map(s => ({ type: 'Sentence', raw: s.trim() }));
  };
  Syntax = { Sentence: 'Sentence' };
}
const xml2js = require('xml2js');
const xliff = require('xliff');

// SRX-like language-specific segmentation rules
const languageRules = {
  // Default rules for most languages
  default: {
    // End of sentence markers followed by space or end of string
    endMarkers: /([.!?])[\s$]/g,
    // Exceptions to end markers (abbreviations, etc.)
    exceptions: [
      /Mr\./g, /Mrs\./g, /Ms\./g, /Dr\./g, /Prof\./g, /Inc\./g, /Ltd\./g,
      /St\./g, /Ave\./g, /Blvd\./g, /Rd\./g, /e\.g\./g, /i\.e\./g, /etc\./g,
      /vs\./g, /Fig\./g, /fig\./g, /No\./g, /no\./g, /Vol\./g, /vol\./g
    ],
    // Preserve these elements (code, tags, etc.)
    preserveElements: [
      // HTML/XML tags
      /<[^>]+>/g,
      // Placeholders like {0}, %s, etc.
      /\{\d+\}/g, /%[sd]/g,
      // Code blocks
      /```[\s\S]*?```/g, /`[^`]+`/g
    ]
  },
  // Chinese, Japanese, Korean - character-based segmentation
  'zh': { endMarkers: /([。！？])/g, exceptions: [] },
  'ja': { endMarkers: /([。！？])/g, exceptions: [] },
  'ko': { endMarkers: /([。！？])/g, exceptions: [] },
  // German - handle compound words and specific punctuation
  'de': {
    endMarkers: /([.!?])[\s$]/g,
    exceptions: [
      /Hr\./g, /Fr\./g, /Dr\./g, /Prof\./g, /Nr\./g, /Nr\./g, /z\.B\./g, /d\.h\./g,
      /etc\./g, /usw\./g, /Abb\./g, /Abk\./g, /Abs\./g, /Abt\./g, /Bd\./g
    ]
  },
  // Spanish - handle inverted punctuation
  'es': {
    endMarkers: /([.!?])[\s$]/g,
    exceptions: [
      /Sr\./g, /Sra\./g, /Srta\./g, /Dr\./g, /Dra\./g, /Av\./g, /Avda\./g, /p\.ej\./g
    ]
  },
  // French - handle specific abbreviations and punctuation
  'fr': {
    endMarkers: /([.!?])[\s$]/g,
    exceptions: [
      /M\./g, /Mme\./g, /Mlle\./g, /Dr\./g, /Prof\./g, /av\./g, /éd\./g, /p\.ex\./g
    ]
  }
};

/**
 * Get language-specific rules for segmentation
 * @param {string} langCode - ISO language code
 * @returns {Object} - Language-specific segmentation rules
 */
function getLanguageRules(langCode) {
  if (!langCode) return languageRules.default;
  
  // Extract base language code (e.g., 'en-US' -> 'en')
  const baseCode = langCode.split('-')[0].toLowerCase();
  
  return languageRules[baseCode] || languageRules.default;
}

/**
 * Segment text using SRX-like rules
 * @param {string} text - Text to segment
 * @param {string} langCode - ISO language code
 * @returns {string[]} - Array of segments
 */
function segmentText(text, langCode) {
  if (!text) return [];
  
  try {
    // Get language-specific rules
    const rules = getLanguageRules(langCode);
    
    // Preserve special elements by replacing them with placeholders
    const preservedElements = [];
    let processedText = text;
    
    // Only process preserveElements if the rules exist and have this property
    if (rules && rules.preserveElements && Array.isArray(rules.preserveElements)) {
      rules.preserveElements.forEach((pattern, index) => {
        try {
          processedText = processedText.replace(pattern, (match) => {
            const placeholder = `__PRESERVED_ELEMENT_${index}_${preservedElements.length}__`;
            preservedElements.push({ placeholder, content: match });
            return placeholder;
          });
        } catch (err) {
          console.warn(`Error processing preserve pattern ${index}:`, err);
        }
      });
    }
    
    // Simple and reliable sentence splitting approach
    let segments = [];
    
    // First try to use the sentence-splitter library if available
    try {
      if (typeof split === 'function' && Syntax && Syntax.Sentence) {
        const splitResult = split(processedText);
        if (splitResult && Array.isArray(splitResult)) {
          segments = splitResult
            .filter(node => node && node.type === Syntax.Sentence)
            .map(node => node.raw);
        }
      }
    } catch (error) {
      console.warn('Sentence splitter library failed, using fallback:', error.message);
    }
    
    // If no segments were found or the library failed, use a simple fallback
    if (segments.length === 0) {
      // Simple regex-based sentence splitting
      const sentenceRegex = /[^.!?\s][^.!?]*(?:[.!?](?!['"]?\s|$)[^.!?]*)*[.!?]?['"]?(?=\s|$)/g;
      const matches = processedText.match(sentenceRegex);
      
      if (matches && matches.length > 0) {
        segments = matches;
      } else {
        // If all else fails, treat the entire text as one segment
        segments = [processedText];
      }
    }
    
    // Restore preserved elements
    if (preservedElements.length > 0) {
      return segments.map(segment => {
        let restoredSegment = segment;
        preservedElements.forEach(({ placeholder, content }) => {
          try {
            restoredSegment = restoredSegment.replace(placeholder, content);
          } catch (err) {
            console.warn(`Error restoring placeholder:`, err);
          }
        });
        return restoredSegment;
      });
    }
    
    return segments;
  } catch (error) {
    console.error('Segmentation error:', error);
    // Ultimate fallback: return the whole text as one segment
    return [text];
  }
}

/**
 * Parse TMX file buffer
 * @param {Buffer} fileBuffer - TMX file buffer
 * @returns {Promise<Array>} - Array of segment pairs
 */
async function parseTMX(fileBuffer) {
  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(fileBuffer.toString());
    
    if (!result.tmx || !result.tmx.body || !result.tmx.body.tu) {
      throw new Error('Invalid TMX format');
    }
    
    const tuArray = Array.isArray(result.tmx.body.tu) ? result.tmx.body.tu : [result.tmx.body.tu];
    const sourceLang = result.tmx.header?.srclang || '';
    
    return tuArray.map((tu, index) => {
      const tuvArray = Array.isArray(tu.tuv) ? tu.tuv : [tu.tuv];
      let sourceText = '';
      let targetText = '';
      let sourceLangCode = '';
      let targetLangCode = '';
      
      tuvArray.forEach(tuv => {
        const langCode = tuv.$.xml_lang || tuv.$.lang;
        const segText = tuv.seg && (typeof tuv.seg === 'string' ? tuv.seg : tuv.seg._);
        
        if (langCode === sourceLang || !targetLangCode) {
          sourceText = segText || '';
          sourceLangCode = langCode;
        } else {
          targetText = segText || '';
          targetLangCode = langCode;
        }
      });
      
      return {
        segment_id: index + 1,
        source: sourceText,
        target: targetText,
        sourceLang: sourceLangCode,
        targetLang: targetLangCode
      };
    });
  } catch (error) {
    console.error('TMX parsing error:', error);
    throw new Error(`Failed to parse TMX file: ${error.message}`);
  }
}

/**
 * Parse XLIFF file buffer
 * @param {Buffer} fileBuffer - XLIFF file buffer
 * @returns {Promise<Array>} - Array of segment pairs
 */
async function parseXLIFF(fileBuffer) {
  try {
    const xliffContent = fileBuffer.toString();
    const xliffObj = await new Promise((resolve, reject) => {
      xliff.xliff2js(xliffContent, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    
    if (!xliffObj || !Object.keys(xliffObj).length) {
      throw new Error('Invalid XLIFF format');
    }
    
    const segments = [];
    let segmentId = 1;
    
    // Process each file in the XLIFF
    Object.keys(xliffObj).forEach(fileKey => {
      const file = xliffObj[fileKey];
      const sourceLang = file.sourceLanguage;
      const targetLang = file.targetLanguage;
      
      // Process each translation unit
      Object.keys(file.resources).forEach(resKey => {
        const resource = file.resources[resKey];
        
        Object.keys(resource).forEach(unitKey => {
          const unit = resource[unitKey];
          
          if (unit.source && (unit.target || unit.target === '')) {
            segments.push({
              segment_id: segmentId++,
              source: unit.source,
              target: unit.target,
              sourceLang,
              targetLang
            });
          }
        });
      });
    });
    
    return segments;
  } catch (error) {
    console.error('XLIFF parsing error:', error);
    throw new Error(`Failed to parse XLIFF file: ${error.message}`);
  }
}

/**
 * Get segments from text or file input
 * @param {Object} params - Input parameters
 * @param {string} [params.sourceText] - Source text
 * @param {string} [params.targetText] - Target text
 * @param {string} [params.sourceLang] - Source language code
 * @param {string} [params.targetLang] - Target language code
 * @param {string|Buffer} [params.fileBuffer] - File buffer for TMX/XLIFF (can be base64 string)
 * @param {string} [params.fileType] - File type ('tmx' or 'xliff')
 * @returns {Promise<Array>} - Array of segments
 */
async function getSegments(params) {
  try {
    const { sourceText, targetText, sourceLang, targetLang, fileBuffer, fileType } = params;
  
  // If file buffer is provided, parse file based on type
  if (fileBuffer) {
    let buffer;
    
    // Check if fileBuffer is a base64 string and convert it to Buffer if needed
    if (typeof fileBuffer === 'string') {
      // If it's a base64 string, convert to Buffer
      buffer = Buffer.from(fileBuffer, 'base64');
    } else {
      // If it's already a Buffer, use it directly
      buffer = fileBuffer;
    }
    
    if (fileType === 'tmx') {
      return parseTMX(buffer);
    } else if (fileType === 'xliff') {
      return parseXLIFF(buffer);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  }
  
  // If raw text is provided, segment it
  if (sourceText || targetText) {
    // Process source and target text into segments
    let sourceSegments = sourceText ? segmentText(sourceText, sourceLang) : [];
    let targetSegments = targetText ? segmentText(targetText, targetLang) : [];
    
    // Ensure we have at least one segment even for simple inputs
    if (sourceText && sourceSegments.length === 0) {
      sourceSegments = [sourceText];
    }
    
    if (targetText && targetSegments.length === 0) {
      targetSegments = [targetText];
    }
    
    // If both source and target are provided, align them
    if (sourceSegments.length && targetSegments.length) {
      // Simple alignment strategy: match segments by index
      // For more complex alignment, a more sophisticated algorithm would be needed
      const maxLength = Math.max(sourceSegments.length, targetSegments.length);
      
      return Array.from({ length: maxLength }, (_, i) => ({
        segment_id: i + 1,
        source: sourceSegments[i] || '',
        target: targetSegments[i] || '',
        sourceLang,
        targetLang
      }));
    }
    
    // If only one of source or target is provided (monolingual mode)
    const segments = sourceSegments.length ? sourceSegments : targetSegments;
    const lang = sourceSegments.length ? sourceLang : targetLang;
    
    return segments.map((text, i) => ({
      segment_id: i + 1,
      source: sourceSegments.length ? text : '',
      target: targetSegments.length ? text : '',
      sourceLang: sourceSegments.length ? lang : '',
      targetLang: targetSegments.length ? lang : ''
    }));
  }
  
  return [];
  } catch (error) {
    console.error('Error in getSegments:', error);
    // Fallback: create a simple segment from the raw text
    const { sourceText, targetText, sourceLang, targetLang } = params;
    if (sourceText || targetText) {
      return [{
        segment_id: 1,
        source: sourceText || '',
        target: targetText || '',
        sourceLang: sourceLang || '',
        targetLang: targetLang || ''
      }];
    }
    return [];
  }
}

/**
 * Generate Excel report for MQM analysis results
 * @param {Array} segments - Array of segments with MQM analysis
 * @param {Object} ExcelJS - ExcelJS library instance
 * @returns {Promise<Buffer>} - Excel file buffer
 */
async function generateExcelReport(segments, ExcelJS) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('MQM Analysis');
  
  // Define columns
  worksheet.columns = [
    { header: 'Segment ID', key: 'segmentId', width: 10 },
    { header: 'Source', key: 'source', width: 40 },
    { header: 'Target', key: 'target', width: 40 },
    { header: 'MQM Score', key: 'mqmScore', width: 12 },
    { header: 'Issue Count', key: 'issueCount', width: 12 },
    { header: 'Issues', key: 'issues', width: 30 },
    { header: 'Explanations', key: 'explanations', width: 40 },
    { header: 'Suggested Fixes', key: 'fixes', width: 40 }
  ];
  
  // Add data rows
  segments.forEach(segment => {
    const issues = segment.mqmIssues || [];
    
    worksheet.addRow({
      segmentId: segment.segment_id,
      source: segment.source,
      target: segment.target,
      mqmScore: segment.mqmScore || 100,
      issueCount: issues.length,
      issues: issues.map(issue => `${issue.category} > ${issue.subcategory} (${issue.severity})`).join('\n'),
      explanations: issues.map(issue => issue.explanation).join('\n'),
      fixes: issues.map(issue => issue.suggestion).join('\n')
    });
  });
  
  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Create buffer
  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  getSegments,
  segmentText,
  generateExcelReport,
  parseTMX
};
