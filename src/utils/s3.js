const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
 * Upload image to S3
 * @param {Buffer} buffer - Image buffer
 * @param {string} folder - Folder name (cookbook or fridge)
 * @param {string} mimeType - Image MIME type
 * @returns {Promise<string>} Image URL
 */
async function uploadImage(buffer, folder, mimeType) {
  const fileExtension = mimeType.split('/')[1];
  const fileName = `${folder}/${uuidv4()}.${fileExtension}`;
  
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: mimeType,
    ACL: 'private', // Changed to private for security
  };
  
  try {
    const result = await s3.upload(params).promise();
    logger.info('Image uploaded to S3', {
      key: fileName,
      size: buffer.length,
    });
    return result.Location;
  } catch (error) {
    logger.error('S3 upload error', {
      error: error.message,
      folder,
    });
    throw new Error('Failed to upload image to storage');
  }
}

/**
 * Delete image from S3
 * @param {string} imageUrl - Image URL
 * @returns {Promise<boolean>} Success status
 */
async function deleteImage(imageUrl) {
  try {
    // Extract key from URL
    const url = new URL(imageUrl);
    const key = url.pathname.substring(1); // Remove leading slash
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };
    
    await s3.deleteObject(params).promise();
    logger.info('Image deleted from S3', { key });
    return true;
  } catch (error) {
    logger.error('S3 delete error', {
      error: error.message,
      imageUrl,
    });
    return false;
  }
}

/**
 * Get signed URL for private image
 * @param {string} imageUrl - Image URL
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Promise<string>} Signed URL
 */
async function getSignedUrl(imageUrl, expiresIn = 3600) {
  try {
    const url = new URL(imageUrl);
    const key = url.pathname.substring(1);
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn,
    };
    
    const signedUrl = await s3.getSignedUrlPromise('getObject', params);
    return signedUrl;
  } catch (error) {
    logger.error('S3 signed URL error', {
      error: error.message,
      imageUrl,
    });
    throw new Error('Failed to generate signed URL');
  }
}

module.exports = {
  uploadImage,
  deleteImage,
  getSignedUrl,
};
