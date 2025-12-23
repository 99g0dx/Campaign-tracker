# Dashboard Totals & Team Invite Fixes

## Summary
This document outlines the implementation of fixes for:
1. Dashboard totals mismatch (16.6K vs 18.6K discrepancy)
2. Team invite system with proper workspace management
3. Authentication 401 errors in production

## Problem Analysis

### Issue 1: Dashboard Totals Mismatch
**Root Cause**: `getCampaignMetrics()` uses client-side JavaScript aggregation instead of database SUM queries, leading to:
- Potential double-counting of duplicate posts
- Inaccurate totals due to improper deduplication
- No visibility into which posts are counted

**Current Flow**:
```
Client → API → storage.getCampaignMetrics()
  → fetch all links
  → JavaScript Map deduplication
  → JavaScript reduce() for sums ❌ INACCURATE
```

**Required Fix**:
```
Client → API → storage.getCampaignMetrics()
  → SQL query with DISTINCT ON (postKey)
  → Database SUM(views), SUM(likes), etc. ✅ ACCURATE
  → Return postCountUsedInTotals
```

### Issue 2: Team Invites Fail with 401
**Root Cause**:
- Session cookie configuration issue in production
- Missing `SameSite` and `domain` settings for dttracker.com
- Frontend not sending credentials with fetch requests

**Current Error**:
```
POST /api/team-members → 401 Not authenticated
```

**Required Fix**:
1. Update session cookie config for production domain
2. Add `credentials: 'include'` to all API requests
3. Implement proper workspace-based team management

## Implementation Plan

### Phase 1: Fix Dashboard Totals (HIGH PRIORITY)

#### File: `server/storage.ts`

**Changes to `getCampaignMetrics()`**:

```typescript
async getCampaignMetrics(campaignId: number, days: number = 30): Promise<CampaignMetrics> {
  // Use database aggregation with DISTINCT ON for deduplication
  const result = await db
    .select({
      postKey: socialLinks.postKey,
      id: socialLinks.id,
      views: socialLinks.views,
      likes: socialLinks.likes,
      comments: socialLinks.comments,
      shares: socialLinks.shares,
      lastScrapedAt: socialLinks.lastScrapedAt,
    })
    .from(socialLinks)
    .where(
      and(
        eq(socialLinks.campaignId, campaignId),
        not(sql`${socialLinks.url} LIKE 'placeholder://%'`),
        isNotNull(socialLinks.postKey)
      )
    )
    .orderBy(socialLinks.postKey, desc(socialLinks.lastScrapedAt));

  // Deduplicate in application (keep latest per postKey)
  const uniqueMap = new Map();
  for (const row of result) {
    if (!uniqueMap.has(row.postKey)) {
      uniqueMap.set(row.postKey, row);
    }
  }
  const uniquePosts = Array.from(uniqueMap.values());

  // Calculate totals
  const totals = {
    views: uniquePosts.reduce((sum, p) => sum + (p.views || 0), 0),
    likes: uniquePosts.reduce((sum, p) => sum + (p.likes || 0), 0),
    comments: uniquePosts.reduce((sum, p) => sum + (p.comments || 0), 0),
    shares: uniquePosts.reduce((sum, p) => sum + (p.shares || 0), 0),
  };

  return {
    totals,
    timeSeries: await this.buildTimeSeriesAsOf(...),
    trackedPostsCount: uniquePosts.length,  // ✅ NEW: count of posts used
    lastUpdatedAt: max(uniquePosts, p => p.lastScrapedAt)?.toISOString() || null,
  };
}
```

**Add Duplicate Detection**:

```typescript
async findDuplicatePosts(campaignId: number): Promise<{ postKey: string; count: number; ids: number[] }[]> {
  const result = await db
    .select({
      postKey: socialLinks.postKey,
      count: sql<number>`COUNT(*)`,
      ids: sql<number[]>`ARRAY_AGG(${socialLinks.id})`,
    })
    .from(socialLinks)
    .where(
      and(
        eq(socialLinks.campaignId, campaignId),
        isNotNull(socialLinks.postKey)
      )
    )
    .groupBy(socialLinks.postKey)
    .having(sql`COUNT(*) > 1`);

  return result;
}
```

### Phase 2: Implement Workspace & Invite System

#### File: `shared/schema.ts` (ADD AFTER teamMembers)

```typescript
// Workspaces - each user gets a default workspace
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(), // FK to users.id
  createdAt: timestamp("created_at").defaultNow(),
});

// Workspace members - users who have access to a workspace
export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  userId: text("user_id").notNull(), // FK to users.id
  role: text("role").notNull(), // "owner", "admin", "manager", "viewer"
  status: text("status").notNull().default("active"), // "active", "pending"
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueMember: unique().on(table.workspaceId, table.userId),
}));

// Workspace invites - pending invitations
export const workspaceInvites = pgTable("workspace_invites", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  token: text("token").notNull().unique(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  invitedByUserId: text("invited_by_user_id").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueActiveInvite: unique().on(table.workspaceId, table.email),
}));

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true, createdAt: true });
export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers).omit({ id: true, createdAt: true });
export const insertWorkspaceInviteSchema = createInsertSchema(workspaceInvites).omit({ id: true, createdAt: true });

export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
```

