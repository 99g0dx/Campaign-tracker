import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull().default("Draft"),
  spend: real("spend").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  revenue: real("revenue").notNull().default(0),
  engagementRate: real("engagement_rate").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// Editing tasks table
export const editingTasks = pgTable("editing_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  campaignName: text("campaign_name").notNull(),
  assignee: text("assignee").notNull(),
  status: text("status").notNull().default("Briefing"),
  dueDate: timestamp("due_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEditingTaskSchema = createInsertSchema(editingTasks).omit({
  id: true,
  createdAt: true,
});

export type InsertEditingTask = z.infer<typeof insertEditingTaskSchema>;
export type EditingTask = typeof editingTasks.$inferSelect;

// Social links table for tracking social media posts
export const socialLinks = pgTable("social_links", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  url: text("url").notNull(),
  platform: text("platform").notNull(),
  postId: text("post_id"),
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
