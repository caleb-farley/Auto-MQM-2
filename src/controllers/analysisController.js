/**
 * Analysis Controller
 * Handles business logic for MQM analysis
 */

const axios = require('axios');
const Run = require('../models/Run');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Readable } = require('stream');
const s3Service = require('../utils/s3Service');
const { getSegments, generateExcelReport } = require('../utils/segment');
const { normalizeLanguageCode, isValidLanguageCode } = require('../utils/languageUtils');

/**
 * Run MQM analysis on text or uploaded file
 */
exports.runMqmAnalysis = async (req, res) => {
  try {
    const { sourceText, targetText, sourceLang, targetLang, mode, llmModel } = req.body;
    const fileBuffer = req.file ? req.file.buffer : null;
    let fileType = req.file ? req.file.originalname.split('.').pop().toLowerCase() : null;
    
    // Normalize file type for MongoDB
    if (fileType === 'xlf') {
      fileType = 'xliff';
    }
    
    console.log('Processing file:', {
      hasFile: !!req.file,
      fileType,
      bufferSize: fileBuffer ? fileBuffer.length : 0
    });
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    
    // Define these variables so they're accessible throughout the function
    let isMonolingual = mode === 'monolingual';
    let processedSourceText = sourceText;
    let processedTargetText = targetText;
    let processedSourceLang = sourceLang;
    let processedTargetLang = targetLang;
    let originalFileName = null;
    
    // Validate file upload parameters
    if (fileBuffer) {
      console.log(`Received file upload request: type=${fileType}, size=${typeof fileBuffer === 'string' ? fileBuffer.length : 'unknown'}`);
      
      if (!fileType || (fileType !== 'tmx' && fileType !== 'xliff' && fileType !== 'xlf')) {
        return res.status(400).json({ error: 'Invalid file type. Only TMX and XLIFF files are supported.' });
      }
    }
    
    // Use the segmentation utility to get segments
    try {
      const segments = await getSegments({
        sourceText,
        targetText,
        sourceLang,
        targetLang,
        fileBuffer,
        fileType
      });
      
      // Extract source and target text from segments if file was uploaded
      if (fileBuffer && segments && segments.length > 0) {
        console.log(`Successfully parsed file with ${segments.length} segments`);
        
        // Combine all segments into a single text
        processedSourceText = segments.map(segment => segment.source || '').join('\n');
        processedTargetText = segments.map(segment => segment.target || '').join('\n');
        
        // If we have no target text but have source text, use source as target for monolingual analysis
        if ((!processedTargetText || processedTargetText.trim() === '') && processedSourceText && processedSourceText.trim() !== '') {
          console.log('No target text found, but source text exists. Using source text as target for analysis.');
          processedTargetText = processedSourceText;
          isMonolingual = true; // Force monolingual mode
        }
        
        // Use language codes from segments if available
        if (segments[0].sourceLang) {
          processedSourceLang = segments[0].sourceLang;
        }
        
        if (segments[0].targetLang) {
          processedTargetLang = segments[0].targetLang;
        }
      }
    } catch (segmentError) {
      console.error('Error processing file:', segmentError);
      return res.status(400).json({ error: `Failed to process file: ${segmentError.message}` });
    }
    
    // Default to Claude-3-Sonnet if no model is specified
    const modelToUse = llmModel || "claude-3-sonnet-20240229";
    
    // Normalize language codes
    processedSourceLang = normalizeLanguageCode(processedSourceLang);
    processedTargetLang = normalizeLanguageCode(processedTargetLang);
    
    // Validate parameters based on mode
    if (isMonolingual) {
      if (!processedTargetText || !processedTargetLang) {
        return res.status(400).json({ error: 'Missing required parameters for monolingual mode' });
      }
    } else {
      if (!processedSourceText || !processedTargetText) {
        return res.status(400).json({ error: 'Missing source or target text for bilingual mode' });
      }
    }
    
    // Check word count limit
    const WORD_COUNT_LIMIT = 500;
    
    if (isMonolingual) {
      // For monolingual mode, check target text word count
      const targetWords = processedTargetText.trim().split(/\s+/);
      const targetWordCount = targetWords.length > 0 && targetWords[0] !== '' ? targetWords.length : 0;
      
      if (targetWordCount > WORD_COUNT_LIMIT) {
        return res.status(400).json({ error: `Target text exceeds the ${WORD_COUNT_LIMIT} word limit` });
      }
    } else {
      // For bilingual mode, check source text word count
      const sourceWords = processedSourceText.trim().split(/\s+/);
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
      prompt = `You are a localization QA expert using the MQM framework to evaluate content quality. This is a MONOLINGUAL assessment.\n\nLanguage: ${processedTargetLang}\n\nText to analyze:\n"""\n${processedTargetText}\n"""\n\nPerform a detailed MQM analysis and return valid JSON with mqmIssues, categories, wordCount, overallScore, and summary.`;
    } else {
      // Bilingual mode prompt - traditional translation quality assessment
      prompt = `You are a localization QA expert using the MQM framework to evaluate translations. This is a BILINGUAL assessment.\n\nSource language: ${processedSourceLang}\nTarget language: ${processedTargetLang}\n\nSource text:\n"""\n${processedSourceText}\n"""\n\nTarget text:\n"""\n${processedTargetText}\n"""\n\nPerform a detailed MQM analysis and return valid JSON with mqmIssues, categories, wordCount, overallScore, and summary.`;
    }
    
    try {
      // Make API request to Claude
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: modelToUse,
          max_tokens: 4000,
          temperature: 0,
          system: "You are a localization QA expert using the MQM framework. Return only valid JSON.",
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
      
      // Parse the response
      const content = response.data.content[0].text;
      let jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from Claude response');
      }
      
      const jsonContent = jsonMatch[0];
      const result = JSON.parse(jsonContent);
      
      // Create a new run record in the database
      const run = await Run.create({
        user: req.user ? req.user._id : null,
        ip,
        issues: result.mqmIssues,
        mqmScore: result.overallScore,
        summary: result.summary,
        sourceText: processedSourceText,
        targetText: processedTargetText,
        sourceLang: processedSourceLang,
        targetLang: processedTargetLang,
        llmModel: modelToUse,
        analysisMode: isMonolingual ? 'monolingual' : 'bilingual',
        fileType: fileType || null
      });
      
      // Return the results
      return res.json({
        runId: run._id,
        mqmIssues: result.mqmIssues,
        categories: result.categories,
        wordCount: result.wordCount,
        overallScore: result.overallScore,
        summary: result.summary,
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
    return res.status(500).json({ 
      error: 'Failed to process text analysis',
      message: error.message
    });
  }
};

/**
 * Check source/target alignment
 */
exports.checkAlignment = async (req, res) => {
  try {
    const { sourceText, targetText, sourceLang, targetLang } = req.body;
    
    // Validate inputs
    if (!sourceText || !targetText || !sourceLang || !targetLang) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // API key from environment variable
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    
    if (!claudeApiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    // Construct prompt for Claude
    const prompt = `Check if the source and target texts are properly aligned. Source language: ${sourceLang}, Target language: ${targetLang}\n\nSource text:\n"""\n${sourceText}\n"""\n\nTarget text:\n"""\n${targetText}\n"""\n\nAre these texts properly aligned? Return only valid JSON with aligned (boolean) and explanation fields.`;
    
    // Make API request to Claude
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        temperature: 0,
        system: "You are a localization expert. Return only valid JSON.",
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
    
    // Parse the response
    const content = response.data.content[0].text;
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }
    
    const jsonContent = jsonMatch[0];
    const result = JSON.parse(jsonContent);
    
    return res.json(result);
  } catch (error) {
    console.error('Alignment check error:', error);
    return res.status(500).json({ error: 'Failed to check alignment' });
  }
};

/**
 * Download Excel report
 */
exports.downloadExcelReport = async (req, res) => {
  try {
    const run = await Run.findById(req.params.id);
    
    if (!run) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    
    // Generate Excel report
    const workbook = new ExcelJS.Workbook();
    await generateExcelReport(run, workbook);
    
    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=mqm-analysis-${req.params.id}.xlsx`);
    
    // Send buffer
    res.send(buffer);
  } catch (error) {
    console.error('Excel report generation error:', error);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
};

/**
 * Download PDF report
 */
exports.downloadPdfReport = async (req, res) => {
  try {
    const run = await Run.findById(req.params.id);
    
    if (!run) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    
    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=mqm-analysis-${req.params.id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(25).text('MQM Analysis Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Analysis ID: ${run._id}`);
    doc.fontSize(14).text(`Date: ${new Date(run.timestamp).toLocaleString()}`);
    doc.fontSize(14).text(`Overall Score: ${run.mqmScore.toFixed(2)}`);
    doc.moveDown();
    
    // Add summary
    doc.fontSize(16).text('Summary', { underline: true });
    doc.fontSize(12).text(run.summary);
    doc.moveDown();
    
    // Add issues
    if (run.issues && run.issues.length > 0) {
      doc.fontSize(16).text('Issues', { underline: true });
      doc.moveDown();
      
      run.issues.forEach((issue, index) => {
        doc.fontSize(14).text(`Issue ${index + 1}: ${issue.category} - ${issue.subcategory}`);
        doc.fontSize(12).text(`Severity: ${issue.severity}`);
        doc.fontSize(12).text(`Explanation: ${issue.explanation}`);
        doc.fontSize(12).text(`Segment: ${issue.segment}`);
        doc.fontSize(12).text(`Suggestion: ${issue.suggestion}`);
        doc.moveDown();
      });
    }
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('PDF report generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
};

/**
 * Download template
 */
exports.downloadTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // Add an instructions sheet
    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.columns = [
      { header: 'Instructions', key: 'instructions', width: 100 }
    ];
    
    instructionsSheet.addRow({
      instructions: 'This template is for uploading content to the Auto-MQM tool for quality analysis.'
    });
    instructionsSheet.addRow({
      instructions: 'Please follow these guidelines:'
    });
    instructionsSheet.addRow({
      instructions: '1. Enter your source text in the Source column and target text in the Target column.'
    });
    instructionsSheet.addRow({
      instructions: '2. Specify the source and target languages using ISO language codes (e.g., en, fr, de, es).'
    });
    instructionsSheet.addRow({
      instructions: '3. Each row represents a separate segment for analysis.'
    });
    instructionsSheet.addRow({
      instructions: '4. For monolingual analysis, you can leave the Source column empty and only fill the Target column.'
    });
    
    // Add a segments sheet
    const segmentsSheet = workbook.addWorksheet('Segments');
    segmentsSheet.columns = [
      { header: 'Source', key: 'source', width: 50 },
      { header: 'Target', key: 'target', width: 50 },
      { header: 'Source Language', key: 'sourceLang', width: 20 },
      { header: 'Target Language', key: 'targetLang', width: 20 }
    ];
    
    // Add example rows
    segmentsSheet.addRow({
      source: 'This is an example source text.',
      target: 'Ceci est un exemple de texte cible.',
      sourceLang: 'en',
      targetLang: 'fr'
    });
    
    segmentsSheet.addRow({
      source: 'Please replace with your own content.',
      target: 'Veuillez remplacer par votre propre contenu.',
      sourceLang: 'en',
      targetLang: 'fr'
    });
    
    // Add a settings sheet
    const settingsSheet = workbook.addWorksheet('Settings');
    settingsSheet.columns = [
      { header: 'Setting', key: 'setting', width: 30 },
      { header: 'Value', key: 'value', width: 30 }
    ];
    
    // Add settings
    settingsSheet.addRow({
      setting: 'Analysis Mode',
      value: 'bilingual'
    });
    
    settingsSheet.addRow({
      setting: 'LLM Model',
      value: 'claude-3-sonnet-20240229'
    });
    
    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=auto-mqm-template.xlsx');
    
    // Send buffer
    res.send(buffer);
  } catch (error) {
    console.error('Excel template generation error:', error);
    res.status(500).json({ error: 'Failed to generate Excel template' });
  }
};
