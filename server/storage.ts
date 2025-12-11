import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import {
  campaigns,
  socialLinks,
  type Campaign,
  type InsertCampaign,
  type SocialLink,
  type InsertSocialLink,
  type CampaignWithStats,
} from "@shared/schema";

export interface IStorage {
  // Campaigns
  getCampaigns(): Promise<Campaign[]>;
  getCampaignsWithStats(): Promise<CampaignWithStats[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  
  // Social Links
  getSocialLinks(): Promise<SocialLink[]>;
  getSocialLinksByCampaign(campaignId: number): Promise<SocialLink[]>;
  getSocialLink(id: number): Promise<SocialLink | undefined>;
  createSocialLink(link: InsertSocialLink): Promise<SocialLink>;
  updateSocialLink(id: number, data: Partial<SocialLink>): Promise<SocialLink | undefined>;
  
  // Seeding
  seedDataIfEmpty(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async getCampaignsWithStats(): Promise<CampaignWithStats[]> {
    const allCampaigns = await this.getCampaigns();
    const allLinks = await this.getSocialLinks();
    
    return allCampaigns.map((campaign) => {
      const campaignLinks = allLinks.filter((link) => link.campaignId === campaign.id);
      const totalViews = campaignLinks.reduce((sum, l) => sum + (l.views || 0), 0);
      const totalLikes = campaignLinks.reduce((sum, l) => sum + (l.likes || 0), 0);
      const totalComments = campaignLinks.reduce((sum, l) => sum + (l.comments || 0), 0);
      const totalShares = campaignLinks.reduce((sum, l) => sum + (l.shares || 0), 0);
      
      return {
        ...campaign,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalEngagement: totalLikes + totalComments + totalShares,
        postCount: campaignLinks.length,
      };
    });
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async getSocialLinks(): Promise<SocialLink[]> {
    return await db.select().from(socialLinks).orderBy(desc(socialLinks.createdAt));
  }

  async getSocialLinksByCampaign(campaignId: number): Promise<SocialLink[]> {
    return await db.select().from(socialLinks)
      .where(eq(socialLinks.campaignId, campaignId))
      .orderBy(desc(socialLinks.createdAt));
  }

  async getSocialLink(id: number): Promise<SocialLink | undefined> {
    const [link] = await db.select().from(socialLinks).where(eq(socialLinks.id, id));
    return link;
  }

  async createSocialLink(link: InsertSocialLink): Promise<SocialLink> {
    const [newLink] = await db.insert(socialLinks).values(link).returning();
    return newLink;
  }

  async updateSocialLink(id: number, data: Partial<SocialLink>): Promise<SocialLink | undefined> {
    const [updated] = await db.update(socialLinks)
      .set(data)
      .where(eq(socialLinks.id, id))
      .returning();
    return updated;
  }

  async seedDataIfEmpty(): Promise<void> {
    const existingCampaigns = await db.select().from(campaigns).limit(1);

    if (existingCampaigns.length === 0) {
      console.log("Seeding sample campaigns...");
      await db.insert(campaigns).values([
        {
          name: "Summer Vibes Launch",
          songTitle: "Summertime",
          songArtist: "DJ Sunny",
          status: "Active",
        },
        {
          name: "Viral Dance Challenge",
          songTitle: "Move It",
          songArtist: "Beat Master",
          status: "Active",
        },
        {
          name: "Holiday Special",
          songTitle: "Jingle Beats",
          songArtist: "Winter Sound",
          status: "Completed",
        },
      ]);
    }
  }
}

export const storage = new DatabaseStorage();
