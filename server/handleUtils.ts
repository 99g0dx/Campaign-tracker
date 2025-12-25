/**
 * Handle normalization and extraction utilities for creator matching
 */

/**
 * Normalizes a creator handle for consistent matching
 *
 * Rules:
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove leading "@" symbol
 * - Remove trailing slashes
 * - Collapse multiple spaces to single space
 *
 * @param handle - The raw handle/username to normalize
 * @returns Normalized handle for matching
 */
export function normalizeHandle(handle: string): string {
  if (!handle) return '';

  return handle
    .trim()                           // Remove leading/trailing whitespace
    .toLowerCase()                    // Case-insensitive matching
    .replace(/^@+/, '')              // Remove leading @ symbols
    .replace(/\/+$/, '')             // Remove trailing slashes
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .trim();                          // Final trim after transformations
}

/**
 * Extracts creator handle from a social media URL
 *
 * @param url - The social media post URL
 * @param platform - The platform (TikTok, Instagram, YouTube, Twitter, Facebook)
 * @returns Extracted handle or null if not found
 */
export function extractHandleFromUrl(url: string, platform: string): string | null {
  if (!url || !platform) return null;

  try {
    const urlLower = url.toLowerCase();
    const platformLower = platform.toLowerCase();

    // TikTok: https://tiktok.com/@username/video/123456
    if (platformLower === 'tiktok') {
      const match = url.match(/@([a-zA-Z0-9._]+)/);
      return match ? match[1] : null;
    }

    // Instagram: https://instagram.com/username/p/ABC123 or https://instagram.com/p/ABC123
    if (platformLower === 'instagram') {
      // Try to find handle in URL (may not always be present in post URLs)
      const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)\/(p|reel|reels)\//i);
      if (match && match[1] !== 'p' && match[1] !== 'reel' && match[1] !== 'reels') {
        return match[1];
      }
      return null; // Instagram post URLs often don't include the handle
    }

    // Twitter/X: https://twitter.com/username/status/123456 or https://x.com/username/status/123456
    if (platformLower === 'twitter' || platformLower === 'x') {
      const match = url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\//i);
      return match ? match[1] : null;
    }

    // YouTube: https://youtube.com/@username or https://youtube.com/c/username
    if (platformLower === 'youtube') {
      // Check for @handle format
      const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9._-]+)/i);
      if (handleMatch) return handleMatch[1];

      // Check for /c/ channel format
      const channelMatch = url.match(/youtube\.com\/c\/([a-zA-Z0-9._-]+)/i);
      if (channelMatch) return channelMatch[1];

      // YouTube watch URLs don't reliably contain handle
      return null;
    }

    // Facebook: Variable formats, hard to extract reliably
    if (platformLower === 'facebook') {
      // Try to extract from profile.php?id= or /username/ formats
      const profileMatch = url.match(/facebook\.com\/([a-zA-Z0-9._-]+)\/?(?:posts|videos|photos)/i);
      if (profileMatch && profileMatch[1] !== 'profile.php') {
        return profileMatch[1];
      }
      return null;
    }

    return null;
  } catch (error) {
    console.error('Error extracting handle from URL:', error);
    return null;
  }
}

/**
 * Creates a unique key for deduplication based on campaign, handle, and platform
 *
 * @param campaignId - The campaign ID
 * @param handle - The creator handle
 * @param platform - The platform (optional)
 * @returns Unique deduplication key
 */
export function createCreatorKey(campaignId: number, handle: string, platform?: string): string {
  const normalizedHandle = normalizeHandle(handle);
  if (platform && platform.toLowerCase() !== 'unknown') {
    return `${campaignId}:${normalizedHandle}:${platform.toLowerCase()}`;
  }
  return `${campaignId}:${normalizedHandle}`;
}

/**
 * Validates if a handle looks valid
 *
 * @param handle - The handle to validate
 * @returns True if handle appears valid
 */
export function isValidHandle(handle: string): boolean {
  if (!handle) return false;
  const normalized = normalizeHandle(handle);

  // Must have at least 1 character after normalization
  // Should contain only valid username characters
  return normalized.length > 0 && /^[a-z0-9._-]+$/.test(normalized);
}
