const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('./auth');

const prisma = new PrismaClient();

/**
 * Seed the database with initial data
 */
async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Create admin user
    const adminPassword = await hashPassword('admin123456');
    const admin = await prisma.user.upsert({
      where: { email: 'admin@blog.com' },
      update: {},
      create: {
        email: 'admin@blog.com',
        username: 'admin',
        password: adminPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true
      }
    });

    console.log('✅ Admin user created:', admin.email);

    // Create categories
    const categories = [
      {
        name: 'Technology',
        slug: 'technology',
        description: 'Latest technology trends and news',
        color: '#3B82F6'
      },
      {
        name: 'Web Development',
        slug: 'web-development',
        description: 'Web development tutorials and tips',
        color: '#10B981'
      },
      {
        name: 'Design',
        slug: 'design',
        description: 'UI/UX design and creative inspiration',
        color: '#F59E0B'
      },
      {
        name: 'Business',
        slug: 'business',
        description: 'Business insights and entrepreneurship',
        color: '#EF4444'
      }
    ];

    for (const categoryData of categories) {
      await prisma.category.upsert({
        where: { slug: categoryData.slug },
        update: {},
        create: categoryData
      });
    }

    console.log('✅ Categories created');

    // Create tags
    const tags = [
      { name: 'JavaScript', slug: 'javascript', color: '#F7DF1E' },
      { name: 'React', slug: 'react', color: '#61DAFB' },
      { name: 'Node.js', slug: 'nodejs', color: '#339933' },
      { name: 'CSS', slug: 'css', color: '#1572B6' },
      { name: 'HTML', slug: 'html', color: '#E34F26' },
      { name: 'TypeScript', slug: 'typescript', color: '#3178C6' },
      { name: 'SEO', slug: 'seo', color: '#4285F4' },
      { name: 'Performance', slug: 'performance', color: '#FF6B6B' },
      { name: 'Tutorial', slug: 'tutorial', color: '#6C5CE7' },
      { name: 'Tips', slug: 'tips', color: '#00B894' }
    ];

    for (const tagData of tags) {
      await prisma.tag.upsert({
        where: { slug: tagData.slug },
        update: {},
        create: tagData
      });
    }

    console.log('✅ Tags created');

    // Create sample posts
    const techCategory = await prisma.category.findUnique({ where: { slug: 'technology' } });
    const webDevCategory = await prisma.category.findUnique({ where: { slug: 'web-development' } });

    const samplePosts = [
      {
        title: 'Getting Started with Modern Web Development',
        slug: 'getting-started-modern-web-development',
        content: `
          <h2>Introduction to Modern Web Development</h2>
          <p>Web development has evolved significantly over the past decade. Modern web development involves a complex ecosystem of tools, frameworks, and best practices that enable developers to build fast, scalable, and maintainable applications.</p>
          
          <h3>Key Technologies</h3>
          <p>Today's web developers work with a variety of technologies:</p>
          <ul>
            <li><strong>Frontend:</strong> React, Vue.js, Angular, Svelte</li>
            <li><strong>Backend:</strong> Node.js, Python, Go, Rust</li>
            <li><strong>Databases:</strong> PostgreSQL, MongoDB, Redis</li>
            <li><strong>DevOps:</strong> Docker, Kubernetes, CI/CD</li>
          </ul>
          
          <h3>Best Practices</h3>
          <p>Following best practices is crucial for building maintainable applications:</p>
          <ol>
            <li>Write clean, readable code</li>
            <li>Implement proper testing strategies</li>
            <li>Use version control effectively</li>
            <li>Optimize for performance</li>
            <li>Ensure accessibility compliance</li>
          </ol>
          
          <p>This comprehensive guide will help you navigate the modern web development landscape and build amazing applications.</p>
        `,
        excerpt: 'A comprehensive guide to modern web development technologies and best practices.',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        categoryId: webDevCategory.id,
        authorId: admin.id,
        metaTitle: 'Getting Started with Modern Web Development - Complete Guide',
        metaDescription: 'Learn modern web development with this comprehensive guide covering frontend, backend, and best practices for building scalable applications.',
        viewCount: 150
      },
      {
        title: 'The Future of Artificial Intelligence in 2024',
        slug: 'future-artificial-intelligence-2024',
        content: `
          <h2>AI Revolution Continues</h2>
          <p>Artificial Intelligence continues to reshape industries and transform how we work, live, and interact with technology. As we progress through 2024, several key trends are emerging that will define the future of AI.</p>
          
          <h3>Emerging Trends</h3>
          <p>The AI landscape is rapidly evolving with these significant developments:</p>
          
          <h4>1. Large Language Models (LLMs)</h4>
          <p>LLMs like GPT-4 and beyond are becoming more sophisticated, offering better reasoning capabilities and more accurate responses across diverse domains.</p>
          
          <h4>2. Multimodal AI</h4>
          <p>AI systems that can process and understand multiple types of data (text, images, audio, video) simultaneously are becoming more prevalent.</p>
          
          <h4>3. Edge AI</h4>
          <p>Moving AI processing closer to data sources reduces latency and improves privacy, making real-time AI applications more feasible.</p>
          
          <h3>Industry Applications</h3>
          <p>AI is making significant impacts across various sectors:</p>
          <ul>
            <li><strong>Healthcare:</strong> Diagnostic assistance and drug discovery</li>
            <li><strong>Finance:</strong> Fraud detection and algorithmic trading</li>
            <li><strong>Transportation:</strong> Autonomous vehicles and traffic optimization</li>
            <li><strong>Education:</strong> Personalized learning and intelligent tutoring</li>
          </ul>
          
          <p>The future of AI holds immense promise, but it also requires careful consideration of ethical implications and responsible development practices.</p>
        `,
        excerpt: 'Exploring the latest trends and applications of artificial intelligence that will shape our future.',
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        categoryId: techCategory.id,
        authorId: admin.id,
        metaTitle: 'The Future of AI in 2024 - Trends and Predictions',
        metaDescription: 'Discover the latest AI trends for 2024, including LLMs, multimodal AI, and industry applications that will transform our future.',
        viewCount: 89
      },
      {
        title: 'Building Responsive Web Applications with CSS Grid',
        slug: 'building-responsive-web-applications-css-grid',
        content: `
          <h2>Mastering CSS Grid for Responsive Design</h2>
          <p>CSS Grid has revolutionized how we approach layout design in web development. This powerful layout system provides unprecedented control over both rows and columns, making it easier than ever to create complex, responsive designs.</p>
          
          <h3>Why CSS Grid?</h3>
          <p>CSS Grid offers several advantages over traditional layout methods:</p>
          <ul>
            <li>Two-dimensional layout control</li>
            <li>Simplified responsive design</li>
            <li>Better browser support</li>
            <li>Cleaner, more semantic HTML</li>
          </ul>
          
          <h3>Basic Grid Setup</h3>
          <p>Getting started with CSS Grid is straightforward:</p>
          <pre><code>.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}</code></pre>
          
          <h3>Advanced Techniques</h3>
          <p>Once you master the basics, you can explore advanced features:</p>
          <ol>
            <li><strong>Grid Areas:</strong> Named grid regions for complex layouts</li>
            <li><strong>Subgrid:</strong> Nested grids that inherit parent grid lines</li>
            <li><strong>Auto-placement:</strong> Automatic item positioning</li>
          </ol>
          
          <h3>Real-world Examples</h3>
          <p>CSS Grid excels in various layout scenarios:</p>
          <ul>
            <li>Magazine-style layouts</li>
            <li>Dashboard interfaces</li>
            <li>Image galleries</li>
            <li>Card-based designs</li>
          </ul>
          
          <p>By mastering CSS Grid, you'll be able to create more flexible and maintainable layouts that work beautifully across all devices.</p>
        `,
        excerpt: 'Learn how to create responsive web layouts using the powerful CSS Grid system.',
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        categoryId: webDevCategory.id,
        authorId: admin.id,
        metaTitle: 'CSS Grid Tutorial - Building Responsive Web Applications',
        metaDescription: 'Master CSS Grid with this comprehensive tutorial. Learn to build responsive web applications with advanced layout techniques.',
        viewCount: 234
      }
    ];

    for (const postData of samplePosts) {
      const post = await prisma.post.upsert({
        where: { slug: postData.slug },
        update: {},
        create: postData
      });

      // Add tags to posts
      const postTags = postData.slug.includes('web-development') 
        ? ['javascript', 'css', 'html', 'tutorial']
        : postData.slug.includes('artificial-intelligence')
        ? ['tutorial', 'tips']
        : ['css', 'tutorial', 'tips'];

      for (const tagSlug of postTags) {
        const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
        if (tag) {
          await prisma.postTag.upsert({
            where: {
              postId_tagId: {
                postId: post.id,
                tagId: tag.id
              }
            },
            update: {},
            create: {
              postId: post.id,
              tagId: tag.id
            }
          });
        }
      }
    }

    console.log('✅ Sample posts created');

    // Create site settings
    const siteSettings = [
      {
        key: 'site_name',
        value: 'My Blog Platform',
        type: 'string',
        description: 'The name of the website'
      },
      {
        key: 'site_description',
        value: 'A modern blog platform built with Node.js and React',
        type: 'string',
        description: 'The description of the website'
      },
      {
        key: 'posts_per_page',
        value: '10',
        type: 'number',
        description: 'Number of posts to display per page'
      },
      {
        key: 'comments_enabled',
        value: 'true',
        type: 'boolean',
        description: 'Whether comments are enabled site-wide'
      }
    ];

    for (const setting of siteSettings) {
      await prisma.siteSettings.upsert({
        where: { key: setting.key },
        update: {},
        create: setting
      });
    }

    console.log('✅ Site settings created');

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📝 Login credentials:');
    console.log('Email: admin@blog.com');
    console.log('Password: admin123456');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedDatabase };

