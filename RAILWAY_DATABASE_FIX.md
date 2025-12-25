# Railway Database Connection Fix

## Problem
The app is getting `password authentication failed for user "postgres"` errors, preventing deployment.

## Solution Steps

### Step 1: Check Railway PostgreSQL Service

1. Go to https://railway.app/dashboard
2. Select your project: **sweet-flexibility**
3. Look for the **PostgreSQL** service (separate from Campaign-tracker service)
4. Click on it to check if it's running

### Step 2: Check Database Variables

In the PostgreSQL service:
1. Go to **Variables** tab
2. Look for these variables:
   - `PGDATABASE`
   - `PGHOST`
   - `PGPASSWORD`
   - `PGPORT`
   - `PGUSER`
   - `DATABASE_URL`

3. Copy the `DATABASE_URL` value

### Step 3: Update Campaign-tracker Service Variables

1. Go back to **Campaign-tracker** service
2. Go to **Variables** tab
3. Update or add these variables with values from PostgreSQL service:
   - `DATABASE_URL` = (the full PostgreSQL DATABASE_URL)
   - `DATABASE_PUBLIC_URL` = (the full PostgreSQL DATABASE_PUBLIC_URL if available)

### Step 4: Run SQL Migration Manually

If the database exists but tables don't:

1. In Railway dashboard → PostgreSQL service → **Data** tab
2. Click **Query** button
3. Copy and paste the SQL below
4. Click **Run** to execute

```sql
-- Create all required tables
CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"song_title" text NOT NULL,
	"song_artist" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"share_slug" text,
	"share_password_hash" text,
	"share_enabled" boolean DEFAULT false NOT NULL,
	"share_created_at" timestamp
);

CREATE TABLE IF NOT EXISTS "creators" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"handle" text NOT NULL,
	"platform" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"email" text,
	"full_name" text,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"profile_image_url" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verification_code" text,
	"verification_expires_at" timestamp,
	"password_hash" text,
	"reset_token" text,
	"reset_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "social_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text,
	"post_key" text,
	"platform" text NOT NULL,
	"post_id" text,
	"creator_name" text,
	"post_status" text DEFAULT 'pending' NOT NULL,
	"views" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"engagement_rate" real DEFAULT 0,
	"last_scraped_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "engagement_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"social_link_id" integer NOT NULL,
	"views" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"total_engagement" integer DEFAULT 0,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "scrape_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "scrape_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"social_link_id" integer NOT NULL,
	"url" text NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"result_views" integer,
	"result_likes" integer,
	"result_comments" integer,
	"result_shares" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"sid" text PRIMARY KEY NOT NULL,
	"sess" text NOT NULL,
	"expire" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspace_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspace_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invites_token_unique" UNIQUE("token"),
	CONSTRAINT "workspace_invites_token_hash_unique" UNIQUE("token_hash")
);

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'engagement_history_social_link_id_social_links_id_fk') THEN
        ALTER TABLE "engagement_history" ADD CONSTRAINT "engagement_history_social_link_id_social_links_id_fk"
        FOREIGN KEY ("social_link_id") REFERENCES "public"."social_links"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scrape_jobs_campaign_id_campaigns_id_fk') THEN
        ALTER TABLE "scrape_jobs" ADD CONSTRAINT "scrape_jobs_campaign_id_campaigns_id_fk"
        FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scrape_tasks_job_id_scrape_jobs_id_fk') THEN
        ALTER TABLE "scrape_tasks" ADD CONSTRAINT "scrape_tasks_job_id_scrape_jobs_id_fk"
        FOREIGN KEY ("job_id") REFERENCES "public"."scrape_jobs"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scrape_tasks_social_link_id_social_links_id_fk') THEN
        ALTER TABLE "scrape_tasks" ADD CONSTRAINT "scrape_tasks_social_link_id_social_links_id_fk"
        FOREIGN KEY ("social_link_id") REFERENCES "public"."social_links"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_links_campaign_id_campaigns_id_fk') THEN
        ALTER TABLE "social_links" ADD CONSTRAINT "social_links_campaign_id_campaigns_id_fk"
        FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_invites_workspace_id_workspaces_id_fk') THEN
        ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_workspace_id_workspaces_id_fk') THEN
        ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk"
        FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

-- Verify tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Step 5: Trigger New Deployment

After fixing the database:

1. In Campaign-tracker service → **Deployments** tab
2. Click **Deploy** or **Redeploy**
3. Or push a small change to trigger auto-deploy

## Verification

After deployment completes, check:
1. New bundle is served: https://dttracker.com should have a new `index-XXXXXX.js` file
2. No crash loops in logs
3. Dashboard totals are correct
4. Team invite works without 401 errors
5. CSV import works
6. Sort dropdown is visible

## If PostgreSQL Service Doesn't Exist

If you don't see a separate PostgreSQL service:

1. Click **+ New** in your Railway project
2. Select **Database** → **PostgreSQL**
3. Once created, copy its `DATABASE_URL`
4. Add it to Campaign-tracker service variables
5. Run the SQL migration above
6. Redeploy Campaign-tracker
