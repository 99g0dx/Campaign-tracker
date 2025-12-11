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
    pages/
      Dashboard.tsx     # Main dashboard with campaign cards
      CampaignDetail.tsx # Individual campaign page with creators table
server/
  db.ts             # Database connection
  storage.ts        # Data access layer
  routes.ts         # API endpoints
  scraper.ts        # Social media engagement scraper
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

## API Endpoints
- `GET /api/campaigns` - Get all campaigns with aggregated stats
- `POST /api/campaigns` - Create new campaign
- `GET /api/social-links` - Get all social links
- `POST /api/social-links` - Add new social link with optional creatorName (triggers scraping)
- `PATCH /api/social-links/:id` - Update post status, creator name, URL, and engagement metrics (views, likes, comments, shares)
- `POST /api/social-links/:id/rescrape` - Rescrape engagement data

## Features
1. **User Authentication** - Log in with Replit Auth (Google, GitHub, or email)
2. **Create Campaigns** - Name + Song title + Artist
3. **Add Social Links** - Paste TikTok, Instagram, YouTube, Twitter, or Facebook post URLs with optional creator name
4. **Post Status Tracking** - Track workflow status per post: Pending, Briefed, Active, Done
5. **Track Engagement** - Automatic scraping of views, likes, comments, shares
6. **Edit Creators & Posts** - Click pencil icon to edit creator name, URL, and manually enter/correct engagement metrics
7. **Dashboard** - Overview of total views, engagement, posts, and active campaigns with user avatar and logout
8. **Per-Campaign Stats** - See aggregated engagement for each campaign
9. **Engagement Charts** - Line charts showing views, likes, comments, shares trends over time with time range filters (24hrs to 90 days)

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
- 2025-12-11: Added Replit Auth authentication with user avatar and logout in dashboard header
- 2025-12-11: Added time range filters to engagement charts (24hrs to 90 days)
- 2025-12-11: Integrated Apify API for TikTok and Instagram scraping
- 2025-12-11: Simplified app to focus on core campaign + social link tracking
- 2025-12-11: Removed editing tasks and complex KPIs
- 2025-12-11: New clean dashboard UI with campaign cards
