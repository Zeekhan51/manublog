const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Simple spam detection keywords
const SPAM_KEYWORDS = [
  'viagra', 'casino', 'lottery', 'winner', 'congratulations',
  'click here', 'free money', 'make money fast', 'work from home',
  'buy now', 'limited time', 'act now', 'urgent', 'guaranteed'
];

/**
 * Simple spam detection
 */
const detectSpam = (content, authorEmail, authorName) => {
  const text = `${content} ${authorEmail || ''} ${authorName || ''}`.toLowerCase();
  
  // Check for spam keywords
  const spamKeywordCount = SPAM_KEYWORDS.filter(keyword => 
    text.includes(keyword.toLowerCase())
  ).length;

  // Check for excessive links
  const linkCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
  
  // Check for excessive caps
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  
  // Simple scoring system
  let spamScore = 0;
  
  if (spamKeywordCount > 0) spamScore += spamKeywordCount * 30;
  if (linkCount > 2) spamScore += (linkCount - 2) * 20;
  if (capsRatio > 0.3) spamScore += 25;
  if (content.length < 10) spamScore += 15;
  if (content.includes('http') && content.length < 50) spamScore += 30;

  return {
    isSpam: spamScore > 50,
    score: spamScore,
    reasons: [
      ...(spamKeywordCount > 0 ? [`Contains ${spamKeywordCount} spam keywords`] : []),
      ...(linkCount > 2 ? [`Contains ${linkCount} links`] : []),
      ...(capsRatio > 0.3 ? ['Excessive use of capital letters'] : []),
      ...(content.length < 10 ? ['Content too short'] : [])
    ]
  };
};

/**
 * POST /api/comments
 * Create new comment
 */
router.post('/', optionalAuth, [
  body('postId').notEmpty().withMessage('Post ID is required'),
  body('content').isLength({ min: 1, max: 1000 }).withMessage('Content is required and must be under 1000 characters'),
  body('authorName').optional().isLength({ max: 100 }).withMessage('Author name must be under 100 characters'),
  body('authorEmail').optional().isEmail().withMessage('Valid email is required'),
  body('authorUrl').optional().isURL().withMessage('Valid URL is required'),
  body('parentId').optional().isString().withMessage('Parent ID must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { 
      postId, 
      content, 
      authorName, 
      authorEmail, 
      authorUrl, 
      parentId 
    } = req.body;

    // Check if post exists and allows comments
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true, title: true }
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    if (post.status !== 'PUBLISHED') {
      return res.status(400).json({
        error: 'Comments are not allowed on unpublished posts',
        code: 'COMMENTS_NOT_ALLOWED'
      });
    }

    // Check if parent comment exists (for replies)
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true }
      });

      if (!parentComment || parentComment.postId !== postId) {
        return res.status(400).json({
          error: 'Invalid parent comment',
          code: 'INVALID_PARENT_COMMENT'
        });
      }
    }

    // Get user info and IP
    const userId = req.user?.id || null;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // For logged-in users, use their info
    let finalAuthorName = authorName;
    let finalAuthorEmail = authorEmail;

    if (req.user) {
      finalAuthorName = req.user.firstName && req.user.lastName 
        ? `${req.user.firstName} ${req.user.lastName}` 
        : req.user.username;
      finalAuthorEmail = req.user.email;
    }

    // Spam detection
    const spamCheck = detectSpam(content, finalAuthorEmail, finalAuthorName);
    let status = 'PENDING';

    if (spamCheck.isSpam) {
      status = 'SPAM';
    } else if (req.user && req.user.role === 'ADMIN') {
      // Auto-approve admin comments
      status = 'APPROVED';
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        status,
        authorName: finalAuthorName,
        authorEmail: finalAuthorEmail,
        authorUrl,
        ipAddress,
        userAgent,
        postId,
        userId,
        parentId
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        }
      }
    });

    res.status(201).json({
      message: status === 'SPAM' 
        ? 'Comment flagged as spam and will be reviewed' 
        : status === 'APPROVED' 
          ? 'Comment posted successfully' 
          : 'Comment submitted for moderation',
      comment,
      spamCheck: spamCheck.isSpam ? spamCheck : undefined
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      error: 'Failed to create comment',
      code: 'CREATE_COMMENT_ERROR'
    });
  }
});

/**
 * GET /api/comments
 * Get comments with filtering and pagination
 */
router.get('/', authenticateToken, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'ALL',
      postId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    let where = {};

    if (status !== 'ALL') {
      where.status = status;
    }

    if (postId) {
      where.postId = postId;
    }

    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { authorName: { contains: search, mode: 'insensitive' } },
        { authorEmail: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          },
          post: {
            select: {
              id: true,
              title: true,
              slug: true
            }
          },
          parent: {
            select: {
              id: true,
              authorName: true,
              content: true
            }
          },
          _count: {
            select: {
              replies: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.comment.count({ where })
    ]);

    res.json({
      comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      error: 'Failed to get comments',
      code: 'GET_COMMENTS_ERROR'
    });
  }
});

