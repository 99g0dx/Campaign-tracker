# DTTracker.com - Complete Breakdown & Analysis

## Executive Summary
DTTracker is a **music campaign analytics platform** that helps artists and music marketers track social media engagement for song promotion campaigns across TikTok, Instagram, YouTube, Twitter, and Facebook. It provides real-time metrics tracking, creator management, workflow automation, and team collaboration features.

---

## Core Purpose & Value Proposition
**Problem Solved**: Artists need to track how their songs perform across multiple creators/influencers on various social platforms, but manually tracking views, likes, comments, and shares is time-consuming and error-prone.

**Solution**: Automated social media metrics scraping and aggregation with workflow management for music promotion campaigns.

---

## System Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Routing**: Wouter (lightweight React router)
- **UI Framework**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query) for server state
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based (express-session + connect-pg-simple)
- **Data Scraping**: ScrapeCreators API (primary) + Apify (fallback)
- **Charts**: Recharts
- **Deployment**: Railway.app
- **Email**: Resend API

### Database Schema
**12 Tables**:
1. `campaigns` - Song campaigns with owner, status, sharing config
2. `social_links` - Social media posts with engagement metrics
3. `engagement_history` - Historical metrics snapshots
4. `scrape_jobs` - Background scraping job queue
5. `scrape_tasks` - Individual scraping task status
6. `users` - User accounts with verification
7. `sessions` - Active user sessions
8. `team_members` - Legacy team management
9. `workspaces` - Multi-user workspace containers
10. `workspace_members` - Workspace membership & roles
11. `workspace_invites` - Email-based team invitations
12. `creators` - Creator/influencer directory

---

## User Flow & Pages

### 1. **Public Routes** (Unauthenticated)
#### Landing Page (`/`)
- Hero section with value proposition
- "Get Started" CTA → Signup
- Product features showcase
- Pricing (if applicable)

#### Login (`/login`)
- Email + password authentication
- "Forgot password" link
- "Sign up" link

#### Signup (`/signup`)
- Email, name, password fields
- Email verification required
- Auto-redirect to verify page

#### Forgot Password (`/forgot-password`)
- Email input
- Reset link sent via email

#### Reset Password (`/reset-password`)
- Token-based password reset
- New password confirmation

#### Shared Campaign (`/share/:slug`)
- Public view of campaign metrics (no login required)
- Optional password protection
- Read-only dashboard with:
  - Total views, likes, comments, shares
  - Performance chart (time series)
  - Creator/post list with metrics
  - Platform breakdown

### 2. **Protected Routes** (Authenticated)
#### Verify Account (`/verify`)
- Email verification code input
- Resend code functionality
- Blocks access until verified

#### Dashboard (`/` or `/dashboard`)
**Main landing page after login**

**Layout**:
- Top navigation bar with:
  - App logo/name
  - User avatar dropdown (profile, logout)
- Main content area

**Features**:
- **"Create Campaign" button** (top-right, purple/primary color)
- **Campaign cards grid** (responsive: 1-3 columns)
  - Each card shows:
    - Campaign name (clickable)
    - Song title + artist
    - Status badge (Active/Inactive)
    - Quick stats: views, likes, comments, shares (formatted with K/M)
    - First 3 social links preview with platform badges
    - "+X more" indicator if >3 links
    - Options menu (⋮): Delete, Duplicate
  - Hover effects: subtle elevation
  - Click → Navigate to Campaign Detail

- **Empty state** (no campaigns):
  - Icon + "No campaigns yet"
  - "Create your first campaign" CTA

**Modals**:
- **Add Campaign Modal**:
  - Campaign Name (text)
  - Song Title (text, required)
  - Song Artist (text, optional)
  - Status dropdown (Active/Inactive)
  - Cancel / Create buttons

#### Campaign Detail (`/campaign/:id`)
**Most complex page** - Full campaign analytics dashboard

**Header Section**:
- Back button → Dashboard
- Campaign name (editable inline)
- Song title + artist (with music icon)
- Status toggle (Active/Inactive)
- Action buttons:
  - Share campaign (generates public link)
  - Refresh all metrics
  - Delete campaign
  - CSV Import
  - CSV Export

**KPI Cards Row** (4 cards, responsive):
1. **Total Views** (eye icon, blue)
2. **Total Likes** (heart icon, red)
3. **Total Comments** (message icon, yellow)
4. **Total Shares** (share icon, green)
- Each card shows:
  - Formatted number (K/M suffix)
  - Icon with color
  - Optional trend indicator (up/down arrow)

