import { getProviderManager } from './scrapers/providerManager';

interface ScrapedData {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  postId?: string;
}

interface ScrapeResult {
  success: boolean;
  data?: ScrapedData;
  error?: string;
  note?: string;
}

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

// Retry logic with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  shouldRetry?: (result: T) => boolean
): Promise<T> {
  let lastResult: T;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      lastResult = await fn();
      
      // If we have a custom retry condition, check it
      if (shouldRetry && shouldRetry(lastResult)) {
        if (attempt < maxRetries - 1) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return lastResult;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`Error on attempt ${attempt + 1}/${maxRetries}, retrying after ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  return lastResult!;
}

function detectPlatform(url: string): string | null {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("tiktok.com")) return "TikTok";
  if (urlLower.includes("instagram.com")) return "Instagram";
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) return "YouTube";
  if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) return "Twitter";
  if (urlLower.includes("facebook.com") || urlLower.includes("fb.com")) return "Facebook";
  return null;
}

function extractPostId(url: string, platform: string): string | null {
  try {
    const urlObj = new URL(url);
    
    switch (platform) {
      case "TikTok": {
        const match = url.match(/video\/(\d+)/);
        if (match) return match[1];
        const vmMatch = url.match(/tiktok\.com\/@[^\/]+\/video\/(\d+)/);
        return vmMatch ? vmMatch[1] : null;
      }
      case "Instagram": {
        const match = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);
        return match ? match[2] : null;
      }
      case "YouTube": {
        if (urlObj.hostname.includes("youtu.be")) {
          return urlObj.pathname.slice(1).split("?")[0];
        }
        return urlObj.searchParams.get("v");
      }
      case "Twitter": {
        const match = url.match(/status\/(\d+)/);
        return match ? match[1] : null;
      }
      case "Facebook": {
        const match = url.match(/\/(\d+)\/?$/);
        return match ? match[1] : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function parseNumber(str: string): number {
  if (!str) return 0;
  
  const cleaned = str.replace(/[,\s]/g, "").toLowerCase();
  
  const multipliers: Record<string, number> = {
    k: 1000,
    m: 1000000,
    b: 1000000000,
  };
  
  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (cleaned.endsWith(suffix)) {
      const num = parseFloat(cleaned.slice(0, -1));
      return Math.round(num * multiplier);
    }
  }
  
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

async function scrapeTikTokWithApify(url: string, postId: string | null): Promise<ScrapeResult> {
  if (!APIFY_API_TOKEN) {
    return {
      success: false,
      error: "Apify API token not configured. Please add APIFY_API_TOKEN to secrets.",
    };
  }

  try {
    // Using clockworks/tiktok-video-scraper - specifically designed for single video URLs
    const actorId = "clockworks~tiktok-video-scraper";
    const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`;
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        postURLs: [url],
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Apify TikTok error:", response.status, errorText);
      if (response.status === 402) {
        return {
          success: false,
          error: "Apify credit limit reached. Please add more credits to your Apify account.",
        };
      }
      return {
        success: false,
        error: `Apify API error: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }

    const results = await response.json();
    console.log("Apify TikTok response:", JSON.stringify(results[0], null, 2));
    
    if (!results || results.length === 0) {
      return {
        success: false,
        error: "No data returned from TikTok scraper. The post may be private or deleted.",
      };
    }

    const video = results[0];
    
    if (video.error) {
      return {
        success: false,
        error: video.error,
      };
    }

    // clockworks video scraper fields: playCount/plays, diggCount/hearts, commentCount, shareCount
    const views = video.playCount || video.plays || 0;
    const likes = video.diggCount || video.hearts || 0;
    const comments = video.commentCount || 0;
    const shares = video.shareCount || 0;

    const totalEngagement = likes + comments + shares;
    const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

    return {
      success: true,
      data: {
        views,
        likes,
        comments,
        shares,
        engagementRate: Math.round(engagementRate * 100) / 100,
        postId: postId || video.id || undefined,
      },
      note: "Data scraped via Apify (clockworks video scraper)",
    };
  } catch (error) {
    console.error("Apify TikTok scraping error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape TikTok via Apify",
    };
  }
}

async function scrapeInstagramWithApify(url: string, postId: string | null): Promise<ScrapeResult> {
  if (!APIFY_API_TOKEN) {
    return {
      success: false,
      error: "Apify API token not configured. Please add APIFY_API_TOKEN to secrets.",
    };
  }

  try {
    const actorId = "apify~instagram-scraper";
    const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`;
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        directUrls: [url],
        resultsLimit: 1,
        resultsType: "posts",
        addParentData: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Apify Instagram error:", response.status, errorText);
      if (response.status === 402) {
        return {
          success: false,
          error: "Apify credit limit reached. Please add more credits to your Apify account.",
        };
      }
      throw new Error(`Apify API error: ${response.status}`);
    }

    const results = await response.json();
    
    if (!results || results.length === 0) {
      return {
        success: false,
        error: "No data returned from Instagram scraper. The post may be private or deleted.",
      };
    }

    const post = results[0];
    const views = post.videoViewCount || post.videoPlayCount || 0;
    const likes = post.likesCount || post.likes || 0;
    const comments = post.commentsCount || post.comments || 0;
    const shares = 0;

    const totalEngagement = likes + comments + shares;
    const engagementRate = views > 0 ? (totalEngagement / views) * 100 : (likes > 0 ? 100 : 0);

    return {
      success: true,
      data: {
        views,
        likes,
        comments,
        shares,
        engagementRate: Math.round(engagementRate * 100) / 100,
        postId: postId || post.shortCode || undefined,
      },
      note: "Data scraped via Apify",
    };
  } catch (error) {
    console.error("Apify Instagram scraping error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape Instagram via Apify",
    };
  }
}

