const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const bucketName = process.env.AWS_S3_BUCKET;

/**
 * Upload a file to S3
 * @param {string} filePath - Local path to the file
 * @param {string} key - S3 object key (path in the bucket)
 * @returns {Promise<string>} - URL of the uploaded file
 */
async function uploadFile(filePath, key) {
  try {
    const fileContent = fs.readFileSync(filePath);
    
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
    const data = await s3.upload(params).promise();
    return data.Location;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
}

/**
 * Upload a buffer to S3
 * @param {Buffer} buffer - File buffer
 * @param {string} key - S3 object key (path in the bucket)
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<string>} - URL of the uploaded file
 */
async function uploadBuffer(buffer, key, contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType
    };
    
    const data = await s3.upload(params).promise();
    return data.Location;
  } catch (error) {
    console.error('Error uploading buffer to S3:', error);
    throw error;
  }
}

/**
 * Generate a signed URL for accessing a file in S3
 * @param {string} key - S3 object key (path in the bucket)
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} - Signed URL
 */
async function getSignedUrl(key, expiresIn = 3600) {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
      Expires: expiresIn
    };
    
    return s3.getSignedUrlPromise('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw error;
  }
}

/**
 * Delete a file from S3
 * @param {string} key - S3 object key (path in the bucket)
 * @returns {Promise<void>}
 */
async function deleteFile(key) {
  try {
    const params = {
      Bucket: bucketName,
      Key: key
    };
    
    await s3.deleteObject(params).promise();
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
}

/**
 * Check if a file exists in S3
 * @param {string} key - S3 object key (path in the bucket)
 * @returns {Promise<boolean>} - Whether the file exists
 */
async function fileExists(key) {
  try {
    const params = {
      Bucket: bucketName,
      Key: key
    };
    
    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
}

module.exports = {
  uploadFile,
  uploadBuffer,
  getSignedUrl,
  deleteFile,
  fileExists
};
