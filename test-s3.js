require('dotenv').config();
const s3Service = require('./utils/s3Service');

async function testS3Connection() {
  console.log('Testing S3 connection...');
  console.log('AWS Region:', process.env.AWS_REGION);
  console.log('AWS Bucket:', process.env.AWS_S3_BUCKET);
  
  try {
    // Test uploading a small test file
    const testContent = Buffer.from('This is a test file for S3 integration');
    const key = `test/s3-test-${Date.now()}.txt`;
    
    console.log('Uploading test file to S3...');
    const url = await s3Service.uploadBuffer(testContent, key, 'text/plain');
    
    console.log('File uploaded successfully!');
    console.log('URL:', url);
    
    // Test generating a signed URL
    console.log('Generating signed URL...');
    const signedUrl = await s3Service.getSignedUrl(key);
    
    console.log('Signed URL generated successfully!');
    console.log('Signed URL:', signedUrl);
    
    // Test checking if file exists
    console.log('Checking if file exists...');
    const exists = await s3Service.fileExists(key);
    
    console.log('File exists:', exists);
    
    // Test deleting the file
    console.log('Deleting test file...');
    await s3Service.deleteFile(key);
    
    console.log('File deleted successfully!');
    
    // Verify deletion
    const existsAfterDeletion = await s3Service.fileExists(key);
    console.log('File exists after deletion:', existsAfterDeletion);
    
    console.log('S3 integration test completed successfully!');
    return true;
  } catch (error) {
    console.error('S3 integration test failed:', error);
    return false;
  }
}

// Run the test
testS3Connection()
  .then(success => {
    if (success) {
      console.log('✅ S3 integration is working correctly!');
    } else {
      console.log('❌ S3 integration test failed!');
    }
  })
  .catch(error => {
    console.error('Error running S3 test:', error);
  });
