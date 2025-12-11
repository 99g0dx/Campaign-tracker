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
        return match ? match[1] : null;
      }
      case "Instagram": {
        const match = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);
        return match ? match[2] : null;
      }
      case "YouTube": {
        if (urlObj.hostname.includes("youtu.be")) {
          return urlObj.pathname.slice(1);
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

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch page: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

function extractMetaTags(html: string): Record<string, string> {
  const metaTags: Record<string, string> = {};
  
  const ogRegex = /<meta\s+(?:property|name)=["']og:([^"']+)["']\s+content=["']([^"']*)["']/gi;
  let match;
  while ((match = ogRegex.exec(html)) !== null) {
    metaTags[`og:${match[1]}`] = match[2];
  }
  
  const twitterRegex = /<meta\s+(?:property|name)=["']twitter:([^"']+)["']\s+content=["']([^"']*)["']/gi;
  while ((match = twitterRegex.exec(html)) !== null) {
    metaTags[`twitter:${match[1]}`] = match[2];
  }
  
  return metaTags;
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

function extractNumbers(html: string): { views: number; likes: number; comments: number; shares: number } {
  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  
  const viewPatterns = [
    /(\d[\d,\.]*[KMB]?)\s*(?:views|plays|impressions)/i,
    /views?[:\s]+(\d[\d,\.]*[KMB]?)/i,
    /"viewCount"[:\s]*"?(\d+)"?/i,
    /"playCount"[:\s]*(\d+)/i,
  ];
  
  for (const pattern of viewPatterns) {
    const match = html.match(pattern);
    if (match) {
      views = parseNumber(match[1]);
      if (views > 0) break;
    }
  }
  
  const likePatterns = [
    /(\d[\d,\.]*[KMB]?)\s*(?:likes?|hearts?)/i,
    /likes?[:\s]+(\d[\d,\.]*[KMB]?)/i,
    /"likeCount"[:\s]*"?(\d+)"?/i,
    /"diggCount"[:\s]*(\d+)/i,
  ];
  
  for (const pattern of likePatterns) {
    const match = html.match(pattern);
    if (match) {
      likes = parseNumber(match[1]);
      if (likes > 0) break;
    }
  }
  
  const commentPatterns = [
    /(\d[\d,\.]*[KMB]?)\s*comments?/i,
    /comments?[:\s]+(\d[\d,\.]*[KMB]?)/i,
    /"commentCount"[:\s]*"?(\d+)"?/i,
  ];
  
  for (const pattern of commentPatterns) {
    const match = html.match(pattern);
    if (match) {
      comments = parseNumber(match[1]);
      if (comments > 0) break;
    }
  }
  
  const sharePatterns = [
    /(\d[\d,\.]*[KMB]?)\s*shares?/i,
    /shares?[:\s]+(\d[\d,\.]*[KMB]?)/i,
    /"shareCount"[:\s]*"?(\d+)"?/i,
  ];
  
  for (const pattern of sharePatterns) {
    const match = html.match(pattern);
    if (match) {
      shares = parseNumber(match[1]);
      if (shares > 0) break;
    }
  }
  
  return { views, likes, comments, shares };
}

export async function scrapeSocialLink(url: string): Promise<ScrapeResult> {
  const platform = detectPlatform(url);
  
  if (!platform) {
    return {
      success: false,
      error: "Unsupported platform. Supported: TikTok, Instagram, YouTube, Twitter, Facebook",
    };
  }
  
  const postId = extractPostId(url, platform);
  
  try {
    const html = await fetchPageContent(url);
    const metaTags = extractMetaTags(html);
    const numbers = extractNumbers(html);
    
    const totalEngagement = numbers.likes + numbers.comments + numbers.shares;
    const engagementRate = numbers.views > 0 ? (totalEngagement / numbers.views) * 100 : 0;
    
    return {
      success: true,
      data: {
        views: numbers.views,
        likes: numbers.likes,
        comments: numbers.comments,
        shares: numbers.shares,
        engagementRate: Math.round(engagementRate * 100) / 100,
        postId: postId || undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape content",
    };
  }
}

export function getPlatformFromUrl(url: string): string {
  return detectPlatform(url) || "Unknown";
}
