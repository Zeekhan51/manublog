const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/analytics/track-view
 * Track post view
 */
router.post('/track-view', async (req, res) => {
  try {
    const { postId, referrer } = req.body;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!postId) {
      return res.status(400).json({
        error: 'Post ID is required',
        code: 'POST_ID_REQUIRED'
      });
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    // Get today's date for analytics grouping
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if this IP already viewed this post today (for unique views)
    const existingView = await prisma.postAnalytics.findFirst({
      where: {
        postId,
        date: today,
        ipAddress
      }
    });

    if (existingView) {
      // Update existing view count
      await prisma.postAnalytics.update({
        where: { id: existingView.id },
        data: {
          views: { increment: 1 },
          referrer: referrer || existingView.referrer,
          userAgent: userAgent || existingView.userAgent
        }
      });
    } else {
      // Create new analytics record
      await prisma.postAnalytics.create({
        data: {
          postId,
          date: today,
          views: 1,
          uniqueViews: 1,
          referrer,
          userAgent,
          ipAddress
        }
      });
    }

    // Update post view count
    await prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } }
    });

    res.json({
      message: 'View tracked successfully'
    });
  } catch (error) {
    console.error('Track view error:', error);
    res.status(500).json({
      error: 'Failed to track view',
      code: 'TRACK_VIEW_ERROR'
    });
  }
});

/**
 * GET /api/analytics/dashboard
 * Get dashboard analytics
 */
router.get('/dashboard', authenticateToken, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get analytics data
    const [
      totalViews,
      uniqueViews,
      topPosts,
      viewsByDay,
      referrers
    ] = await Promise.all([
      // Total views in period
      prisma.postAnalytics.aggregate({
        where: { date: { gte: startDate } },
        _sum: { views: true }
      }),
      
      // Unique views in period
      prisma.postAnalytics.aggregate({
        where: { date: { gte: startDate } },
        _sum: { uniqueViews: true }
      }),
      
      // Top posts by views
      prisma.post.findMany({
        select: {
          id: true,
          title: true,
          slug: true,
          viewCount: true,
          publishedAt: true
        },
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: startDate }
        },
        orderBy: { viewCount: 'desc' },
        take: 10
      }),
      
      // Views by day
      prisma.postAnalytics.groupBy({
        by: ['date'],
        where: { date: { gte: startDate } },
        _sum: {
          views: true,
          uniqueViews: true
        },
        orderBy: { date: 'asc' }
      }),
      
      // Top referrers
      prisma.postAnalytics.groupBy({
        by: ['referrer'],
        where: {
          date: { gte: startDate },
          referrer: { not: null }
        },
        _sum: { views: true },
        orderBy: { _sum: { views: 'desc' } },
        take: 10
      })
    ]);

    res.json({
      summary: {
        totalViews: totalViews._sum.views || 0,
        uniqueViews: uniqueViews._sum.views || 0,
        period: days
      },
      topPosts,
      viewsByDay: viewsByDay.map(day => ({
        date: day.date,
        views: day._sum.views,
        uniqueViews: day._sum.uniqueViews
      })),
      topReferrers: referrers.map(ref => ({
        referrer: ref.referrer,
        views: ref._sum.views
      }))
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({
      error: 'Failed to get analytics',
      code: 'GET_ANALYTICS_ERROR'
    });
  }
});

/**
 * GET /api/analytics/posts/:postId
 * Get analytics for specific post
 */
