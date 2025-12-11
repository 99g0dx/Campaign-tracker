# Campaign Tracker - Digital Marketing Analytics Dashboard

## Overview
A SaaS dashboard for tracking digital marketing campaigns, creator marketing, and content production. Features real-time analytics powered by PostgreSQL.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Charts**: Recharts
- **Database**: PostgreSQL (Replit built-in)
- **ORM**: Drizzle ORM
- **API**: Express.js REST API

## Project Structure
```
client/
  src/
    components/       # Reusable UI components
      ui/             # shadcn/ui base components
      KPICard.tsx     # Metric display cards
      PerformanceChart.tsx  # Line chart for trends
      CreativeStatusChart.tsx  # Pie chart for task status
      CampaignTable.tsx  # Campaign data table
      EditingTaskCard.tsx  # Task cards
      AddCampaignModal.tsx  # New campaign form
    hooks/
      useCampaigns.ts # React Query hooks for campaigns and tasks
    pages/
      Dashboard.tsx   # Main dashboard page
server/
  db.ts             # Database connection
  storage.ts        # Data access layer
  routes.ts         # API endpoints
shared/
  schema.ts         # Drizzle schema definitions
```

## Database Schema
- `campaigns` - Marketing campaign data with metrics
- `editing_tasks` - Creative production task tracking

## API Endpoints
- `GET /api/campaigns` - Get all campaigns with computed ROI/CPA
- `POST /api/campaigns` - Create new campaign
- `GET /api/editing-tasks` - Get all editing tasks
- `POST /api/editing-tasks` - Create new editing task

## Features
- Real-time campaign metrics (ROI, CPA, engagement)
- Performance trend visualization
- Creative production status tracking
- Sortable/filterable campaign table
- Add new campaigns via modal form
- Automatic data seeding for new databases

## Recent Changes
- 2025-12-11: Switched from Firebase to Replit built-in PostgreSQL database
- 2025-12-11: Initial implementation with API routes and React Query hooks
