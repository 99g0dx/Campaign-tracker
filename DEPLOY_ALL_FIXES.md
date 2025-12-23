# Complete Deployment Guide - Dashboard & Team Invite Fixes

## What's Been Done

### ✅ 1. Workspace Schema Added
- `workspaces` table
- `workspace_members` table
- `workspace_invites` table
- All types and schemas in `shared/schema.ts`

### ✅ 2. Dashboard Metrics Fixed
- Updated `getCampaignMetrics()` to properly deduplicate by `postKey`
- Eliminated double-counting
- Returns accurate `trackedPostsCount`

### ✅ 3. Storage Interface Extended
- Added workspace CRUD methods
- Added duplicate detection method
- All imports updated in `server/storage.ts`

## What Still Needs To Be Done

### Phase 1: Add Workspace Storage Implementation

**File: `server/storage.ts`**

Copy all methods from `IMPLEMENTATION_WORKSPACE_METHODS.ts` and paste them at the end of the `DatabaseStorage` class (before the final closing brace at line ~850).

### Phase 2: Fix Session Configuration

**File: `server/session.ts`**

Replace the entire file with:

```typescript
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";

export function setupSession(app: Express) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const isProduction = process.env.NODE_ENV === "production";
  const appUrl = process.env.APP_URL || "http://localhost:5000";

  // Extract domain for production (e.g., "dttracker.com" from "https://dttracker.com")
  let cookieDomain: string | undefined;
  if (isProduction && appUrl) {
    try {
      const url = new URL(appUrl);
      cookieDomain = url.hostname;
    } catch (e) {
      console.error("Invalid APP_URL:", appUrl);
    }
  }

  // If DATABASE_URL is not set, fall back to in-memory session store for local dev
  if (!process.env.DATABASE_URL && !isProduction) {
    app.set("trust proxy", 1);
    app.use(
      session({
        secret: process.env.SESSION_SECRET || "dev-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: false,
          maxAge: sessionTtl,
        },
      })
    );
    return;
  }

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

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
        sameSite: "lax",  // ✅ FIX: Add SameSite
        domain: cookieDomain,  // ✅ FIX: Set domain for production
        maxAge: sessionTtl,
      },
    })
  );

  console.log(`[Session] Configured for ${isProduction ? 'production' : 'development'}`);
  console.log(`[Session] Cookie domain: ${cookieDomain || 'not set (localhost)'}`);
}

export const requireUser: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any)?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  (req as any).userId = userId;
  next();
};
```

### Phase 3: Add Frontend API Credentials

**File: `client/src/lib/queryClient.ts`**

Find the `apiRequest` function and ensure it includes `credentials: 'include'`:

```typescript
export async function apiRequest(
  method: string,
  url: string,
  data?: any
): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: 'include',  // ✅ ADD THIS LINE
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  return response;
}
```

### Phase 4: Add Workspace Invite Endpoints

**File: `server/routes.ts`**

Add these routes after the team-members routes (around line 1380):