**Performance Chart Section**:
- Time series line chart (30 days default)
- Multi-line: views, likes, comments, shares
- Recharts responsive container
- X-axis: dates
- Y-axis: metric values
- Legend with color coding
- Tooltips on hover

**Creators & Posts Section**:
**Toolbar**:
- Search bar (filter by creator name/handle)
- Sort dropdown:
  - Creator (alphabetical)
  - Platform
  - Status (pending/briefed/active/done)
  - Views (desc)
  - Likes (desc)
  - Comments (desc)
  - Shares (desc)
- Sort direction toggle (asc/desc arrows)
- Filter dropdown (by platform, status)
- **Add Link button** (primary, opens modal)
- **Import CSV button** (opens import modal)
- **Bulk actions** (when items selected):
  - Delete selected
  - Update status
  - Refresh metrics

**Posts Table**:
- Responsive table with columns:
  1. **Checkbox** (bulk select)
  2. **Creator** - Name + handle + platform badge
  3. **Platform** - Colored badge (TikTok black, IG gradient, YouTube red, etc.)
  4. **Status** - Workflow badge (Pending/Briefed/Active/Done) with colors
  5. **Views** - Formatted number
  6. **Likes** - Formatted number
  7. **Comments** - Formatted number
  8. **Shares** - Formatted number
  9. **Engagement Rate** - Percentage
  10. **Last Updated** - Timestamp
  11. **Actions** - Dropdown menu:
      - Edit (opens edit modal)
      - Refresh metrics (re-scrape)
      - Open link (external)
      - Delete

**Table Features**:
- Pagination (20 per page)
- Row hover effects
- Sortable columns (click header)
- Empty state: "No posts yet. Add your first link."
- Loading skeleton during fetch

**Modals in Campaign Detail**:

1. **Add Social Link Modal**:
   - URL input (TikTok/IG/YouTube/Twitter/Facebook)
   - Platform auto-detection from URL
   - Creator name autocomplete (searches existing creators)
   - Post status dropdown (Pending/Briefed/Active/Done)
   - "Add & Scrape" button (adds link + triggers metrics fetch)

2. **Edit Social Link Modal**:
   - Same as Add but pre-filled
   - Update button

3. **CSV Import Modal**:
   - File upload drag-drop zone
   - CSV format guide:
     - Required columns: url, creatorName
     - Optional: platform, postStatus
   - Preview table (shows parsed rows)
   - Import button
   - Error handling (invalid format, duplicate URLs)

4. **Share Campaign Modal**:
   - Toggle: Enable/Disable sharing
   - Generate shareable link
   - Optional password protection
   - Copy link button
   - View shared page button

5. **Delete Confirmation Dialog**:
   - "Are you sure?" message
   - Cancel / Delete buttons
   - Destructive action (red button)

#### Profile (`/profile`)
- User information display
- Email, name, profile picture
- Account settings
- Change password
- Logout button

### 3. **Not Found** (`404`)
- Friendly 404 message
- "Go to Dashboard" link

---

## Data Models & Entities

### Campaign
```typescript
{
  id: number;
  ownerId: string;          // User who created it
  name: string;             // Campaign name
  songTitle: string;        // Song being promoted
  songArtist: string;       // Artist name
  status: "Active" | "Inactive";
  createdAt: Date;

  // Sharing
  shareSlug: string;        // Public URL slug
  sharePasswordHash: string; // Optional password
  shareEnabled: boolean;
  shareCreatedAt: Date;
}
```

### Social Link (Post)
```typescript
{
  id: number;
  campaignId: number;
  url: string;              // Original post URL
  canonicalUrl: string;     // Normalized URL
  postKey: string;          // "platform:canonicalUrl" (for deduplication)
  platform: "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
  postId: string;           // Platform-specific ID
  creatorName: string;      // Creator handle/name

  // Workflow
  postStatus: "pending" | "briefed" | "active" | "done";

  // Metrics (scraped)
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;   // Calculated: (likes+comments+shares)/views

  // Metadata
  lastScrapedAt: Date;
  status: "pending" | "success" | "failed";
  errorMessage: string;
  createdAt: Date;
}
```

### User
```typescript
{
  id: string;               // UUID
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  profileImageUrl: string;

  // Verification
  isVerified: boolean;
  verificationCode: string;
  verificationExpiresAt: Date;

  // Password reset
  passwordHash: string;
  resetToken: string;
  resetTokenExpiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

### Workspace (Team Collaboration)
```typescript
{
  id: number;
  name: string;
  ownerId: string;
  createdAt: Date;
}

