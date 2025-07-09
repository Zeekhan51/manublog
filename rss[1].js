const express = require('express');
const RSS = require('rss');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Generate RSS feed
 */
const generateRSSFeed = async (options = {}) => {
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const siteName = process.env.SITE_NAME || 'My Blog';
  const siteDescription = process.env.SITE_DESCRIPTION || 'A custom blog platform';

  // Create RSS feed
  const feed = new RSS({
    title: siteName,
    description: siteDescription,
    feed_url: `${siteUrl}/rss`,
    site_url: siteUrl,
    image_url: `${siteUrl}/logo.png`,
    managingEditor: 'admin@example.com',
    webMaster: 'admin@example.com',
    copyright: `© ${new Date().getFullYear()} ${siteName}`,
    language: 'en',
    categories: ['Blog', 'Technology', 'Web Development'],
    pubDate: new Date(),
    ttl: 60 // Time to live in minutes
  });

  // Build query options
  const queryOptions = {
    where: {
      status: 'PUBLISHED',
      publishedAt: { lte: new Date() }
    },
    include: {
      author: {
        select: {
          username: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      category: {
        select: {
          name: true,
          slug: true
        }
      },
      tags: {
        include: {
          tag: {
            select: {
              name: true,
              slug: true
            }
          }
        }
      }
    },
    orderBy: { publishedAt: 'desc' },
    take: options.limit || 20
  };

  // Add category filter if specified
  if (options.category) {
    queryOptions.where.category = { slug: options.category };
  }

  // Add tag filter if specified
  if (options.tag) {
    queryOptions.where.tags = {
      some: {
        tag: { slug: options.tag }
      }
    };
  }

  // Get posts
  const posts = await prisma.post.findMany(queryOptions);

  // Add posts to feed
  posts.forEach(post => {
    const authorName = post.author.firstName && post.author.lastName
      ? `${post.author.firstName} ${post.author.lastName}`
      : post.author.username;

    const categories = [
      ...(post.category ? [post.category.name] : []),
      ...post.tags.map(pt => pt.tag.name)
    ];

    // Clean content for RSS (remove HTML tags for description)
    const description = post.excerpt || 
      post.content.replace(/<[^>]*>/g, '').substring(0, 300) + '...';

    feed.item({
      title: post.title,
      description: description,
      url: `${siteUrl}/blog/${post.slug}`,
      guid: post.id,
      categories: categories,
      author: `${post.author.email} (${authorName})`,
      date: post.publishedAt,
      enclosure: post.featuredImage ? {
        url: post.featuredImage.startsWith('http') 
          ? post.featuredImage 
          : `${siteUrl}${post.featuredImage}`,
        type: 'image/jpeg'
      } : undefined,
      custom_elements: [
        { 'content:encoded': `<![CDATA[${post.content}]]>` },
        ...(post.featuredImage ? [{
          'media:content': {
            _attr: {
              url: post.featuredImage.startsWith('http') 
                ? post.featuredImage 
                : `${siteUrl}${post.featuredImage}`,
              type: 'image/jpeg'
            }
          }
        }] : [])
      ]
    });
  });

  return feed.xml({ indent: true });
};

/**
 * GET /rss
 * Main RSS feed
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const rssXml = await generateRSSFeed({ 
      limit: parseInt(limit) 
    });
    
    res.set({
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });
    
    res.send(rssXml);
  } catch (error) {
    console.error('RSS feed generation error:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate RSS feed</error>');
  }
});

/**
 * GET /rss/category/:slug
 * Category-specific RSS feed
 */
router.get('/category/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { limit = 20 } = req.query;

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { slug },
      select: { name: true, slug: true }
    });

    if (!category) {
      return res.status(404).send('<?xml version="1.0" encoding="UTF-8"?><error>Category not found</error>');
    }

    const rssXml = await generateRSSFeed({ 
      category: slug,
      limit: parseInt(limit)
    });
    
    res.set({
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.send(rssXml);
  } catch (error) {
    console.error('Category RSS feed generation error:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate category RSS feed</error>');
  }
});

/**
 * GET /rss/tag/:slug
 * Tag-specific RSS feed
 */
