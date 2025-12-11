# Campaign Tracking Dashboard - Design Guidelines

## Design Approach

**Selected Approach**: Design System with Modern Analytics Dashboard Inspiration

Drawing from **Linear's** clean information hierarchy and **Amplitude/Mixpanel's** data visualization patterns to create a utility-focused analytics dashboard that prioritizes data clarity and efficient workflow management.

**Core Principles**:
- Data-first hierarchy: Metrics and insights immediately scannable
- Consistent density: Balanced information display without overwhelming
- Clear visual separation: Distinct zones for KPIs, trends, and detailed data
- Purposeful interactions: Every element serves data discovery or action

---

## Typography System

**Font Stack**: 
- Primary: Inter or Work Sans (via Google Fonts CDN)
- Monospace: JetBrains Mono for numerical data

**Hierarchy**:
- Dashboard Title: text-2xl font-semibold
- Section Headers: text-lg font-medium
- KPI Values: text-3xl font-bold (monospace for numbers)
- KPI Labels: text-sm font-medium uppercase tracking-wide
- Table Headers: text-xs font-semibold uppercase tracking-wider
- Body Text: text-sm font-normal
- Data Points: text-sm font-mono (for consistent number alignment)
- Micro Labels: text-xs font-medium

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 20**
- Component padding: p-6 or p-8
- Section gaps: gap-6 or gap-8
- Card spacing: space-y-4
- Inline elements: gap-2 or gap-4

**Grid Structure**:
- Dashboard container: max-w-screen-2xl mx-auto px-6 py-8
- KPI cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Charts section: grid-cols-1 lg:grid-cols-2 gap-6
- Full-width table section: Takes container width with horizontal scroll on mobile

---

## Component Library

### Dashboard Header
- Fixed top bar with dashboard title, "Add Campaign" button, and user indicator
- Height: h-16 with px-6 py-4
- Sticky positioning for context retention during scroll

### KPI Cards (4 cards)
- Rounded corners: rounded-2xl
- Border treatment: border with subtle emphasis
- Internal padding: p-6
- Layout: Metric value (large, top), label (small, below), trend indicator (icon + percentage change)
- Gradient background treatment for depth

### Performance Charts Section
- Two equal-width cards side-by-side on desktop
- Line Chart (left): 7-day trend showing conversions vs clicks
- Pie Chart (right): Creative status distribution with legend
- Chart height: h-80
- Responsive: Stack on mobile (grid-cols-1 md:grid-cols-2)

### Campaign Table
- Full-width container with rounded-2xl border
- Sticky header row for scroll context
- Column structure: Campaign Name (wide) | Channel | Status | Spend | Impressions | Clicks | Conversions | CPA | ROI | Engagement
- Row height: h-12 for data rows
- Alternating row treatment for readability
- Interactive sort indicators on headers
- Filter controls above table: search input (w-80) + status dropdown

### Editing Tasks Section
- Card-based layout: Each task as individual card
- Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
- Card structure: Title (font-medium), campaign reference (text-xs), assignee badge, status badge, due date
- Status color coding via border-l-4 accent
- Compact padding: p-4

### Add Campaign Modal
- Centered overlay with backdrop blur
- Modal width: max-w-2xl
- Form layout: Two-column grid for related fields (md:grid-cols-2 gap-4)
- Field grouping: Campaign details | Channel & Status | Metrics
- Submit button: Full-width at bottom
- Close icon: top-right corner

### Buttons
- Primary CTA: px-6 py-2.5 rounded-xl font-medium
- Secondary: px-4 py-2 rounded-lg font-medium  
- Icon buttons: p-2 rounded-lg

### Form Inputs
- Height: h-10 for text inputs
- Border radius: rounded-xl
- Padding: px-3 py-2
- Label spacing: mb-2 from label to input
- Consistent focus ring treatment

### Status Badges
- Compact: px-2.5 py-1 rounded-full text-xs font-medium
- Inline with truncated text for long statuses

### Data Visualization
- Chart margins: Standard Recharts responsive container
- Tooltip styling: Rounded container with backdrop
- Legend positioning: Bottom for pie, top-right for line
- Consistent color palette across all charts for status types

---

## Navigation & Interactions

- Single-page dashboard (no complex navigation needed)
- Smooth scroll to sections if implementing anchor links
- Table sorting: Click column headers, visual indicator for active sort
- Filter updates: Immediate, no "Apply" button needed
- Modal: Click outside or X to close, ESC key support

---

## Loading & Empty States

- Initial load: Skeleton cards matching KPI/chart shapes
- Empty campaigns table: Centered message with "Add Campaign" CTA
- Real-time updates: Subtle fade-in animation for new items (duration-200)

---

## Responsive Breakpoints

- Mobile (<640px): Single column, stacked cards, horizontal scroll table
- Tablet (640-1024px): 2-column KPIs, stacked charts
- Desktop (1024px+): 4-column KPIs, side-by-side charts, full table