// Membership
{
  id: number;
  workspaceId: number;
  userId: string;
  role: "owner" | "admin" | "manager" | "viewer";
  status: "active" | "inactive";
  createdAt: Date;
}

// Invites
{
  id: number;
  workspaceId: number;
  email: string;
  role: string;
  token: string;            // Unique invite token
  tokenHash: string;        // SHA-256 hash
  expiresAt: Date;
  invitedByUserId: string;
  acceptedAt: Date;
  createdAt: Date;
}
```

---

## Key Features in Detail

### 1. Automated Metrics Scraping
**How it works**:
1. User adds social media URL
2. Platform detected from URL pattern
3. Background job created in `scrape_jobs` table
4. Individual tasks created in `scrape_tasks` table
5. ScrapeCreators API called (primary provider)
   - Fallback to Apify if ScrapeCreators fails
6. Metrics extracted: views, likes, comments, shares
7. `social_links` table updated
8. `engagement_history` snapshot created
9. User sees updated metrics in dashboard

**Scraping Queue**:
- Processes up to 5 concurrent scrapes
- Retry logic: 3 attempts with 1s delay
- Timeout: 30s per scrape
- Error tracking per link

### 2. Deduplication System
**Problem**: Same post added multiple times causes inflated totals

**Solution**:
- `postKey` = `platform:canonicalUrl`
- URL normalization: remove tracking params, lowercase
- Database query groups by `postKey`
- Only most recent scrape kept per postKey
- Frontend totals calculated from unique posts only

### 3. Workflow Management
**Post statuses** track creator collaboration:
- **Pending**: Not yet contacted
- **Briefed**: Creator briefed on campaign
- **Active**: Content published
- **Done**: Campaign completed

**UI**: Color-coded badges, filterable, bulk update

### 4. Team Collaboration (Workspaces)
- Owner creates workspace
- Invite team members via email
- Token-based invite acceptance
- Role-based permissions:
  - **Owner**: Full access
  - **Admin**: Manage campaigns, invite members
  - **Manager**: Edit campaigns, view analytics
  - **Viewer**: Read-only access

### 5. Campaign Sharing
- Generate public shareable link
- Optional password protection
- Share-only view (no editing)
- Useful for clients/stakeholders

### 6. CSV Import/Export
**Import**:
- Upload CSV with url, creatorName, platform, postStatus
- Bulk add 100s of links at once
- Auto-scrapes after import

**Export**:
- Download all campaign data as CSV
- Columns: creator, platform, url, views, likes, comments, shares, status

### 7. Real-time Updates
- TanStack Query for automatic refetching
- Optimistic updates (instant UI response)
- Background polling for active scrape jobs
- Toast notifications for success/errors

---

## UI/UX Design Principles

### Design System
**Colors** (Dark mode optimized):
- Primary: Purple (`#8B5CF6` / hsl(262, 83%, 58%))
- Background: Near-black (`hsl(0, 0%, 0%)` in dark mode)
- Cards: Elevated with subtle borders
- Buttons: Flat style with subtle borders

**Typography**:
- Sans-serif: Inter (300, 400, 500, 600, 700)
- Monospace: JetBrains Mono (400, 500, 600)
- Serif: Georgia (system font)

**Spacing**:
- Consistent 4px grid
- Card padding: 24px (1.5rem)
- Button padding: 12px 16px
- Gap between elements: 12px-24px

**Components** (shadcn/ui style):
- **Buttons**: Rounded corners (9px), subtle shadows
- **Cards**: Elevated look with borders
- **Badges**: Pill-shaped, platform-specific colors
- **Tables**: Zebra striping, hover effects
- **Inputs**: Clean, minimal, focus ring
- **Modals**: Centered overlay with backdrop blur

**Iconography**:
- Lucide icons throughout
- 16px (h-4 w-4) for inline icons
- 20px (h-5 w-5) for buttons
- 24px (h-6 w-6) for headers

**Responsive Breakpoints**:
- Mobile: < 640px (1 column)
- Tablet: 640px-1024px (2 columns)
- Desktop: > 1024px (3 columns)

### Interaction Patterns
1. **Hover effects**: Subtle elevation/color change
2. **Loading states**: Skeleton screens, spinners
3. **Optimistic updates**: Instant UI feedback
4. **Toasts**: Success/error notifications (top-right)
5. **Confirmation dialogs**: Destructive actions
6. **Inline editing**: Click to edit campaign names
7. **Autocomplete**: Creator name suggestions
8. **Drag-drop**: CSV file upload

