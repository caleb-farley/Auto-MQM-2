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
    // Check if the test TMX file exists
    const testFilePath = path.join(__dirname, 'test-data', 'sample.tmx');
    
    if (!fs.existsSync(testFilePath)) {
      console.log('Test TMX file not found. Creating a sample TMX file...');
      
      // Create test directory if it doesn't exist
      const testDir = path.join(__dirname, 'test-data');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
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
      
      fs.writeFileSync(testFilePath, sampleTMX, 'utf8');
      console.log(`Created sample TMX file at ${testFilePath}`);
    }
    
    // Read the TMX file
    const fileBuffer = fs.readFileSync(testFilePath);
    console.log('Successfully read TMX file');
    
    // Parse the TMX file
    const segments = await parseTMX(fileBuffer);
    console.log('Successfully parsed TMX file');
    console.log(`Found ${segments.length} segments:`);
    console.log(JSON.stringify(segments, null, 2));
    
    return segments;
  } catch (error) {
    console.error('Error testing TMX parsing:', error);
    throw error;
  }
}

// Run the test
testTMXParsing()
  .then(() => {
    console.log('TMX parsing test completed successfully');
  })
  .catch(error => {
    console.error('TMX parsing test failed:', error);
  });