router.get('/posts/:postId', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), async (req, res) => {
  try {
    const { postId } = req.params;
    const { period = '30' } = req.query;
    const days = parseInt(period);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Check if post exists and user has permission
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { author: true }
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    // Check permissions (authors can only see their own posts)
    if (req.user.role === 'AUTHOR' && post.authorId !== req.user.id) {
      return res.status(403).json({
        error: 'You can only view analytics for your own posts',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const [
      totalViews,
      uniqueViews,
      viewsByDay,
      referrers
    ] = await Promise.all([
      // Total views for this post
      prisma.postAnalytics.aggregate({
        where: {
          postId,
          date: { gte: startDate }
        },
        _sum: { views: true }
      }),
      
      // Unique views for this post
      prisma.postAnalytics.aggregate({
        where: {
          postId,
          date: { gte: startDate }
        },
        _sum: { uniqueViews: true }
      }),
      
      // Views by day for this post
      prisma.postAnalytics.findMany({
        where: {
          postId,
          date: { gte: startDate }
        },
        select: {
          date: true,
          views: true,
          uniqueViews: true
        },
        orderBy: { date: 'asc' }
      }),
      
      // Referrers for this post
      prisma.postAnalytics.groupBy({
        by: ['referrer'],
        where: {
          postId,
          date: { gte: startDate },
          referrer: { not: null }
        },
        _sum: { views: true },
        orderBy: { _sum: { views: 'desc' } },
        take: 10
      })
    ]);

    res.json({
      post: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        publishedAt: post.publishedAt
      },
      summary: {
        totalViews: totalViews._sum.views || 0,
        uniqueViews: uniqueViews._sum.views || 0,
        allTimeViews: post.viewCount,
        period: days
      },
      viewsByDay,
      topReferrers: referrers.map(ref => ({
        referrer: ref.referrer,
        views: ref._sum.views
      }))
    });
  } catch (error) {
    console.error('Get post analytics error:', error);
    res.status(500).json({
      error: 'Failed to get post analytics',
      code: 'GET_POST_ANALYTICS_ERROR'
    });
  }
});

/**
 * GET /api/analytics/overview
 * Get overview statistics
 */
router.get('/overview', authenticateToken, requireRole(['ADMIN', 'EDITOR']), async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setDate(lastMonth.getDate() - 30);

    const [
      todayViews,
      yesterdayViews,
      weekViews,
      monthViews,
      totalPosts,
      publishedPosts,
      totalComments,
      approvedComments
    ] = await Promise.all([
      // Today's views
      prisma.postAnalytics.aggregate({
        where: { date: today },
        _sum: { views: true, uniqueViews: true }
      }),
      
      // Yesterday's views
      prisma.postAnalytics.aggregate({
        where: { date: yesterday },
        _sum: { views: true, uniqueViews: true }
      }),
      
      // Last week's views
      prisma.postAnalytics.aggregate({
        where: { date: { gte: lastWeek } },
        _sum: { views: true, uniqueViews: true }
      }),
      
      // Last month's views
      prisma.postAnalytics.aggregate({
        where: { date: { gte: lastMonth } },
        _sum: { views: true, uniqueViews: true }
      }),
      
      // Total posts
      prisma.post.count(),
      
      // Published posts
      prisma.post.count({ where: { status: 'PUBLISHED' } }),
      
      // Total comments
      prisma.comment.count(),
      
      // Approved comments
      prisma.comment.count({ where: { status: 'APPROVED' } })
    ]);

    res.json({
      views: {
        today: todayViews._sum.views || 0,
        yesterday: yesterdayViews._sum.views || 0,
        week: weekViews._sum.views || 0,
        month: monthViews._sum.views || 0
      },
      uniqueViews: {
        today: todayViews._sum.uniqueViews || 0,
        yesterday: yesterdayViews._sum.uniqueViews || 0,
        week: weekViews._sum.uniqueViews || 0,
        month: monthViews._sum.uniqueViews || 0
      },
      content: {
        totalPosts,
        publishedPosts,
        draftPosts: totalPosts - publishedPosts
      },
      engagement: {
        totalComments,
        approvedComments,
        pendingComments: totalComments - approvedComments
      }
    });
  } catch (error) {
    console.error('Get overview analytics error:', error);
    res.status(500).json({
      error: 'Failed to get overview analytics',
      code: 'GET_OVERVIEW_ERROR'
    });
  }
});

module.exports = router;

