const multer = require('multer');
const path = require('path');
const { AppError } = require('./errorHandler');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/jpg').split(',');
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only JPEG and PNG images are allowed.', 422, 'INVALID_IMAGE'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_IMAGE_SIZE) || 10485760, // 10MB default
  },
});

/**
 * Handle multer errors
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Image file is too large. Maximum size is 10MB.',
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: err.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  next(err);
};

module.exports = {
  upload,
  handleUploadError,
};
