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
  app.get("/api/campaigns", async (_req, res) => {
    try {
      const campaigns = await storage.getCampaignsWithStats();
      res.json(campaigns);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Get a single campaign
  app.get("/api/campaigns/:id", async (req, res) => {
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
  app.post("/api/campaigns", async (req, res) => {
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

  // Get all social links
  app.get("/api/social-links", async (_req, res) => {
    try {
      const links = await storage.getSocialLinks();
      res.json(links);
    } catch (error) {
      console.error("Failed to fetch social links:", error);
      res.status(500).json({ error: "Failed to fetch social links" });
    }
  });

  // Get social links for a specific campaign
  app.get("/api/campaigns/:campaignId/social-links", async (req, res) => {
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
  app.post("/api/social-links", async (req, res) => {
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
  app.post("/api/social-links/:id/rescrape", async (req, res) => {
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
  app.post("/api/campaigns/:id/rescrape-all", async (req, res) => {
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
  app.get("/api/campaigns/:id/engagement-history", async (req, res) => {
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
  app.patch("/api/social-links/:id", async (req, res) => {
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

      const campaign = await storage.getCampaignByShareSlug(slug);
      if (!campaign || !campaign.shareEnabled || !campaign.sharePasswordHash) {
        return res.status(404).json({ error: "Campaign not available" });
      }

      const isValid = await bcrypt.compare(password, campaign.sharePasswordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Incorrect password" });
      }

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
      });
    } catch (error) {
      console.error("Failed to fetch public campaign:", error);
      res.status(500).json({ error: "Failed to fetch campaign" });
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

  return httpServer;
}
