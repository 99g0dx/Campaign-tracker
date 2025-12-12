import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertSocialLinkSchema, postStatusOptions } from "@shared/schema";
import { z } from "zod";
import { scrapeSocialLink, getPlatformFromUrl } from "./scraper";
import { setupAuth, isAuthenticated } from "./replitAuth";
import profileRoutes from "./profileRoutes";

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

  return httpServer;
}
