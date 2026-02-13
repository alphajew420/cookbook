const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

// Configure S3-compatible client (Cloudflare R2)
const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'auto',
  signatureVersion: 'v4',
  s3ForcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

logger.info('S3/R2 config', {
  endpoint: process.env.S3_ENDPOINT || 'NOT SET',
  bucket: BUCKET_NAME || 'NOT SET',
  hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
});

/**
 * Extract the object key from a stored URL (strips leading bucket name for path-style URLs)
 */
function extractKeyFromUrl(imageUrl) {
  const url = new URL(imageUrl);
  const path = url.pathname.substring(1); // Remove leading slash
  // With path-style URLs the bucket name is the first segment — strip it
  if (path.startsWith(`${BUCKET_NAME}/`)) {
    return path.substring(BUCKET_NAME.length + 1);
  }
  return path;
}

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
    // Note: ACL not supported by Cloudflare R2
  };
  
  try {
    await s3.upload(params).promise();
    // Construct URL ourselves — result.Location from R2 can double the bucket name
    const imageUrl = `${process.env.S3_ENDPOINT}/${BUCKET_NAME}/${fileName}`;
    logger.info('Image uploaded to R2', {
      key: fileName,
      size: buffer.length,
      url: imageUrl,
    });
    return imageUrl;
  } catch (error) {
    logger.error('S3 upload error', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      region: error.region,
      hostname: error.hostname,
      endpoint: process.env.S3_ENDPOINT,
      bucket: BUCKET_NAME,
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
    const key = extractKeyFromUrl(imageUrl);
    
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
 * @param {number} expiresIn - Expiration time in seconds (default: 24 hours)
 * @returns {Promise<string>} Signed URL
 */
async function getSignedUrl(imageUrl, expiresIn = 86400) {
  try {
    if (!imageUrl) {
      return null;
    }

    const key = extractKeyFromUrl(imageUrl);
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn,
    };
    
    const signedUrl = await s3.getSignedUrlPromise('getObject', params);
    logger.info('Generated signed URL', { key, hasSignature: signedUrl.includes('X-Amz-Signature') });
    return signedUrl;
  } catch (error) {
    logger.error('S3 signed URL error', {
      error: error.message,
      code: error.code,
      imageUrl,
      key: extractKeyFromUrl(imageUrl),
    });
    // Return original URL as fallback
    return imageUrl;
  }
}

/**
 * Add signed URLs to recipe object
 * @param {Object} recipe - Recipe object with originalImageUrl
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Promise<Object>} Recipe with signed URL
 */
async function addSignedUrlToRecipe(recipe, expiresIn = 86400) {
  if (!recipe) {
    return recipe;
  }
  
  if (recipe.originalImageUrl || recipe.original_image_url) {
    const imageUrl = recipe.originalImageUrl || recipe.original_image_url;
    const signedUrl = await getSignedUrl(imageUrl, expiresIn);
    
    return {
      ...recipe,
      originalImageUrl: signedUrl,
      imageUrl: signedUrl, // Also add as imageUrl for consistency
    };
  }
  
  return recipe;
}

/**
 * Add signed URLs to multiple recipes
 * @param {Array} recipes - Array of recipe objects
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Promise<Array>} Recipes with signed URLs
 */
async function addSignedUrlsToRecipes(recipes, expiresIn = 86400) {
  if (!recipes || recipes.length === 0) {
    return recipes;
  }
  
  return Promise.all(
    recipes.map(recipe => addSignedUrlToRecipe(recipe, expiresIn))
  );
}

module.exports = {
  s3,
  BUCKET_NAME,
  extractKeyFromUrl,
  uploadImage,
  deleteImage,
  getSignedUrl,
  addSignedUrlToRecipe,
  addSignedUrlsToRecipes,
};
