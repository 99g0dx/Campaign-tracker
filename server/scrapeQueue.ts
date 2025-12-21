import pLimit from "p-limit";
import { storage } from "./storage";
import { scrapeSocialLink } from "./scraper";
import type { ScrapeTask } from "@shared/schema";

// Configurable via environment variables
const CONCURRENCY_LIMIT = parseInt(process.env.SCRAPING_CONCURRENCY || '5', 10);
const MAX_ATTEMPTS = parseInt(process.env.SCRAPING_MAX_RETRIES || '3', 10);
const BASE_DELAY_MS = parseInt(process.env.SCRAPING_RETRY_DELAY_MS || '1000', 10);
const POLL_INTERVAL_MS = 2000;

const limit = pLimit(CONCURRENCY_LIMIT);

console.log(`[ScrapeQueue] Configured with concurrency=${CONCURRENCY_LIMIT}, maxRetries=${MAX_ATTEMPTS}, retryDelay=${BASE_DELAY_MS}ms`);

let processingInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;
const pendingRetries = new Set<number>();

interface ScrapeError {
  provider: string;
  statusCode?: number;
  message: string;
  bodySnippet?: string;
}

function isRetriableError(errorMessage: string): boolean {
  const retriablePatterns = [
    "429",
    "503",
    "502",
    "500",
    "timeout",
    "network",
    "connection",
    "ECONNRESET",
    "ETIMEDOUT",
    "temporary",
  ];
  const errorLower = errorMessage.toLowerCase();
  return retriablePatterns.some(pattern => errorLower.includes(pattern.toLowerCase()));
}

function isPermanentError(errorMessage: string): boolean {
  const permanentPatterns = [
    "not configured",
    "credit limit",
    "private or deleted",
    "authentication required",
    "requires authentication",
    "API subscription",
    "paid API access",
    "unsupported platform",
  ];
  const errorLower = errorMessage.toLowerCase();
  return permanentPatterns.some(pattern => errorLower.includes(pattern.toLowerCase()));
}

