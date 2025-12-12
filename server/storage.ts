import { db } from "./db";
import { eq, desc, sql, asc, inArray, and } from "drizzle-orm";
import {
  campaigns,
  socialLinks,
  engagementHistory,
  users,
  teamMembers,
  type Campaign,
  type InsertCampaign,
  type SocialLink,
  type InsertSocialLink,
  type CampaignWithStats,
  type InsertEngagementHistory,
  type EngagementHistory,
  type User,
  type UpsertUser,
  type TeamMember,
  type InsertTeamMember,
} from "@shared/schema";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, data: { firstName?: string; lastName?: string; phone?: string; email?: string; verificationCode?: string | null; verificationExpiresAt?: Date | null; isVerified?: boolean }): Promise<User | undefined>;
  
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
  
  // Engagement History
  createEngagementSnapshot(data: InsertEngagementHistory): Promise<EngagementHistory>;
  getEngagementHistory(socialLinkId: number): Promise<EngagementHistory[]>;
  getCampaignEngagementHistory(campaignId: number): Promise<{ date: string; views: number; likes: number; comments: number; shares: number; totalEngagement: number }[]>;
  
  // Campaign sharing
  updateCampaignShare(id: number, shareData: { shareSlug?: string | null; sharePasswordHash?: string | null; shareEnabled: boolean; shareCreatedAt?: Date | null }): Promise<Campaign | undefined>;
  getCampaignByShareSlug(slug: string): Promise<Campaign | undefined>;
  
  // Team members
  getTeamMembers(ownerId: string): Promise<TeamMember[]>;
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  removeTeamMember(id: number, ownerId: string): Promise<boolean>;
  
  // Seeding
  seedDataIfEmpty(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      // Atomic upsert using INSERT ... ON CONFLICT
      // On conflict with id, update all fields except email to avoid unique constraint issues
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error: any) {
      // Handle email unique constraint violation for new users
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        // Insert without email for new user whose email is already taken
        const [user] = await db
          .insert(users)
          .values({ ...userData, email: null })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: new Date(),
            },
          })
          .returning();
        return user;
      }
      throw error;
    }
  }

  async updateUserProfile(id: string, data: { firstName?: string; lastName?: string; phone?: string; email?: string; verificationCode?: string | null; verificationExpiresAt?: Date | null; isVerified?: boolean }): Promise<User | undefined> {
    // If updating email, check if it's taken by another user
    if (data.email) {
      const [existingUser] = await db.select().from(users).where(eq(users.email, data.email));
      if (existingUser && existingUser.id !== id) {
        throw new Error('Email is already in use by another account');
      }
    }
    
    const [user] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

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

  async createEngagementSnapshot(data: InsertEngagementHistory): Promise<EngagementHistory> {
    const [snapshot] = await db.insert(engagementHistory).values(data).returning();
    return snapshot;
  }

  async getEngagementHistory(socialLinkId: number): Promise<EngagementHistory[]> {
    return await db.select()
      .from(engagementHistory)
      .where(eq(engagementHistory.socialLinkId, socialLinkId))
      .orderBy(asc(engagementHistory.recordedAt));
  }

  async getCampaignEngagementHistory(campaignId: number): Promise<{ date: string; views: number; likes: number; comments: number; shares: number; totalEngagement: number }[]> {
    const links = await this.getSocialLinksByCampaign(campaignId);
    const linkIds = links.map(l => l.id);
    
    if (linkIds.length === 0) {
      return [];
    }
    
    const history = await db.select()
      .from(engagementHistory)
      .where(inArray(engagementHistory.socialLinkId, linkIds))
      .orderBy(asc(engagementHistory.recordedAt));
    
    const groupedByDate = new Map<string, { views: number; likes: number; comments: number; shares: number; totalEngagement: number }>();
    
    for (const record of history) {
      const date = record.recordedAt.toISOString().split('T')[0];
      const existing = groupedByDate.get(date) || { views: 0, likes: 0, comments: 0, shares: 0, totalEngagement: 0 };
      
      groupedByDate.set(date, {
        views: existing.views + (record.views || 0),
        likes: existing.likes + (record.likes || 0),
        comments: existing.comments + (record.comments || 0),
        shares: existing.shares + (record.shares || 0),
        totalEngagement: existing.totalEngagement + (record.totalEngagement || 0),
      });
    }
    
    return Array.from(groupedByDate.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Campaign sharing
  async updateCampaignShare(id: number, shareData: { shareSlug?: string | null; sharePasswordHash?: string | null; shareEnabled: boolean; shareCreatedAt?: Date | null }): Promise<Campaign | undefined> {
    const [updated] = await db
      .update(campaigns)
      .set(shareData)
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  async getCampaignByShareSlug(slug: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.shareSlug, slug));
    return campaign;
  }

  // Team members
  async getTeamMembers(ownerId: string): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).where(eq(teamMembers.ownerId, ownerId)).orderBy(desc(teamMembers.createdAt));
  }

  async addTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [newMember] = await db.insert(teamMembers).values(member).returning();
    return newMember;
  }

  async removeTeamMember(id: number, ownerId: string): Promise<boolean> {
    const deleted = await db.delete(teamMembers)
      .where(and(eq(teamMembers.id, id), eq(teamMembers.ownerId, ownerId)))
      .returning();
    return deleted.length > 0;
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
