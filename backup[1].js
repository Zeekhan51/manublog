const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Generate WordPress-compatible export data
 */
const generateWordPressExport = async () => {
  // Get all posts with related data
  const posts = await prisma.post.findMany({
    include: {
      author: {
        select: {
          username: true,
          email: true,
          firstName: true,
          lastName: true
        }
      },
      category: true,
      tags: {
        include: {
          tag: true
        }
      },
      comments: {
        where: { status: 'APPROVED' },
        include: {
          user: {
            select: {
              username: true,
              email: true
            }
          }
        }
      }
    }
  });

  // Get categories and tags
  const [categories, tags] = await Promise.all([
    prisma.category.findMany(),
    prisma.tag.findMany()
  ]);

  // Convert to WordPress format
  const wpData = {
    version: '1.0',
    generator: 'Custom Blog Platform',
    site: {
      title: process.env.SITE_NAME || 'My Blog',
      link: process.env.SITE_URL || 'http://localhost:3000',
      description: process.env.SITE_DESCRIPTION || 'A custom blog platform',
      language: 'en-US'
    },
    categories: categories.map(cat => ({
      term_id: cat.id,
      category_nicename: cat.slug,
      category_name: cat.name,
      category_description: cat.description || ''
    })),
    tags: tags.map(tag => ({
      term_id: tag.id,
      tag_slug: tag.slug,
      tag_name: tag.name
    })),
    posts: posts.map(post => ({
      post_id: post.id,
      post_title: post.title,
      post_name: post.slug,
      post_content: post.content,
      post_excerpt: post.excerpt || '',
      post_status: post.status.toLowerCase(),
      post_type: 'post',
      post_date: post.publishedAt || post.createdAt,
      post_author: post.author.username,
      post_category: post.category ? [post.category.name] : [],
      post_tags: post.tags.map(pt => pt.tag.name),
      post_meta: {
        _wp_featured_image: post.featuredImage || '',
        _yoast_wpseo_title: post.metaTitle || '',
        _yoast_wpseo_metadesc: post.metaDescription || '',
        _yoast_wpseo_canonical: post.canonicalUrl || '',
        _yoast_wpseo_opengraph_title: post.ogTitle || '',
        _yoast_wpseo_opengraph_description: post.ogDescription || '',
        _yoast_wpseo_opengraph_image: post.ogImage || '',
        _yoast_wpseo_twitter_title: post.twitterTitle || '',
        _yoast_wpseo_twitter_description: post.twitterDescription || '',
        _yoast_wpseo_twitter_image: post.twitterImage || ''
      },
      comments: post.comments.map(comment => ({
        comment_id: comment.id,
        comment_author: comment.authorName || comment.user?.username || 'Anonymous',
        comment_author_email: comment.authorEmail || comment.user?.email || '',
        comment_author_url: comment.authorUrl || '',
        comment_date: comment.createdAt,
        comment_content: comment.content,
        comment_approved: comment.status === 'APPROVED' ? 1 : 0,
        comment_parent: comment.parentId || 0
      }))
    }))
  };

  return wpData;
};

/**
 * Create backup archive
 */
const createBackupArchive = async (backupData, includeMedia = true) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join('backups', timestamp);
  const backupPath = `${backupDir}.zip`;

  // Ensure backup directory exists
  await fs.mkdir('backups', { recursive: true });

  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      resolve({
        filename: path.basename(backupPath),
        path: backupPath,
        size: archive.pointer()
      });
    });

    archive.on('error', reject);
    archive.pipe(output);

    // Add posts data
    archive.append(JSON.stringify(backupData, null, 2), { name: 'posts.json' });

    // Add site settings
    archive.append(JSON.stringify({
      siteName: process.env.SITE_NAME || 'My Blog',
      siteUrl: process.env.SITE_URL || 'http://localhost:3000',
      siteDescription: process.env.SITE_DESCRIPTION || 'A custom blog platform',
      exportDate: new Date().toISOString(),
      version: '1.0'
    }, null, 2), { name: 'settings.json' });

    // Add media files if requested
    if (includeMedia) {
      const uploadsDir = 'uploads';
      if (require('fs').existsSync(uploadsDir)) {
        archive.directory(uploadsDir, 'uploads');
      }
    }

    archive.finalize();
  });
};

/**
 * POST /api/backup/create
 * Create a new backup
 */
