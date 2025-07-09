const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test routes one by one
try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.log('❌ Auth routes error:', error.message);
}

try {
  app.use('/api/posts', require('./routes/posts'));
  console.log('✅ Posts routes loaded');
} catch (error) {
  console.log('❌ Posts routes error:', error.message);
}

try {
  app.use('/api/media', require('./routes/media'));
  console.log('✅ Media routes loaded');
} catch (error) {
  console.log('❌ Media routes error:', error.message);
}

try {
  app.use('/api/analytics', require('./routes/analytics'));
  console.log('✅ Analytics routes loaded');
} catch (error) {
  console.log('❌ Analytics routes error:', error.message);
}

try {
  app.use('/api/backup', require('./routes/backup'));
  console.log('✅ Backup routes loaded');
} catch (error) {
  console.log('❌ Backup routes error:', error.message);
}

try {
  app.use('/api/seo', require('./routes/seo'));
  console.log('✅ SEO routes loaded');
} catch (error) {
  console.log('❌ SEO routes error:', error.message);
}

try {
  app.use('/api/comments', require('./routes/comments'));
  console.log('✅ Comments routes loaded');
} catch (error) {
  console.log('❌ Comments routes error:', error.message);
}

try {
  app.get('/sitemap.xml', require('./routes/sitemap'));
  console.log('✅ Sitemap routes loaded');
} catch (error) {
  console.log('❌ Sitemap routes error:', error.message);
}

try {
  app.use('/rss', require('./routes/rss'));
  console.log('✅ RSS routes loaded');
} catch (error) {
  console.log('❌ RSS routes error:', error.message);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test server running on port ${PORT}`);
});

