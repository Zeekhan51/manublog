const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const slugify = require('slugify');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const postValidation = [
  body('title').isLength({ min: 1, max: 200 }).withMessage('Title is required and must be under 200 characters'),
  body('content').isLength({ min: 1 }).withMessage('Content is required'),
  body('excerpt').optional().isLength({ max: 500 }).withMessage('Excerpt must be under 500 characters'),
  body('status').optional().isIn(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'PRIVATE']).withMessage('Invalid status'),
  body('categoryId').optional().isString().withMessage('Category ID must be a string'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('metaTitle').optional().isLength({ max: 60 }).withMessage('Meta title must be under 60 characters'),
  body('metaDescription').optional().isLength({ max: 160 }).withMessage('Meta description must be under 160 characters')
];

/**
 * Generate unique slug for post
 */
const generateUniqueSlug = async (title, postId = null) => {
  let baseSlug = slugify(title, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingPost = await prisma.post.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!existingPost || (postId && existingPost.id === postId)) {
      break;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

/**
 * GET /api/posts
 * Get all posts with filtering and pagination
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = 'PUBLISHED',
      category,
      tag,
      search,
      author,
      sortBy = 'publishedAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const isAdmin = req.user && req.user.role === 'ADMIN';

    // Build where clause
    let where = {};

    // Status filter - non-admins can only see published posts
    if (!isAdmin) {
      where.status = 'PUBLISHED';
      where.publishedAt = { lte: new Date() };
    } else if (status !== 'ALL') {
      where.status = status;
    }

    // Category filter
    if (category) {
      where.category = { slug: category };
    }

    // Tag filter
    if (tag) {
      where.tags = {
        some: {
          tag: { slug: tag }
        }
      };
    }

    // Author filter
    if (author) {
      where.author = { username: author };
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get posts with relations
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true
            }
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true
                }
              }
            }
          },
          _count: {
            select: {
              comments: {
                where: { status: 'APPROVED' }
              }
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.post.count({ where })
    ]);

    // Transform posts to include tag array
    const transformedPosts = posts.map(post => ({
      ...post,
      tags: post.tags.map(pt => pt.tag),
      commentCount: post._count.comments
    }));

    res.json({
      posts: transformedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      error: 'Failed to get posts',
      code: 'GET_POSTS_ERROR'
    });
  }
});

/**
 * GET /api/posts/:slug
 * Get single post by slug
 */
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const isAdmin = req.user && req.user.role === 'ADMIN';

    const post = await prisma.post.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true
              }
            }
          }
        },
        comments: {
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
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    // Check if user can view this post
    if (!isAdmin && (post.status !== 'PUBLISHED' || post.publishedAt > new Date())) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    // Increment view count
    await prisma.post.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } }
    });

    // Transform post
    const transformedPost = {
      ...post,
      tags: post.tags.map(pt => pt.tag)
    };

    res.json({ post: transformedPost });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      error: 'Failed to get post',
      code: 'GET_POST_ERROR'
    });
  }
});

/**
 * POST /api/posts
 * Create new post
 */
router.post('/', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), postValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      title,
      content,
      excerpt,
      featuredImage,
      status = 'DRAFT',
      categoryId,
      tags = [],
      scheduledAt,
      metaTitle,
      metaDescription,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogImage,
      twitterTitle,
      twitterDescription,
      twitterImage
    } = req.body;

    // Generate unique slug
    const slug = await generateUniqueSlug(title);

    // Set published date if status is PUBLISHED
    let publishedAt = null;
    if (status === 'PUBLISHED') {
      publishedAt = new Date();
    } else if (status === 'SCHEDULED' && scheduledAt) {
      publishedAt = new Date(scheduledAt);
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        featuredImage,
        status,
        publishedAt,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        authorId: req.user.id,
        categoryId,
        metaTitle,
        metaDescription,
        canonicalUrl,
        ogTitle,
        ogDescription,
        ogImage,
        twitterTitle,
        twitterDescription,
        twitterImage
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        category: true
      }
    });

    // Handle tags
    if (tags.length > 0) {
      const tagConnections = [];
      
      for (const tagName of tags) {
        // Find or create tag
        const tagSlug = slugify(tagName, { lower: true, strict: true });
        let tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
        
        if (!tag) {
          tag = await prisma.tag.create({
            data: {
              name: tagName,
              slug: tagSlug
            }
          });
        }
        
        tagConnections.push({
          postId: post.id,
          tagId: tag.id
        });
      }

      await prisma.postTag.createMany({
        data: tagConnections
      });
    }

    // Get post with tags
    const postWithTags = await prisma.post.findUnique({
      where: { id: post.id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        category: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        ...postWithTags,
        tags: postWithTags.tags.map(pt => pt.tag)
      }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      error: 'Failed to create post',
      code: 'CREATE_POST_ERROR'
    });
  }
});