---

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Check session
- `POST /api/auth/verify` - Email verification
- `POST /api/auth/forgot-password` - Request reset
- `POST /api/auth/reset-password` - Reset password

### Campaigns
- `GET /api/campaigns` - List user's campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign details
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `POST /api/campaigns/:id/duplicate` - Duplicate campaign
- `PUT /api/campaigns/:id/status` - Update status
- `GET /api/campaigns/:id/metrics` - Get aggregated metrics

### Social Links
- `GET /api/social-links` - List links (filterable by campaignId)
- `POST /api/social-links` - Add link
- `PUT /api/social-links/:id` - Update link
- `DELETE /api/social-links/:id` - Delete link
- `POST /api/social-links/:id/rescrape` - Re-fetch metrics
- `POST /api/campaigns/:id/rescrape-all` - Rescrape all links
- `GET /api/social-links/creator-names/search?q=` - Autocomplete

### Sharing
- `POST /api/campaigns/:id/share` - Enable sharing
- `DELETE /api/campaigns/:id/share` - Disable sharing
- `GET /api/public/campaigns/:slug` - Get shared campaign
- `POST /api/public/campaigns/:slug/verify-password` - Password check

### CSV
- `POST /api/campaigns/:id/import-csv` - Import CSV
- `GET /api/campaigns/:id/export-csv` - Export CSV

### Workspaces (Team)
- `GET /api/workspaces/:id` - Get workspace
- `POST /api/workspaces` - Create workspace
- `POST /api/workspaces/:id/invite` - Invite member
- `GET /api/workspaces/:id/invites` - List invites
- `POST /api/invites/accept` - Accept invite
- `DELETE /api/invites/:id` - Revoke invite

### Scraping
- `GET /api/scrape-jobs/:campaignId/active` - Active job status
- `GET /api/scrape-tasks?jobId=` - Task progress
- `GET /api/scrape-queue/status` - Queue health

---

## Performance Optimizations

### Current Issues
1. ❌ **23 Google Fonts loaded** (~3-4MB) but only 2 used
2. ❌ No code splitting
3. ❌ No image optimization
4. ❌ No CDN for assets
5. ❌ Full table renders (no virtualization)

### Implemented Optimizations
1. ✅ TanStack Query caching (reduces API calls)
2. ✅ Optimistic updates (instant UI)
3. ✅ Lazy loading (React.lazy for routes)
4. ✅ Debounced search (autocomplete)
5. ✅ Pagination (20 items per page)

### Recommended Improvements
1. **Font optimization**: Reduce to 2 families (Inter, JetBrains Mono)
2. **Code splitting**: Route-based chunks
3. **Image optimization**: WebP, lazy loading
4. **CDN**: CloudFlare for static assets
5. **Virtual scrolling**: For 1000+ row tables
6. **Bundle analysis**: Remove unused dependencies
7. **Minification**: Terser, CSS purging
8. **Caching**: Service worker, HTTP caching headers

---

## Security Features

1. **Authentication**:
   - Password hashing (bcrypt)
   - Session-based auth (not JWT)
   - CSRF protection via SameSite cookies

2. **Authorization**:
   - Row-level security (ownerId checks)
   - Workspace-based permissions
   - Share link tokens (SHA-256 hashed)

3. **Input Validation**:
   - Zod schemas for all inputs
   - SQL injection prevention (Drizzle ORM)
   - XSS protection (React escaping)

4. **Rate Limiting**:
   - API rate limits (to implement)
   - Scraping throttling (5 concurrent)

5. **Data Privacy**:
   - Password-protected shares
   - Email verification required
   - Session expiration (7 days)

---

## Deployment & Infrastructure

**Platform**: Railway.app

**Build Process**:
1. `npm install --include=dev`
2. `npm run build` (Vite + TSX compilation)
3. Output: `dist/` folder with:
   - `index.cjs` (Express server)
   - `public/` (static assets)

**Start Command**:
```bash
bash run-migration.sh && NODE_ENV=production node dist/index.cjs
```

**Environment Variables**:
- `DATABASE_URL` - PostgreSQL connection
- `SESSION_SECRET` - Session encryption key
- `SCRAPECREATORS_API_KEY` - Scraping provider
- `APIFY_API_TOKEN` - Fallback scraping
- `RESEND_API_KEY` - Email service
- `RESEND_FROM_EMAIL` - Sender email
- `APP_URL` - https://dttracker.com
- `NODE_ENV` - production

**Database**: PostgreSQL on Railway
- Auto-backups
- Connection pooling
- SSL enabled

---

## Business Model & Monetization

**Current**: Free tier (likely)

