import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertEditingTaskSchema, insertSocialLinkSchema } from "@shared/schema";
import { z } from "zod";
import { scrapeSocialLink, getPlatformFromUrl } from "./scraper";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed data on startup
  await storage.seedDataIfEmpty();

  // Get all campaigns
  app.get("/api/campaigns", async (_req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      // Compute ROI and CPA for each campaign
      const enrichedCampaigns = campaigns.map((c) => ({
        ...c,
        cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
        roi: c.spend > 0 ? ((c.revenue - c.spend) / c.spend) * 100 : 0,
      }));
      res.json(enrichedCampaigns);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
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
      res.status(201).json({
        ...campaign,
        cpa: campaign.conversions > 0 ? campaign.spend / campaign.conversions : 0,
        roi: campaign.spend > 0 ? ((campaign.revenue - campaign.spend) / campaign.spend) * 100 : 0,
      });
    } catch (error) {
      console.error("Failed to create campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  // Get all editing tasks
  app.get("/api/editing-tasks", async (_req, res) => {
    try {
      const tasks = await storage.getEditingTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Failed to fetch editing tasks:", error);
      res.status(500).json({ error: "Failed to fetch editing tasks" });
    }
  });

  // Create a new editing task
  app.post("/api/editing-tasks", async (req, res) => {
    try {
      const parsed = insertEditingTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const task = await storage.createEditingTask(parsed.data);
      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create editing task:", error);
      res.status(500).json({ error: "Failed to create editing task" });
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
        url: z.string().url("Please enter a valid URL"),
        campaignId: z.number().optional(),
      });

      const parsed = urlSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const { url, campaignId } = parsed.data;
      const platform = getPlatformFromUrl(url);

      if (platform === "Unknown") {
        return res.status(400).json({ 
          error: "Unsupported platform. Supported: TikTok, Instagram, YouTube, Twitter, Facebook" 
        });
      }

      // Create the social link entry
      const linkData = {
        url,
        platform,
        campaignId: campaignId ?? null,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagementRate: 0,
      };

      const link = await storage.createSocialLink(linkData);

      // Start scraping in background and update
      scrapeSocialLink(url).then(async (result) => {
        if (result.success && result.data) {
          await storage.updateSocialLink(link.id, {
            ...result.data,
            status: "scraped",
            lastScrapedAt: new Date(),
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

  return httpServer;
}