/**
 * GET /api/comments/post/:postId
 * Get approved comments for a specific post
 */
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true }
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    // Get approved comments with replies
    const comments = await prisma.comment.findMany({
      where: {
        postId,
        status: 'APPROVED',
        parentId: null // Only top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        replies: {
          where: { status: 'APPROVED' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.comment.count({
      where: {
        postId,
        status: 'APPROVED',
        parentId: null
      }
    });

    res.json({
      comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get post comments error:', error);
    res.status(500).json({
      error: 'Failed to get post comments',
      code: 'GET_POST_COMMENTS_ERROR'
    });
  }
});

/**
 * PUT /api/comments/:id/status
 * Update comment status (approve, reject, spam)
 */
router.put('/:id/status', authenticateToken, requireRole(['ADMIN', 'EDITOR']), [
  body('status').isIn(['APPROVED', 'PENDING', 'SPAM', 'TRASH']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        post: {
          select: { title: true }
        }
      }
    });

    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found',
        code: 'COMMENT_NOT_FOUND'
      });
    }

    const updatedComment = await prisma.comment.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        }
      }
    });

    res.json({
      message: `Comment ${status.toLowerCase()} successfully`,
      comment: updatedComment
    });
  } catch (error) {
    console.error('Update comment status error:', error);
    res.status(500).json({
      error: 'Failed to update comment status',
      code: 'UPDATE_COMMENT_STATUS_ERROR'
    });
  }
});

/**
 * DELETE /api/comments/:id
 * Delete comment
 */
router.delete('/:id', authenticateToken, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        replies: true
      }
    });

    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found',
        code: 'COMMENT_NOT_FOUND'
      });
    }

    // Delete comment and all replies (cascade)
    await prisma.comment.delete({
      where: { id }
    });

    res.json({
      message: 'Comment deleted successfully',
      deletedReplies: comment.replies.length
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      error: 'Failed to delete comment',
      code: 'DELETE_COMMENT_ERROR'
    });
  }
});

/**
 * GET /api/comments/stats
 * Get comment statistics
 */
router.get('/stats', authenticateToken, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  try {
    const [
      totalComments,
      approvedComments,
      pendingComments,
      spamComments,
      recentComments
    ] = await Promise.all([
      prisma.comment.count(),
      prisma.comment.count({ where: { status: 'APPROVED' } }),
      prisma.comment.count({ where: { status: 'PENDING' } }),
      prisma.comment.count({ where: { status: 'SPAM' } }),
      prisma.comment.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    res.json({
      totalComments,
      approvedComments,
      pendingComments,
      spamComments,
      recentComments,
      moderationQueue: pendingComments + spamComments
    });
  } catch (error) {
    console.error('Get comment stats error:', error);
    res.status(500).json({
      error: 'Failed to get comment statistics',
      code: 'GET_COMMENT_STATS_ERROR'
    });
  }
});

/**
 * POST /api/comments/bulk-action
 * Perform bulk actions on comments
 */
router.post('/bulk-action', authenticateToken, requireRole(['ADMIN', 'EDITOR']), [
  body('action').isIn(['approve', 'reject', 'spam', 'delete']).withMessage('Invalid action'),
  body('commentIds').isArray().withMessage('Comment IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { action, commentIds } = req.body;

    if (commentIds.length === 0) {
      return res.status(400).json({
        error: 'No comments selected',
        code: 'NO_COMMENTS_SELECTED'
      });
    }

    let result;

    switch (action) {
      case 'approve':
        result = await prisma.comment.updateMany({
          where: { id: { in: commentIds } },
          data: { status: 'APPROVED' }
        });
        break;
      case 'reject':
        result = await prisma.comment.updateMany({
          where: { id: { in: commentIds } },
          data: { status: 'PENDING' }
        });
        break;
      case 'spam':
        result = await prisma.comment.updateMany({
          where: { id: { in: commentIds } },
          data: { status: 'SPAM' }
        });
        break;
      case 'delete':
        result = await prisma.comment.deleteMany({
          where: { id: { in: commentIds } }
        });
        break;
    }

    res.json({
      message: `Bulk ${action} completed successfully`,
      affectedCount: result.count
    });
  } catch (error) {
    console.error('Bulk comment action error:', error);
    res.status(500).json({
      error: 'Failed to perform bulk action',
      code: 'BULK_ACTION_ERROR'
    });
  }
});

module.exports = router;

