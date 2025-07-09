'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, User, ArrowRight, TrendingUp } from 'lucide-react';
import { postsAPI } from '@/lib/api';
import { Post } from '@/types';

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await postsAPI.getPosts({ limit: 6, sortBy: 'publishedAt', sortOrder: 'desc' });
      setPosts(response.data.posts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getReadingTime = (content: string) => {
    const wordsPerMinute = 200;
    const words = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Welcome to Our
              <span className="text-primary block">Blog Platform</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Discover insightful articles, tutorials, and stories from our community of writers. 
              Built with modern web technologies and optimized for performance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/blog">
                <Button size="lg" className="w-full sm:w-auto">
                  Explore Articles
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/about">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Posts */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Latest Articles
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Stay up to date with our newest content
              </p>
            </div>
            <Link href="/blog">
              <Button variant="outline">
                View All Posts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-t-lg" />
                  <CardHeader>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Card key={post.id} className="group hover:shadow-lg transition-shadow duration-300">
                  {post.featuredImage && (
                    <div className="relative h-48 overflow-hidden rounded-t-lg">
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      {post.category && (
                        <Badge variant="secondary" style={{ backgroundColor: post.category.color + '20', color: post.category.color }}>
                          {post.category.name}
                        </Badge>
                      )}
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        {post.viewCount} views
                      </div>
                    </div>
                    <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                      <Link href={`/blog/${post.slug}`}>
                        {post.title}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300 line-clamp-3 mb-4">
                      {post.excerpt || post.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...'}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        {post.author.firstName && post.author.lastName
                          ? `${post.author.firstName} ${post.author.lastName}`
                          : post.author.username}
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <CalendarDays className="h-4 w-4 mr-1" />
                          {formatDate(post.publishedAt || post.createdAt)}
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {getReadingTime(post.content)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Platform Features
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Built with modern technologies and best practices for performance, SEO, and user experience.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-6 w-6 text-primary mr-2" />
                  SEO Optimized
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Built-in SEO optimization with meta tags, structured data, and performance optimization.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-6 w-6 text-primary mr-2" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Complete user management system with roles, permissions, and authentication.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ArrowRight className="h-6 w-6 text-primary mr-2" />
                  Modern Stack
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Built with Next.js, Node.js, TypeScript, and Tailwind CSS for modern development.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