async function processTask(task: ScrapeTask): Promise<void> {
  console.log(`[ScrapeQueue] Processing task ${task.id} for URL: ${task.url}`);
  
  try {
    await storage.updateScrapeTask(task.id, { status: "running" });
    
    const result = await scrapeSocialLink(task.url);
    
    if (result.success && result.data) {
      await storage.updateScrapeTask(task.id, {
        status: "success",
        attempts: task.attempts + 1,
        resultViews: result.data.views,
        resultLikes: result.data.likes,
        resultComments: result.data.comments,
        resultShares: result.data.shares,
        lastError: null,
      });
      
      await storage.updateSocialLink(task.socialLinkId, {
        views: result.data.views,
        likes: result.data.likes,
        comments: result.data.comments,
        shares: result.data.shares,
        engagementRate: result.data.engagementRate,
        status: "scraped",
        lastScrapedAt: new Date(),
        errorMessage: null,
      });
      
      const totalEngagement = result.data.likes + result.data.comments + result.data.shares;
      await storage.createEngagementSnapshot({
        socialLinkId: task.socialLinkId,
        views: result.data.views,
        likes: result.data.likes,
        comments: result.data.comments,
        shares: result.data.shares,
        totalEngagement,
      });
      
      console.log(`[ScrapeQueue] Task ${task.id} completed successfully`);
    } else {
      await handleTaskFailure(task, result.error || "Unknown scraping error");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await handleTaskFailure(task, errorMessage);
  }
}

async function handleTaskFailure(task: ScrapeTask, errorMessage: string): Promise<void> {
  const newAttempts = task.attempts + 1;
  
  const shouldRetry = newAttempts < MAX_ATTEMPTS && 
                      isRetriableError(errorMessage) && 
                      !isPermanentError(errorMessage);
  
  const errorObj: ScrapeError = {
    provider: task.platform,
    message: errorMessage,
  };
  
  if (shouldRetry) {
    const delay = BASE_DELAY_MS * Math.pow(2, task.attempts);
    console.log(`[ScrapeQueue] Task ${task.id} failed, scheduling retry after ${delay}ms (attempt ${newAttempts}/${MAX_ATTEMPTS})`);
    
    await storage.updateScrapeTask(task.id, {
      status: "pending_retry",
      attempts: newAttempts,
      lastError: JSON.stringify(errorObj),
    });
    
    pendingRetries.add(task.id);
    
    setTimeout(async () => {
      pendingRetries.delete(task.id);
      console.log(`[ScrapeQueue] Retry delay elapsed for task ${task.id}, marking as queued`);
      try {
        await storage.updateScrapeTask(task.id, { status: "queued" });
      } catch (err) {
        console.error(`[ScrapeQueue] Failed to re-queue task ${task.id}:`, err);
      }
    }, delay);
  } else {
    console.log(`[ScrapeQueue] Task ${task.id} failed permanently: ${errorMessage}`);
    
    await storage.updateScrapeTask(task.id, {
      status: "failed",
      attempts: newAttempts,
      lastError: JSON.stringify(errorObj),
    });
    
    await storage.updateSocialLink(task.socialLinkId, {
      status: "error",
      errorMessage,
    });
  }
}

async function processQueuedTasks(): Promise<void> {
  if (isProcessing) {
    return;
  }
  
  isProcessing = true;
  
  try {
    const queuedTasks = await storage.getQueuedScrapeTasks(10);
    
    if (queuedTasks.length === 0) {
      await updateJobStatuses();
      return;
    }
    
    console.log(`[ScrapeQueue] Processing ${queuedTasks.length} queued tasks`);
    
    const jobIds = new Set(queuedTasks.map(t => t.jobId));
    for (const jobId of jobIds) {
      const job = await storage.getScrapeJob(jobId);
      if (job && job.status === "queued") {
        await storage.updateScrapeJobStatus(jobId, "running");
        console.log(`[ScrapeQueue] Job ${jobId} transitioned to running`);
      }
    }
    
    const promises = queuedTasks.map(task => 
      limit(() => processTask(task))
    );
    
    await Promise.allSettled(promises);
    
    await updateJobStatuses();
  } catch (error) {
    console.error("[ScrapeQueue] Error processing queue:", error);
  } finally {
    isProcessing = false;
  }
}

async function updateJobStatuses(): Promise<void> {
  try {
    const activeJobs = await storage.getActiveJobs();
    
    for (const job of activeJobs) {
      const jobWithStats = await storage.getScrapeJobWithStats(job.id);
      if (!jobWithStats) continue;
      
      const allTasksComplete = jobWithStats.completedTasks === jobWithStats.totalTasks;
      
      if (allTasksComplete) {
        const newStatus = jobWithStats.failedTasks > 0 ? "failed" : "done";
        await storage.updateScrapeJobStatus(job.id, newStatus, new Date());
        console.log(`[ScrapeQueue] Job ${job.id} completed with status: ${newStatus}`);
      } else if (jobWithStats.status === "queued") {
        await storage.updateScrapeJobStatus(job.id, "running");
      }
    }
  } catch (error) {
    console.error("[ScrapeQueue] Error updating job statuses:", error);
  }
}

export function startScrapeQueueWorker(): void {
  if (processingInterval) {
    console.log("[ScrapeQueue] Worker already running");
    return;
  }
  
  console.log("[ScrapeQueue] Starting queue worker");
  
  processingInterval = setInterval(processQueuedTasks, POLL_INTERVAL_MS);
  
  setTimeout(processQueuedTasks, 500);
}

export function stopScrapeQueueWorker(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
    console.log("[ScrapeQueue] Worker stopped");
  }
  
  pendingRetries.clear();
}

export async function enqueueScrapeJob(campaignId: number): Promise<{ jobId: number; taskCount: number }> {
  const existingJob = await storage.getActiveScrapeJobForCampaign(campaignId);
  if (existingJob) {
    throw new Error("A scrape job is already running for this campaign");
  }
  
  const links = await storage.getSocialLinksByCampaign(campaignId);
  
  if (links.length === 0) {
    throw new Error("No posts to scrape in this campaign");
  }
  
  const scrapableLinks = links.filter(l => !l.url.startsWith("placeholder://"));
  
  if (scrapableLinks.length === 0) {
    throw new Error("No scrapable posts in this campaign (all posts are placeholders)");
  }
  
  const { job, tasks } = await storage.createScrapeJobWithTasks(campaignId, scrapableLinks);
  
  console.log(`[ScrapeQueue] Created job ${job.id} with ${tasks.length} tasks for campaign ${campaignId}`);
  
  setTimeout(processQueuedTasks, 100);
  
  return { jobId: job.id, taskCount: tasks.length };
}