/**
 * PUT /api/posts/:id
 * Update post
 */
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), postValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const {
      title,
      content,
      excerpt,
      featuredImage,
      status,
      categoryId,
      tags = [],
      scheduledAt,
      metaTitle,
      metaDescription,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogImage,
      twitterTitle,
      twitterDescription,
      twitterImage
    } = req.body;

    // Check if post exists and user has permission
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: { author: true }
    });

    if (!existingPost) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    // Check permissions
    if (req.user.role !== 'ADMIN' && existingPost.authorId !== req.user.id) {
      return res.status(403).json({
        error: 'You can only edit your own posts',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Generate new slug if title changed
    let slug = existingPost.slug;
    if (title !== existingPost.title) {
      slug = await generateUniqueSlug(title, id);
    }

    // Handle published date
    let publishedAt = existingPost.publishedAt;
    if (status === 'PUBLISHED' && existingPost.status !== 'PUBLISHED') {
      publishedAt = new Date();
    } else if (status === 'SCHEDULED' && scheduledAt) {
      publishedAt = new Date(scheduledAt);
    } else if (status !== 'PUBLISHED' && status !== 'SCHEDULED') {
      publishedAt = null;
    }

    // Update post
    const post = await prisma.post.update({
      where: { id },
      data: {
        title,
        slug,
        content,
        excerpt,
        featuredImage,
        status,
        publishedAt,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        categoryId,
        metaTitle,
        metaDescription,
        canonicalUrl,
        ogTitle,
        ogDescription,
        ogImage,
        twitterTitle,
        twitterDescription,
        twitterImage
      }
    });

    // Update tags
    await prisma.postTag.deleteMany({ where: { postId: id } });
    
    if (tags.length > 0) {
      const tagConnections = [];
      
      for (const tagName of tags) {
        const tagSlug = slugify(tagName, { lower: true, strict: true });
        let tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
        
        if (!tag) {
          tag = await prisma.tag.create({
            data: {
              name: tagName,
              slug: tagSlug
            }
          });
        }
        
        tagConnections.push({
          postId: id,
          tagId: tag.id
        });
      }

      await prisma.postTag.createMany({
        data: tagConnections
      });
    }

    // Get updated post with relations
    const updatedPost = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        category: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    res.json({
      message: 'Post updated successfully',
      post: {
        ...updatedPost,
        tags: updatedPost.tags.map(pt => pt.tag)
      }
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({
      error: 'Failed to update post',
      code: 'UPDATE_POST_ERROR'
    });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete post
 */
router.delete('/:id', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if post exists and user has permission
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: { author: true }
    });

    if (!existingPost) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    // Check permissions
    if (req.user.role !== 'ADMIN' && existingPost.authorId !== req.user.id) {
      return res.status(403).json({
        error: 'You can only delete your own posts',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Delete post (cascade will handle related records)
    await prisma.post.delete({
      where: { id }
    });

    res.json({
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      error: 'Failed to delete post',
      code: 'DELETE_POST_ERROR'
    });
  }
});

/**
 * GET /api/posts/stats/overview
 * Get posts statistics
 */
router.get('/stats/overview', authenticateToken, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  try {
    const [
      totalPosts,
      publishedPosts,
      draftPosts,
      scheduledPosts,
      totalViews,
      totalComments
    ] = await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: 'PUBLISHED' } }),
      prisma.post.count({ where: { status: 'DRAFT' } }),
      prisma.post.count({ where: { status: 'SCHEDULED' } }),
      prisma.post.aggregate({ _sum: { viewCount: true } }),
      prisma.comment.count({ where: { status: 'APPROVED' } })
    ]);

    res.json({
      totalPosts,
      publishedPosts,
      draftPosts,
      scheduledPosts,
      totalViews: totalViews._sum.viewCount || 0,
      totalComments
    });
  } catch (error) {
    console.error('Get posts stats error:', error);
    res.status(500).json({
      error: 'Failed to get posts statistics',
      code: 'GET_STATS_ERROR'
    });
  }
});

module.exports = router;

