const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Generate unique filename
 */
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '-');
  return `${timestamp}-${random}-${name}${ext}`;
};

/**
 * Ensure upload directory exists
 */
const ensureUploadDir = async (dir) => {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};

/**
 * POST /api/media/upload
 * Upload media files
 */
router.post('/upload', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        error: 'No files were uploaded',
        code: 'NO_FILES'
      });
    }

    const uploadedFiles = [];
    const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({
          error: `File ${file.name} is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          code: 'FILE_TOO_LARGE'
        });
      }

      // Validate file type
      const isValidType = [
        ...ALLOWED_IMAGE_TYPES,
        ...ALLOWED_VIDEO_TYPES,
        ...ALLOWED_DOCUMENT_TYPES
      ].includes(file.mimetype);

      if (!isValidType) {
        return res.status(400).json({
          error: `File type ${file.mimetype} is not allowed`,
          code: 'INVALID_FILE_TYPE'
        });
      }

      // Generate unique filename
      const filename = generateUniqueFilename(file.name);
      
      // Determine upload directory based on file type
      let uploadDir = 'uploads';
      if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        uploadDir = 'uploads/images';
      } else if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
        uploadDir = 'uploads/videos';
      } else {
        uploadDir = 'uploads/documents';
      }

      // Ensure directory exists
      await ensureUploadDir(uploadDir);

      // Save file
      const filePath = path.join(uploadDir, filename);
      await file.mv(filePath);

      // Create media record
      const media = await prisma.media.create({
        data: {
          filename,
          originalName: file.name,
          mimeType: file.mimetype,
          size: file.size,
          url: `/${filePath}`,
          alt: req.body.alt || '',
          caption: req.body.caption || ''
        }
      });

      uploadedFiles.push(media);
    }

    res.status(201).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Failed to upload files',
      code: 'UPLOAD_ERROR'
    });
  }
});

/**
 * GET /api/media
 * Get media library with pagination and filtering
 */
router.get('/', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type = 'all',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    let where = {};

    // Type filter
    if (type !== 'all') {
      if (type === 'images') {
        where.mimeType = { in: ALLOWED_IMAGE_TYPES };
      } else if (type === 'videos') {
        where.mimeType = { in: ALLOWED_VIDEO_TYPES };
      } else if (type === 'documents') {
        where.mimeType = { in: ALLOWED_DOCUMENT_TYPES };
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { alt: { contains: search, mode: 'insensitive' } },
        { caption: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.media.count({ where })
    ]);

    res.json({
      media,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({
      error: 'Failed to get media',
      code: 'GET_MEDIA_ERROR'
    });
  }
});

/**
 * GET /api/media/:id
 * Get single media item
 */
router.get('/:id', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), async (req, res) => {
  try {
    const { id } = req.params;

    const media = await prisma.media.findUnique({
      where: { id }
    });

    if (!media) {
      return res.status(404).json({
        error: 'Media not found',
        code: 'MEDIA_NOT_FOUND'
      });
    }

    res.json({ media });
  } catch (error) {
    console.error('Get media item error:', error);
    res.status(500).json({
      error: 'Failed to get media item',
      code: 'GET_MEDIA_ITEM_ERROR'
    });
  }
});

/**
 * PUT /api/media/:id
 * Update media metadata
 */
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), async (req, res) => {
  try {
    const { id } = req.params;
    const { alt, caption } = req.body;

    const media = await prisma.media.findUnique({
      where: { id }
    });

    if (!media) {
      return res.status(404).json({
        error: 'Media not found',
        code: 'MEDIA_NOT_FOUND'
      });
    }

    const updatedMedia = await prisma.media.update({
      where: { id },
      data: {
        alt: alt !== undefined ? alt : media.alt,
        caption: caption !== undefined ? caption : media.caption
      }
    });

    res.json({
      message: 'Media updated successfully',
      media: updatedMedia
    });
  } catch (error) {
    console.error('Update media error:', error);
    res.status(500).json({
      error: 'Failed to update media',
      code: 'UPDATE_MEDIA_ERROR'
    });
  }
});

/**
 * DELETE /api/media/:id
 * Delete media file
 */
router.delete('/:id', authenticateToken, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  try {
    const { id } = req.params;

    const media = await prisma.media.findUnique({
      where: { id }
    });

    if (!media) {
      return res.status(404).json({
        error: 'Media not found',
        code: 'MEDIA_NOT_FOUND'
      });
    }

    // Delete file from filesystem
    try {
      const filePath = media.url.startsWith('/') ? media.url.substring(1) : media.url;
      await fs.unlink(filePath);
    } catch (fileError) {
      console.warn('Failed to delete file from filesystem:', fileError);
    }

    // Delete media record
    await prisma.media.delete({
      where: { id }
    });

    res.json({
      message: 'Media deleted successfully'
    });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({
      error: 'Failed to delete media',
      code: 'DELETE_MEDIA_ERROR'
    });
  }
});

/**
 * GET /api/media/stats/overview
 * Get media statistics
 */
router.get('/stats/overview', authenticateToken, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  try {
    const [
      totalFiles,
      totalSize,
      imageCount,
      videoCount,
      documentCount
    ] = await Promise.all([
      prisma.media.count(),
      prisma.media.aggregate({ _sum: { size: true } }),
      prisma.media.count({ where: { mimeType: { in: ALLOWED_IMAGE_TYPES } } }),
      prisma.media.count({ where: { mimeType: { in: ALLOWED_VIDEO_TYPES } } }),
      prisma.media.count({ where: { mimeType: { in: ALLOWED_DOCUMENT_TYPES } } })
    ]);

    res.json({
      totalFiles,
      totalSize: totalSize._sum.size || 0,
      imageCount,
      videoCount,
      documentCount
    });
  } catch (error) {
    console.error('Get media stats error:', error);
    res.status(500).json({
      error: 'Failed to get media statistics',
      code: 'GET_MEDIA_STATS_ERROR'
    });
  }
});

module.exports = router;

