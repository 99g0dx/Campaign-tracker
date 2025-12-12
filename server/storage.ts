import { db } from "./db";
import { eq, desc, sql, asc, inArray, and, ilike, or } from "drizzle-orm";
import {
  campaigns,
  socialLinks,
  engagementHistory,
  users,
  teamMembers,
  creators,
  scrapeJobs,
  scrapeTasks,
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
  type Creator,
  type InsertCreator,
  type ScrapeJob,
  type InsertScrapeJob,
  type ScrapeTask,
  type InsertScrapeTask,
  type ScrapeJobWithStats,
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(userData: { email: string; passwordHash: string; fullName?: string; phone?: string; verificationCode?: string; verificationExpiresAt?: Date }): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, data: { fullName?: string; firstName?: string; lastName?: string; phone?: string; email?: string; verificationCode?: string | null; verificationExpiresAt?: Date | null; isVerified?: boolean }): Promise<User | undefined>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  updateUserResetToken(id: string, resetToken: string | null, resetTokenExpiresAt: Date | null): Promise<User | undefined>;
  
  // Campaigns
  getCampaigns(ownerId: string): Promise<Campaign[]>;
  getCampaignsWithStats(ownerId: string): Promise<CampaignWithStats[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  getCampaignForOwner(id: number, ownerId: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaignStatus(id: number, status: string): Promise<Campaign | undefined>;
  deleteCampaign(id: number, ownerId: string): Promise<boolean>;
  
  // Social Links
  getSocialLinks(): Promise<SocialLink[]>;
  getSocialLinksByCampaign(campaignId: number): Promise<SocialLink[]>;
  getSocialLink(id: number): Promise<SocialLink | undefined>;
  createSocialLink(link: InsertSocialLink): Promise<SocialLink>;
  updateSocialLink(id: number, data: Partial<SocialLink>): Promise<SocialLink | undefined>;
  deleteSocialLink(id: number): Promise<boolean>;
  
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
  
  // Creators database
  getCreators(ownerId: string): Promise<Creator[]>;
  searchCreators(ownerId: string, query: string): Promise<Creator[]>;
  createCreator(creator: InsertCreator): Promise<Creator>;
  createCreatorsBulk(creators: InsertCreator[]): Promise<number>;
  
  // Bulk social links
  createSocialLinksBulk(links: InsertSocialLink[]): Promise<number>;
  
  // Search creator names from existing social links
  searchCreatorNamesFromLinks(query: string): Promise<{ creatorName: string; platform: string }[]>;
  
  // Scrape jobs
  createScrapeJob(job: InsertScrapeJob): Promise<ScrapeJob>;
  createScrapeJobWithTasks(campaignId: number, links: SocialLink[]): Promise<{ job: ScrapeJob; tasks: ScrapeTask[] }>;
  getScrapeJob(id: number): Promise<ScrapeJob | undefined>;
  getScrapeJobWithStats(id: number): Promise<ScrapeJobWithStats | undefined>;
  getActiveScrapeJobForCampaign(campaignId: number): Promise<ScrapeJob | undefined>;
  getActiveJobs(): Promise<ScrapeJob[]>;
  updateScrapeJobStatus(id: number, status: string, completedAt?: Date): Promise<ScrapeJob | undefined>;
  
  // Scrape tasks
  getScrapeTasksByJob(jobId: number): Promise<ScrapeTask[]>;
  getScrapeTask(id: number): Promise<ScrapeTask | undefined>;
  getQueuedScrapeTasks(limit?: number): Promise<ScrapeTask[]>;
  updateScrapeTask(id: number, data: Partial<ScrapeTask>): Promise<ScrapeTask | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(userData: { email: string; passwordHash: string; fullName?: string; phone?: string; verificationCode?: string; verificationExpiresAt?: Date }): Promise<User> {
    const [user] = await db.insert(users).values({
      email: userData.email.toLowerCase(),
      passwordHash: userData.passwordHash,
      fullName: userData.fullName || null,
      phone: userData.phone || null,
      verificationCode: userData.verificationCode || null,
      verificationExpiresAt: userData.verificationExpiresAt || null,
      isVerified: false,
    }).returning();
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserResetToken(id: string, resetToken: string | null, resetTokenExpiresAt: Date | null): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        resetToken,
        resetTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getCampaigns(ownerId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns)
      .where(eq(campaigns.ownerId, ownerId))
      .orderBy(desc(campaigns.createdAt));
  }

  async getCampaignsWithStats(ownerId: string): Promise<CampaignWithStats[]> {
    const allCampaigns = await this.getCampaigns(ownerId);
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

  async getCampaignForOwner(id: number, ownerId: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.ownerId, ownerId)));
    return campaign;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async updateCampaignStatus(id: number, status: string): Promise<Campaign | undefined> {
    const [updated] = await db.update(campaigns)
      .set({ status })
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  async deleteCampaign(id: number, ownerId: string): Promise<boolean> {
    // First verify ownership
    const campaign = await this.getCampaignForOwner(id, ownerId);
    if (!campaign) {
      return false;
    }

    // Get all social links for this campaign
    const links = await this.getSocialLinksByCampaign(id);
    const linkIds = links.map(l => l.id);

    // Delete engagement history for all links
    if (linkIds.length > 0) {
      await db.delete(engagementHistory)
        .where(inArray(engagementHistory.socialLinkId, linkIds));
    }

    // Delete all social links for this campaign
    await db.delete(socialLinks)
      .where(eq(socialLinks.campaignId, id));

    // Delete the campaign
    const deleted = await db.delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.ownerId, ownerId)))
      .returning();

    return deleted.length > 0;
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

  async deleteSocialLink(id: number): Promise<boolean> {
    // First delete related engagement history (foreign key constraint)
    await db.delete(engagementHistory)
      .where(eq(engagementHistory.socialLinkId, id));
    
    // Then delete the social link
    const deleted = await db.delete(socialLinks)
      .where(eq(socialLinks.id, id))
      .returning();
    return deleted.length > 0;
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

  // Creators database
  async getCreators(ownerId: string): Promise<Creator[]> {
    return await db.select().from(creators).where(eq(creators.ownerId, ownerId)).orderBy(desc(creators.createdAt));
  }

  async searchCreators(ownerId: string, query: string): Promise<Creator[]> {
    const pattern = `%${query}%`;
    return await db.select()
      .from(creators)
      .where(
        and(
          eq(creators.ownerId, ownerId),
          or(
            ilike(creators.name, pattern),
            ilike(creators.handle, pattern)
          )
        )
      )
      .limit(10);
  }

  async createCreator(creator: InsertCreator): Promise<Creator> {
    const [newCreator] = await db.insert(creators).values(creator).returning();
    return newCreator;
  }

  async createCreatorsBulk(creatorList: InsertCreator[]): Promise<number> {
    if (creatorList.length === 0) return 0;
    const result = await db.insert(creators).values(creatorList).returning();
    return result.length;
  }

  // Bulk social links
  async createSocialLinksBulk(links: InsertSocialLink[]): Promise<number> {
    if (links.length === 0) return 0;
    const result = await db.insert(socialLinks).values(links).returning();
    return result.length;
  }

  // Search unique creator names from social links (for autocomplete)
  async searchCreatorNamesFromLinks(query: string): Promise<{ creatorName: string; platform: string }[]> {
    const pattern = `%${query}%`;
    const results = await db
      .selectDistinct({ 
        creatorName: socialLinks.creatorName,
        platform: socialLinks.platform
      })
      .from(socialLinks)
      .where(
        and(
          sql`${socialLinks.creatorName} IS NOT NULL`,
          sql`${socialLinks.creatorName} != ''`,
          ilike(socialLinks.creatorName, pattern)
        )
      )
      .limit(10);
    return results.filter(r => r.creatorName).map(r => ({
      creatorName: r.creatorName!,
      platform: r.platform
    }));
  }

  // Scrape job operations
  async createScrapeJob(job: InsertScrapeJob): Promise<ScrapeJob> {
    const [newJob] = await db.insert(scrapeJobs).values(job).returning();
    return newJob;
  }

  async createScrapeJobWithTasks(campaignId: number, links: SocialLink[]): Promise<{ job: ScrapeJob; tasks: ScrapeTask[] }> {
    const job = await this.createScrapeJob({ campaignId, status: "queued" });
    
    const taskValues: InsertScrapeTask[] = links.map(link => ({
      jobId: job.id,
      socialLinkId: link.id,
      url: link.url,
      platform: link.platform,
      status: "queued",
      attempts: 0,
    }));
    
    const tasks = await db.insert(scrapeTasks).values(taskValues).returning();
    return { job, tasks };
  }

  async getScrapeJob(id: number): Promise<ScrapeJob | undefined> {
    const [job] = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, id));
    return job;
  }

  async getScrapeJobWithStats(id: number): Promise<ScrapeJobWithStats | undefined> {
    const job = await this.getScrapeJob(id);
    if (!job) return undefined;
    
    const tasks = await this.getScrapeTasksByJob(id);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === "success" || t.status === "failed").length;
    const successfulTasks = tasks.filter(t => t.status === "success").length;
    const failedTasks = tasks.filter(t => t.status === "failed").length;
    
    return {
      ...job,
      totalTasks,
      completedTasks,
      successfulTasks,
      failedTasks,
    };
  }

  async getActiveScrapeJobForCampaign(campaignId: number): Promise<ScrapeJob | undefined> {
    const [job] = await db.select()
      .from(scrapeJobs)
      .where(
        and(
          eq(scrapeJobs.campaignId, campaignId),
          or(eq(scrapeJobs.status, "queued"), eq(scrapeJobs.status, "running"))
        )
      )
      .orderBy(desc(scrapeJobs.createdAt))
      .limit(1);
    return job;
  }

  async getActiveJobs(): Promise<ScrapeJob[]> {
    return db.select()
      .from(scrapeJobs)
      .where(
        or(eq(scrapeJobs.status, "queued"), eq(scrapeJobs.status, "running"))
      );
  }

  async updateScrapeJobStatus(id: number, status: string, completedAt?: Date): Promise<ScrapeJob | undefined> {
    const [updated] = await db.update(scrapeJobs)
      .set({ status, completedAt })
      .where(eq(scrapeJobs.id, id))
      .returning();
    return updated;
  }

  // Scrape task operations
  async getScrapeTasksByJob(jobId: number): Promise<ScrapeTask[]> {
    return await db.select().from(scrapeTasks).where(eq(scrapeTasks.jobId, jobId));
  }

  async getScrapeTask(id: number): Promise<ScrapeTask | undefined> {
    const [task] = await db.select().from(scrapeTasks).where(eq(scrapeTasks.id, id));
    return task;
  }

  async getQueuedScrapeTasks(limit: number = 10): Promise<ScrapeTask[]> {
    return await db.select()
      .from(scrapeTasks)
      .where(eq(scrapeTasks.status, "queued"))
      .orderBy(asc(scrapeTasks.id))
      .limit(limit);
  }

  async updateScrapeTask(id: number, data: Partial<ScrapeTask>): Promise<ScrapeTask | undefined> {
    const [updated] = await db.update(scrapeTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scrapeTasks.id, id))
      .returning();
    return updated;
  }

}

export const storage = new DatabaseStorage();
