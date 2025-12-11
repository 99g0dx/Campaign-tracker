# Campaign Tracker - Song Marketing Dashboard

## Overview
A simplified SaaS dashboard for tracking digital marketing campaigns for songs. Create campaigns linked to songs, add social media post links, track engagement data, and view performance metrics.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: PostgreSQL (Replit built-in)
- **ORM**: Drizzle ORM
- **API**: Express.js REST API

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
- `PATCH /api/social-links/:id` - Update post status or creator name
- `POST /api/social-links/:id/rescrape` - Rescrape engagement data

## Features
1. **Create Campaigns** - Name + Song title + Artist
2. **Add Social Links** - Paste TikTok, Instagram, YouTube, Twitter, or Facebook post URLs with optional creator name
3. **Post Status Tracking** - Track workflow status per post: Pending, Briefed, Active, Done
4. **Track Engagement** - Automatic scraping of views, likes, comments, shares
5. **Dashboard** - Overview of total views, engagement, posts, and active campaigns
6. **Per-Campaign Stats** - See aggregated engagement for each campaign
7. **Engagement Charts** - Line charts showing views, likes, comments, shares trends over time with uptick/downtick indicators

## Social Media Scraping
The scraper attempts to extract engagement data from supported platforms:

### Platform Support Status
| Platform | Status | Notes |
|----------|--------|-------|
| YouTube | Working | Views, likes, comments extracted from page |
| TikTok | Limited | Anti-bot measures block most requests |
| Instagram | Limited | Requires login, blocks automated access |
| Twitter/X | Blocked | Paid API subscription required |
| Facebook | Blocked | Authentication required |

### Technical Details
- YouTube: Successfully extracts viewCount, likeCount from HTML
- TikTok/Instagram/Twitter: These platforms use JavaScript rendering and anti-bot protection that blocks basic HTTP scraping
- For reliable data from blocked platforms, consider:
  - Manual data entry
  - Third-party API services (Apify, RapidAPI, ScrapFly)
  - Official platform APIs (requires developer accounts)

Note: Posts will show "Error" status with a message explaining why scraping failed.

## Recent Changes
- 2025-12-11: Simplified app to focus on core campaign + social link tracking
- 2025-12-11: Removed editing tasks and complex KPIs
- 2025-12-11: New clean dashboard UI with campaign cards
