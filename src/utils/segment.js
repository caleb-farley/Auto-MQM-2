/**
 * Segment Utilities
 * Handles text segmentation and file parsing for TMX/XLIFF files
 */

const { DOMParser } = require('xmldom');
const ExcelJS = require('exceljs');
const { normalizeLanguageCode } = require('./languageUtils');

/**
 * Extract segments from text or uploaded file
 */
exports.getSegments = async ({ sourceText, targetText, sourceLang, targetLang, fileBuffer, fileType }) => {
  // If no file is provided, create a single segment from the text inputs
  if (!fileBuffer) {
    return [
      {
        source: sourceText || '',
        target: targetText || '',
        sourceLang: sourceLang || null,
        targetLang: targetLang || null
      }
    ];
  }
  
  // Parse file based on type
  switch (fileType) {
    case 'tmx':
      return parseTMX(fileBuffer);
    case 'xliff':
      return parseXLIFF(fileBuffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
};

/**
 * Parse TMX file and extract segments
 */
function parseTMX(fileBuffer) {
  try {
    // Convert buffer to string
    const xmlString = fileBuffer.toString('utf8');
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    // Get translation units
    const tuNodes = xmlDoc.getElementsByTagName('tu');
    const segments = [];
    
    // Extract source and target languages from header
    let sourceLang = null;
    let targetLang = null;
    
    const headerNode = xmlDoc.getElementsByTagName('header')[0];
    if (headerNode) {
      sourceLang = headerNode.getAttribute('srclang');
      
      // TMX doesn't have a target language in the header, so we'll get it from the first TUV
      const firstTu = tuNodes[0];
      if (firstTu) {
        const tuvNodes = firstTu.getElementsByTagName('tuv');
        for (let i = 0; i < tuvNodes.length; i++) {
          const lang = tuvNodes[i].getAttribute('xml:lang') || tuvNodes[i].getAttribute('lang');
          if (lang && lang !== sourceLang) {
            targetLang = lang;
            break;
          }
        }
      }
    }
    
    // Normalize language codes
    sourceLang = normalizeLanguageCode(sourceLang);
    targetLang = normalizeLanguageCode(targetLang);
    
    // Process each translation unit
    for (let i = 0; i < tuNodes.length; i++) {
      const tuNode = tuNodes[i];
      const tuvNodes = tuNode.getElementsByTagName('tuv');
      
      let sourceText = null;
      let targetText = null;
      let segSourceLang = sourceLang;
      let segTargetLang = targetLang;
      
      // Process each translation unit variant
      for (let j = 0; j < tuvNodes.length; j++) {
        const tuvNode = tuvNodes[j];
        const lang = tuvNode.getAttribute('xml:lang') || tuvNode.getAttribute('lang');
        const segNode = tuvNode.getElementsByTagName('seg')[0];
        
        if (!segNode) continue;
        
        const text = segNode.textContent;
        
        // Determine if this is source or target based on language
        if (lang === sourceLang || (!sourceText && j === 0)) {
          sourceText = text;
          segSourceLang = normalizeLanguageCode(lang);
        } else {
          targetText = text;
          segTargetLang = normalizeLanguageCode(lang);
        }
      }
      
      // Only add segments that have at least a target
      if (targetText) {
        segments.push({
          source: sourceText,
          target: targetText,
          sourceLang: segSourceLang,
          targetLang: segTargetLang
        });
      }
    }
    
    return segments;
  } catch (error) {
    console.error('Error parsing TMX file:', error);
    throw new Error(`Failed to parse TMX file: ${error.message}`);
  }
}

/**
 * Parse XLIFF file and extract segments
 */
function parseXLIFF(fileBuffer) {
  try {
    // Convert buffer to string
    const xmlString = fileBuffer.toString('utf8');
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    // Get file node
    const fileNode = xmlDoc.getElementsByTagName('file')[0];
    if (!fileNode) {
      throw new Error('Invalid XLIFF: No file element found');
    }
    
    // Extract source and target languages
    let sourceLang = fileNode.getAttribute('source-language');
    let targetLang = fileNode.getAttribute('target-language');
    
    // Normalize language codes
    sourceLang = normalizeLanguageCode(sourceLang);
    targetLang = normalizeLanguageCode(targetLang);
    
    // Get translation units
    const transUnitNodes = xmlDoc.getElementsByTagName('trans-unit');
    const segments = [];
    
    // Process each translation unit
    for (let i = 0; i < transUnitNodes.length; i++) {
      const transUnitNode = transUnitNodes[i];
      const sourceNode = transUnitNode.getElementsByTagName('source')[0];
      const targetNode = transUnitNode.getElementsByTagName('target')[0];
      
      if (!sourceNode) continue;
      
      const sourceText = sourceNode.textContent;
      const targetText = targetNode ? targetNode.textContent : '';
      
      // Only add segments that have source text
      if (sourceText) {
        segments.push({
          source: sourceText,
          target: targetText,
          sourceLang,
          targetLang
        });
      }
    }
    
    return segments;
  } catch (error) {
    console.error('Error parsing XLIFF file:', error);
    throw new Error(`Failed to parse XLIFF file: ${error.message}`);
  }
}

/**
 * Generate Excel report for an analysis run
 */
exports.generateExcelReport = async (run, workbook) => {
  // Add summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Property', key: 'property', width: 30 },
    { header: 'Value', key: 'value', width: 70 }
  ];
  
  // Add summary data
  summarySheet.addRow({ property: 'Analysis ID', value: run._id.toString() });
  summarySheet.addRow({ property: 'Date', value: new Date(run.timestamp).toLocaleString() });
  summarySheet.addRow({ property: 'Analysis Mode', value: run.analysisMode });
  summarySheet.addRow({ property: 'Source Language', value: run.sourceLang });
  summarySheet.addRow({ property: 'Target Language', value: run.targetLang });
  summarySheet.addRow({ property: 'LLM Model', value: run.llmModel });
  summarySheet.addRow({ property: 'MQM Score', value: run.mqmScore.toFixed(2) });
  summarySheet.addRow({ property: 'Summary', value: run.summary });
  
  // Add source/target text sheet
  const textSheet = workbook.addWorksheet('Text');
  textSheet.columns = [
    { header: 'Source Text', key: 'source', width: 50 },
    { header: 'Target Text', key: 'target', width: 50 }
  ];
  
  // Add text data
  textSheet.addRow({ source: run.sourceText, target: run.targetText });
  
  // Add issues sheet
  const issuesSheet = workbook.addWorksheet('Issues');
  issuesSheet.columns = [
    { header: '#', key: 'index', width: 5 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Subcategory', key: 'subcategory', width: 20 },
    { header: 'Severity', key: 'severity', width: 15 },
    { header: 'Segment', key: 'segment', width: 40 },
    { header: 'Explanation', key: 'explanation', width: 40 },
    { header: 'Suggestion', key: 'suggestion', width: 40 }
  ];
  
  // Add issues data
  if (run.issues && run.issues.length > 0) {
    run.issues.forEach((issue, index) => {
      issuesSheet.addRow({
        index: index + 1,
        category: issue.category,
        subcategory: issue.subcategory,
        severity: issue.severity,
        segment: issue.segment,
        explanation: issue.explanation,
        suggestion: issue.suggestion
      });
    });
  }
  
  return workbook;
};
