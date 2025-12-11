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

async function scrapeTikTok(url: string, postId: string | null): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    let views = 0, likes = 0, comments = 0, shares = 0;

    const scriptMatch = html.match(/<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch) {
      try {
        const jsonData = JSON.parse(scriptMatch[1]);
        const defaultScope = jsonData?.__DEFAULT_SCOPE__;
        const videoDetail = defaultScope?.["webapp.video-detail"]?.itemInfo?.itemStruct;
        
        if (videoDetail?.stats) {
          views = videoDetail.stats.playCount || 0;
          likes = videoDetail.stats.diggCount || 0;
          comments = videoDetail.stats.commentCount || 0;
          shares = videoDetail.stats.shareCount || 0;
        }
      } catch (e) {
      }
    }

    if (views === 0 && likes === 0) {
      const sigiMatch = html.match(/<script\s+id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/i);
      if (sigiMatch) {
        try {
          const sigiData = JSON.parse(sigiMatch[1]);
          const itemModule = sigiData?.ItemModule;
          if (itemModule) {
            const videoKey = Object.keys(itemModule)[0];
            if (videoKey && itemModule[videoKey]?.stats) {
              const stats = itemModule[videoKey].stats;
              views = stats.playCount || 0;
              likes = stats.diggCount || 0;
              comments = stats.commentCount || 0;
              shares = stats.shareCount || 0;
            }
          }
        } catch (e) {
        }
      }
    }

    if (views === 0 && likes === 0) {
      const patterns = {
        views: [/"playCount"\s*:\s*(\d+)/i, /"play_count"\s*:\s*(\d+)/i],
        likes: [/"diggCount"\s*:\s*(\d+)/i, /"like_count"\s*:\s*(\d+)/i],
        comments: [/"commentCount"\s*:\s*(\d+)/i, /"comment_count"\s*:\s*(\d+)/i],
        shares: [/"shareCount"\s*:\s*(\d+)/i, /"share_count"\s*:\s*(\d+)/i],
      };

      for (const pattern of patterns.views) {
        const match = html.match(pattern);
        if (match) { views = parseInt(match[1], 10); break; }
      }
      for (const pattern of patterns.likes) {
        const match = html.match(pattern);
        if (match) { likes = parseInt(match[1], 10); break; }
      }
      for (const pattern of patterns.comments) {
        const match = html.match(pattern);
        if (match) { comments = parseInt(match[1], 10); break; }
      }
      for (const pattern of patterns.shares) {
        const match = html.match(pattern);
        if (match) { shares = parseInt(match[1], 10); break; }
      }
    }

    if (views === 0 && likes === 0 && comments === 0 && shares === 0) {
      return {
        success: false,
        error: "TikTok uses anti-bot protection. Engagement data requires API integration.",
        note: "TikTok blocks automated scraping. Consider manual entry or API service.",
      };
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
    };
  } catch (error) {
    return {
      success: false,
      error: "TikTok scraping blocked. Platform requires API access for engagement data.",
    };
  }
}

async function scrapeInstagram(url: string, postId: string | null): Promise<ScrapeResult> {
  try {
    const shortcode = postId;
    if (!shortcode) {
      throw new Error("Could not extract Instagram shortcode from URL");
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    let views = 0, likes = 0, comments = 0, shares = 0;

    const sharedDataMatch = html.match(/window\._sharedData\s*=\s*(\{[\s\S]*?\});<\/script>/);
    if (sharedDataMatch) {
      try {
        const sharedData = JSON.parse(sharedDataMatch[1]);
        const media = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
        if (media) {
          views = media.video_view_count || 0;
          likes = media.edge_media_preview_like?.count || 0;
          comments = media.edge_media_to_parent_comment?.count || media.edge_media_preview_comment?.count || 0;
        }
      } catch (e) {
      }
    }

    if (likes === 0) {
      const patterns = {
        views: [/"video_view_count"\s*:\s*(\d+)/i, /"play_count"\s*:\s*(\d+)/i],
        likes: [/"like_count"\s*:\s*(\d+)/i, /"edge_media_preview_like"\s*:\s*\{\s*"count"\s*:\s*(\d+)/i],
        comments: [/"comment_count"\s*:\s*(\d+)/i, /"edge_media_preview_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/i],
      };

      for (const pattern of patterns.views) {
        const match = html.match(pattern);
        if (match) { views = parseNumber(match[1]); if (views > 0) break; }
      }
      for (const pattern of patterns.likes) {
        const match = html.match(pattern);
        if (match) { likes = parseNumber(match[1]); if (likes > 0) break; }
      }
      for (const pattern of patterns.comments) {
        const match = html.match(pattern);
        if (match) { comments = parseNumber(match[1]); if (comments > 0) break; }
      }
    }

    const metaLikesMatch = html.match(/content="([\d,]+)\s+Likes/i);
    if (metaLikesMatch && likes === 0) {
      likes = parseNumber(metaLikesMatch[1]);
    }
    const metaCommentsMatch = html.match(/content="[\d,]+\s+Likes,\s+([\d,]+)\s+Comments/i);
    if (metaCommentsMatch && comments === 0) {
      comments = parseNumber(metaCommentsMatch[1]);
    }

    if (views === 0 && likes === 0 && comments === 0) {
      return {
        success: false,
        error: "Instagram requires login for engagement data. Manual entry recommended.",
        note: "Instagram blocks automated access. Consider API service or manual entry.",
      };
    }

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
        postId: shortcode || undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: "Instagram scraping blocked. Platform requires authentication for data access.",
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
  
  const postId = extractPostId(url, platform);
  
  switch (platform) {
    case "TikTok":
      return scrapeTikTok(url, postId);
    case "Instagram":
      return scrapeInstagram(url, postId);
    case "Twitter":
      return scrapeTwitter(url, postId);
    case "YouTube":
      return scrapeYouTube(url, postId);
    case "Facebook":
      return scrapeFacebook(url, postId);
    default:
      return {
        success: false,
        error: `Scraping not implemented for ${platform}`,
      };
  }
}

export function getPlatformFromUrl(url: string): string {
  return detectPlatform(url) || "Unknown";
}
