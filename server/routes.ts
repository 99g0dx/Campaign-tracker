import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertSocialLinkSchema, postStatusOptions, insertTeamMemberSchema } from "@shared/schema";
import { z } from "zod";
import { scrapeSocialLink, getPlatformFromUrl } from "./scraper";
import { setupSession, requireUser } from "./session";
import authRoutes from "./authRoutes";
import profileRoutes from "./profileRoutes";
import bcrypt from "bcrypt";
import crypto from "crypto";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { enqueueScrapeJob, startScrapeQueueWorker } from "./scrapeQueue";
import { getLiveTrackerStatus, runTrackingCycle } from "./liveTracker";
import { sendPasswordResetEmail } from "./email";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

function getSessionUserId(req: any): string | undefined {
  return req?.session?.userId || req?.user?.id || req?.user?.claims?.sub;
}

// Rate limiting for shared campaign password attempts
const passwordAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number | null }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 60 * 60 * 1000; // 1 hour

function getRateLimitKey(ip: string, slug: string): string {
  return `${ip}:${slug}`;
}

function checkRateLimit(ip: string, slug: string): { allowed: boolean; remainingAttempts: number; lockedUntil: number | null } {
  const key = getRateLimitKey(ip, slug);
  const now = Date.now();
  const record = passwordAttempts.get(key);
  
  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntil: null };
  }
  
  // Check if locked
  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, remainingAttempts: 0, lockedUntil: record.lockedUntil };
  }
  
  // Reset if window expired
  if (now - record.lastAttempt > ATTEMPT_WINDOW) {
    passwordAttempts.delete(key);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntil: null };
  }
  
  // Check attempt count
  if (record.count >= MAX_ATTEMPTS) {
    const lockedUntil = record.lastAttempt + LOCKOUT_DURATION;
    if (now < lockedUntil) {
      record.lockedUntil = lockedUntil;
      return { allowed: false, remainingAttempts: 0, lockedUntil };
    }
    // Lockout expired, reset
    passwordAttempts.delete(key);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntil: null };
  }
  
  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - record.count, lockedUntil: null };
}

function recordFailedAttempt(ip: string, slug: string): void {
  const key = getRateLimitKey(ip, slug);
  const now = Date.now();
  const record = passwordAttempts.get(key);
  
  if (!record || now - record.lastAttempt > ATTEMPT_WINDOW) {
    passwordAttempts.set(key, { count: 1, lastAttempt: now, lockedUntil: null });
  } else {
    record.count += 1;
    record.lastAttempt = now;
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION;
    }
  }
}

