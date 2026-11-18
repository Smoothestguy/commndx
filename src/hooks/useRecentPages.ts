import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export interface RecentPage {
  path: string;
  name: string;
  visitedAt: number;
}

const STORAGE_KEY = 'recentPages';
const MAX_PAGES = 10;

// Map paths to readable names
export const getPageName = (pathname: string): string => {
  const pathMap: Record<string, string> = {
    '/': 'Home',
    '/estimates': 'Estimates',
    '/invoices': 'Invoices',
    '/personnel': 'Personnel',
    '/projects': 'Projects',
    '/customers': 'Customers',
    '/vendors': 'Vendors',
    '/products': 'Products',
    '/time-tracking': 'Time Tracking',
    '/purchase-orders': 'Work Orders',
    '/change-orders': 'Change Orders',
    '/job-orders': 'Job Orders',
    '/settings': 'Settings',
    '/user-management': 'User Management',
    '/documents': 'Documents',
    '/staffing/applications': 'Staffing Applications',
    '/staffing/form-templates': 'Form Templates',
    '/portal': 'Personnel Portal',
    '/vendor': 'Vendor Portal',
  };

  // Check for exact match first
  if (pathMap[pathname]) {
    return pathMap[pathname];
  }

  // Check for dynamic routes
  if (pathname.startsWith('/projects/')) return 'Project Details';
  if (pathname.startsWith('/estimates/')) return 'Estimate Details';
  if (pathname.startsWith('/invoices/')) return 'Invoice Details';
  if (pathname.startsWith('/personnel/')) return 'Personnel Details';
  if (pathname.startsWith('/customers/')) return 'Customer Details';
  if (pathname.startsWith('/vendors/')) return 'Vendor Details';
  if (pathname.startsWith('/purchase-orders/')) return 'PO Details';
  if (pathname.startsWith('/change-orders/')) return 'Change Order Details';
  if (pathname.startsWith('/job-orders/')) return 'Job Order Details';
  if (pathname.startsWith('/staffing/applications/')) return 'Application Details';

  // Fallback: capitalize the last segment
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    return lastSegment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return 'Page';
};

// Paths to exclude from tracking
const EXCLUDED_PATHS = [
  '/auth',
  '/unauthorized',
  '/apply',
  '/onboarding',
];

const shouldTrackPath = (pathname: string): boolean => {
  return !EXCLUDED_PATHS.some(excluded => pathname.startsWith(excluded));
};

export function useRecentPages() {
  const location = useLocation();
  const { user } = useAuth();
  const storageKey = `${STORAGE_KEY}:${user?.id || 'signed-out'}`;
  const [recentPages, setRecentPages] = useState<RecentPage[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { setRecentPages(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { setRecentPages([]); }
  }, [storageKey]);

  useEffect(() => {
    const pathname = location.pathname;
    const path = pathname + location.search + location.hash;
    
    // Don't track excluded paths
    if (!shouldTrackPath(pathname)) {
      return;
    }

    const pageName = getPageName(pathname);
    const newEntry: RecentPage = {
      path,
      name: pageName,
      visitedAt: Date.now(),
    };

    setRecentPages(prev => {
      // Remove existing entry for this path (deduplication)
      const filtered = prev.filter(p => p.path !== path);
      
      // Add new entry at the beginning and limit to max
      const updated = [newEntry, ...filtered].slice(0, MAX_PAGES);
      
      // Save to localStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent pages to localStorage:', e);
      }
      
      return updated;
    });
  }, [location.pathname, location.search, location.hash, storageKey]);

  return recentPages;
}
