const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Generate XML sitemap
 */
const generateSitemap = async () => {
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  
  // Get all published posts
  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { lte: new Date() }
    },
    select: {
      slug: true,
      updatedAt: true,
      publishedAt: true
    },
    orderBy: { publishedAt: 'desc' }
  });

  // Get all categories
  const categories = await prisma.category.findMany({
    select: {
      slug: true,
      updatedAt: true
    }
  });

  // Get all tags
  const tags = await prisma.tag.findMany({
    select: {
      slug: true,
      updatedAt: true
    }
  });

  // Build sitemap XML
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Add homepage
  sitemap += `
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  // Add blog index
  sitemap += `
  <url>
    <loc>${siteUrl}/blog</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;

  // Add posts
  posts.forEach(post => {
    const lastmod = post.updatedAt > post.publishedAt ? post.updatedAt : post.publishedAt;
    sitemap += `
  <url>
    <loc>${siteUrl}/blog/${post.slug}</loc>
    <lastmod>${lastmod.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  // Add categories
  categories.forEach(category => {
    sitemap += `
  <url>
    <loc>${siteUrl}/category/${category.slug}</loc>
    <lastmod>${category.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
  });

  // Add tags
  tags.forEach(tag => {
    sitemap += `
  <url>
    <loc>${siteUrl}/tag/${tag.slug}</loc>
    <lastmod>${tag.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`;
  });

  // Add static pages
  const staticPages = [
    { url: '/about', priority: '0.7', changefreq: 'monthly' },
    { url: '/contact', priority: '0.7', changefreq: 'monthly' },
    { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
    { url: '/terms', priority: '0.3', changefreq: 'yearly' }
  ];

  staticPages.forEach(page => {
    sitemap += `
  <url>
    <loc>${siteUrl}${page.url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  });

  sitemap += `
</urlset>`;

  return sitemap;
};

/**
 * GET /sitemap.xml
 * Generate and serve sitemap
 */
router.get('/', async (req, res) => {
  try {
    const sitemap = await generateSitemap();
    
    res.set({
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });
    
    res.send(sitemap);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate sitemap</error>');
  }
});

/**
 * Generate robots.txt content
 */
const generateRobotsTxt = () => {
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  
  return `User-agent: *
Allow: /

# Disallow admin and private areas
Disallow: /admin/
Disallow: /api/
Disallow: /login
Disallow: /register
Disallow: /dashboard/

# Allow specific API endpoints that should be crawled
Allow: /api/posts/
Allow: /api/sitemap

# Sitemap location
Sitemap: ${siteUrl}/sitemap.xml

# Crawl delay (optional)
Crawl-delay: 1`;
};

/**
 * GET /robots.txt
 * Generate and serve robots.txt
 */
router.get('/robots.txt', (req, res) => {
  try {
    const robotsTxt = generateRobotsTxt();
    
    res.set({
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });
    
    res.send(robotsTxt);
  } catch (error) {
    console.error('Robots.txt generation error:', error);
    res.status(500).send('# Error generating robots.txt');
  }
});

module.exports = router;