function clearAttempts(ip: string, slug: string): void {
  const key = getRateLimitKey(ip, slug);
  passwordAttempts.delete(key);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup session-based authentication
  setupSession(app);

  // Auth routes (signup, login, logout, verify, forgot-password, reset-password)
  app.use("/api/auth", authRoutes);

  // Profile routes for KYC verification (requires authentication)
  app.use("/api/profile", requireUser, profileRoutes);

  // Get all campaigns with aggregated stats (scoped to user)
  app.get("/api/campaigns", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const campaigns = await storage.getCampaignsWithStats(userId);
      res.json(campaigns);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Get a single campaign (verify ownership)
  app.get("/api/campaigns/:id", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }
      const campaign = await storage.getCampaignForOwner(id, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  // Create a new campaign
  app.post("/api/campaigns", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const parsed = insertCampaignSchema.safeParse({ ...req.body, ownerId: userId });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const campaign = await storage.createCampaign(parsed.data);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Failed to create campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  // Delete a campaign (verify ownership)
  app.delete("/api/campaigns/:id", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }
      const deleted = await storage.deleteCampaign(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Campaign not found or access denied" });
      }
      res.json({ success: true, message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // Duplicate a campaign (copy campaign and social links with creator names only)
  app.post("/api/campaigns/:id/duplicate", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      // Verify ownership of original campaign
      const originalCampaign = await storage.getCampaignForOwner(id, userId);
      if (!originalCampaign) {
        return res.status(404).json({ error: "Campaign not found or access denied" });
      }

      // Get new campaign name from request body (optional)
      const newNameSchema = z.object({
        name: z.string().optional(),
      });
      const parsed = newNameSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      // Create new campaign with same details but new name
      const newCampaignName = parsed.data.name || `${originalCampaign.name} (Copy)`;
      const newCampaign = await storage.createCampaign({
        ownerId: userId,
        name: newCampaignName,
        songTitle: originalCampaign.songTitle,
        songArtist: originalCampaign.songArtist,
        status: "Active", // Reset to Active status
      });

      // Get all social links from original campaign
      const originalLinks = await storage.getSocialLinksByCampaign(id);

      // Get unique creators (deduplicate by creator name and platform)
      const uniqueCreatorsMap = new Map<string, { creatorName: string; platform: string }>();
      for (const link of originalLinks) {
        if (link.creatorName && link.creatorName.trim() !== "") {
          const key = `${link.creatorName.trim()}-${link.platform}`;
          if (!uniqueCreatorsMap.has(key)) {
            uniqueCreatorsMap.set(key, {
              creatorName: link.creatorName.trim(),
              platform: link.platform,
            });
          }
        }
      }

      const uniqueCreators = Array.from(uniqueCreatorsMap.values());

      // Create placeholder links for each unique creator in the new campaign
      // All start with status "pending" and zero metrics
      for (const creator of uniqueCreators) {
        await storage.createSocialLink({
          campaignId: newCampaign.id,
          url: `placeholder://${newCampaign.id}/${creator.creatorName.replace(/[^a-zA-Z0-9]/g, "")}/${Date.now()}`,
          platform: creator.platform,
          creatorName: creator.creatorName,
          postStatus: "pending", // All creators start as pending
        });
      }

      res.status(201).json({
        ...newCampaign,
        copiedCreatorsCount: uniqueCreators.length,
      });
    } catch (error) {
      console.error("Failed to duplicate campaign:", error);
      res.status(500).json({ error: "Failed to duplicate campaign" });
    }
  });

  // Update campaign status (verify ownership)
  app.patch("/api/campaigns/:id/status", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      // Verify ownership
      const campaign = await storage.getCampaignForOwner(id, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const statusSchema = z.object({
        status: z.enum(["Active", "Completed"]),
      });

      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const updated = await storage.updateCampaignStatus(id, parsed.data.status);
      res.json(updated);
    } catch (error) {
      console.error("Failed to update campaign status:", error);
      res.status(500).json({ error: "Failed to update campaign status" });
    }
  });

  // Get all social links
  app.get("/api/social-links", requireUser, async (_req, res) => {
    try {
      const links = await storage.getSocialLinks();
      res.json(links);
    } catch (error) {
      console.error("Failed to fetch social links:", error);
      res.status(500).json({ error: "Failed to fetch social links" });
    }
  });

  // Get social links for a specific campaign
  app.get("/api/campaigns/:campaignId/social-links", requireUser, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId, 10);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }
      const links = await storage.getSocialLinksByCampaign(campaignId);
      res.json(links);
    } catch (error) {
      console.error("Failed to fetch campaign social links:", error);
      res.status(500).json({ error: "Failed to fetch social links" });
    }
  });

  // Add a new social link and scrape data
  app.post("/api/social-links", requireUser, async (req, res) => {
    try {
      const urlSchema = z.object({
        url: z.string(),
        campaignId: z.number(),
        creatorName: z.string().optional(),
        postStatus: z.enum(postStatusOptions).optional(),
      });

      const parsed = urlSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const { url, campaignId, creatorName, postStatus } = parsed.data;
      
      // Check if it's a placeholder URL (creator added without link)
      const isPlaceholder = url.startsWith("placeholder://");
      const platform = isPlaceholder ? "Unknown" : getPlatformFromUrl(url);

      if (!isPlaceholder && platform === "Unknown") {
        return res.status(400).json({ 
          error: "Unsupported platform. Supported: TikTok, Instagram, YouTube, Twitter, Facebook" 
        });
      }

      // Check campaign exists
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Create the social link entry
      // Auto-set status to "active" if this is a real post link (not placeholder)
      const defaultPostStatus = isPlaceholder ? "pending" : "active";
      const linkData = {
        url,
        platform,
        campaignId,
        creatorName: creatorName || null,
        postStatus: postStatus || defaultPostStatus,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagementRate: 0,
      };

      const link = await storage.createSocialLink(linkData);

      // Only scrape if it's a real URL
      if (!isPlaceholder) {
        scrapeSocialLink(url).then(async (result) => {
          if (result.success && result.data) {
            await storage.updateSocialLink(link.id, {
              ...result.data,
              status: "scraped",
              lastScrapedAt: new Date(),
            });
            
            // Save engagement snapshot for history tracking
            const totalEngagement = (result.data.likes || 0) + (result.data.comments || 0) + (result.data.shares || 0);
            await storage.createEngagementSnapshot({
              socialLinkId: link.id,
              views: result.data.views || 0,
              likes: result.data.likes || 0,
              comments: result.data.comments || 0,
              shares: result.data.shares || 0,
              totalEngagement,
            });
          } else {
            await storage.updateSocialLink(link.id, {
              status: "error",
              errorMessage: result.error || "Failed to scrape",
            });
          }
        }).catch(async (err) => {
          console.error("Scraping error:", err);
          await storage.updateSocialLink(link.id, {
            status: "error",
            errorMessage: err.message || "Scraping failed",
          });
        });

        res.status(201).json({ ...link, status: "scraping" });
      } else {
        res.status(201).json(link);
      }
    } catch (error) {
      console.error("Failed to create social link:", error);
      res.status(500).json({ error: "Failed to create social link" });
    }
  });

  // Rescrape a social link
  app.post("/api/social-links/:id/rescrape", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid link ID" });
      }

      const link = await storage.getSocialLink(id);
      if (!link) {
        return res.status(404).json({ error: "Social link not found" });
      }

      // Update status to scraping
      await storage.updateSocialLink(id, { status: "scraping" });

      // Start scraping
      const result = await scrapeSocialLink(link.url);

      if (result.success && result.data) {
        const updated = await storage.updateSocialLink(id, {
          ...result.data,
          status: "scraped",
          lastScrapedAt: new Date(),
        });
        
        // Save engagement snapshot for history tracking
        const totalEngagement = (result.data.likes || 0) + (result.data.comments || 0) + (result.data.shares || 0);
        await storage.createEngagementSnapshot({
          socialLinkId: id,
          views: result.data.views || 0,
          likes: result.data.likes || 0,
          comments: result.data.comments || 0,
          shares: result.data.shares || 0,
          totalEngagement,
        });
        
        res.json(updated);
      } else {
        await storage.updateSocialLink(id, {
          status: "error",
          errorMessage: result.error || "Failed to scrape",
        });
        res.status(400).json({ error: result.error || "Failed to scrape" });
      }
    } catch (error) {
      console.error("Failed to rescrape social link:", error);
      res.status(500).json({ error: "Failed to rescrape social link" });
    }
  });

  // Rescrape all social links for a campaign (verify ownership) - uses job queue
  app.post("/api/campaigns/:id/rescrape-all", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const campaign = await storage.getCampaignForOwner(id, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const { jobId, taskCount } = await enqueueScrapeJob(id);
      
      res.json({ jobId, taskCount, status: "queued" });
    } catch (error: any) {
      console.error("Failed to start batch scrape:", error);
      if (error.message?.includes("already running")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message?.includes("No posts")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to start batch scrape" });
    }
  });

  // Get scrape job status with aggregated stats
  app.get("/api/scrape-jobs/:id", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid job ID" });
      }

      const jobWithStats = await storage.getScrapeJobWithStats(id);
      if (!jobWithStats) {
        return res.status(404).json({ error: "Scrape job not found" });
      }

      const campaign = await storage.getCampaignForOwner(jobWithStats.campaignId, userId);
      if (!campaign) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(jobWithStats);
    } catch (error) {
      console.error("Failed to fetch scrape job:", error);
      res.status(500).json({ error: "Failed to fetch scrape job" });
    }
  });

  // Get scrape tasks for a job
  app.get("/api/scrape-jobs/:id/tasks", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid job ID" });
      }

      const job = await storage.getScrapeJob(id);
      if (!job) {
        return res.status(404).json({ error: "Scrape job not found" });
      }

      const campaign = await storage.getCampaignForOwner(job.campaignId, userId);
      if (!campaign) {
        return res.status(403).json({ error: "Access denied" });
      }

      const tasks = await storage.getScrapeTasksByJob(id);
      res.json(tasks);
    } catch (error) {
      console.error("Failed to fetch scrape tasks:", error);
      res.status(500).json({ error: "Failed to fetch scrape tasks" });
    }
  });

  // Get active scrape job for a campaign
  app.get("/api/campaigns/:id/active-scrape-job", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const campaign = await storage.getCampaignForOwner(id, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const job = await storage.getActiveScrapeJobForCampaign(id);
      if (!job) {
        return res.json(null);
      }

      const jobWithStats = await storage.getScrapeJobWithStats(job.id);
      res.json(jobWithStats);
    } catch (error) {
      console.error("Failed to fetch active scrape job:", error);
      res.status(500).json({ error: "Failed to fetch active scrape job" });
    }
  });

  // Get campaign engagement history for charts (verify ownership)
  app.get("/api/campaigns/:id/engagement-history", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }
      
      const campaign = await storage.getCampaignForOwner(id, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      const history = await storage.getCampaignEngagementHistory(id);
      res.json(history);
    } catch (error) {
      console.error("Failed to fetch engagement history:", error);
      res.status(500).json({ error: "Failed to fetch engagement history" });
    }
  });

  // Get unified campaign metrics (single source of truth for KPI totals + chart)
  app.get("/api/campaigns/:id/metrics", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }
      
      const campaign = await storage.getCampaignForOwner(id, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      // Get days parameter (default 30)
      const days = parseInt(req.query.days as string, 10) || 30;
      const metrics = await storage.getCampaignMetrics(id, days);
      res.json(metrics);
    } catch (error) {
      console.error("Failed to fetch campaign metrics:", error);
      res.status(500).json({ error: "Failed to fetch campaign metrics" });
    }
  });

  // Get live tracker status
  app.get("/api/live-tracker/status", requireUser, async (_req, res) => {
    try {
      const status = getLiveTrackerStatus();
      res.json(status);
    } catch (error) {
      console.error("Failed to get tracker status:", error);
      res.status(500).json({ error: "Failed to get tracker status" });
    }
  });

  // Trigger manual tracking run
  app.post("/api/live-tracker/run", requireUser, async (_req, res) => {
    try {
      const result = await runTrackingCycle();
      res.json(result);
    } catch (error) {
      console.error("Failed to run tracking cycle:", error);
      res.status(500).json({ error: "Failed to run tracking cycle" });
    }
  });

  // Get scraping provider statistics and health
  app.get("/api/scraping/providers", requireUser, async (_req, res) => {
    try {
      const { getProviderManager } = await import('./scrapers/providerManager');
      const manager = getProviderManager();
      const stats = manager.getProvidersStats();
      res.json({
        providers: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to get provider stats:", error);
      res.status(500).json({ error: "Failed to get provider stats" });
    }
  });

  // Reset circuit breakers (admin endpoint)
  app.post("/api/scraping/providers/reset", requireUser, async (_req, res) => {
    try {
      const { getProviderManager } = await import('./scrapers/providerManager');
      const manager = getProviderManager();
      manager.resetCircuitBreakers();
      res.json({ success: true, message: "Circuit breakers reset" });
    } catch (error) {
      console.error("Failed to reset circuit breakers:", error);
      res.status(500).json({ error: "Failed to reset circuit breakers" });
    }
  });

  // Update social link (post status, creator name, url)
  app.patch("/api/social-links/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid link ID" });
      }

      const updateSchema = z.object({
        postStatus: z.enum(postStatusOptions).optional(),
        creatorName: z.string().optional(),
        url: z.string().optional(),
        views: z.number().optional(),
        likes: z.number().optional(),
        comments: z.number().optional(),
        shares: z.number().optional(),
      });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const link = await storage.getSocialLink(id);
      if (!link) {
        return res.status(404).json({ error: "Social link not found" });
      }

      const { url, ...otherUpdates } = parsed.data;
      
      // Check if URL is actually changing (different from current URL)
      const isNewUrl = url && url.trim() && 
                       !url.startsWith("placeholder://") && 
                       url.trim() !== link.url;
      
      // If URL is being updated to a new value, validate and trigger scraping
      if (isNewUrl) {
        const platform = getPlatformFromUrl(url);
        if (platform === "Unknown") {
          return res.status(400).json({
            error: "Unsupported platform. Supported: TikTok, Instagram, YouTube, Twitter, Facebook"
          });
        }

        // Update with new URL and platform, set to scraping
        // Auto-set postStatus to "active" when adding a real URL (if currently pending)
        const updates: any = {
          ...otherUpdates,
          url,
          platform,
          status: "scraping"
        };

        // If converting from placeholder to real URL and status is pending, set to active
        if (link.url.startsWith("placeholder://") && link.postStatus === "pending") {
          updates.postStatus = "active";
        }

        await storage.updateSocialLink(id, updates);
        
        // Start scraping in background
        scrapeSocialLink(url).then(async (result) => {
          if (result.success && result.data) {
            await storage.updateSocialLink(id, {
              ...result.data,
              status: "scraped",
              lastScrapedAt: new Date(),
            });
            
            // Save engagement snapshot for history tracking
            const totalEngagement = (result.data.likes || 0) + (result.data.comments || 0) + (result.data.shares || 0);
            await storage.createEngagementSnapshot({
              socialLinkId: id,
              views: result.data.views || 0,
              likes: result.data.likes || 0,
              comments: result.data.comments || 0,
              shares: result.data.shares || 0,
              totalEngagement,
            });
          } else {
            await storage.updateSocialLink(id, {
              status: "error",
              errorMessage: result.error || "Failed to scrape",
            });
          }
        }).catch(async (err) => {
          console.error("Scraping error:", err);
          await storage.updateSocialLink(id, {
            status: "error",
            errorMessage: err.message || "Scraping failed",
          });
        });
        
        const updated = await storage.getSocialLink(id);
        res.json(updated);
      } else {
        // No URL change, just update other fields (including manual metrics)
        const updated = await storage.updateSocialLink(id, otherUpdates);
        res.json(updated);
      }
    } catch (error) {
      console.error("Failed to update social link:", error);
      res.status(500).json({ error: "Failed to update social link" });
    }
  });

  // Delete social link (remove creator from campaign)
  app.delete("/api/social-links/:id", requireUser, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid link ID" });
      }

      const link = await storage.getSocialLink(id);
      if (!link) {
        return res.status(404).json({ error: "Social link not found" });
      }

      const deleted = await storage.deleteSocialLink(id);
      if (deleted) {
        res.json({ success: true, message: "Creator removed from campaign" });
      } else {
        res.status(500).json({ error: "Failed to delete social link" });
      }
    } catch (error) {
      console.error("Failed to delete social link:", error);
      res.status(500).json({ error: "Failed to delete social link" });
    }
  });

  // ==================== CAMPAIGN SHARING ROUTES ====================
  
  // Enable or update share settings for a campaign (verify ownership)
  app.post("/api/campaigns/:id/share", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const shareSchema = z.object({
        enable: z.boolean(),
        password: z.string().optional(),
      });

      const parsed = shareSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const { enable, password } = parsed.data;
      
      const campaign = await storage.getCampaignForOwner(id, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      let shareSlug = campaign.shareSlug;
      let sharePasswordHash = campaign.sharePasswordHash;

      if (enable) {
        if (!password) {
          return res.status(400).json({ error: "Password is required to enable sharing" });
        }
        
        // Generate slug if not exists
        if (!shareSlug) {
          shareSlug = crypto.randomBytes(12).toString("hex");
        }
        
        sharePasswordHash = await bcrypt.hash(password, 10);
      } else {
        shareSlug = null;
        sharePasswordHash = null;
      }

      const updated = await storage.updateCampaignShare(id, {
        shareEnabled: enable,
        shareSlug,
        sharePasswordHash,
        shareCreatedAt: enable ? new Date() : null,
      });

      res.json({
        id: updated?.id,
        shareEnabled: updated?.shareEnabled,
        shareSlug: updated?.shareSlug,
      });
    } catch (error) {
      console.error("Failed to update campaign share:", error);
      res.status(500).json({ error: "Failed to update share settings" });
    }
  });

  // Get share status for a campaign (verify ownership)
  app.get("/api/campaigns/:id/share", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const campaign = await storage.getCampaignForOwner(id, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json({
        shareEnabled: campaign.shareEnabled,
        shareSlug: campaign.shareSlug,
      });
    } catch (error) {
      console.error("Failed to get share status:", error);
      res.status(500).json({ error: "Failed to get share status" });
    }
  });

  // ==================== PUBLIC CAMPAIGN ACCESS ROUTES ====================
  
  const COOKIE_PREFIX = "campaign_access_";

  // Dev-only: unlock helper - sets the campaign access cookie in the browser and redirects to the front-end share page
  // Usage: GET /dev/unlock/:slug (only works when NODE_ENV !== 'production')
  if (process.env.NODE_ENV !== 'production') {
    app.get('/dev/unlock/:slug', (req, res) => {
      try {
        const { slug } = req.params;
        const cookieName = COOKIE_PREFIX + slug;
        const frontend = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

        // Return a small HTML page that sets the cookie (so it's set on the browser domain) and redirects
        res.set('Content-Type', 'text/html');
        res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Unlock</title></head><body><script>
          document.cookie = '${cookieName}=ok; path=/; SameSite=Lax';
          window.location = '${frontend}/share/${slug}';
        </script></body></html>`);
      } catch (err) {
        console.error('Dev unlock failed:', err);
        res.status(500).send('Dev unlock failed');
      }
    });
  }

  // Verify password for public campaign access
  app.post("/api/public/campaigns/:slug/verify", async (req, res) => {
    try {
      const { slug } = req.params;
      const { password } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";

      // Check rate limit before processing
      const rateLimit = checkRateLimit(clientIp, slug);
      if (!rateLimit.allowed) {
        const minutesLeft = rateLimit.lockedUntil 
          ? Math.ceil((rateLimit.lockedUntil - Date.now()) / 60000)
          : 15;
        return res.status(429).json({ 
          error: `Too many failed attempts. Try again in ${minutesLeft} minutes.`,
          lockedUntil: rateLimit.lockedUntil,
        });
      }

      const campaign = await storage.getCampaignByShareSlug(slug);
      if (!campaign || !campaign.shareEnabled || !campaign.sharePasswordHash) {
        return res.status(404).json({ error: "Campaign not available" });
      }

      const isValid = await bcrypt.compare(password, campaign.sharePasswordHash);
      if (!isValid) {
        recordFailedAttempt(clientIp, slug);
        const updatedLimit = checkRateLimit(clientIp, slug);
        return res.status(401).json({ 
          error: "Incorrect password",
          remainingAttempts: updatedLimit.remainingAttempts,
        });
      }

      // Clear attempts on successful login
      clearAttempts(clientIp, slug);

      // Set cookie for access
      res.cookie(COOKIE_PREFIX + slug, "ok", {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        sameSite: "lax",
      });

      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to verify campaign password:", error);
      res.status(500).json({ error: "Failed to verify password" });
    }
  });

  // Get public campaign data (requires valid cookie)
  app.get("/api/public/campaigns/:slug", async (req, res) => {
    try {
      const { slug } = req.params;

      // Dev-only mock: return fixture data for quick previews without needing a DB or cookie
      if (process.env.NODE_ENV !== "production" && slug === "test") {
        const now = Date.now();
        const socialLinks = [
          // scraped very recently
          { id: 1, url: "https://tiktok.com/@alice/video/1", platform: "tiktok", creatorName: "Alice", postStatus: "active", views: 1200, likes: 200, comments: 10, shares: 2, lastScrapedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() }, // 2 hours ago
          // scraped yesterday
          { id: 2, url: "https://instagram.com/p/abc", platform: "instagram", creatorName: "Bob", postStatus: "done", views: 3500, likes: 400, comments: 50, shares: 5, lastScrapedAt: new Date(now - 26 * 60 * 60 * 1000).toISOString() },
          // placeholder row (should be excluded)
          { id: 3, url: "placeholder://123", platform: null, creatorName: null, postStatus: "pending", views: 0, likes: 0, comments: 0, shares: 0 },
          // not scraped yet
          { id: 4, url: "https://youtube.com/watch?v=xyz", platform: "youtube", creatorName: "Carol", postStatus: "pending", views: 0, likes: 0, comments: 0, shares: 0 },
          // duplicate post (same url as Alice) to test dedupe
          { id: 5, url: "https://tiktok.com/@alice/video/1", platform: "tiktok", creatorName: "Alice D", postStatus: "active", views: 1200, likes: 200, comments: 10, shares: 2, lastScrapedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
          // older scrape (10 days ago)
          { id: 6, url: "https://tiktok.com/@dave/video/2", platform: "tiktok", creatorName: "Dave", postStatus: "done", views: 8000, likes: 800, comments: 80, shares: 10, lastScrapedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() },
        ];

        const engagementHistory = [] as any[];

        const engagementWindows: Record<string, { views: number; likes: number; comments: number; shares: number; label: string }> = {};
        const windows = [
          { key: "24h", label: "Last 24 Hours", hoursAgo: 24 },
          { key: "72h", label: "Last 72 Hours", hoursAgo: 72 },
          { key: "7d", label: "Last 7 Days", hoursAgo: 24 * 7 },
          { key: "30d", label: "Last 30 Days", hoursAgo: 24 * 30 },
          { key: "60d", label: "Last 60 Days", hoursAgo: 24 * 60 },
          { key: "90d", label: "Last 90 Days", hoursAgo: 24 * 90 },
        ];

        for (const w of windows) {
          const cutoff = now - w.hoursAgo * 60 * 60 * 1000;
          const filtered = socialLinks.filter((s) => s.lastScrapedAt && Date.parse(s.lastScrapedAt) >= cutoff && !(s.url || "").startsWith("placeholder://"));
          const totals = filtered.reduce((acc, l) => ({ views: acc.views + (l.views || 0), likes: acc.likes + (l.likes || 0), comments: acc.comments + (l.comments || 0), shares: acc.shares + (l.shares || 0) }), { views: 0, likes: 0, comments: 0, shares: 0 });
          engagementWindows[w.key] = { ...totals, label: w.label };
        }

        return res.json({
          campaign: { id: 999, name: "Test Campaign", songTitle: "Test Song", songArtist: "Test Artist", status: "Active", createdAt: Date.now() },
          socialLinks,
          engagementHistory,
          engagementWindows,
        });
      }

      const cookieName = COOKIE_PREFIX + slug;

      if (req.cookies?.[cookieName] !== "ok") {
        return res.status(401).json({ error: "Locked" });
      }

      const campaign = await storage.getCampaignByShareSlug(slug);
      if (!campaign || !campaign.shareEnabled) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Get social links for this campaign
      const socialLinks = await storage.getSocialLinksByCampaign(campaign.id);
      
      // Get engagement history
      const engagementHistory = await storage.getCampaignEngagementHistory(campaign.id);

      // Calculate engagement by time windows
      const now = new Date();
      const timeWindows = [
        { key: "24h", label: "Last 24 Hours", hoursAgo: 24 },
        { key: "72h", label: "Last 72 Hours", hoursAgo: 72 },
        { key: "7d", label: "Last 7 Days", hoursAgo: 24 * 7 },
        { key: "30d", label: "Last 30 Days", hoursAgo: 24 * 30 },
        { key: "60d", label: "Last 60 Days", hoursAgo: 24 * 60 },
        { key: "90d", label: "Last 90 Days", hoursAgo: 24 * 90 },
      ];

      const engagementWindows: Record<string, { views: number; likes: number; comments: number; shares: number; label: string }> = {};
      
      for (const window of timeWindows) {
        const cutoffDate = new Date(now.getTime() - window.hoursAgo * 60 * 60 * 1000);
        const filteredHistory = engagementHistory.filter((h: any) => new Date(h.date) >= cutoffDate);
        
        // Sum up the latest values from the filtered history
        const stats = filteredHistory.reduce(
          (acc: any, h: any) => ({
            views: acc.views + (h.views || 0),
            likes: acc.likes + (h.likes || 0),
            comments: acc.comments + (h.comments || 0),
            shares: acc.shares + (h.shares || 0),
          }),
          { views: 0, likes: 0, comments: 0, shares: 0 }
        );

        engagementWindows[window.key] = {
          ...stats,
          label: window.label,
        };
      }

      // If no history, use current social link totals for all windows
      if (engagementHistory.length === 0) {
        const totals = socialLinks.reduce(
          (acc, link) => ({
            views: acc.views + (link.views || 0),
            likes: acc.likes + (link.likes || 0),
            comments: acc.comments + (link.comments || 0),
            shares: acc.shares + (link.shares || 0),
          }),
          { views: 0, likes: 0, comments: 0, shares: 0 }
        );

        for (const window of timeWindows) {
          engagementWindows[window.key] = {
            ...totals,
            label: window.label,
          };
        }
      }

      res.json({ 
        campaign: {
          id: campaign.id,
          name: campaign.name,
          songTitle: campaign.songTitle,
          songArtist: campaign.songArtist,
          status: campaign.status,
          createdAt: campaign.createdAt,
        },
        socialLinks,
        engagementHistory,
        engagementWindows,
      });
    } catch (error) {
      console.error("Failed to fetch public campaign:", error);
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  // ==================== PASSWORD MANAGEMENT ROUTES ====================
  
  // Check if user has password set
  app.get("/api/auth/has-password", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      res.json({ hasPassword: !!user?.passwordHash });
    } catch (error) {
      console.error("Failed to check password status:", error);
      res.status(500).json({ error: "Failed to check password status" });
    }
  });

  // Change password (logged-in user)
  app.post("/api/auth/change-password", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const schema = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }

      const { currentPassword, newPassword } = parsed.data;
      const user = await storage.getUser(userId);

      if (!user?.passwordHash) {
        return res.status(400).json({ error: "Password login is not enabled for this account. Please set a password first using forgot password." });
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(userId, newHash);

      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to change password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Set password (for users without password - first time setup)
  app.post("/api/auth/set-password", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const schema = z.object({
        newPassword: z.string().min(6),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }

      const user = await storage.getUser(userId);
      if (user?.passwordHash) {
        return res.status(400).json({ error: "Password already set. Use change password instead." });
      }

      const hash = await bcrypt.hash(parsed.data.newPassword, 10);
      await storage.updateUserPassword(userId, hash);

      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to set password:", error);
      res.status(500).json({ error: "Failed to set password" });
    }
  });

  // Forgot password - send reset email
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Valid email required" });
      }

      const { email } = parsed.data;
      const user = await storage.getUserByEmail(email);

      // Always return success to avoid email enumeration
      if (!user) {
        return res.json({ ok: true });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.updateUserResetToken(user.id, token, expires);

      // Get the app URL from environment or request
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      
      const resetLink = `${appUrl}/reset-password?token=${token}`;

      try {
        await sendPasswordResetEmail(email, resetLink);
      } catch (emailError) {
        console.error("Failed to send reset email:", emailError);
        // Still return success to avoid exposing email status
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to process forgot password:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // Validate reset token (check if token is valid and not expired)
  app.get("/api/auth/validate-reset-token", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.json({ valid: false });
      }

      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
        return res.json({ valid: false });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Failed to validate reset token:", error);
      res.json({ valid: false });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const schema = z.object({
        token: z.string().min(1),
        newPassword: z.string().min(6),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }

      const { token, newPassword } = parsed.data;
      const user = await storage.getUserByResetToken(token);

      if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hash);

      // Clear the reset token after successful reset
      await storage.updateUserResetToken(user.id, null, null);

      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to reset password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // ==================== TEAM MEMBERS ROUTES ====================
  
  // Get team members for current user
  app.get("/api/team-members", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const members = await storage.getTeamMembers(userId);
      res.json(members);
    } catch (error) {
      console.error("Failed to fetch team members:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  // Add team member
  app.post("/api/team-members", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const memberSchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.string().optional(),
      });

      const parsed = memberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const member = await storage.addTeamMember({
        ownerId: userId,
        ...parsed.data,
      });

      res.status(201).json(member);
    } catch (error) {
      console.error("Failed to add team member:", error);
      res.status(500).json({ error: "Failed to add team member" });
    }
  });

  // Remove team member
  app.delete("/api/team-members/:id", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid member ID" });
      }

      const deleted = await storage.removeTeamMember(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Team member not found or not authorized" });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to remove team member:", error);
      res.status(500).json({ error: "Failed to remove team member" });
    }
  });

  // ==================== CSV IMPORT ROUTES ====================

  // Import creators CSV for a campaign (no links)
  // Creates social link entries with status "pending" for each creator
  app.post("/api/campaigns/:id/import-creators-csv", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const campaignId = parseInt(req.params.id, 10);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const campaign = await storage.getCampaignForOwner(campaignId, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Parse request body
      const { rows } = req.body;
      if (!Array.isArray(rows)) {
        return res.status(400).json({ error: "Invalid request: rows must be an array" });
      }

      // Validation schema for creator rows
      const creatorRowSchema = z.object({
        handle: z.string().min(1),
        platform: z.string().optional(),
        posts_promised: z.number().optional(),
      });

      let added = 0;
      let skipped = 0;
      const errors: string[] = [];
      const seen = new Set<string>();

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // Validate row
          const validationResult = creatorRowSchema.safeParse(row);
          if (!validationResult.success) {
            skipped++;
            errors.push(`Row ${i + 1}: Invalid data - ${validationResult.error.message}`);
            continue;
          }

          const { handle, platform, posts_promised } = validationResult.data;

          // Normalize handle
          const normalizedHandle = handle.trim().toLowerCase();
          if (!normalizedHandle) {
            skipped++;
            errors.push(`Row ${i + 1}: Handle is empty`);
            continue;
          }

          // Deduplication key: handle + platform or just handle
          const dedupeKey = platform
            ? `${normalizedHandle}:${platform.toLowerCase()}`
            : normalizedHandle;

          if (seen.has(dedupeKey)) {
            skipped++;
            continue;
          }
          seen.add(dedupeKey);

          // Check if creator already exists in this campaign
          const existingLinks = await storage.getSocialLinksByCampaign(campaignId);
          const alreadyExists = existingLinks.some((link) => {
            const existingNormalized = (link.creatorName || "").trim().toLowerCase();
            const platformMatch = platform
              ? (link.platform || "").toLowerCase() === platform.toLowerCase()
              : true;
            return existingNormalized === normalizedHandle && platformMatch;
          });

          if (alreadyExists) {
            skipped++;
            continue;
          }

          // Create placeholder social link with "pending" status
          const placeholderUrl = `placeholder://${campaignId}/${Date.now()}/${Math.random()}`;

          await storage.createSocialLink({
            campaignId,
            url: placeholderUrl,
            platform: platform || "unknown",
            creatorName: handle,
            postStatus: "pending",
          });

          added++;
        } catch (err) {
          skipped++;
          errors.push(
            `Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      res.json({
        added,
        skipped,
        errors: errors.slice(0, 10), // Return first 10 errors only
      });
    } catch (error) {
      console.error("Failed to import creators CSV:", error);
      res.status(500).json({ error: "Failed to import creators CSV" });
    }
  });

  // Import posts from CSV for a campaign (verify ownership)
  // New flexible CSV import with two modes: creators and posts
  app.post("/api/campaigns/:id/import-csv", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const campaignId = parseInt(req.params.id, 10);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const campaign = await storage.getCampaignForOwner(campaignId, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Preprocessor to convert empty strings to undefined
      const emptyToUndefined = (v: any) => {
        if (v === null || v === undefined) return undefined;
        if (typeof v === "string" && v.trim() === "") return undefined;
        return v;
      };

      // Validation schemas for each mode
      const creatorRowSchema = z.object({
        handle: z.string().min(1),
        platform: z.preprocess(emptyToUndefined, z.string().optional()),
        profileUrl: z.preprocess(emptyToUndefined, z.string().url().optional()),
      });

      const postRowSchema = z.object({
        url: z.string().url(),
        creatorName: z.preprocess(emptyToUndefined, z.string().optional()),
        platform: z.preprocess(emptyToUndefined, z.string().optional()),
        views: z.number().optional(),
        likes: z.number().optional(),
        comments: z.number().optional(),
        shares: z.number().optional(),
      });

      const importSchema = z.object({
        mode: z.enum(["creators", "posts"]),
        rows: z.array(z.record(z.any())),
      });

      const parsed = importSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const { mode, rows } = parsed.data;

      let imported = 0;
      let skipped = 0;
      let duplicates = 0;
      const errors: string[] = [];

      if (mode === "creators") {
        // Import creators mode - create placeholder social links for each creator
        const seen = new Set<string>();

        for (const row of rows) {
          try {
            // Validate row with schema
            const validationResult = creatorRowSchema.safeParse(row);
            if (!validationResult.success) {
              skipped++;
              errors.push(`Invalid row for ${row.handle || "unknown"}: ${validationResult.error.message}`);
              continue;
            }

            const { handle, platform, profileUrl } = validationResult.data;

            // Deduplicate by handle + platform
            const normalizedPlatform = platform?.toLowerCase();
            const dedupeKey = normalizedPlatform ? `${handle}:${normalizedPlatform}` : handle;
            if (seen.has(dedupeKey)) {
              duplicates++;
              continue;
            }
            seen.add(dedupeKey);

            // Create a placeholder social link with creator info
            const placeholderUrl = `placeholder://${campaignId}/${Date.now()}/${Math.random()}`;

            await storage.createSocialLink({
              campaignId,
              url: placeholderUrl,
              platform: normalizedPlatform || "Unknown",
              creatorName: handle,
              postStatus: "pending",
            });

            imported++;
          } catch (err) {
            console.error("Error importing creator:", err);
            skipped++;
            errors.push(`Failed to import ${row.handle || "unknown"}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } else {
        // Import posts mode with creator matching
        const seen = new Set<string>();

        // Load all existing creators (social links) for this campaign
        const existingLinks = await storage.getSocialLinksByCampaign(campaignId);

        // Build a map of existing creators by normalized handle + platform
        const creatorMap = new Map<string, typeof existingLinks[0]>();
        for (const link of existingLinks) {
          if (link.creatorName) {
            const { normalizeHandle, createCreatorKey } = await import("./handleUtils");
            const key = createCreatorKey(campaignId, link.creatorName, link.platform);
            // Only map placeholder URLs (creators without posts yet)
            if (link.url.startsWith("placeholder://")) {
              creatorMap.set(key, link);
            }
          }
        }

        let matched = 0;
        let created = 0;

        for (const row of rows) {
          try {
            const url = row.url?.trim();
            if (!url) {
              skipped++;
              continue;
            }

            // Deduplicate by URL within this import
            if (seen.has(url)) {
              duplicates++;
              continue;
            }
            seen.add(url);

            const platform = row.platform || getPlatformFromUrl(url);
            let creatorName = row.creatorName?.trim();
            let matchedCreator: typeof existingLinks[0] | undefined;

            // Import utility functions
            const { normalizeHandle, extractHandleFromUrl, createCreatorKey } = await import("./handleUtils");

            // Try to match with existing creator
            if (creatorName) {
              // Rule 1: Exact match on normalized handle from CSV
              const key = createCreatorKey(campaignId, creatorName, platform);
              matchedCreator = creatorMap.get(key);

              // Also try without platform constraint
              if (!matchedCreator) {
                const keyNoPlatform = createCreatorKey(campaignId, creatorName);
                matchedCreator = creatorMap.get(keyNoPlatform);
              }
            }

            // Rule 2: If no creator column, try to infer from URL
            if (!matchedCreator && !creatorName) {
              const inferredHandle = extractHandleFromUrl(url, platform);
              if (inferredHandle) {
                const key = createCreatorKey(campaignId, inferredHandle, platform);
                matchedCreator = creatorMap.get(key);

                if (!matchedCreator) {
                  const keyNoPlatform = createCreatorKey(campaignId, inferredHandle);
                  matchedCreator = creatorMap.get(keyNoPlatform);
                }

                // Use inferred handle as creator name
                if (!creatorName) {
                  creatorName = inferredHandle;
                }
              }
            }

            // If matched, update the placeholder with real URL and set status to active
            if (matchedCreator) {
              await storage.updateSocialLink(matchedCreator.id, {
                url,
                platform,
                postStatus: "active", // Auto-activate when real post is added
                views: row.views || 0,
                likes: row.likes || 0,
                comments: row.comments || 0,
                shares: row.shares || 0,
              });
              matched++;
              imported++;

              // Remove from map so it can't be matched again
              const key = createCreatorKey(campaignId, matchedCreator.creatorName!, matchedCreator.platform);
              creatorMap.delete(key);
            } else {
              // Rule 3: Create new creator entry as fallback
              await storage.createSocialLink({
                campaignId,
                url,
                platform,
                creatorName: creatorName || "Unknown",
                postStatus: "active", // New posts with real URLs start as active
                views: row.views || 0,
                likes: row.likes || 0,
                comments: row.comments || 0,
                shares: row.shares || 0,
              });
              created++;
              imported++;
            }
          } catch (err) {
            console.error("Error importing post:", err);
            skipped++;
            errors.push(`Failed to import ${row.url || "unknown"}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        // Add summary info to response
        res.json({
          imported,
          skipped,
          duplicates,
          matched,
          created,
          errors: errors.slice(0, 10),
        });
        return;
      }

      res.json({
        imported,
        skipped,
        duplicates,
        errors: errors.slice(0, 10), // Return first 10 errors only
      });
    } catch (error) {
      console.error("Failed to import CSV:", error);
      res.status(500).json({ error: "Failed to import CSV" });
    }
  });

  app.post("/api/campaigns/:id/import-posts", requireUser, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const campaignId = parseInt(req.params.id, 10);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const campaign = await storage.getCampaignForOwner(campaignId, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const text = req.file.buffer.toString("utf8");
      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Array<{
        creator_name?: string;
        handle?: string;
        url?: string;
        status?: string;
      }>;

      // Load existing creators for matching
      const existingLinks = await storage.getSocialLinksByCampaign(campaignId);
      const { normalizeHandle, extractHandleFromUrl, createCreatorKey } = await import("./handleUtils");

      // Build creator map
      const creatorMap = new Map<string, typeof existingLinks[0]>();
      for (const link of existingLinks) {
        if (link.creatorName && link.url.startsWith("placeholder://")) {
          const key = createCreatorKey(campaignId, link.creatorName, link.platform);
          creatorMap.set(key, link);
        }
      }

      const validStatuses = new Set(postStatusOptions);
      let matched = 0;
      let created = 0;

      for (const record of records) {
        if (!record.creator_name && !record.url) continue;

        try {
          const url = record.url?.trim() || `placeholder://${Date.now()}-${Math.random()}`;
          const isPlaceholder = url.startsWith("placeholder://");
          const platform = isPlaceholder ? "Unknown" : getPlatformFromUrl(url);
          let creatorName = record.creator_name?.trim() || record.handle?.trim();
          const rawStatus = record.status?.toLowerCase()?.trim() || "pending";
          const postStatus = validStatuses.has(rawStatus as any) ? rawStatus : "pending";

          let matchedCreator: typeof existingLinks[0] | undefined;

          // Try to match with existing creator if this is a real URL
          if (!isPlaceholder) {
            if (creatorName) {
              // Try exact match
              const key = createCreatorKey(campaignId, creatorName, platform);
              matchedCreator = creatorMap.get(key);

              if (!matchedCreator) {
                const keyNoPlatform = createCreatorKey(campaignId, creatorName);
                matchedCreator = creatorMap.get(keyNoPlatform);
              }
            }

            // Try inferring from URL
            if (!matchedCreator && !creatorName) {
              const inferredHandle = extractHandleFromUrl(url, platform);
              if (inferredHandle) {
                const key = createCreatorKey(campaignId, inferredHandle, platform);
                matchedCreator = creatorMap.get(key);

                if (!matchedCreator) {
                  const keyNoPlatform = createCreatorKey(campaignId, inferredHandle);
                  matchedCreator = creatorMap.get(keyNoPlatform);
                }

                if (!creatorName) {
                  creatorName = inferredHandle;
                }
              }
            }
          }

          // Update existing creator or create new
          if (matchedCreator && !isPlaceholder) {
            await storage.updateSocialLink(matchedCreator.id, {
              url,
              platform,
              postStatus: "active", // Auto-activate
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
            });
            matched++;

            // Remove from map
            const key = createCreatorKey(campaignId, matchedCreator.creatorName!, matchedCreator.platform);
            creatorMap.delete(key);
          } else {
            await storage.createSocialLink({
              campaignId,
              url,
              platform,
              creatorName: creatorName || null,
              postStatus: isPlaceholder ? postStatus as "pending" | "briefed" | "active" | "done" : "active",
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
            });
            created++;
          }
        } catch (err) {
          console.error("Error importing row:", err);
        }
      }

      res.json({ ok: true, inserted: matched + created, matched, created });
    } catch (error) {
      console.error("Failed to import CSV:", error);
      res.status(500).json({ error: "Failed to import CSV file" });
    }
  });

  // ==================== CREATORS DATABASE ROUTES ====================

  // Get all creators for the current user
  app.get("/api/creators", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const creatorList = await storage.getCreators(userId);
      res.json(creatorList);
    } catch (error) {
      console.error("Failed to fetch creators:", error);
      res.status(500).json({ error: "Failed to fetch creators" });
    }
  });

  // Search creators by name or handle
  app.get("/api/creators/search", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const query = (req.query.q as string)?.trim();
      if (!query) {
        return res.json({ results: [] });
      }

      const results = await storage.searchCreators(userId, query);
      res.json({ results });
    } catch (error) {
      console.error("Failed to search creators:", error);
      res.status(500).json({ error: "Failed to search creators" });
    }
  });

  // Search creator names from existing social links (autocomplete for Add Creator modal)
  app.get("/api/social-links/creator-names/search", requireUser, async (req: any, res) => {
    try {
      const query = (req.query.q as string)?.trim();
      if (!query || query.length < 2) {
        return res.json({ results: [] });
      }

      const results = await storage.searchCreatorNamesFromLinks(query);
      res.json({ results });
    } catch (error) {
      console.error("Failed to search creator names:", error);
      res.status(500).json({ error: "Failed to search creator names" });
    }
  });

  // Import creators from CSV
  app.post("/api/creators/import", requireUser, upload.single("file"), async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const text = req.file.buffer.toString("utf8");
      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Array<{
        name?: string;
        handle?: string;
        platform?: string;
        notes?: string;
      }>;

      const creatorList = records
        .filter((r) => r.name && r.handle)
        .map((r) => ({
          ownerId: userId,
          name: r.name!.trim(),
          handle: r.handle!.trim(),
          platform: r.platform?.trim() || null,
          notes: r.notes?.trim() || null,
        }));

      if (!creatorList.length) {
        return res.status(400).json({ error: "No valid rows in CSV file. Required columns: name, handle" });
      }

      const inserted = await storage.createCreatorsBulk(creatorList);
      res.json({ ok: true, inserted });
    } catch (error) {
      console.error("Failed to import creators CSV:", error);
      res.status(500).json({ error: "Failed to import creators CSV" });
    }
  });

  // Start the scrape queue worker
  startScrapeQueueWorker();

  return httpServer;
}
