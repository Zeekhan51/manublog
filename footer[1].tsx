import Link from 'next/link';
import { Github, Twitter, Linkedin, Rss } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    blog: [
      { name: 'Latest Posts', href: '/blog' },
      { name: 'Categories', href: '/categories' },
      { name: 'Tags', href: '/tags' },
      { name: 'Archive', href: '/archive' },
    ],
    company: [
      { name: 'About', href: '/about' },
      { name: 'Contact', href: '/contact' },
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
    ],
    resources: [
      { name: 'RSS Feed', href: '/rss' },
      { name: 'Sitemap', href: '/sitemap.xml' },
      { name: 'Admin', href: '/admin' },
      { name: 'API Docs', href: '/api/docs' },
    ],
  };

  const socialLinks = [
    { name: 'GitHub', href: '#', icon: Github },
    { name: 'Twitter', href: '#', icon: Twitter },
    { name: 'LinkedIn', href: '#', icon: Linkedin },
    { name: 'RSS', href: '/rss', icon: Rss },
  ];

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
                Blog Platform
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              A modern blog platform built with Next.js and Node.js, featuring 
              WordPress-like functionality with advanced SEO and analytics.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-gray-400 hover:text-primary transition-colors duration-200"
                  >
                    <span className="sr-only">{item.name}</span>
                    <Icon className="h-5 w-5" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Blog Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Blog
            </h3>
            <ul className="space-y-2">
              {footerLinks.blog.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors duration-200 text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Company
            </h3>
            <ul className="space-y-2">
              {footerLinks.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors duration-200 text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Resources
            </h3>
            <ul className="space-y-2">
              {footerLinks.resources.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors duration-200 text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              © {currentYear} Blog Platform. All rights reserved.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 md:mt-0">
              Built with ❤️ using Next.js and Node.js
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