router.get('/tag/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { limit = 20 } = req.query;

    // Check if tag exists
    const tag = await prisma.tag.findUnique({
      where: { slug },
      select: { name: true, slug: true }
    });

    if (!tag) {
      return res.status(404).send('<?xml version="1.0" encoding="UTF-8"?><error>Tag not found</error>');
    }

    const rssXml = await generateRSSFeed({ 
      tag: slug,
      limit: parseInt(limit)
    });
    
    res.set({
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.send(rssXml);
  } catch (error) {
    console.error('Tag RSS feed generation error:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate tag RSS feed</error>');
  }
});

/**
 * GET /rss/feed.json
 * JSON Feed format (alternative to RSS)
 */
router.get('/feed.json', async (req, res) => {
  try {
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const siteName = process.env.SITE_NAME || 'My Blog';
    const siteDescription = process.env.SITE_DESCRIPTION || 'A custom blog platform';
    const { limit = 20 } = req.query;

    // Get posts
    const posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { lte: new Date() }
      },
      include: {
        author: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        category: {
          select: {
            name: true,
            slug: true
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        }
      },
      orderBy: { publishedAt: 'desc' },
      take: parseInt(limit)
    });

    // Build JSON Feed
    const jsonFeed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: siteName,
      description: siteDescription,
      home_page_url: siteUrl,
      feed_url: `${siteUrl}/rss/feed.json`,
      icon: `${siteUrl}/icon.png`,
      favicon: `${siteUrl}/favicon.ico`,
      language: 'en',
      items: posts.map(post => {
        const authorName = post.author.firstName && post.author.lastName
          ? `${post.author.firstName} ${post.author.lastName}`
          : post.author.username;

        const tags = [
          ...(post.category ? [post.category.name] : []),
          ...post.tags.map(pt => pt.tag.name)
        ];

        return {
          id: post.id,
          url: `${siteUrl}/blog/${post.slug}`,
          title: post.title,
          content_html: post.content,
          summary: post.excerpt || post.content.replace(/<[^>]*>/g, '').substring(0, 300) + '...',
          image: post.featuredImage ? (
            post.featuredImage.startsWith('http') 
              ? post.featuredImage 
              : `${siteUrl}${post.featuredImage}`
          ) : undefined,
          date_published: post.publishedAt.toISOString(),
          date_modified: post.updatedAt.toISOString(),
          author: {
            name: authorName,
            avatar: post.author.avatar ? (
              post.author.avatar.startsWith('http')
                ? post.author.avatar
                : `${siteUrl}${post.author.avatar}`
            ) : undefined
          },
          tags: tags
        };
      })
    };

    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.json(jsonFeed);
  } catch (error) {
    console.error('JSON feed generation error:', error);
    res.status(500).json({ error: 'Failed to generate JSON feed' });
  }
});

/**
 * GET /rss/atom
 * Atom feed format
 */
router.get('/atom', async (req, res) => {
  try {
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const siteName = process.env.SITE_NAME || 'My Blog';
    const siteDescription = process.env.SITE_DESCRIPTION || 'A custom blog platform';
    const { limit = 20 } = req.query;

    // Get posts
    const posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { lte: new Date() }
      },
      include: {
        author: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { publishedAt: 'desc' },
      take: parseInt(limit)
    });

    // Generate Atom XML
    let atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${siteName}</title>
  <subtitle>${siteDescription}</subtitle>
  <link href="${siteUrl}/rss/atom" rel="self"/>
  <link href="${siteUrl}"/>
  <id>${siteUrl}/</id>
  <updated>${new Date().toISOString()}</updated>`;

    posts.forEach(post => {
      const authorName = post.author.firstName && post.author.lastName
        ? `${post.author.firstName} ${post.author.lastName}`
        : post.author.username;

      atomXml += `
  <entry>
    <title>${post.title}</title>
    <link href="${siteUrl}/blog/${post.slug}"/>
    <id>${siteUrl}/blog/${post.slug}</id>
    <updated>${post.updatedAt.toISOString()}</updated>
    <published>${post.publishedAt.toISOString()}</published>
    <author>
      <name>${authorName}</name>
      <email>${post.author.email}</email>
    </author>
    <summary>${post.excerpt || post.content.replace(/<[^>]*>/g, '').substring(0, 300) + '...'}</summary>
    <content type="html"><![CDATA[${post.content}]]></content>
  </entry>`;
    });

    atomXml += `
</feed>`;

    res.set({
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.send(atomXml);
  } catch (error) {
    console.error('Atom feed generation error:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate Atom feed</error>');
  }
});

module.exports = router;

