import { db } from "./db";
import { eq, desc, asc } from "drizzle-orm";
import {
  campaigns,
  editingTasks,
  type Campaign,
  type InsertCampaign,
  type EditingTask,
  type InsertEditingTask,
} from "@shared/schema";

export interface IStorage {
  // Campaigns
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  
  // Editing Tasks
  getEditingTasks(): Promise<EditingTask[]>;
  getEditingTask(id: number): Promise<EditingTask | undefined>;
  createEditingTask(task: InsertEditingTask): Promise<EditingTask>;
  
  // Seeding
  seedDataIfEmpty(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async getEditingTasks(): Promise<EditingTask[]> {
    return await db.select().from(editingTasks).orderBy(asc(editingTasks.dueDate));
  }

  async getEditingTask(id: number): Promise<EditingTask | undefined> {
    const [task] = await db.select().from(editingTasks).where(eq(editingTasks.id, id));
    return task;
  }

  async createEditingTask(task: InsertEditingTask): Promise<EditingTask> {
    const [newTask] = await db.insert(editingTasks).values(task).returning();
    return newTask;
  }

  async seedDataIfEmpty(): Promise<void> {
    const existingCampaigns = await db.select().from(campaigns).limit(1);
    const existingTasks = await db.select().from(editingTasks).limit(1);

    if (existingCampaigns.length === 0) {
      console.log("Seeding campaigns...");
      const now = new Date();
      const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);

      await db.insert(campaigns).values([
        {
          name: "Kah-Lo - Somersaults TikTok Push",
          channel: "TikTok",
          status: "Active",
          spend: 500,
          impressions: 120000,
          clicks: 15000,
          conversions: 1200,
          revenue: 2200,
          engagementRate: 14,
          createdAt: daysAgo(6),
        },
        {
          name: "Rema Fan Edit Challenge",
          channel: "Instagram",
          status: "Active",
          spend: 800,
          impressions: 200000,
          clicks: 24000,
          conversions: 1800,
          revenue: 4100,
          engagementRate: 18,
          createdAt: daysAgo(4),
        },
        {
          name: "Brand UGC Influencer Sprint",
          channel: "YouTube",
          status: "Completed",
          spend: 1200,
          impressions: 300000,
          clicks: 35000,
          conversions: 3000,
          revenue: 6800,
          engagementRate: 16,
          createdAt: daysAgo(2),
        },
      ]);
    }

    if (existingTasks.length === 0) {
      console.log("Seeding editing tasks...");
      const now = new Date();
      const daysAhead = (days: number) => new Date(now.getTime() + days * 86400000);

      await db.insert(editingTasks).values([
        {
          title: "Somersaults TikTok Edit v1",
          campaignName: "Kah-Lo - Somersaults TikTok Push",
          assignee: "Tomi",
          status: "Editing",
          dueDate: daysAhead(1),
        },
        {
          title: "Rema Challenge Overlay Pack",
          campaignName: "Rema Fan Edit Challenge",
          assignee: "Ada",
          status: "In Review",
          dueDate: daysAhead(2),
        },
        {
          title: "UGC Script Refine",
          campaignName: "Brand UGC Influencer Sprint",
          assignee: "Emeka",
          status: "Approved",
          dueDate: daysAhead(3),
        },
        {
          title: "Instagram Reels Cutdown",
          campaignName: "Rema Fan Edit Challenge",
          assignee: "Daye",
          status: "Briefing",
          dueDate: daysAhead(4),
        },
        {
          title: "YouTube Thumbnail Concepts",
          campaignName: "Brand UGC Influencer Sprint",
          assignee: "Zee",
          status: "Blocked",
          dueDate: daysAhead(5),
        },
      ]);
    }
  }
}

export const storage = new DatabaseStorage();
