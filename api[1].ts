import axios from 'axios';
import { Post, User, Media, Comment } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/api/auth/login', credentials),
  
  logout: () => api.post('/api/auth/logout'),
  
  getProfile: () => api.get('/api/auth/me'),
  
  updateProfile: (data: Partial<User>) => api.put('/api/auth/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/api/auth/change-password', data),
};

// Posts API
export const postsAPI = {
  getPosts: (params?: Record<string, unknown>) => api.get('/api/posts', { params }),
  
  getPost: (slug: string) => api.get(`/api/posts/${slug}`),
  
  createPost: (data: Partial<Post>) => api.post('/api/posts', data),
  
  updatePost: (id: string, data: Partial<Post>) => api.put(`/api/posts/${id}`, data),
  
  deletePost: (id: string) => api.delete(`/api/posts/${id}`),
  
  getStats: () => api.get('/api/posts/stats/overview'),
};

// Media API
export const mediaAPI = {
  uploadFiles: (formData: FormData) =>
    api.post('/api/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  getMedia: (params?: Record<string, unknown>) => api.get('/api/media', { params }),
  
  updateMedia: (id: string, data: Partial<Media>) => api.put(`/api/media/${id}`, data),
  
  deleteMedia: (id: string) => api.delete(`/api/media/${id}`),
};

// Analytics API
export const analyticsAPI = {
  trackView: (data: { postId: string; referrer?: string }) =>
    api.post('/api/analytics/track-view', data),
  
  getDashboard: (params?: Record<string, unknown>) => api.get('/api/analytics/dashboard', { params }),
  
  getPostAnalytics: (postId: string, params?: Record<string, unknown>) =>
    api.get(`/api/analytics/posts/${postId}`, { params }),
  
  getOverview: () => api.get('/api/analytics/overview'),
};

// Comments API
export const commentsAPI = {
  getComments: (params?: Record<string, unknown>) => api.get('/api/comments', { params }),
  
  getPostComments: (postId: string, params?: Record<string, unknown>) =>
    api.get(`/api/comments/post/${postId}`, { params }),
  
  createComment: (data: Partial<Comment>) => api.post('/api/comments', data),
  
  updateCommentStatus: (id: string, status: string) =>
    api.put(`/api/comments/${id}/status`, { status }),
  
  deleteComment: (id: string) => api.delete(`/api/comments/${id}`),
  
  bulkAction: (data: { action: string; commentIds: string[] }) =>
    api.post('/api/comments/bulk-action', data),
  
  getStats: () => api.get('/api/comments/stats'),
};

// SEO API
export const seoAPI = {
  analyze: (data: Record<string, unknown>) => api.post('/api/seo/analyze', data),
  
  generateSlug: (data: { title: string; postId?: string }) =>
    api.post('/api/seo/generate-slug', data),
  
  getMetaPreview: (params: Record<string, unknown>) => api.get('/api/seo/meta-preview', { params }),
  
  getSuggestions: () => api.get('/api/seo/suggestions'),
};

// Backup API
export const backupAPI = {
  createBackup: (data?: Record<string, unknown>) => api.post('/api/backup/create', data),
  
  getBackups: (params?: Record<string, unknown>) => api.get('/api/backup/list', { params }),
  
  downloadBackup: (id: string) => api.get(`/api/backup/download/${id}`),
  
  deleteBackup: (id: string) => api.delete(`/api/backup/${id}`),
  
  getSchedule: () => api.get('/api/backup/schedule'),
  
  updateSchedule: (data: Record<string, unknown>) => api.post('/api/backup/schedule', data),
};

export default api;

