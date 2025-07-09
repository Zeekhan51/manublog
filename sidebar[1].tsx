'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';
import {
  LayoutDashboard,
  FileText,
  Image,
  MessageSquare,
  Users,
  Settings,
  BarChart3,
  Search,
  Archive,
  Shield,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onLogout?: () => void;
}

export function AdminSidebar({ darkMode, onToggleDarkMode, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const navigation = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
      current: pathname === '/admin',
    },
    {
      name: 'Posts',
      href: '/admin/posts',
      icon: FileText,
      current: pathname.startsWith('/admin/posts'),
    },
    {
      name: 'Media Library',
      href: '/admin/media',
      icon: Image,
      current: pathname.startsWith('/admin/media'),
    },
    {
      name: 'Comments',
      href: '/admin/comments',
      icon: MessageSquare,
      current: pathname.startsWith('/admin/comments'),
    },
    {
      name: 'Users',
      href: '/admin/users',
      icon: Users,
      current: pathname.startsWith('/admin/users'),
    },
    {
      name: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
      current: pathname.startsWith('/admin/analytics'),
    },
    {
      name: 'SEO',
      href: '/admin/seo',
      icon: Search,
      current: pathname.startsWith('/admin/seo'),
    },
    {
      name: 'Backup',
      href: '/admin/backup',
      icon: Archive,
      current: pathname.startsWith('/admin/backup'),
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: Settings,
      current: pathname.startsWith('/admin/settings'),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-gray-200 dark:border-gray-700">
        <Link href="/admin" className="flex items-center">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
            Admin Panel
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                item.current
                  ? 'bg-primary text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  item.current
                    ? 'text-white'
                    : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">Theme</span>
          {onToggleDarkMode && (
            <Button variant="ghost" size="sm" onClick={onToggleDarkMode}>
              {darkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        
        <div className="space-y-2">
          <Link href="/" className="w-full">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              View Site
            </Button>
          </Link>
          
          {onLogout && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

