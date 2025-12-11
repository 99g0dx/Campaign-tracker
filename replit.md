# Campaign Tracker - Digital Marketing Analytics Dashboard

## Overview
A SaaS dashboard for tracking digital marketing campaigns, creator marketing, and content production. Features real-time analytics powered by Firebase Firestore.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Charts**: Recharts
- **Database**: Firebase Firestore (real-time sync)
- **Authentication**: Firebase Anonymous Auth

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
      useFirebase.ts  # Firebase real-time data hook
    lib/
      firebase.ts     # Firebase configuration
    pages/
      Dashboard.tsx   # Main dashboard page
```

## Firebase Configuration
Required environment variables:
- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_APP_ID` - Firebase app ID

### Firebase Console Setup
1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Firestore Database in test mode
3. Enable Anonymous authentication under Authentication > Sign-in method
4. Get credentials from Project Settings > SDK setup

## Firestore Collections
- `campaigns` - Marketing campaign data with metrics
- `editingTasks` - Creative production task tracking

## Features
- Real-time campaign metrics (ROI, CPA, engagement)
- Performance trend visualization
- Creative production status tracking
- Sortable/filterable campaign table
- Add new campaigns via modal form
- Automatic data seeding for new projects

## Recent Changes
- 2025-12-11: Initial implementation with Firebase integration