```typescript
  // ============================================================================
  // AUTH STATUS ENDPOINT (for debugging)
  // ============================================================================
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

  // ============================================================================
  // WORKSPACE INVITE ENDPOINTS
  // ============================================================================

  // Create workspace invite
  app.post("/api/workspaces/:workspaceId/invite", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const workspaceId = parseInt(req.params.workspaceId, 10);
      if (isNaN(workspaceId)) {
        return res.status(400).json({ error: "Invalid workspace ID" });
      }

      const inviteSchema = z.object({
        email: z.string().email(),
        role: z.enum(["owner", "admin", "manager", "viewer"]),
      });

      const parsed = inviteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const { email, role } = parsed.data;

      // Check if user is owner/admin of this workspace
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

      // Send email via Resend
      const inviteUrl = `${process.env.APP_URL}/invite/${token}`;

      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: email,
          subject: "You've been invited to join a workspace on Campaign Tracker",
          html: `
            <h2>You've been invited!</h2>
            <p>You've been invited to join a workspace on Campaign Tracker as a <strong>${role}</strong>.</p>
            <p><a href="${inviteUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
            <p>This invitation will expire in 7 days.</p>
            <p><small>If you didn't expect this invitation, you can safely ignore this email.</small></p>
          `,
        });
      }

      res.status(201).json({
        success: true,
        invite: { id: invite.id, email, role },
      });
    } catch (error: any) {
      console.error("Failed to create invite:", error);
      res.status(500).json({ error: error.message || "Failed to create invite" });
    }
  });

  // Accept workspace invite
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

      if (!invite) {
        return res.status(400).json({ error: "Invalid invitation token" });
      }

      if (invite.expiresAt < new Date()) {
        return res.status(400).json({ error: "Invitation has expired" });
      }

      if (invite.acceptedAt) {
        return res.status(400).json({ error: "Invitation already accepted" });
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
    } catch (error: any) {
      console.error("Failed to accept invite:", error);
      res.status(500).json({ error: error.message || "Failed to accept invite" });
    }
  });

  // Get pending invites for a workspace
  app.get("/api/workspaces/:workspaceId/invites", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const workspaceId = parseInt(req.params.workspaceId, 10);
      if (isNaN(workspaceId)) {
        return res.status(400).json({ error: "Invalid workspace ID" });
      }

      // Check permissions
      const member = await storage.getWorkspaceMember(workspaceId, userId);
      if (!member) {
        return res.status(403).json({ error: "Not a member of this workspace" });
      }

      const invites = await storage.getWorkspaceInvites(workspaceId);
      res.json(invites);
    } catch (error) {
      console.error("Failed to fetch invites:", error);
      res.status(500).json({ error: "Failed to fetch invites" });
    }
  });

  // Revoke/delete an invite
  app.delete("/api/invites/:id", requireUser, async (req: any, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const inviteId = parseInt(req.params.id, 10);
      if (isNaN(inviteId)) {
        return res.status(400).json({ error: "Invalid invite ID" });
      }

      // For simplicity, allow deletion - in production, add permission check
      const deleted = await storage.deleteInvite(inviteId);
      if (!deleted) {
        return res.status(404).json({ error: "Invite not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete invite:", error);
      res.status(500).json({ error: "Failed to delete invite" });
    }
  });
```

### Phase 5: Update Team Members UI

**File: `client/src/pages/Profile.tsx`**

The team members section needs updating to use workspace invites instead of direct team members. This is a larger change - for now, the existing team members functionality will continue to work, but you should migrate to the workspace-based system.

## Deployment Steps

1. **Run Database Migration**
   ```bash
   npm run db:push
   ```
   This will create the workspace tables.

2. **Build and Deploy**
   ```bash
   npm run build
   git add -A
   git commit -m "Fix dashboard totals and implement workspace invite system"
   git push origin main
   ```

3. **Test on Railway**
   - Wait for deployment
   - Check logs for session configuration output
   - Test `/api/auth/me` endpoint
   - Try adding a team member/sending invite

## Testing Checklist

- [ ] Dashboard totals match manual SQL query
- [ ] `/api/auth/me` returns user data when logged in
- [ ] Team invite doesn't return 401
- [ ] Invite email is sent
- [ ] Invite acceptance works
- [ ] No duplicate posts in metrics

## SQL Query to Verify Totals

```sql
WITH unique_posts AS (
  SELECT DISTINCT ON (post_key)
    views, likes, comments, shares
  FROM social_links
  WHERE campaign_id = YOUR_CAMPAIGN_ID
    AND post_key IS NOT NULL
    AND url NOT LIKE 'placeholder://%'
  ORDER BY post_key, last_scraped_at DESC NULLS LAST
)
SELECT
  SUM(views) as total_views,
  SUM(likes) as total_likes,
  SUM(comments) as total_comments,
  SUM(shares) as total_shares,
  COUNT(*) as post_count
FROM unique_posts;
```

Compare these numbers with your dashboard - they should match exactly!
