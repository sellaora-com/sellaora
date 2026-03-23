const express = require('express');
const { upload, deleteImages, extractPublicId, verifyCloudinaryConfig } = require('../utils/cloudinary');
const authMiddleware = require('../middleware/authMiddleware');
const Product = require('../models/Product');
const Store = require('../models/Store');

const router = express.Router();

const extractOwnedPublicIds = (images = []) =>
  (Array.isArray(images) ? images : [])
    .flatMap((image) => {
      if (typeof image === 'string') {
        const extracted = extractPublicId(image);
        return extracted ? [extracted] : [];
      }

      if (image && typeof image === 'object') {
        const ids = [];
        if (typeof image.publicId === 'string' && image.publicId.trim()) {
          ids.push(image.publicId.trim());
        }
        if (typeof image.url === 'string') {
          const extracted = extractPublicId(image.url);
          if (extracted) ids.push(extracted);
        }
        return ids;
      }

      return [];
    })
    .filter(Boolean);

const checkCloudinaryConfig = (req, res, next) => {
  if (!verifyCloudinaryConfig()) {
    return res.status(500).json({
      success: false,
      message: 'Image upload service is not configured. Please contact support.'
    });
  }
  next();
};

router.post('/images', authMiddleware, checkCloudinaryConfig, (req, res) => {
  // Use multer middleware for handling multiple file uploads
  upload.array('images', 10)(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 10MB per file.'
        });
      }
      
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum is 10 files per upload.'
        });
      }
      
      if (err.message.includes('Invalid file type')) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error uploading images',
        error: err.message
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided'
      });
    }

    try {
      const uploadedImages = req.files.map(file => ({
        url: file.path, 
        publicId: file.filename,
        originalName: file.originalname,
        size: file.size,
        width: file.width,
        height: file.height,
        format: file.format
      }));

      res.status(200).json({
        success: true,
        message: `Successfully uploaded ${uploadedImages.length} image(s)`,
        data: {
          images: uploadedImages,
          count: uploadedImages.length
        }
      });
    } catch (error) {
      console.error('Error processing upload response:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing uploaded images'
      });
    }
  });
});

router.post('/single-image', authMiddleware, checkCloudinaryConfig, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Single upload error:', err);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 10MB.'
        });
      }
      
      if (err.message.includes('Invalid file type')) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error uploading image',
        error: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image provided'
      });
    }

    try {
      const uploadedImage = {
        url: req.file.path,
        publicId: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        width: req.file.width,
        height: req.file.height,
        format: req.file.format
      };

      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          image: uploadedImage
        }
      });
    } catch (error) {
      console.error('Error processing single upload response:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing uploaded image'
      });
    }
  });
});

router.delete('/images', authMiddleware, checkCloudinaryConfig, async (req, res) => {
  try {
    const { imageUrls, publicIds } = req.body;
    
    let idsToDelete = [];
    
    if (Array.isArray(imageUrls)) {
      const extractedIds = imageUrls.map(url => extractPublicId(url)).filter(Boolean);
      idsToDelete.push(...extractedIds);
    }
    
    if (Array.isArray(publicIds)) {
      idsToDelete.push(...publicIds);
    }
    
    idsToDelete = [...new Set(idsToDelete)];
    
    if (idsToDelete.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid image identifiers provided. Please provide imageUrls or publicIds.'
      });
    }

    const ownedStores = await Store.find({ ownerId: req.user._id }, '_id').lean();
    const ownedStoreIds = ownedStores.map((store) => store._id);
    if (ownedStoreIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not own any stores associated with these assets.'
      });
    }

    const ownedProducts = await Product.find(
      { storeId: { $in: ownedStoreIds } },
      'images'
    ).lean();

    const allowedPublicIds = new Set(
      ownedProducts.flatMap((product) => extractOwnedPublicIds(product.images))
    );

    const unauthorizedIds = idsToDelete.filter((id) => !allowedPublicIds.has(id));
    if (unauthorizedIds.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'One or more images do not belong to stores you own.'
      });
    }

    const result = await deleteImages(idsToDelete);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          deletedCount: idsToDelete.length,
          publicIds: idsToDelete
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error deleting images:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting images',
      error: error.message
    });
  }
});

router.get('/health', (req, res) => {
  const isConfigured = verifyCloudinaryConfig();
  
  res.status(200).json({
    success: true,
    message: 'Image upload service status',
    data: {
      configured: isConfigured,
      status: isConfigured ? 'ready' : 'not configured',
      maxFileSize: '10MB',
      maxFiles: 10,
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
    }
  });
});

module.exports = router;
