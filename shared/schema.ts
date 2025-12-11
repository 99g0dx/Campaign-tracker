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