async function scrapeTwitter(url: string, postId: string | null): Promise<ScrapeResult> {
  try {
    if (!postId) {
      throw new Error("Could not extract tweet ID from URL");
    }

    const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${postId}&lang=en&token=0`;
    
    const response = await fetch(syndicationUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://platform.twitter.com/",
        "Origin": "https://platform.twitter.com",
      },
    });

    if (response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        
        const likes = data.favorite_count || 0;
        const comments = data.reply_count || data.conversation_count || 0;
        const shares = data.retweet_count || 0;
        const views = data.views_count || data.view_count || 0;

        if (likes > 0 || comments > 0 || shares > 0 || views > 0) {
          const totalEngagement = likes + comments + shares;
          const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

          return {
            success: true,
            data: {
              views,
              likes,
              comments,
              shares,
              engagementRate: Math.round(engagementRate * 100) / 100,
              postId,
            },
          };
        }
      }
    }

    return {
      success: false,
      error: "X/Twitter API access restricted. Engagement data requires API subscription.",
      note: "X now requires paid API access for tweet metrics.",
    };
  } catch (error) {
    return {
      success: false,
      error: "X/Twitter scraping unavailable. Platform requires paid API access.",
    };
  }
}

async function scrapeYouTube(url: string, postId: string | null): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    let views = 0, likes = 0, comments = 0, shares = 0;

    const viewMatch = html.match(/"viewCount"\s*:\s*"(\d+)"/);
    if (viewMatch) views = parseInt(viewMatch[1], 10);

    const likePatterns = [
      /"likeCount"\s*:\s*"?(\d+)"?/,
      /like this video along with ([\d,]+) other people/i,
      /"likes"\s*:\s*\{\s*"simpleText"\s*:\s*"([\d,KMB]+)"/i,
    ];
    
    for (const pattern of likePatterns) {
      const match = html.match(pattern);
      if (match) { 
        likes = parseNumber(match[1]); 
        if (likes > 0) break; 
      }
    }

    const commentMatch = html.match(/"commentCount"\s*:\s*"?(\d+)"?/);
    if (commentMatch) comments = parseInt(commentMatch[1], 10);

    if (views === 0) {
      const metaViewMatch = html.match(/<meta\s+itemprop="interactionCount"\s+content="(\d+)"/i);
      if (metaViewMatch) views = parseInt(metaViewMatch[1], 10);
    }

    const totalEngagement = likes + comments + shares;
    const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

    return {
      success: true,
      data: {
        views,
        likes,
        comments,
        shares,
        engagementRate: Math.round(engagementRate * 100) / 100,
        postId: postId || undefined,
      },
      note: views > 0 ? undefined : "Some metrics may be limited without API access",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape YouTube",
    };
  }
}

async function scrapeFacebook(url: string, postId: string | null): Promise<ScrapeResult> {
  return {
    success: false,
    error: "Facebook requires authentication for engagement data.",
    note: "Facebook blocks automated access. Manual entry or API integration required.",
  };
}

export async function scrapeSocialLink(url: string): Promise<ScrapeResult> {
  const platform = detectPlatform(url);

  if (!platform) {
    return {
      success: false,
      error: "Unsupported platform. Supported: TikTok, Instagram, YouTube, Twitter, Facebook",
    };
  }

  const platformLower = platform.toLowerCase() as 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook';

  // Special handling for platforms not yet supported by managed providers
  if (platform === "YouTube") {
    // Use legacy YouTube scraper (HTML parsing)
    const postId = extractPostId(url, platform);
    const shouldRetryResult = (result: ScrapeResult): boolean => {
      if (result.success) return false;
      const permanentErrors = ["not configured", "private or deleted", "authentication required"];
      const errorLower = (result.error || "").toLowerCase();
      return !permanentErrors.some(err => errorLower.includes(err.toLowerCase()));
    };
    return withRetry(() => scrapeYouTube(url, postId), 2, 500, shouldRetryResult);
  }

  if (platform === "Facebook") {
    return scrapeFacebook(url, null);
  }

  // Use new provider system for TikTok, Instagram, Twitter
  try {
    const manager = getProviderManager();
    const result = await manager.scrape(url, platformLower);

    // Add note field for compatibility
    return {
      ...result,
      note: result.success ? `Scraped via ${result.provider}` : undefined,
    };
  } catch (error) {
    console.error(`Failed to scrape ${platform}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Scraping failed",
    };
  }
}

export function getPlatformFromUrl(url: string): string {
  return detectPlatform(url) || "Unknown";
}
