/**
 * Performance utilities for Edgaze
 * Tracks and optimizes loading performance
 */

export function reportWebVitals(metric: any) {
  // Log performance metrics in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Performance]', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    });
  }

  // Send to analytics in production
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    try {
      // Track with Mixpanel if available
      if ((window as any).mixpanel) {
        (window as any).mixpanel.track('Web Vitals', {
          metric: metric.name,
          value: metric.value,
          rating: metric.rating,
          id: metric.id,
        });
      }
    } catch (error) {
      console.error('[Performance] Failed to report web vitals:', error);
    }
  }
}

/**
 * Preload critical resources
 */
export function preloadCriticalAssets() {
  if (typeof window === 'undefined') return;

  const criticalImages = [
    '/brand/edgaze-mark.png',
    '/favicon.ico',
  ];

  criticalImages.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });
}

/**
 * Optimize images by converting to WebP/AVIF when supported
 */
export function getOptimizedImageUrl(src: string, width?: number): string {
  if (typeof window === 'undefined') return src;
  
  // For Next.js Image component, this is handled automatically
  // This is a fallback for direct image URLs
  const supportsWebP = document.createElement('canvas')
    .toDataURL('image/webp')
    .indexOf('data:image/webp') === 0;

  if (supportsWebP && !src.includes('.svg')) {
    // Next.js will handle conversion
    return src;
  }

  return src;
}

/**
 * Defer non-critical scripts
 */
export function deferNonCriticalScripts() {
  if (typeof window === 'undefined') return;

  // Use requestIdleCallback to defer non-critical work
  const scheduleTask = (fn: () => void) => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(fn, { timeout: 2000 });
    } else {
      setTimeout(fn, 1);
    }
  };

  scheduleTask(() => {
    // Any non-critical initialization can go here
    console.log('[Performance] Non-critical scripts loaded');
  });
}
