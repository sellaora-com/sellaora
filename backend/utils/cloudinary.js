const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const verifyCloudinaryConfig = () => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  
  if (!cloud_name || !api_key || !api_secret) {
    console.warn('⚠️  Cloudinary configuration missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
    return false;
  }
  
  return true;
};

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'sellaora/products', 
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit', quality: 'auto' }, 
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 15);
      const filename = file.originalname.replace(/\.[^/.]+$/, "");
      const sanitized = filename.replace(/[^a-zA-Z0-9]/g, '_');
      return `${sanitized}_${timestamp}_${random}`;
    },
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, 
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'image/gif'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${allowedMimes.join(', ')} are allowed.`), false);
    }
  },
});

const deleteImages = async (publicIds) => {
  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    return { success: true, message: 'No images to delete' };
  }

  try {
    const validIds = publicIds.filter(id => id && typeof id === 'string');
    
    if (validIds.length === 0) {
      return { success: true, message: 'No valid image IDs provided' };
    }

    let results;
    if (validIds.length === 1) {
      results = await cloudinary.uploader.destroy(validIds[0]);
    } else {
      results = await cloudinary.api.delete_resources(validIds);
    }

    return {
      success: true,
      message: `Successfully deleted ${validIds.length} image(s)`,
      results: results
    };
  } catch (error) {
    console.error('Error deleting images from Cloudinary:', error);
    return {
      success: false,
      message: 'Failed to delete images from Cloudinary',
      error: error.message
    };
  }
};

const extractPublicId = (cloudinaryUrl) => {
  if (!cloudinaryUrl || typeof cloudinaryUrl !== 'string') return null;
  
  try {
    const url = new URL(cloudinaryUrl);
    const uploadMarker = '/upload/';
    const uploadIndex = url.pathname.indexOf(uploadMarker);
    if (uploadIndex === -1) return null;

    let assetPath = url.pathname.slice(uploadIndex + uploadMarker.length);
    assetPath = assetPath.replace(/^.*\/v\d+\//, '');

    if (!assetPath) return null;

    const withoutExtension = assetPath.replace(/\.[^/.?#]+$/, '');
    return withoutExtension || null;
  } catch (error) {
    console.error('Error extracting public_id from URL:', error);
    return null;
  }
};

const getOptimizedImageUrl = (publicId, options = {}) => {
  const {
    width = 800,
    height = 600,
    crop = 'fill',
    quality = 'auto',
    format = 'auto'
  } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    quality,
    format,
    secure: true
  });
};

module.exports = {
  cloudinary,
  upload,
  storage,
  deleteImages,
  extractPublicId,
  getOptimizedImageUrl,
  verifyCloudinaryConfig
};
