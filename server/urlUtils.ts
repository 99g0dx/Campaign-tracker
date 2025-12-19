/**
 * URL normalization utilities for deduplication of social media posts.
 * Normalizes URLs by removing tracking parameters and standardizing format.
 */

const TRACKING_PARAMS = [
  'igsh', 'igshid', 'ig_rid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
  'ref', 'ref_src', 'ref_url',
  'share_id', 'tt_from', 'is_copy_url', 'is_from_webapp',
  'feature', 'app', 'gclid', 'msclkid',
  '_ga', 'mc_cid', 'mc_eid',
];

/**
 * Normalize a social media URL for deduplication purposes.
 * Removes tracking parameters, trailing slashes, and standardizes format.
 */
export function normalizeUrl(url: string): string {
  if (!url || url.startsWith('placeholder://')) {
    return url;
  }

  try {
    let normalized = url.trim();
    
    // Parse the URL
    const parsed = new URL(normalized);
    
    // Remove tracking parameters
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    
    // Remove hash fragment (often used for tracking)
    parsed.hash = '';
    
    // Convert to string and remove trailing slash from path (unless it's just "/")
    let result = parsed.toString();
    
    // Remove trailing slash if it's not the root path
    if (result.endsWith('/') && parsed.pathname !== '/') {
      result = result.slice(0, -1);
    }
    
    // Convert to lowercase for hostname consistency
    const finalUrl = new URL(result);
    finalUrl.hostname = finalUrl.hostname.toLowerCase();
    
    return finalUrl.toString();
  } catch (e) {
    // If URL parsing fails, just trim and return
    return url.trim();
  }
}

/**
 * Extract post ID from URL for platform-specific deduplication.
 */
export function extractPostId(url: string, platform: string): string | null {
  if (!url || url.startsWith('placeholder://')) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    switch (platform.toLowerCase()) {
      case 'instagram': {
        // Instagram formats: /p/CODE/, /reel/CODE/, /reels/CODE/
        const match = path.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);
        return match ? match[2] : null;
      }
      case 'tiktok': {
        // TikTok formats: /@user/video/ID, /video/ID
        const match = path.match(/\/video\/(\d+)/);
        return match ? match[1] : null;
      }
      case 'youtube': {
        // YouTube formats: /watch?v=ID, /shorts/ID, youtu.be/ID
        if (parsed.hostname.includes('youtu.be')) {
          return path.slice(1).split('/')[0] || null;
        }
        const vParam = parsed.searchParams.get('v');
        if (vParam) return vParam;
        const shortsMatch = path.match(/\/shorts\/([A-Za-z0-9_-]+)/);
        return shortsMatch ? shortsMatch[1] : null;
      }
      case 'twitter':
      case 'x': {
        // Twitter/X formats: /user/status/ID
        const match = path.match(/\/status\/(\d+)/);
        return match ? match[1] : null;
      }
      case 'facebook': {
        // Facebook is complex, just use normalized URL
        return null;
      }
      default:
        return null;
    }
  } catch (e) {
    return null;
  }
}

/**
 * Generate a unique post key for deduplication.
 * Format: platform:postId or platform:normalizedUrl
 */
export function generatePostKey(url: string, platform: string): string {
  const postId = extractPostId(url, platform);
  if (postId) {
    return `${platform.toLowerCase()}:${postId}`;
  }
  return `${platform.toLowerCase()}:${normalizeUrl(url)}`;
}

/**
 * Check if a social link should be included in metrics calculations.
 * Excludes pending posts and placeholder URLs.
 */
export function shouldIncludeInMetrics(link: {
  url: string;
  postStatus: string;
  status?: string;
}): boolean {
  // Exclude placeholder URLs
  if (!link.url || link.url.startsWith('placeholder://')) {
    return false;
  }
  
  // Include posts with postStatus of 'briefed', 'active', or 'done'
  // Exclude 'pending' posts as they don't have actual URLs yet
  const validStatuses = ['briefed', 'active', 'done'];
  return validStatuses.includes(link.postStatus);
}
