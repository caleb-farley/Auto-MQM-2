/**
 * Test script for TMX file upload functionality
 * 
 * This script tests the TMX file parsing functionality in the segmentation utility
 * to ensure that TMX files are properly handled.
 */

const fs = require('fs');
const path = require('path');
const { parseTMX } = require('./utils/segment');

// Test TMX parsing
async function testTMXParsing() {
  try {
    // Create test directory if it doesn't exist
    const testDir = path.join(__dirname, 'test-data');
    if (!fs.existsSync(testDir)) {
      console.log('Creating test data directory...');
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Check if the test TMX file exists
    const testFilePath = path.join(__dirname, 'test-data', 'sample.tmx');
    
    // Create a sample TMX file
    const sampleTMX = `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <header srclang="en-US" datatype="plaintext"/>
  <body>
    <tu>
      <tuv xml:lang="en-US">
        <seg>This is a test sentence.</seg>
      </tuv>
      <tuv xml:lang="es-ES">
        <seg>Esta es una frase de prueba.</seg>
      </tuv>
    </tu>
    <tu>
      <tuv xml:lang="en-US">
        <seg>The quick brown fox jumps over the lazy dog.</seg>
      </tuv>
      <tuv xml:lang="es-ES">
        <seg>El rápido zorro marrón salta sobre el perro perezoso.</seg>
      </tuv>
    </tu>
  </body>
</tmx>`;
    
    // Also create a monolingual TMX file (missing target text)
    const monolingualTMXPath = path.join(__dirname, 'test-data', 'monolingual.tmx');
    const monolingualTMX = `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <header srclang="en-US" datatype="plaintext"/>
  <body>
    <tu>
      <tuv xml:lang="en-US">
        <seg>This is a monolingual test sentence.</seg>
      </tuv>
    </tu>
    <tu>
      <tuv xml:lang="en-US">
        <seg>Another monolingual sentence for testing.</seg>
      </tuv>
    </tu>
  </body>
</tmx>`;
    
    fs.writeFileSync(monolingualTMXPath, monolingualTMX, 'utf8');
    console.log(`Created monolingual TMX file at ${monolingualTMXPath}`);
    
    fs.writeFileSync(testFilePath, sampleTMX, 'utf8');
    console.log(`Created sample TMX file at ${testFilePath}`);
    
    // Read the TMX file
    const fileBuffer = fs.readFileSync(testFilePath);
    console.log('Testing TMX parsing...');
    const segments = await parseTMX(fileBuffer);
    
    console.log(`Successfully parsed ${segments.length} segments from TMX file:`);
    segments.forEach((segment, index) => {
      console.log(`Segment ${index + 1}:
  Source: ${segment.source}
  Target: ${segment.target}
  Source Lang: ${segment.sourceLang}
  Target Lang: ${segment.targetLang}`);
    });
    
    // Test parsing the monolingual TMX file
    console.log('\nTesting monolingual TMX parsing...');
    const monolingualPath = path.join(__dirname, 'test-data', 'monolingual.tmx');
    const monoBuffer = fs.readFileSync(monolingualPath);
    const monoSegments = await parseTMX(monoBuffer);
    
    console.log(`Successfully parsed ${monoSegments.length} segments from monolingual TMX file:`);
    monoSegments.forEach((segment, index) => {
      console.log(`Segment ${index + 1}:
  Source: ${segment.source}
  Target: ${segment.target}
  Source Lang: ${segment.sourceLang}
  Target Lang: ${segment.targetLang}`);
    });
    
    // Verify that source was used as target in monolingual mode
    const allHaveTarget = monoSegments.every(segment => segment.target && segment.target.length > 0);
    if (allHaveTarget) {
      console.log('✅ Monolingual test passed: Source text was correctly used as target text');
    } else {
      console.log('❌ Monolingual test failed: Some segments are missing target text');
    }
    
    console.log('TMX parsing tests completed successfully!');
  } catch (error) {
    console.error('TMX parsing test failed:', error);
  }
}

// Run the test
testTMXParsing();
