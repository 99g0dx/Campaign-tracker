/**
 * Live Tracking Engine
 * Background job that scrapes all active posts every 10 minutes
 * to keep engagement metrics up to date.
 */

import { storage } from "./storage";
import { scrapeSocialLink } from "./scraper";
import { normalizeUrl, generatePostKey } from "./urlUtils";
import pLimit from "p-limit";

const SCRAPE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
// Configurable via environment variables
const MAX_CONCURRENT_SCRAPES = parseInt(process.env.SCRAPING_CONCURRENCY || '5', 10);
const MAX_RETRIES = parseInt(process.env.SCRAPING_MAX_RETRIES || '2', 10);
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

console.log(`[LiveTracker] Configured with concurrency=${MAX_CONCURRENT_SCRAPES}, maxRetries=${MAX_RETRIES}`);

let isTrackerRunning = false;
let lastTrackingRun: Date | null = null;
let nextScheduledRun: Date | null = null;

interface TrackingStats {
  totalPosts: number;
  successfulScrapes: number;
  failedScrapes: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  isRunning: boolean;
}

export function getTrackingStats(): TrackingStats {
  return {
    totalPosts: 0, // Updated during runs
    successfulScrapes: 0,
    failedScrapes: 0,
    lastRunAt: lastTrackingRun?.toISOString() || null,
    nextRunAt: nextScheduledRun?.toISOString() || null,
    isRunning: isTrackerRunning,
  };
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scrape a single post with retry logic
 */
async function scrapeWithRetry(
  linkId: number, 
  url: string, 
  platform: string
): Promise<{ success: boolean; views?: number; likes?: number; comments?: number; shares?: number }> {
  let lastError: string | null = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(RETRY_DELAYS[attempt - 1] || 4000);
      }
      
      const result = await scrapeSocialLink(url);
      
      if (result.success && result.data) {
        // Update canonical URL if not set
        const canonicalUrl = normalizeUrl(url);
        const postKey = generatePostKey(url, platform);
        await storage.updateSocialLinkCanonicalUrl(linkId, canonicalUrl, postKey);
        
        // Update link with scraped data
        await storage.updateSocialLink(linkId, {
          views: result.data.views || 0,
          likes: result.data.likes || 0,
          comments: result.data.comments || 0,
          shares: result.data.shares || 0,
          status: "scraped",
          lastScrapedAt: new Date(),
          errorMessage: null,
        });
        
        // Save engagement snapshot for history
        const totalEngagement = (result.data.likes || 0) + (result.data.comments || 0) + (result.data.shares || 0);
        await storage.createEngagementSnapshot({
          socialLinkId: linkId,
          views: result.data.views || 0,
          likes: result.data.likes || 0,
          comments: result.data.comments || 0,
          shares: result.data.shares || 0,
          totalEngagement,
        });
        
        return { 
          success: true,
          views: result.data.views,
          likes: result.data.likes,
          comments: result.data.comments,
          shares: result.data.shares,
        };
      }
      
      lastError = result.error || "Unknown error";
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }
  }
  
  // All retries failed
  await storage.updateSocialLink(linkId, {
    status: "error",
    errorMessage: `Live tracking failed: ${lastError}`,
  });
  
  return { success: false };
}

/**
 * Run a single tracking cycle - scrape all active posts
 */
export async function runTrackingCycle(): Promise<{
  total: number;
  successful: number;
  failed: number;
}> {
  if (isTrackerRunning) {
    console.log("[LiveTracker] Already running, skipping cycle");
    return { total: 0, successful: 0, failed: 0 };
  }
  
  isTrackerRunning = true;
  lastTrackingRun = new Date();
  
  console.log("[LiveTracker] Starting tracking cycle...");
  
  try {
    // Get all active posts that should be tracked
    const activePosts = await storage.getActivePostsForScraping();
    console.log(`[LiveTracker] Found ${activePosts.length} active posts to track`);
    
    if (activePosts.length === 0) {
      return { total: 0, successful: 0, failed: 0 };
    }
    
    // Use concurrency limiter
    const limit = pLimit(MAX_CONCURRENT_SCRAPES);
    let successful = 0;
    let failed = 0;
    
    const tasks = activePosts.map(post => 
      limit(async () => {
        const result = await scrapeWithRetry(post.id, post.url, post.platform);
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
        return result;
      })
    );
    
    await Promise.all(tasks);
    
    console.log(`[LiveTracker] Cycle complete: ${successful} successful, ${failed} failed out of ${activePosts.length}`);
    
    return { 
      total: activePosts.length, 
      successful, 
      failed 
    };
  } catch (error) {
    console.error("[LiveTracker] Tracking cycle error:", error);
    return { total: 0, successful: 0, failed: 0 };
  } finally {
    isTrackerRunning = false;
  }
}

/**
 * Start the live tracking scheduler
 */
let trackingInterval: NodeJS.Timeout | null = null;

export function startLiveTracker(): void {
  if (trackingInterval) {
    console.log("[LiveTracker] Already started");
    return;
  }
  
  console.log(`[LiveTracker] Starting with ${SCRAPE_INTERVAL_MS / 60000} minute interval`);
  
  // Schedule next run
  function scheduleNextRun() {
    nextScheduledRun = new Date(Date.now() + SCRAPE_INTERVAL_MS);
    trackingInterval = setTimeout(async () => {
      await runTrackingCycle();
      scheduleNextRun();
    }, SCRAPE_INTERVAL_MS);
  }
  
  scheduleNextRun();
}

export function stopLiveTracker(): void {
  if (trackingInterval) {
    clearTimeout(trackingInterval);
    trackingInterval = null;
    nextScheduledRun = null;
    console.log("[LiveTracker] Stopped");
  }
}

/**
 * Get the current status of the live tracker
 */
export function getLiveTrackerStatus(): {
  isRunning: boolean;
  isScheduled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
} {
  return {
    isRunning: isTrackerRunning,
    isScheduled: trackingInterval !== null,
    lastRunAt: lastTrackingRun?.toISOString() || null,
    nextRunAt: nextScheduledRun?.toISOString() || null,
  };
}
