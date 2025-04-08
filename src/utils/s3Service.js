/**
 * S3 Service
 * Handles file uploads and downloads to/from AWS S3
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Create S3 service object
const s3 = new AWS.S3();

/**
 * Upload a file to S3
 * @param {Buffer|Stream} fileData - File data to upload
 * @param {string} fileName - Original file name
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<string>} - URL of the uploaded file
 */
exports.uploadFile = async (fileData, fileName, contentType) => {
  try {
    const bucketName = process.env.AWS_S3_BUCKET;
    
    if (!bucketName) {
      throw new Error('S3 bucket name not configured');
    }
    
    // Generate a unique file name to prevent collisions
    const uniqueFileName = `${uuidv4()}-${fileName}`;
    
    // Set up the S3 upload parameters
    const params = {
      Bucket: bucketName,
      Key: uniqueFileName,
      Body: fileData,
      ContentType: contentType,
      ACL: 'private' // Make the file private by default
    };
    
    // Upload to S3
    const result = await s3.upload(params).promise();
    
    console.log(`File uploaded successfully to ${result.Location}`);
    
    return result.Location;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

/**
 * Download a file from S3
 * @param {string} fileUrl - URL of the file to download
 * @returns {Promise<Buffer>} - File data
 */
exports.downloadFile = async (fileUrl) => {
  try {
    const bucketName = process.env.AWS_S3_BUCKET;
    
    if (!bucketName) {
      throw new Error('S3 bucket name not configured');
    }
    
    // Extract the key from the URL
    const key = fileUrl.split(`${bucketName}/`)[1];
    
    if (!key) {
      throw new Error('Invalid file URL');
    }
    
    // Set up the S3 download parameters
    const params = {
      Bucket: bucketName,
      Key: key
    };
    
    // Download from S3
    const result = await s3.getObject(params).promise();
    
    return result.Body;
  } catch (error) {
    console.error('S3 download error:', error);
    throw new Error(`Failed to download file from S3: ${error.message}`);
  }
};

/**
 * Generate a pre-signed URL for temporary access to a file
 * @param {string} fileUrl - URL of the file
 * @param {number} expirySeconds - Number of seconds until URL expires
 * @returns {Promise<string>} - Pre-signed URL
 */
exports.getSignedUrl = async (fileUrl, expirySeconds = 3600) => {
  try {
    const bucketName = process.env.AWS_S3_BUCKET;
    
    if (!bucketName) {
      throw new Error('S3 bucket name not configured');
    }
    
    // Extract the key from the URL
    const key = fileUrl.split(`${bucketName}/`)[1];
    
    if (!key) {
      throw new Error('Invalid file URL');
    }
    
    // Set up the S3 signed URL parameters
    const params = {
      Bucket: bucketName,
      Key: key,
      Expires: expirySeconds
    };
    
    // Generate signed URL
    const signedUrl = await s3.getSignedUrlPromise('getObject', params);
    
    return signedUrl;
  } catch (error) {
    console.error('S3 signed URL error:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

/**
 * Delete a file from S3
 * @param {string} fileUrl - URL of the file to delete
 * @returns {Promise<boolean>} - True if deleted successfully
 */
exports.deleteFile = async (fileUrl) => {
  try {
    const bucketName = process.env.AWS_S3_BUCKET;
    
    if (!bucketName) {
      throw new Error('S3 bucket name not configured');
    }
    
    // Extract the key from the URL
    const key = fileUrl.split(`${bucketName}/`)[1];
    
    if (!key) {
      throw new Error('Invalid file URL');
    }
    
    // Set up the S3 delete parameters
    const params = {
      Bucket: bucketName,
      Key: key
    };
    
    // Delete from S3
    await s3.deleteObject(params).promise();
    
    console.log(`File deleted successfully: ${fileUrl}`);
    
    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
};