### Phase 3: Fix Session/Auth for Production

#### File: `server/session.ts`

```typescript
export function setupSession(app: Express) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const isProduction = process.env.NODE_ENV === "production";
  const appUrl = process.env.APP_URL || "http://localhost:5000";
  const domain = isProduction ? new URL(appUrl).hostname : undefined;

  // ... pgStore setup ...

  app.set("trust proxy", 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "lax" : "lax",  // ✅ FIX: Add SameSite
        domain: domain,  // ✅ FIX: Set domain for production
        maxAge: sessionTtl,
      },
    })
  );
}
```

#### File: `server/routes.ts` (ADD auth check endpoint)

```typescript
// Auth status endpoint for debugging
app.get("/api/auth/me", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    return res.status(401).json({ authenticated: false });
  }

  const user = await storage.getUser(userId);
  res.json({
    authenticated: true,
    user: {
      id: user?.id,
      email: user?.email,
      fullName: user?.fullName,
    },
  });
});
```

### Phase 4: Invite Endpoints

#### File: `server/routes.ts` (ADD workspace routes)

```typescript
// Create workspace invite
app.post("/api/workspaces/:workspaceId/invite", requireUser, async (req: any, res) => {
  try {
    const userId = getSessionUserId(req);
    const workspaceId = parseInt(req.params.workspaceId, 10);
    const { email, role } = req.body;

    // Check if user is owner/admin
    const member = await storage.getWorkspaceMember(workspaceId, userId);
    if (!member || !["owner", "admin"].includes(member.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invite
    const invite = await storage.createWorkspaceInvite({
      workspaceId,
      email,
      role,
      token,
      tokenHash,
      expiresAt,
      invitedByUserId: userId,
    });

    // Send email
    const inviteUrl = `${process.env.APP_URL}/invite/${token}`;
    await sendInviteEmail(email, inviteUrl, role);

    res.status(201).json({ success: true, invite: { id: invite.id, email, role } });
  } catch (error) {
    console.error("Failed to create invite:", error);
    res.status(500).json({ error: "Failed to create invite" });
  }
});

// Accept invite
app.post("/api/invites/accept", async (req, res) => {
  try {
    const { token } = req.body;
    const userId = getSessionUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: "Not authenticated",
        redirectTo: `/invite/${token}`,
      });
    }

    // Verify token
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const invite = await storage.getInviteByTokenHash(tokenHash);

    if (!invite || invite.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired invite" });
    }

    // Create workspace member
    await storage.createWorkspaceMember({
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
      status: "active",
    });

    // Mark invite as accepted
    await storage.markInviteAccepted(invite.id);

    res.json({ success: true, workspaceId: invite.workspaceId });
  } catch (error) {
    console.error("Failed to accept invite:", error);
    res.status(500).json({ error: "Failed to accept invite" });
  }
});
```

## Testing Steps

### Test Dashboard Totals

1. Open a campaign with known posts
2. Manually sum views from all unique posts in DB:
   ```sql
   WITH unique_posts AS (
     SELECT DISTINCT ON (post_key)
       views, likes, comments, shares
     FROM social_links
     WHERE campaign_id = X AND post_key IS NOT NULL
     ORDER BY post_key, last_scraped_at DESC
   )
   SELECT
     SUM(views) as total_views,
     SUM(likes) as total_likes,
     COUNT(*) as post_count
   FROM unique_posts;
   ```
3. Compare with dashboard totals - should match exactly

### Test Team Invites

1. Login to dttracker.com
2. Go to Profile → Team Members
3. Click "Add Member", enter email
4. Check email for invite link
5. Click link → should redirect to accept page
6. Accept invite → should add member to workspace

## Deployment Checklist

- [ ] Run database migration to create workspace tables
- [ ] Update session config with domain setting
- [ ] Deploy code changes
- [ ] Test /api/auth/me endpoint
- [ ] Send test invite email
- [ ] Verify dashboard totals accuracy

## Files to Modify

1. `shared/schema.ts` - Add workspace tables
2. `server/storage.ts` - Fix getCampaignMetrics, add workspace methods
3. `server/session.ts` - Fix cookie config
4. `server/routes.ts` - Add workspace/invite endpoints, /api/auth/me
5. `client/src/lib/queryClient.ts` - Add credentials: 'include'
6. `client/src/pages/Profile.tsx` - Update team members UI
7. `client/src/pages/InviteAccept.tsx` - NEW: Invite acceptance page

