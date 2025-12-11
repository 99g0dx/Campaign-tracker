import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Campaigns table - simplified to track song campaigns
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  songTitle: text("song_title").notNull(),
  songArtist: text("song_artist"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
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

// Users table (existing)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
