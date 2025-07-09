const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const slugify = require('slugify');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Analyze SEO for content
 */
const analyzeSEO = (content, title, metaDescription, slug) => {
  const analysis = {
    score: 0,
    issues: [],
    suggestions: [],
    checks: {}
  };

  // Title analysis
  if (!title || title.length === 0) {
    analysis.issues.push('Title is missing');
    analysis.checks.title = { status: 'error', message: 'Title is required' };
  } else if (title.length < 30) {
    analysis.issues.push('Title is too short (recommended: 30-60 characters)');
    analysis.checks.title = { status: 'warning', message: `Title is ${title.length} characters (recommended: 30-60)` };
  } else if (title.length > 60) {
    analysis.issues.push('Title is too long (recommended: 30-60 characters)');
    analysis.checks.title = { status: 'warning', message: `Title is ${title.length} characters (recommended: 30-60)` };
  } else {
    analysis.score += 20;
    analysis.checks.title = { status: 'success', message: `Title length is optimal (${title.length} characters)` };
  }

  // Meta description analysis
  if (!metaDescription || metaDescription.length === 0) {
    analysis.issues.push('Meta description is missing');
    analysis.checks.metaDescription = { status: 'error', message: 'Meta description is required for SEO' };
  } else if (metaDescription.length < 120) {
    analysis.issues.push('Meta description is too short (recommended: 120-160 characters)');
    analysis.checks.metaDescription = { status: 'warning', message: `Meta description is ${metaDescription.length} characters (recommended: 120-160)` };
  } else if (metaDescription.length > 160) {
    analysis.issues.push('Meta description is too long (recommended: 120-160 characters)');
    analysis.checks.metaDescription = { status: 'warning', message: `Meta description is ${metaDescription.length} characters (recommended: 120-160)` };
  } else {
    analysis.score += 20;
    analysis.checks.metaDescription = { status: 'success', message: `Meta description length is optimal (${metaDescription.length} characters)` };
  }

  // Slug analysis
  if (!slug || slug.length === 0) {
    analysis.issues.push('URL slug is missing');
    analysis.checks.slug = { status: 'error', message: 'URL slug is required' };
  } else if (slug.length > 75) {
    analysis.issues.push('URL slug is too long (recommended: under 75 characters)');
    analysis.checks.slug = { status: 'warning', message: `URL slug is ${slug.length} characters (recommended: under 75)` };
  } else if (!/^[a-z0-9-]+$/.test(slug)) {
    analysis.issues.push('URL slug should only contain lowercase letters, numbers, and hyphens');
    analysis.checks.slug = { status: 'warning', message: 'URL slug should be lowercase with hyphens' };
  } else {
    analysis.score += 15;
    analysis.checks.slug = { status: 'success', message: 'URL slug is SEO-friendly' };
  }

  // Content analysis
  if (!content || content.length === 0) {
    analysis.issues.push('Content is missing');
    analysis.checks.content = { status: 'error', message: 'Content is required' };
  } else {
    const wordCount = content.split(/\s+/).length;
    const headingMatches = content.match(/<h[1-6][^>]*>/gi) || [];
    const imageMatches = content.match(/<img[^>]*>/gi) || [];
    const linkMatches = content.match(/<a[^>]*>/gi) || [];

    // Word count check
    if (wordCount < 300) {
      analysis.issues.push('Content is too short (recommended: 300+ words for SEO)');
      analysis.checks.wordCount = { status: 'warning', message: `Content has ${wordCount} words (recommended: 300+)` };
    } else {
      analysis.score += 15;
      analysis.checks.wordCount = { status: 'success', message: `Content has ${wordCount} words` };
    }

    // Heading structure check
    if (headingMatches.length === 0) {
      analysis.suggestions.push('Add headings (H1, H2, H3) to improve content structure');
      analysis.checks.headings = { status: 'warning', message: 'No headings found in content' };
    } else {
      analysis.score += 10;
      analysis.checks.headings = { status: 'success', message: `Found ${headingMatches.length} headings` };
    }

    // Image optimization check
    if (imageMatches.length > 0) {
      const imagesWithoutAlt = imageMatches.filter(img => !img.includes('alt=') || img.includes('alt=""'));
      if (imagesWithoutAlt.length > 0) {
        analysis.issues.push(`${imagesWithoutAlt.length} images missing alt text`);
        analysis.checks.images = { status: 'warning', message: `${imagesWithoutAlt.length} of ${imageMatches.length} images missing alt text` };
      } else {
        analysis.score += 10;
        analysis.checks.images = { status: 'success', message: `All ${imageMatches.length} images have alt text` };
      }
    }

    // Internal linking check
    if (linkMatches.length === 0) {
      analysis.suggestions.push('Add internal links to improve SEO and user experience');
      analysis.checks.links = { status: 'info', message: 'No links found in content' };
    } else {
      analysis.score += 5;
      analysis.checks.links = { status: 'success', message: `Found ${linkMatches.length} links` };
    }
  }

  // Keyword density analysis (basic)
  if (title && content) {
    const titleWords = title.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    const keywordDensities = {};

    titleWords.forEach(word => {
      if (word.length > 3) { // Only check words longer than 3 characters
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = (contentLower.match(regex) || []).length;
        const density = (matches / content.split(/\s+/).length) * 100;
        keywordDensities[word] = { count: matches, density: density.toFixed(2) };
      }
    });

    analysis.keywordDensity = keywordDensities;
  }

  // Calculate final score
  analysis.score = Math.min(100, analysis.score);
  
  // Determine overall status
  if (analysis.score >= 80) {
    analysis.status = 'excellent';
  } else if (analysis.score >= 60) {
    analysis.status = 'good';
  } else if (analysis.score >= 40) {
    analysis.status = 'needs-improvement';
  } else {
    analysis.status = 'poor';
  }

  return analysis;
};

