# Campaign Tracker - Song Marketing Dashboard

## Overview
A simplified SaaS dashboard for tracking digital marketing campaigns for songs. Create campaigns linked to songs, add social media post links, track engagement data, and view performance metrics.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: PostgreSQL (Replit built-in)
- **ORM**: Drizzle ORM
- **API**: Express.js REST API
- **Authentication**: Replit Auth (OpenID Connect)

## Project Structure
```
client/
  src/
    components/
      ui/             # shadcn/ui base components
      AddCampaignModal.tsx  # Create new campaign
    hooks/
      useCampaigns.ts # React Query hooks
      useAuth.ts      # Authentication hook
    pages/
      Dashboard.tsx     # Main dashboard with campaign cards
      CampaignDetail.tsx # Individual campaign page with creators table
      Onboarding.tsx    # KYC verification page
      Landing.tsx       # Landing page for unauthenticated users
server/
  db.ts             # Database connection
  storage.ts        # Data access layer
  routes.ts         # API endpoints
  scraper.ts        # Social media engagement scraper
  replitAuth.ts     # Replit Auth OIDC setup
  profileRoutes.ts  # KYC verification endpoints
shared/
  schema.ts         # Drizzle schema definitions
```

## Database Schema

### campaigns
- `id` - Primary key
- `name` - Campaign name
- `songTitle` - Song being promoted
- `songArtist` - Artist name (optional)
- `status` - Active/Completed
- `createdAt` - Timestamp

### social_links
- `id` - Primary key
- `campaignId` - Foreign key to campaigns
- `url` - Social media post URL
- `platform` - TikTok/Instagram/YouTube/Twitter/Facebook
- `creatorName` - Optional creator/influencer name
- `postStatus` - Workflow status: pending/briefed/active/done
- `views`, `likes`, `comments`, `shares` - Engagement metrics
- `status` - Scraping status: pending/scraping/scraped/error
- `lastScrapedAt` - When data was last scraped

### users
- `id` - Primary key (Replit user ID from OIDC sub claim)
- `email` - User email (unique)
- `firstName`, `lastName` - User name
- `phone` - Phone number (for KYC)
- `profileImageUrl` - Avatar URL from Replit
- `isVerified` - KYC verification status (boolean)
- `verificationCode` - 6-digit verification code
- `verificationExpiresAt` - Code expiration timestamp
- `passwordHash` - Bcrypt-hashed password (optional, for local auth)
- `resetToken` - Secure token for password reset
- `resetTokenExpiresAt` - Token expiration (1 hour from creation)
- `createdAt`, `updatedAt` - Timestamps

## API Endpoints

### Campaign Endpoints
- `GET /api/campaigns` - Get all campaigns with aggregated stats
- `POST /api/campaigns` - Create new campaign
- `POST /api/campaigns/:id/rescrape-all` - Batch rescrape all posts in a campaign
- `GET /api/social-links` - Get all social links
- `POST /api/social-links` - Add new social link with optional creatorName (triggers scraping)
- `PATCH /api/social-links/:id` - Update post status, creator name, URL, and engagement metrics (views, likes, comments, shares)
- `POST /api/social-links/:id/rescrape` - Rescrape engagement data

### Profile/KYC Endpoints
- `POST /api/profile/start` - Start verification (body: firstName, lastName, email, phone) - sends 6-digit code
- `POST /api/profile/verify` - Verify code (body: code) - marks user as verified
- `POST /api/profile/resend` - Resend verification code

### Password Management Endpoints
- `GET /api/auth/has-password` - Check if current user has password set (authenticated)
- `POST /api/auth/set-password` - Set password for OAuth users without one (authenticated)
- `POST /api/auth/change-password` - Change existing password (authenticated, requires current password)
- `POST /api/auth/forgot-password` - Request password reset email (public)
- `POST /api/auth/reset-password` - Reset password with valid token (public)

## Features
1. **User Authentication** - Log in with Replit Auth (Google, GitHub, or email)
2. **KYC Verification** - Email verification required before accessing campaigns
3. **Create Campaigns** - Name + Song title + Artist
4. **Add Social Links** - Paste TikTok, Instagram, YouTube, Twitter, or Facebook post URLs with optional creator name
5. **Post Status Tracking** - Track workflow status per post: Pending, Briefed, Active, Done
6. **Track Engagement** - Automatic scraping of views, likes, comments, shares
7. **Edit Creators & Posts** - Click pencil icon to edit creator name, URL, and manually enter/correct engagement metrics
8. **Dashboard** - Overview of total views, engagement, posts, and active campaigns with user avatar and logout
9. **Per-Campaign Stats** - See aggregated engagement for each campaign
10. **Engagement Charts** - Line charts showing views, likes, comments, shares trends over time with time range filters (24hrs to 90 days)
11. **Batch Scraping** - "Scrape All" button to rescrape engagement data for all posts in a campaign simultaneously
12. **CSV Export** - "Download CSV" button to export campaign post data with all engagement metrics
13. **Chart Metric Toggles** - Checkboxes to selectively show/hide views, likes, comments, shares on engagement charts

## Social Media Scraping
The scraper uses Apify API for reliable engagement data extraction:

### Platform Support Status
| Platform | Status | Notes |
|----------|--------|-------|
| TikTok | Working | Apify clockworks/tiktok-scraper |
| Instagram | Working | Apify apify/instagram-scraper |
| YouTube | Working | Direct HTML parsing (views, likes, comments) |
| Twitter/X | Limited | Syndication API (may require paid access) |
| Facebook | Blocked | Authentication required |

### Technical Details
- **TikTok**: Uses `clockworks~tiktok-scraper` Apify actor for reliable data extraction
- **Instagram**: Uses `apify~instagram-scraper` Apify actor for posts and reels
- **YouTube**: Direct HTML parsing extracts viewCount, likeCount from page
- **Twitter/X**: Syndication API may work for some tweets
- **Facebook**: Requires authentication, manual entry recommended

### Configuration
- `APIFY_API_TOKEN` - Required secret for TikTok/Instagram scraping
- Get your token at: apify.com → Settings → Integrations

## Recent Changes
- 2025-12-12: Added password management - change password on Profile page, set password for OAuth users, forgot/reset password via email with secure token-based recovery
- 2025-12-12: Enhanced shared campaigns with engagement time windows breakdown (24hrs, 72hrs, 7/30/60/90 days) and creator status badges
- 2025-12-12: Added ForgotPassword and ResetPassword pages with secure token validation and auto-expiry
- 2025-12-12: Added campaign sharing with password protection - users can share campaigns via password-locked public links
- 2025-12-12: Added Profile page with user details and team member management
- 2025-12-12: Added shared campaign page with password gate for public access
- 2025-12-12: Added chart metric toggles - checkboxes to show/hide views, likes, comments, shares on engagement charts
- 2025-12-12: Added CSV export - "Download CSV" button to export campaign post data with engagement metrics
- 2025-12-12: Added batch scraping - "Scrape All" button to rescrape all posts in a campaign simultaneously
- 2025-12-11: Added KYC verification flow - users must verify email before accessing campaigns
- 2025-12-11: Added Onboarding page with profile form and email verification
- 2025-12-11: Added Replit Auth authentication with user avatar and logout in dashboard header
- 2025-12-11: Added time range filters to engagement charts (24hrs to 90 days)
- 2025-12-11: Integrated Apify API for TikTok and Instagram scraping
- 2025-12-11: Simplified app to focus on core campaign + social link tracking
- 2025-12-11: Removed editing tasks and complex KPIs
- 2025-12-11: New clean dashboard UI with campaign cards