**Potential Pricing**:
- **Free**: 1 campaign, 50 links, daily scrapes
- **Pro** ($29/mo): Unlimited campaigns, 1000 links, hourly scrapes
- **Team** ($99/mo): Workspaces, 10 members, API access
- **Enterprise** (Custom): White-label, SLA, dedicated support

**Revenue Drivers**:
1. Subscription tiers
2. Per-scrape API usage fees
3. White-label licensing
4. Consulting/onboarding services

---

## Competitive Advantages

1. **Music-specific**: Tailored for song promotion (vs generic social analytics)
2. **Multi-platform**: TikTok + IG + YouTube + Twitter + Facebook
3. **Workflow management**: Post status tracking (unique feature)
4. **Automated scraping**: No manual data entry
5. **Team collaboration**: Workspaces for agencies
6. **Affordable**: Cheaper than Hootsuite/Sprout Social
7. **Simple UX**: Clean, focused interface

---

## Target Users

**Primary**:
- Independent musicians
- Music managers
- Record labels (indie)
- Music PR agencies

**Secondary**:
- Influencer marketing agencies
- Social media managers
- Brand partnerships teams

**User Personas**:
1. **Indie Artist** (Sarah, 25)
   - Tracks TikTok/IG performance of new single
   - Works with 10-20 micro-influencers
   - Needs proof of ROI for marketing spend

2. **Music Manager** (James, 35)
   - Manages 5-10 artists
   - Coordinates creator campaigns
   - Reports to label/investors

3. **PR Agency** (MusicBoost LLC)
   - Runs campaigns for 50+ artists
   - Needs team collaboration
   - White-label reporting for clients

---

## Future Roadmap Ideas

**Phase 1** (MVP - Current):
- ✅ Campaign creation
- ✅ Manual link addition
- ✅ Automated scraping
- ✅ Dashboard analytics
- ✅ CSV import/export

**Phase 2** (Enhanced):
- 🔄 Workspace teams
- 🔄 Email invites
- 📝 Advanced filtering
- 📝 Custom date ranges
- 📝 Export PDF reports

**Phase 3** (Advanced):
- API access for developers
- Spotify/Apple Music integration
- Automated creator discovery
- AI-powered insights
- Mobile apps (iOS/Android)
- Webhook integrations
- Custom dashboards
- A/B testing tools

**Phase 4** (Enterprise):
- White-label solution
- SSO (SAML/OAuth)
- Advanced permissions
- Audit logs
- SLA guarantees
- Dedicated infrastructure

---

## Technical Debt & Known Issues

**Critical**:
1. ⚠️ Railway deploys old code (cache issue)
2. ⚠️ Database migrations manual (not automated)
3. ⚠️ No error tracking (Sentry needed)

**High Priority**:
1. Font optimization (23 → 2 families)
2. No test coverage
3. No CI/CD pipeline
4. Hard-coded scraping provider (no fallback UI)
5. Session security improvements needed

**Medium Priority**:
1. No loading states on some modals
2. Pagination controls basic
3. No keyboard shortcuts
4. Mobile UX could improve
5. Accessibility (ARIA labels missing)

**Low Priority**:
1. Dark mode only (no light mode toggle)
2. No user preferences
3. Basic error messages
4. No onboarding tour
5. No help docs/tooltips

---

## Success Metrics to Track

**Product Metrics**:
- Active campaigns per user
- Links added per campaign
- Scrape success rate
- Dashboard engagement (time on page)
- CSV import adoption

**Business Metrics**:
- Monthly recurring revenue (MRR)
- Customer acquisition cost (CAC)
- Lifetime value (LTV)
- Churn rate
- Net promoter score (NPS)

**Technical Metrics**:
- Page load time (< 2s)
- API response time (< 500ms)
- Scraping accuracy (> 95%)
- Uptime (> 99.9%)
- Error rate (< 1%)

---

## Conclusion

DTTracker is a **specialized music campaign analytics platform** that solves the pain point of tracking social media engagement across multiple creators and platforms. Its strength lies in:

1. **Automation**: Eliminates manual data collection
2. **Simplicity**: Clean, focused UI without bloat
3. **Workflow integration**: Post status tracking unique to music industry
4. **Multi-platform**: Covers all major social networks
5. **Collaboration**: Team features for agencies/labels

**Core differentiator**: Music-first design vs generic social media dashboards.

**Business opportunity**: $50B music industry + $16B influencer marketing = massive TAM for specialized tool.

**Next steps**: Fix deployment issues, optimize performance, add team features, then scale user acquisition.