/**
 * POST /api/seo/analyze
 * Analyze SEO for given content
 */
router.post('/analyze', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), [
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('slug').optional().isString(),
  body('metaDescription').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { title, content, slug, metaDescription } = req.body;

    // Generate slug if not provided
    const finalSlug = slug || slugify(title, { lower: true, strict: true });

    // Perform SEO analysis
    const analysis = analyzeSEO(content, title, metaDescription, finalSlug);

    res.json({
      analysis,
      generatedSlug: finalSlug
    });
  } catch (error) {
    console.error('SEO analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze SEO',
      code: 'SEO_ANALYSIS_ERROR'
    });
  }
});

/**
 * POST /api/seo/generate-slug
 * Generate SEO-friendly slug from title
 */
router.post('/generate-slug', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), [
  body('title').notEmpty().withMessage('Title is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { title, postId } = req.body;

    // Generate base slug
    let baseSlug = slugify(title, { 
      lower: true, 
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });

    // Ensure uniqueness
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

    res.json({
      slug,
      isUnique: counter === 1
    });
  } catch (error) {
    console.error('Generate slug error:', error);
    res.status(500).json({
      error: 'Failed to generate slug',
      code: 'GENERATE_SLUG_ERROR'
    });
  }
});

/**
 * GET /api/seo/meta-preview
 * Generate meta tag preview for social media
 */
router.get('/meta-preview', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), async (req, res) => {
  try {
    const { 
      title, 
      metaDescription, 
      ogTitle, 
      ogDescription, 
      ogImage,
      twitterTitle,
      twitterDescription,
      twitterImage,
      slug 
    } = req.query;

    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const siteName = process.env.SITE_NAME || 'My Blog';

    const preview = {
      google: {
        title: title || 'Untitled Post',
        description: metaDescription || 'No description available',
        url: `${siteUrl}/${slug || 'post-slug'}`
      },
      facebook: {
        title: ogTitle || title || 'Untitled Post',
        description: ogDescription || metaDescription || 'No description available',
        image: ogImage || '',
        url: `${siteUrl}/${slug || 'post-slug'}`,
        siteName
      },
      twitter: {
        title: twitterTitle || ogTitle || title || 'Untitled Post',
        description: twitterDescription || ogDescription || metaDescription || 'No description available',
        image: twitterImage || ogImage || '',
        url: `${siteUrl}/${slug || 'post-slug'}`
      }
    };

    res.json({ preview });
  } catch (error) {
    console.error('Meta preview error:', error);
    res.status(500).json({
      error: 'Failed to generate meta preview',
      code: 'META_PREVIEW_ERROR'
    });
  }
});

/**
 * GET /api/seo/suggestions
 * Get SEO improvement suggestions
 */
router.get('/suggestions', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), async (req, res) => {
  try {
    // Get posts with SEO issues
    const posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED'
      },
      select: {
        id: true,
        title: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        content: true,
        viewCount: true
      },
      take: 50,
      orderBy: { viewCount: 'desc' }
    });

    const suggestions = [];

    posts.forEach(post => {
      const issues = [];

      // Check for missing meta title
      if (!post.metaTitle || post.metaTitle.length === 0) {
        issues.push('Missing meta title');
      } else if (post.metaTitle.length > 60) {
        issues.push('Meta title too long');
      }

      // Check for missing meta description
      if (!post.metaDescription || post.metaDescription.length === 0) {
        issues.push('Missing meta description');
      } else if (post.metaDescription.length > 160) {
        issues.push('Meta description too long');
      }

      // Check slug length
      if (post.slug.length > 75) {
        issues.push('URL slug too long');
      }

      // Check content length
      const wordCount = post.content.split(/\s+/).length;
      if (wordCount < 300) {
        issues.push('Content too short for SEO');
      }

      if (issues.length > 0) {
        suggestions.push({
          postId: post.id,
          title: post.title,
          slug: post.slug,
          issues,
          priority: issues.length > 2 ? 'high' : 'medium'
        });
      }
    });

    // Sort by priority and view count
    suggestions.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return 0;
    });

    res.json({
      suggestions: suggestions.slice(0, 20), // Return top 20 suggestions
      totalIssues: suggestions.length
    });
  } catch (error) {
    console.error('Get SEO suggestions error:', error);
    res.status(500).json({
      error: 'Failed to get SEO suggestions',
      code: 'GET_SUGGESTIONS_ERROR'
    });
  }
});

/**
 * GET /api/seo/keywords
 * Get keyword analysis for content
 */
router.get('/keywords', authenticateToken, requireRole(['ADMIN', 'EDITOR', 'AUTHOR']), async (req, res) => {
  try {
    const { content, title } = req.query;

    if (!content) {
      return res.status(400).json({
        error: 'Content is required',
        code: 'CONTENT_REQUIRED'
      });
    }

    // Simple keyword extraction (in production, you might use a more sophisticated NLP library)
    const text = `${title || ''} ${content}`.toLowerCase();
    const words = text.match(/\b[a-z]{3,}\b/g) || [];
    
    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      if (!['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'will', 'with'].includes(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });

    // Get top keywords
    const keywords = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({
        word,
        count,
        density: ((count / words.length) * 100).toFixed(2)
      }));

    res.json({
      keywords,
      totalWords: words.length,
      uniqueWords: Object.keys(wordCount).length
    });
  } catch (error) {
    console.error('Keyword analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze keywords',
      code: 'KEYWORD_ANALYSIS_ERROR'
    });
  }
});

module.exports = router;

