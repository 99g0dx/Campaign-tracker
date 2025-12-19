import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Campaigns table - simplified to track song campaigns
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull(),  // user who owns this campaign
  name: text("name").notNull(),
  songTitle: text("song_title").notNull(),
  songArtist: text("song_artist"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Sharing fields
  shareSlug: text("share_slug"),
  sharePasswordHash: text("share_password_hash"),
  shareEnabled: boolean("share_enabled").default(false).notNull(),
  shareCreatedAt: timestamp("share_created_at"),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  shareSlug: true,
  sharePasswordHash: true,
  shareEnabled: true,
  shareCreatedAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// Post status options for workflow tracking
export const postStatusOptions = ["pending", "briefed", "active", "done"] as const;
export type PostStatus = typeof postStatusOptions[number];

// Social links table for tracking social media posts
export const socialLinks = pgTable("social_links", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id).notNull(),
  url: text("url").notNull(),
  canonicalUrl: text("canonical_url"),  // Normalized URL for deduplication
  postKey: text("post_key"),            // Unique key: platform:canonicalUrl
  platform: text("platform").notNull(),
  postId: text("post_id"),
  creatorName: text("creator_name"),
  postStatus: text("post_status").notNull().default("pending"),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  engagementRate: real("engagement_rate").default(0),
  lastScrapedAt: timestamp("last_scraped_at"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSocialLinkSchema = createInsertSchema(socialLinks).omit({
  id: true,
  createdAt: true,
  lastScrapedAt: true,
  status: true,
  errorMessage: true,
});

export type InsertSocialLink = z.infer<typeof insertSocialLinkSchema>;
export type SocialLink = typeof socialLinks.$inferSelect;

// Campaign with aggregated stats from social links
export type CampaignWithStats = Campaign & {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEngagement: number;
  postCount: number;
};

// Unified campaign metrics response (single source of truth)
export type CampaignMetrics = {
  totals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  timeSeries: {
    date: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }[];
  trackedPostsCount: number;
  lastUpdatedAt: string | null;
};

// Engagement history for tracking metrics over time
export const engagementHistory = pgTable("engagement_history", {
  id: serial("id").primaryKey(),
  socialLinkId: integer("social_link_id").references(() => socialLinks.id).notNull(),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  totalEngagement: integer("total_engagement").default(0),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const insertEngagementHistorySchema = createInsertSchema(engagementHistory).omit({
  id: true,
  recordedAt: true,
});

export type InsertEngagementHistory = z.infer<typeof insertEngagementHistorySchema>;
export type EngagementHistory = typeof engagementHistory.$inferSelect;

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: text("sess").notNull(),
    expire: timestamp("expire").notNull(),
  }
);

// User storage table for local email/password authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  fullName: varchar("full_name"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  profileImageUrl: varchar("profile_image_url"),
  isVerified: boolean("is_verified").default(false).notNull(),
  verificationCode: varchar("verification_code"),
  verificationExpiresAt: timestamp("verification_expires_at"),
  // Password authentication
  passwordHash: text("password_hash"),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Team members table for profile management
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull(),  // user who owns this team member
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role"),                      // e.g. "Analyst", "Manager"
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
});

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

// Creators database for searchable creator lookup
export const creators = pgTable("creators", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull(),  // user who owns this creator entry
  name: text("name").notNull(),
  handle: text("handle").notNull(),
  platform: text("platform"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCreatorSchema = createInsertSchema(creators).omit({
  id: true,
  createdAt: true,
});

export type InsertCreator = z.infer<typeof insertCreatorSchema>;
export type Creator = typeof creators.$inferSelect;

// Scrape job status options
export const scrapeJobStatusOptions = ["queued", "running", "done", "failed"] as const;
export type ScrapeJobStatus = typeof scrapeJobStatusOptions[number];

// Scrape task status options
export const scrapeTaskStatusOptions = ["queued", "running", "success", "failed"] as const;
export type ScrapeTaskStatus = typeof scrapeTaskStatusOptions[number];

// Scrape jobs table - tracks batch scrape operations
export const scrapeJobs = pgTable("scrape_jobs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id).notNull(),
  status: text("status").notNull().default("queued"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertScrapeJobSchema = createInsertSchema(scrapeJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertScrapeJob = z.infer<typeof insertScrapeJobSchema>;
export type ScrapeJob = typeof scrapeJobs.$inferSelect;

// Scrape tasks table - individual scraping tasks within a job
export const scrapeTasks = pgTable("scrape_tasks", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => scrapeJobs.id).notNull(),
  socialLinkId: integer("social_link_id").references(() => socialLinks.id).notNull(),
  url: text("url").notNull(),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  resultViews: integer("result_views"),
  resultLikes: integer("result_likes"),
  resultComments: integer("result_comments"),
  resultShares: integer("result_shares"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScrapeTaskSchema = createInsertSchema(scrapeTasks).omit({
  id: true,
  updatedAt: true,
});

export type InsertScrapeTask = z.infer<typeof insertScrapeTaskSchema>;
export type ScrapeTask = typeof scrapeTasks.$inferSelect;

// Job with aggregated task stats
export type ScrapeJobWithStats = ScrapeJob & {
  totalTasks: number;
  completedTasks: number;
  successfulTasks: number;
  failedTasks: number;
};
