import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertEditingTaskSchema } from "@shared/schema";
import { z } from "zod";

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

  return httpServer;
}
