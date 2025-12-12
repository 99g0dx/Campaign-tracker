import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertSocialLinkSchema, postStatusOptions, insertTeamMemberSchema } from "@shared/schema";
import { z } from "zod";
import { scrapeSocialLink, getPlatformFromUrl } from "./scraper";
import { setupAuth, isAuthenticated } from "./replitAuth";
import profileRoutes from "./profileRoutes";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendPasswordResetEmail } from "./email";
import multer from "multer";
import { parse } from "csv-parse/sync";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

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
  // Setup authentication (includes /auth/login, /auth/logout, /auth/callback, /auth/user)
  await setupAuth(app);

  // Profile routes for KYC verification (requires authentication)
  app.use("/api/profile", profileRoutes);

  // Seed data on startup
  await storage.seedDataIfEmpty();

  // Get all campaigns with aggregated stats
  app.get("/api/campaigns", isAuthenticated, async (_req, res) => {
    try {
      const campaigns = await storage.getCampaignsWithStats();
      res.json(campaigns);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Get a single campaign
  app.get("/api/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }
      const campaign = await storage.getCampaign(id);
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
  app.post("/api/campaigns", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertCampaignSchema.safeParse(req.body);
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

  // Update campaign status
  app.patch("/api/campaigns/:id/status", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const statusSchema = z.object({
        status: z.enum(["Active", "Completed"]),
      });

      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const campaign = await storage.updateCampaignStatus(id, parsed.data.status);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Failed to update campaign status:", error);
      res.status(500).json({ error: "Failed to update campaign status" });
    }
  });

  // Get all social links
  app.get("/api/social-links", isAuthenticated, async (_req, res) => {
    try {
      const links = await storage.getSocialLinks();
      res.json(links);
    } catch (error) {
      console.error("Failed to fetch social links:", error);
      res.status(500).json({ error: "Failed to fetch social links" });
    }
  });

  // Get social links for a specific campaign
  app.get("/api/campaigns/:campaignId/social-links", isAuthenticated, async (req, res) => {
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
  app.post("/api/social-links", isAuthenticated, async (req, res) => {
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
      const linkData = {
        url,
        platform,
        campaignId,
        creatorName: creatorName || null,
        postStatus: postStatus || "pending" as const,
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
  app.post("/api/social-links/:id/rescrape", isAuthenticated, async (req, res) => {
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

  // Rescrape all social links for a campaign
  app.post("/api/campaigns/:id/rescrape-all", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const links = await storage.getSocialLinksByCampaign(id);
      const scrapableLinks = links.filter(l => !l.url.startsWith("placeholder://"));
      
      if (scrapableLinks.length === 0) {
        return res.json({ scraped: 0, total: 0 });
      }

      // Mark all as scraping
      await Promise.all(scrapableLinks.map(link => 
        storage.updateSocialLink(link.id, { status: "scraping" })
      ));

      // Start scraping all in background
      Promise.all(scrapableLinks.map(async (link) => {
        try {
          const result = await scrapeSocialLink(link.url);
          if (result.success && result.data) {
            await storage.updateSocialLink(link.id, {
              ...result.data,
              status: "scraped",
              lastScrapedAt: new Date(),
            });
            
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
        } catch (err: any) {
          console.error("Batch scraping error for link", link.id, err);
          await storage.updateSocialLink(link.id, {
            status: "error",
            errorMessage: err.message || "Scraping failed",
          });
        }
      }));

      res.json({ scraped: scrapableLinks.length, total: links.length, status: "scraping" });
    } catch (error) {
      console.error("Failed to batch rescrape:", error);
      res.status(500).json({ error: "Failed to batch rescrape" });
    }
  });

  // Get campaign engagement history for charts
  app.get("/api/campaigns/:id/engagement-history", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }
      
      const campaign = await storage.getCampaign(id);
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

  // Update social link (post status, creator name, url)
  app.patch("/api/social-links/:id", isAuthenticated, async (req, res) => {
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
        await storage.updateSocialLink(id, { 
          ...otherUpdates, 
          url, 
          platform, 
          status: "scraping" 
        });
        
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
  app.delete("/api/social-links/:id", isAuthenticated, async (req: any, res) => {
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
  
  // Enable or update share settings for a campaign
  app.post("/api/campaigns/:id/share", isAuthenticated, async (req, res) => {
    try {
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
      
      const campaign = await storage.getCampaign(id);
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

  // Get share status for a campaign
  app.get("/api/campaigns/:id/share", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const campaign = await storage.getCampaign(id);
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
  app.get("/api/auth/has-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
  app.post("/api/auth/set-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DEPLOYMENT_URL 
          ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
          : `${req.protocol}://${req.get('host')}`;
      
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
  app.get("/api/team-members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
  app.post("/api/team-members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
  app.delete("/api/team-members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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

  // Import posts from CSV for a campaign
  app.post("/api/campaigns/:id/import-posts", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user?.id;
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

      const campaign = await storage.getCampaign(campaignId);
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

      const validStatuses = new Set(postStatusOptions);
      const links = records
        .filter((r) => r.creator_name || r.url)
        .map((r) => {
          const url = r.url?.trim() || `placeholder://${Date.now()}-${Math.random()}`;
          const platform = url.startsWith("placeholder://") ? "Unknown" : getPlatformFromUrl(url);
          const rawStatus = r.status?.toLowerCase()?.trim() || "pending";
          const postStatus = validStatuses.has(rawStatus as any) ? rawStatus : "pending";
          return {
            campaignId,
            url,
            platform,
            creatorName: r.creator_name?.trim() || r.handle?.trim() || null,
            postStatus: postStatus as "pending" | "briefed" | "active" | "done",
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
          };
        });

      if (!links.length) {
        return res.status(400).json({ error: "No valid rows found in CSV file" });
      }

      const inserted = await storage.createSocialLinksBulk(links);
      res.json({ ok: true, inserted });
    } catch (error) {
      console.error("Failed to import CSV:", error);
      res.status(500).json({ error: "Failed to import CSV file" });
    }
  });

  // ==================== CREATORS DATABASE ROUTES ====================

  // Get all creators for the current user
  app.get("/api/creators", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
  app.get("/api/creators/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
  app.get("/api/social-links/creator-names/search", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/creators/import", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user?.id;
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

  return httpServer;
}