router.post('/create', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { type = 'FULL', includeMedia = true } = req.body;

    // Create backup record
    const backup = await prisma.backup.create({
      data: {
        filename: '', // Will be updated after creation
        size: 0,
        type,
        status: 'IN_PROGRESS'
      }
    });

    try {
      // Generate export data
      const exportData = await generateWordPressExport();

      // Create archive
      const archiveInfo = await createBackupArchive(exportData, includeMedia);

      // Update backup record
      const updatedBackup = await prisma.backup.update({
        where: { id: backup.id },
        data: {
          filename: archiveInfo.filename,
          size: archiveInfo.size,
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      res.json({
        message: 'Backup created successfully',
        backup: updatedBackup,
        downloadUrl: `/api/backup/download/${updatedBackup.id}`
      });
    } catch (error) {
      // Update backup record with error
      await prisma.backup.update({
        where: { id: backup.id },
        data: {
          status: 'FAILED',
          error: error.message
        }
      });
      throw error;
    }
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({
      error: 'Failed to create backup',
      code: 'CREATE_BACKUP_ERROR'
    });
  }
});

/**
 * GET /api/backup/list
 * Get list of backups
 */
router.get('/list', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const [backups, total] = await Promise.all([
      prisma.backup.findMany({
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.backup.count()
    ]);

    res.json({
      backups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get backups error:', error);
    res.status(500).json({
      error: 'Failed to get backups',
      code: 'GET_BACKUPS_ERROR'
    });
  }
});

/**
 * GET /api/backup/download/:id
 * Download backup file
 */
router.get('/download/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    const backup = await prisma.backup.findUnique({
      where: { id }
    });

    if (!backup) {
      return res.status(404).json({
        error: 'Backup not found',
        code: 'BACKUP_NOT_FOUND'
      });
    }

    if (backup.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Backup is not ready for download',
        code: 'BACKUP_NOT_READY'
      });
    }

    const filePath = path.join('backups', backup.filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: 'Backup file not found',
        code: 'BACKUP_FILE_NOT_FOUND'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    res.setHeader('Content-Type', 'application/zip');

    // Stream file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download backup error:', error);
    res.status(500).json({
      error: 'Failed to download backup',
      code: 'DOWNLOAD_BACKUP_ERROR'
    });
  }
});

/**
 * DELETE /api/backup/:id
 * Delete backup
 */
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    const backup = await prisma.backup.findUnique({
      where: { id }
    });

    if (!backup) {
      return res.status(404).json({
        error: 'Backup not found',
        code: 'BACKUP_NOT_FOUND'
      });
    }

    // Delete file if it exists
    if (backup.filename) {
      const filePath = path.join('backups', backup.filename);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn('Failed to delete backup file:', error);
      }
    }

    // Delete backup record
    await prisma.backup.delete({
      where: { id }
    });

    res.json({
      message: 'Backup deleted successfully'
    });
  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({
      error: 'Failed to delete backup',
      code: 'DELETE_BACKUP_ERROR'
    });
  }
});

/**
 * POST /api/backup/schedule
 * Configure automatic backup schedule
 */
router.post('/schedule', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { enabled, frequency = 'daily', time = '02:00', includeMedia = true } = req.body;

    // Store schedule in site settings
    await prisma.siteSettings.upsert({
      where: { key: 'backup_schedule' },
      update: {
        value: JSON.stringify({
          enabled,
          frequency,
          time,
          includeMedia,
          updatedAt: new Date().toISOString()
        })
      },
      create: {
        key: 'backup_schedule',
        value: JSON.stringify({
          enabled,
          frequency,
          time,
          includeMedia,
          createdAt: new Date().toISOString()
        }),
        type: 'json',
        description: 'Automatic backup schedule configuration'
      }
    });

    res.json({
      message: 'Backup schedule updated successfully',
      schedule: {
        enabled,
        frequency,
        time,
        includeMedia
      }
    });
  } catch (error) {
    console.error('Update backup schedule error:', error);
    res.status(500).json({
      error: 'Failed to update backup schedule',
      code: 'UPDATE_SCHEDULE_ERROR'
    });
  }
});

/**
 * GET /api/backup/schedule
 * Get current backup schedule
 */
router.get('/schedule', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const setting = await prisma.siteSettings.findUnique({
      where: { key: 'backup_schedule' }
    });

    const defaultSchedule = {
      enabled: false,
      frequency: 'daily',
      time: '02:00',
      includeMedia: true
    };

    const schedule = setting ? JSON.parse(setting.value) : defaultSchedule;

    res.json({ schedule });
  } catch (error) {
    console.error('Get backup schedule error:', error);
    res.status(500).json({
      error: 'Failed to get backup schedule',
      code: 'GET_SCHEDULE_ERROR'
    });
  }
});

module.exports = router;

