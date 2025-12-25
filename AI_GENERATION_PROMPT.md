# Ultra-Detailed AI Web Generator Prompt for DTTracker Clone

---

## PROMPT FOR AI WEB GENERATOR (Copy below)

---

Create a full-stack web application called **"MusicTrackr"** - a music campaign analytics platform for tracking social media engagement across TikTok, Instagram, YouTube, Twitter, and Facebook.

---

## 🎯 APPLICATION PURPOSE

Build a SaaS platform that helps musicians, music managers, and record labels track how their songs perform across social media by monitoring posts from multiple creators/influencers. The app automatically scrapes engagement metrics (views, likes, comments, shares) and provides real-time analytics dashboards.

---

## 🏗️ TECHNICAL STACK

### Frontend
- **Framework**: React 18.3+ with TypeScript
- **Build Tool**: Vite 5.x
- **Routing**: Wouter (lightweight React router)
- **UI Library**: Tailwind CSS 3.x + shadcn/ui components
- **State Management**: TanStack Query v5 (React Query) for server state
- **Charts**: Recharts 2.x for data visualization
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Fetch API with credentials

### Backend
- **Runtime**: Node.js 22.x
- **Framework**: Express.js 4.x
- **Language**: TypeScript
- **Database**: PostgreSQL 16.x
- **ORM**: Drizzle ORM with Drizzle Kit
- **Authentication**: express-session + connect-pg-simple (session store)
- **Password**: bcryptjs for hashing
- **Email**: Resend API
- **Validation**: Zod schemas

### External APIs
- **Primary Scraper**: ScrapeCreators API (for TikTok/Instagram/YouTube metrics)
- **Fallback Scraper**: Apify API
- **Email Service**: Resend

---

## 📊 DATABASE SCHEMA

Create PostgreSQL database with these 12 tables:

### 1. users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  profile_image_url TEXT,
  is_verified BOOLEAN DEFAULT false NOT NULL,
  verification_code TEXT,
  verification_expires_at TIMESTAMP,
  password_hash TEXT NOT NULL,
  reset_token TEXT,
  reset_token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 2. campaigns
```sql
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  song_title TEXT NOT NULL,
  song_artist TEXT,
  status TEXT DEFAULT 'Active' NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  share_slug TEXT UNIQUE,
  share_password_hash TEXT,
  share_enabled BOOLEAN DEFAULT false NOT NULL,
  share_created_at TIMESTAMP
);
CREATE INDEX idx_campaigns_owner ON campaigns(owner_id);
```

### 3. social_links
```sql
CREATE TABLE social_links (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  canonical_url TEXT,  -- Normalized URL for deduplication
  post_key TEXT,       -- Unique: "platform:canonicalUrl"
  platform TEXT NOT NULL,  -- tiktok, instagram, youtube, twitter, facebook
  post_id TEXT,
  creator_name TEXT,
  post_status TEXT DEFAULT 'pending' NOT NULL,  -- pending, briefed, active, done
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,
  last_scraped_at TIMESTAMP,
  status TEXT DEFAULT 'pending' NOT NULL,  -- scraping status
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_social_links_campaign ON social_links(campaign_id);
CREATE INDEX idx_social_links_post_key ON social_links(post_key);
```

### 4. engagement_history
```sql
CREATE TABLE engagement_history (
  id SERIAL PRIMARY KEY,
  social_link_id INTEGER NOT NULL REFERENCES social_links(id) ON DELETE CASCADE,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_engagement_social_link ON engagement_history(social_link_id);
```

### 5. scrape_jobs
```sql
CREATE TABLE scrape_jobs (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  status TEXT DEFAULT 'queued' NOT NULL,  -- queued, processing, completed, failed
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  completed_at TIMESTAMP
);
```

### 6. scrape_tasks
```sql
CREATE TABLE scrape_tasks (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES scrape_jobs(id),
  social_link_id INTEGER NOT NULL REFERENCES social_links(id),
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'queued' NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  last_error TEXT,
  result_views INTEGER,
  result_likes INTEGER,
  result_comments INTEGER,
  result_shares INTEGER,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### 7. sessions
```sql
CREATE TABLE sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX idx_sessions_expire ON sessions(expire);
```

### 8. workspaces
```sql
CREATE TABLE workspaces (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### 9. workspace_members
```sql
CREATE TABLE workspace_members (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,  -- owner, admin, manager, viewer
  status TEXT DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### 10. workspace_invites
```sql
CREATE TABLE workspace_invites (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  invited_by_user_id TEXT NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### 11. creators
```sql
CREATE TABLE creators (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  platform TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

### 12. team_members (legacy)
```sql
CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

---

## 🎨 DESIGN SYSTEM

### Color Palette (Dark Mode)
```css
/* Primary Brand Color */
--primary: hsl(262, 83%, 58%);           /* Purple #8B5CF6 */
--primary-foreground: hsl(210, 20%, 98%);  /* Near white */

/* Background */
--background: hsl(0, 0%, 0%);            /* Pure black */
--foreground: hsl(240, 10%, 3.9%);       /* Near black text */

/* Cards & Surfaces */
--card: hsl(0, 0%, 2%);                  /* Slightly elevated */
--card-border: hsl(240, 4.8%, 95.9%);   /* Subtle border */

/* Muted (Secondary elements) */
--muted: hsl(240, 4.8%, 94%);
--muted-foreground: hsl(240, 3.8%, 46.1%);

/* Borders */
--border: hsl(240, 5.9%, 90%);

/* Destructive (Delete actions) */
--destructive: hsl(0, 84.2%, 60.2%);     /* Red */
--destructive-foreground: hsl(0, 0%, 98%);
```

### Typography
- **Primary Font**: Inter (weights: 300, 400, 500, 600, 700)
- **Monospace Font**: JetBrains Mono (weights: 400, 500, 600)
- **System Serif**: Georgia (fallback)

**Font Loading**:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

**CSS Variables**:
```css
--font-sans: Inter, sans-serif;
--font-mono: JetBrains Mono, monospace;
--font-serif: Georgia, serif;
```

### Spacing Scale (Tailwind)
- `xs`: 4px (0.25rem)
- `sm`: 8px (0.5rem)
- `md`: 12px (0.75rem)
- `lg`: 16px (1rem)
- `xl`: 24px (1.5rem)
- `2xl`: 32px (2rem)

### Border Radius
- `sm`: 3px
- `md`: 6px
- `lg`: 9px

### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

---

## 🧩 UI COMPONENTS (shadcn/ui Style)

Use shadcn/ui components or build equivalent:

### 1. Button
**Variants**: default, secondary, destructive, ghost, outline
**Sizes**: sm, md, lg, icon

```tsx
<Button variant="default">Primary Action</Button>
<Button variant="outline">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost" size="icon"><Icon /></Button>
```

### 2. Card
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

### 3. Badge
Platform-specific colors:
- **TikTok**: Black background, white text
- **Instagram**: Purple-pink gradient
- **YouTube**: Red #FF0000
- **Twitter**: Sky blue #1DA1F2
- **Facebook**: Blue #1877F2

### 4. Table
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### 5. Modal/Dialog
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Form content */}
  </DialogContent>
</Dialog>
```

### 6. Dropdown Menu
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button variant="ghost" size="icon">⋮</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 7. Select/Dropdown
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

### 8. Input
```tsx
<div className="space-y-2">
  <Label htmlFor="name">Name</Label>
  <Input id="name" type="text" placeholder="Enter name" />
</div>
```

### 9. Toast Notifications
Position: Top-right
Types: Success (green), Error (red), Info (blue)

---

## 📱 PAGE LAYOUTS & ROUTES

### PUBLIC ROUTES (Unauthenticated)

#### 1. Landing Page (`/`)
**Layout**:
- **Hero Section**:
  - H1: "Track Your Music Campaign Performance"
  - Subtitle: "Monitor TikTok, Instagram, YouTube engagement in real-time"
  - CTA Button: "Get Started Free" (purple, large)
  - Hero Image: Dashboard mockup

- **Features Section** (3 columns):
  1. **Automated Tracking**
     - Icon: Refresh icon
     - Description: "Automatic scraping of views, likes, comments, shares"

  2. **Multi-Platform**
     - Icon: Grid icon
     - Description: "TikTok, Instagram, YouTube, Twitter, Facebook support"

  3. **Team Collaboration**
     - Icon: Users icon
     - Description: "Share campaigns with team members and clients"

- **How It Works** (4 steps):
  1. Create campaign → Music note icon
  2. Add social links → Link icon
  3. Auto-scrape metrics → Zap icon
  4. View analytics → Chart icon

- **Footer**:
  - Links: About, Privacy, Terms
  - Social icons

#### 2. Login Page (`/login`)
**Layout**: Centered card (max-width: 400px)

```tsx
<Card>
  <CardHeader>
    <CardTitle>Welcome Back</CardTitle>
    <CardDescription>Sign in to your account</CardDescription>
  </CardHeader>
  <CardContent>
    <form>
      <Input type="email" label="Email" />
      <Input type="password" label="Password" />
      <Link href="/forgot-password">Forgot password?</Link>
      <Button type="submit" fullWidth>Sign In</Button>
    </form>
    <p>Don't have an account? <Link href="/signup">Sign up</Link></p>
  </CardContent>
</Card>
```

#### 3. Signup Page (`/signup`)
Similar to Login but with:
- Full Name input
- Email verification notice
- Terms checkbox

#### 4. Forgot Password (`/forgot-password`)
- Email input
- "Send Reset Link" button
- Back to Login link

#### 5. Reset Password (`/reset-password`)
- New password input
- Confirm password input
- Submit button

#### 6. Shared Campaign (`/share/:slug`)
**Public view of campaign (no login required)**

Layout:
- **Header**:
  - Campaign name (large)
  - Song title + artist
  - "Powered by MusicTrackr" badge

- **KPI Cards** (4 cards in a row):
  - Total Views (eye icon)
  - Total Likes (heart icon)
  - Total Comments (message icon)
  - Total Shares (share icon)

- **Performance Chart**:
  - 30-day time series
  - Lines: views, likes, comments, shares
  - Recharts responsive container

- **Posts Table**:
  - Columns: Creator, Platform, Views, Likes, Comments, Shares
  - No edit/delete actions (read-only)
  - Sortable by metrics
  - Search by creator name

- **Password Protection** (if enabled):
  - Modal overlay: "Enter password to view"
  - Password input
  - Submit button

---

### PROTECTED ROUTES (Authenticated)

#### 7. Verify Account (`/verify`)
**Layout**: Centered card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Verify Your Email</CardTitle>
    <CardDescription>
      We sent a verification code to {user.email}
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Input
      type="text"
      label="Verification Code"
      placeholder="Enter 6-digit code"
      maxLength={6}
    />
    <Button type="submit">Verify</Button>
    <Button variant="ghost">Resend Code</Button>
  </CardContent>
</Card>
```

#### 8. Dashboard (`/` or `/dashboard`)
**Main landing page after login**

**Top Navigation Bar**:
```tsx
<nav className="border-b px-6 py-4 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <Music className="h-6 w-6 text-primary" />
    <h1 className="text-xl font-semibold">MusicTrackr</h1>
  </div>

  <div className="flex items-center gap-4">
    <Button onClick={openCreateCampaignModal}>
      <Plus className="h-4 w-4 mr-2" />
      Create Campaign
    </Button>

    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar>
          <AvatarImage src={user.profileImageUrl} />
          <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <User className="h-4 w-4 mr-2" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</nav>
```

**Main Content** (Grid of campaign cards):
```tsx
<div className="p-6">
  {/* Empty State */}
  {campaigns.length === 0 && (
    <div className="text-center py-12">
      <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">No campaigns yet</h2>
      <p className="text-muted-foreground mb-4">
        Create your first campaign to start tracking metrics
      </p>
      <Button onClick={openCreateCampaignModal}>
        <Plus className="h-4 w-4 mr-2" />
        Create Campaign
      </Button>
    </div>
  )}

  {/* Campaign Cards Grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {campaigns.map(campaign => (
      <CampaignCard key={campaign.id} campaign={campaign} />
    ))}
  </div>
</div>
```

**Campaign Card Component**:
```tsx
<Card className="hover:shadow-lg transition-shadow">
  <CardHeader className="flex flex-row items-start justify-between">
    <Link href={`/campaign/${campaign.id}`} className="flex-1">
      <CardTitle className="flex items-center gap-2">
        {campaign.name}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </CardTitle>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
        <Music className="h-4 w-4" />
        <span>{campaign.songTitle}</span>
        {campaign.songArtist && <span>by {campaign.songArtist}</span>}
      </div>
    </Link>

    <div className="flex items-center gap-2">
      <Badge variant={campaign.status === 'Active' ? 'default' : 'secondary'}>
        {campaign.status}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => duplicateCampaign(campaign.id)}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => deleteCampaign(campaign.id)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </CardHeader>

  <CardContent>
    {/* Quick Stats */}
    <div className="grid grid-cols-4 gap-4 mb-4">
      <div className="text-center">
        <Eye className="h-4 w-4 mx-auto text-blue-500 mb-1" />
        <p className="text-xs text-muted-foreground">Views</p>
        <p className="font-semibold">{formatNumber(stats.views)}</p>
      </div>
      <div className="text-center">
        <Heart className="h-4 w-4 mx-auto text-red-500 mb-1" />
        <p className="text-xs text-muted-foreground">Likes</p>
        <p className="font-semibold">{formatNumber(stats.likes)}</p>
      </div>
      <div className="text-center">
        <MessageCircle className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
        <p className="text-xs text-muted-foreground">Comments</p>
        <p className="font-semibold">{formatNumber(stats.comments)}</p>
      </div>
      <div className="text-center">
        <Share2 className="h-4 w-4 mx-auto text-green-500 mb-1" />
        <p className="text-xs text-muted-foreground">Shares</p>
        <p className="font-semibold">{formatNumber(stats.shares)}</p>
      </div>
    </div>

    {/* Social Links Preview */}
    {socialLinks.length > 0 && (
      <div className="flex items-center gap-2 flex-wrap">
        {socialLinks.slice(0, 3).map(link => (
          <Badge key={link.id} className={getPlatformColor(link.platform)}>
            {link.creatorName}
          </Badge>
        ))}
        {socialLinks.length > 3 && (
          <Badge variant="outline">+{socialLinks.length - 3} more</Badge>
        )}
      </div>
    )}

    {/* Add Link Button */}
    {socialLinks.length === 0 && (
      <Button
        variant="outline"
        size="sm"
        onClick={() => openAddLinkModal(campaign.id)}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add First Link
      </Button>
    )}
  </CardContent>
</Card>
```

**Create Campaign Modal**:
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create New Campaign</DialogTitle>
      <DialogDescription>
        Track social media performance for your song
      </DialogDescription>
    </DialogHeader>

    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Campaign Name</Label>
          <Input
            id="name"
            placeholder="Summer 2024 Release"
            required
          />
        </div>

        <div>
          <Label htmlFor="songTitle">Song Title</Label>
          <Input
            id="songTitle"
            placeholder="My Song Name"
            required
          />
        </div>

        <div>
          <Label htmlFor="songArtist">Artist Name</Label>
          <Input
            id="songArtist"
            placeholder="Artist Name (optional)"
          />
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select defaultValue="Active">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button type="submit">
          Create Campaign
        </Button>
      </div>
    </form>
  </DialogContent>
</Dialog>
```

#### 9. Campaign Detail Page (`/campaign/:id`)
**MOST COMPLEX PAGE**

**Header Section**:
```tsx
<div className="border-b px-6 py-4">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div>
        <h1 className="text-2xl font-bold">{campaign.name}</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Music className="h-4 w-4" />
          <span>{campaign.songTitle}</span>
          {campaign.songArtist && <span>by {campaign.songArtist}</span>}
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <Select
        value={campaign.status}
        onValueChange={(v) => updateStatus(campaign.id, v)}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Active">Active</SelectItem>
          <SelectItem value="Inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" onClick={() => setShareModalOpen(true)}>
        <LinkIcon className="h-4 w-4 mr-2" />
        Share
      </Button>

      <Button
        variant="outline"
        onClick={() => rescrapeAll(campaign.id)}
        disabled={isRescrapingAll}
      >
        {isRescrapingAll ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        Refresh All
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setCsvImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportCsv(campaign.id)}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => deleteCampaign(campaign.id)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Campaign
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</div>
```

**KPI Cards Section**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
  {/* Views Card */}
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        Total Views
      </CardTitle>
      <Eye className="h-4 w-4 text-blue-500" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{formatNumber(metrics.totals.views)}</div>
      <p className="text-xs text-muted-foreground mt-1">
        From {metrics.trackedPostsCount} unique posts
      </p>
    </CardContent>
  </Card>

  {/* Likes Card */}
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        Total Likes
      </CardTitle>
      <Heart className="h-4 w-4 text-red-500" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{formatNumber(metrics.totals.likes)}</div>
      <p className="text-xs text-muted-foreground mt-1">
        {((metrics.totals.likes / metrics.totals.views) * 100).toFixed(1)}% of views
      </p>
    </CardContent>
  </Card>

  {/* Comments Card */}
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        Total Comments
      </CardTitle>
      <MessageCircle className="h-4 w-4 text-yellow-500" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{formatNumber(metrics.totals.comments)}</div>
    </CardContent>
  </Card>

  {/* Shares Card */}
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        Total Shares
      </CardTitle>
      <Share2 className="h-4 w-4 text-green-500" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{formatNumber(metrics.totals.shares)}</div>
    </CardContent>
  </Card>
</div>
```

**Performance Chart**:
```tsx
<div className="p-6">
  <Card>
    <CardHeader>
      <CardTitle>Performance Over Time</CardTitle>
      <CardDescription>Last 30 days</CardDescription>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={metrics.timeSeries}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => new Date(date).toLocaleDateString()}
          />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="views"
            stroke="#3B82F6"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="likes"
            stroke="#EF4444"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="comments"
            stroke="#F59E0B"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="shares"
            stroke="#10B981"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
</div>
```

**Creators & Posts Section**:
```tsx
<div className="p-6">
  <Card>
    <CardHeader>
      <CardTitle>Creators & Posts</CardTitle>
      <CardDescription>
        {filteredLinks.length} {filteredLinks.length === 1 ? 'post' : 'posts'} tracked
      </CardDescription>
    </CardHeader>
    <CardContent>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search by creator name or handle..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />

        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Sort by:</Label>
          <Select value={sortKey} onValueChange={setSortKey}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="creator">Creator</SelectItem>
              <SelectItem value="platform">Platform</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="views">Views</SelectItem>
              <SelectItem value="likes">Likes</SelectItem>
              <SelectItem value="comments">Comments</SelectItem>
              <SelectItem value="shares">Shares</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          >
            {sortDir === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Filter:</Label>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex gap-2">
          <Button onClick={() => setCsvImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setAddLinkOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Link
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar (shown when items selected) */}
      {selectedLinks.length > 0 && (
        <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedLinks.length} {selectedLinks.length === 1 ? 'item' : 'items'} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkUpdateStatus(selectedLinks)}
            >
              Update Status
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkRescrape(selectedLinks)}
            >
              Refresh Metrics
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => bulkDelete(selectedLinks)}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedLinks.length === filteredLinks.length}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>Creator</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-right">Likes</TableHead>
            <TableHead className="text-right">Comments</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Engagement</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredLinks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <LinkIcon className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">No posts yet</p>
                  <Button onClick={() => setAddLinkOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Link
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            paginatedLinks.map(link => (
              <TableRow key={link.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedLinks.includes(link.id)}
                    onCheckedChange={() => toggleSelect(link.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{link.creatorName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getPlatformColor(link.platform)}>
                    {link.platform}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={link.postStatus}
                    onValueChange={(v) => updateLinkStatus(link.id, v)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="briefed">Briefed</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(link.views)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(link.likes)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(link.comments)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(link.shares)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(link.engagementRate * 100).toFixed(2)}%
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {link.lastScrapedAt
                    ? formatDistanceToNow(new Date(link.lastScrapedAt), { addSuffix: true })
                    : 'Never'
                  }
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(link)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => rescrape(link.id)}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Metrics
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(link.url, '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => deleteLink(link.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, filteredLinks.length)} of {filteredLinks.length} results
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 py-2 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
</div>
```

**Add Social Link Modal**:
```tsx
<Dialog open={addLinkOpen} onOpenChange={setAddLinkOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add Social Link</DialogTitle>
      <DialogDescription>
        Add a TikTok, Instagram, YouTube, Twitter, or Facebook post to track
      </DialogDescription>
    </DialogHeader>

    <form onSubmit={handleAddLink}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="url">Post URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://www.tiktok.com/@username/video/..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              detectPlatform(e.target.value);
            }}
            required
          />
          {detectedPlatform && (
            <p className="text-xs text-muted-foreground mt-1">
              Detected platform: {detectedPlatform}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="creatorName">Creator Name</Label>
          <Input
            id="creatorName"
            placeholder="@username or Creator Name"
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            required
          />
          {/* Autocomplete suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-1 border rounded-md bg-popover">
              {suggestions.map(s => (
                <div
                  key={s.creatorName}
                  className="px-3 py-2 hover:bg-accent cursor-pointer"
                  onClick={() => setCreatorName(s.creatorName)}
                >
                  {s.creatorName} <span className="text-muted-foreground">({s.platform})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="postStatus">Post Status</Label>
          <Select value={postStatus} onValueChange={setPostStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="briefed">Briefed</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button type="button" variant="outline" onClick={() => setAddLinkOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isAdding}>
          {isAdding ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add & Scrape
            </>
          )}
        </Button>
      </div>
    </form>
  </DialogContent>
</Dialog>
```

**CSV Import Modal**:
```tsx
<Dialog open={csvImportOpen} onOpenChange={setCsvImportOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Import CSV</DialogTitle>
      <DialogDescription>
        Upload a CSV file to bulk add social links
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">
          Drag & drop your CSV file here
        </p>
        <p className="text-xs text-muted-foreground">
          or click to browse
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Format Guide */}
      <div className="bg-muted p-4 rounded-lg">
        <h4 className="font-semibold mb-2">CSV Format</h4>
        <p className="text-sm text-muted-foreground mb-2">
          Required columns: <code>url</code>, <code>creatorName</code>
        </p>
        <p className="text-sm text-muted-foreground mb-2">
          Optional columns: <code>platform</code>, <code>postStatus</code>
        </p>
        <p className="text-xs text-muted-foreground">
          Example:
        </p>
        <pre className="text-xs bg-background p-2 rounded mt-1 overflow-x-auto">
url,creatorName,platform,postStatus
https://tiktok.com/@user/video/123,@user,tiktok,active
https://instagram.com/p/ABC123,@creator,instagram,pending
        </pre>
      </div>

      {/* Preview Table */}
      {parsedData.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">
            Preview ({parsedData.length} rows)
          </h4>
          <div className="border rounded-lg max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData.slice(0, 10).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="max-w-xs truncate">{row.url}</TableCell>
                    <TableCell>{row.creatorName}</TableCell>
                    <TableCell>
                      <Badge>{row.platform || 'Auto-detect'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.postStatus || 'pending'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {parsedData.length > 10 && (
              <p className="text-xs text-center py-2 text-muted-foreground">
                ...and {parsedData.length - 10} more rows
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <h4 className="font-semibold text-destructive mb-2">
            Errors Found ({errors.length})
          </h4>
          <ul className="text-sm text-destructive space-y-1">
            {errors.slice(0, 5).map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
            {errors.length > 5 && (
              <li>...and {errors.length - 5} more errors</li>
            )}
          </ul>
        </div>
      )}
    </div>

    <div className="flex justify-end gap-2 mt-6">
      <Button type="button" variant="outline" onClick={() => setCsvImportOpen(false)}>
        Cancel
      </Button>
      <Button
        onClick={handleImport}
        disabled={parsedData.length === 0 || errors.length > 0 || isImporting}
      >
        {isImporting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Importing...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Import {parsedData.length} Links
          </>
        )}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

**Share Campaign Modal**:
```tsx
<Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Share Campaign</DialogTitle>
      <DialogDescription>
        Create a public link to share this campaign
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Enable Public Sharing</Label>
          <p className="text-xs text-muted-foreground">
            Allow anyone with the link to view metrics
          </p>
        </div>
        <Switch
          checked={shareEnabled}
          onCheckedChange={handleToggleShare}
        />
      </div>

      {shareEnabled && (
        <>
          <div>
            <Label htmlFor="shareLink">Share Link</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="shareLink"
                value={shareUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast({ title: 'Link copied!' });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Password Protection</Label>
              <p className="text-xs text-muted-foreground">
                Require password to view
              </p>
            </div>
            <Switch
              checked={passwordProtected}
              onCheckedChange={setPasswordProtected}
            />
          </div>

          {passwordProtected && (
            <div>
              <Label htmlFor="sharePassword">Password</Label>
              <Input
                id="sharePassword"
                type="password"
                placeholder="Enter password"
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
              />
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(shareUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Shared Page
          </Button>
        </>
      )}
    </div>

    <div className="flex justify-end gap-2 mt-6">
      <Button variant="outline" onClick={() => setShareModalOpen(false)}>
        Close
      </Button>
      {shareEnabled && (
        <Button onClick={handleSaveShareSettings}>
          Save Settings
        </Button>
      )}
    </div>
  </DialogContent>
</Dialog>
```

#### 10. Profile Page (`/profile`)
```tsx
<div className="max-w-2xl mx-auto p-6">
  <Card>
    <CardHeader>
      <CardTitle>Profile</CardTitle>
      <CardDescription>Manage your account settings</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.profileImageUrl} />
          <AvatarFallback className="text-2xl">
            {user.initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold text-lg">{user.fullName}</h3>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <Badge variant={user.isVerified ? 'default' : 'secondary'} className="mt-1">
            {user.isVerified ? 'Verified' : 'Not Verified'}
          </Badge>
        </div>
      </div>

      <Separator />

      <div>
        <Label htmlFor="fullName">Full Name</Label>
        <Input id="fullName" defaultValue={user.fullName} />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" defaultValue={user.email} disabled />
      </div>

      <div>
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" type="tel" defaultValue={user.phone} />
      </div>

      <Separator />

      <div>
        <h4 className="font-semibold mb-2">Change Password</h4>
        <div className="space-y-3">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input id="currentPassword" type="password" />
          </div>
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" type="password" />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input id="confirmPassword" type="password" />
          </div>
          <Button variant="outline">Update Password</Button>
        </div>
      </div>

      <Separator />

      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-semibold">Delete Account</h4>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all data
          </p>
        </div>
        <Button variant="destructive">Delete Account</Button>
      </div>
    </CardContent>
  </Card>
</div>
```

---

## 🔧 BACKEND API IMPLEMENTATION

### Authentication Endpoints

#### POST /api/auth/signup
```typescript
// Request
{
  email: string;
  fullName: string;
  password: string;
}

// Response (201)
{
  user: {
    id: string;
    email: string;
    fullName: string;
    isVerified: false;
  }
}

// Logic:
1. Validate email format
2. Check if email already exists
3. Hash password with bcryptjs (10 rounds)
4. Generate 6-digit verification code
5. Set verification expiry (24 hours)
6. Insert user into database
7. Send verification email via Resend
8. Create session
9. Return user object
```

#### POST /api/auth/login
```typescript
// Request
{
  email: string;
  password: string;
}

// Response (200)
{
  user: {
    id: string;
    email: string;
    fullName: string;
    isVerified: boolean;
  }
}

// Logic:
1. Find user by email
2. Compare password with bcrypt.compare()
3. If match, create session
4. Return user object
5. If no match, return 401
```

#### POST /api/auth/verify
```typescript
// Request
{
  code: string;
}

// Response (200)
{
  success: true;
}

// Logic:
1. Get user from session
2. Check if code matches and not expired
3. Update isVerified = true
4. Clear verification code
5. Return success
```

#### GET /api/auth/session
```typescript
// Response (200)
{
  user: {
    id: string;
    email: string;
    fullName: string;
    isVerified: boolean;
  }
}

// OR (401)
{
  error: "Not authenticated"
}

// Logic:
1. Check if session exists
2. If yes, return user from session
3. If no, return 401
```

### Campaign Endpoints

#### GET /api/campaigns
```typescript
// Response (200)
{
  campaigns: Campaign[]
}

// Logic:
1. Get user ID from session
2. Query campaigns WHERE ownerId = userId
3. For each campaign, calculate aggregated stats:
   - totalViews = SUM(social_links.views WHERE campaignId = campaign.id)
   - totalLikes, totalComments, totalShares (same pattern)
   - postCount = COUNT(social_links WHERE campaignId = campaign.id)
4. Return campaigns with stats
```

#### POST /api/campaigns
```typescript
// Request
{
  name: string;
  songTitle: string;
  songArtist?: string;
  status: "Active" | "Inactive";
}

// Response (201)
{
  campaign: Campaign
}

// Logic:
1. Get user ID from session
2. Validate input with Zod
3. Insert campaign with ownerId = userId
4. Return created campaign
```

#### GET /api/campaigns/:id/metrics
```typescript
// Response (200)
{
  totals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  timeSeries: Array<{
    date: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
  trackedPostsCount: number;
  lastUpdatedAt: string | null;
}

// Logic (IMPORTANT - Deduplication):
1. Get user ID from session
2. Verify user owns campaign
3. Query all social_links WHERE campaignId = :id
4. **Deduplicate by postKey**:
   - Group by postKey
   - For each group, keep only the most recently scraped link
   - This ensures same post added multiple times doesn't inflate totals
5. Calculate totals from deduplicated links
6. Build time series from engagement_history (last 30 days)
7. Return metrics object
```

### Social Links Endpoints

#### POST /api/social-links
```typescript
// Request
{
  campaignId: number;
  url: string;
  creatorName: string;
  postStatus: "pending" | "briefed" | "active" | "done";
}

// Response (201)
{
  socialLink: SocialLink;
  scrapeJob: ScrapeJob;
}

// Logic:
1. Verify user owns campaign
2. Detect platform from URL pattern:
   - tiktok.com → "tiktok"
   - instagram.com → "instagram"
   - youtube.com → "youtube"
   - twitter.com/x.com → "twitter"
   - facebook.com → "facebook"
3. Normalize URL (remove query params, lowercase)
4. Generate postKey = `${platform}:${canonicalUrl}`
5. Insert social_link
6. Create scrape_job (status: "queued")
7. Create scrape_task for this link
8. Trigger background scraper
9. Return link + job
```

#### POST /api/social-links/:id/rescrape
```typescript
// Response (200)
{
  scrapeJob: ScrapeJob;
}

// Logic:
1. Verify user owns the social link's campaign
2. Create new scrape_job
3. Create scrape_task for this link
4. Trigger background scraper
5. Return job
```

### Scraping System

#### Background Scraper Queue
```typescript
// Runs every 10 seconds
async function processQueue() {
  // Get up to 5 queued tasks
  const tasks = await db.query(`
    SELECT * FROM scrape_tasks
    WHERE status = 'queued'
    ORDER BY id ASC
    LIMIT 5
  `);

  // Process concurrently
  await Promise.all(tasks.map(processTask));
}

async function processTask(task: ScrapeTask) {
  try {
    // Update status
    await db.update(scrape_tasks)
      .set({ status: 'processing', attempts: task.attempts + 1 })
      .where(eq(scrape_tasks.id, task.id));

    // Call scraping API
    let metrics;
    try {
      // Try ScrapeCreators API first
      metrics = await scrapeCreatorsApi(task.url, task.platform);
    } catch (e) {
      // Fallback to Apify
      metrics = await apifyApi(task.url, task.platform);
    }

    // Update social_links with metrics
    await db.update(social_links)
      .set({
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        engagementRate: (metrics.likes + metrics.comments + metrics.shares) / metrics.views,
        lastScrapedAt: new Date(),
        status: 'success',
        errorMessage: null,
      })
      .where(eq(social_links.id, task.social_link_id));

    // Create engagement_history snapshot
    await db.insert(engagement_history).values({
      socialLinkId: task.social_link_id,
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      totalEngagement: metrics.likes + metrics.comments + metrics.shares,
      recordedAt: new Date(),
    });

    // Update task status
    await db.update(scrape_tasks)
      .set({
        status: 'completed',
        resultViews: metrics.views,
        resultLikes: metrics.likes,
        resultComments: metrics.comments,
        resultShares: metrics.shares,
        updatedAt: new Date(),
      })
      .where(eq(scrape_tasks.id, task.id));

  } catch (error) {
    // Retry logic
    if (task.attempts < 3) {
      await db.update(scrape_tasks)
        .set({
          status: 'queued',
          lastError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(scrape_tasks.id, task.id));
    } else {
      // Max retries reached
      await db.update(scrape_tasks)
        .set({
          status: 'failed',
          lastError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(scrape_tasks.id, task.id));

      await db.update(social_links)
        .set({
          status: 'failed',
          errorMessage: error.message,
        })
        .where(eq(social_links.id, task.social_link_id));
    }
  }
}
```

#### ScrapeCreators API Integration
```typescript
async function scrapeCreatorsApi(url: string, platform: string) {
  const response = await fetch('https://api.scrapecreators.com/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SCRAPECREATORS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      platform,
      fields: ['views', 'likes', 'comments', 'shares'],
    }),
  });

  if (!response.ok) {
    throw new Error(`ScrapeCreators API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    views: data.views || 0,
    likes: data.likes || 0,
    comments: data.comments || 0,
    shares: data.shares || 0,
  };
}
```

### CSV Import Endpoint

#### POST /api/campaigns/:id/import-csv
```typescript
// Request (multipart/form-data)
{
  file: File (CSV)
}

// Response (200)
{
  imported: number;
  skipped: number;
  errors: string[];
}

// Logic:
1. Verify user owns campaign
2. Parse CSV file
3. Validate headers: require 'url' and 'creatorName'
4. For each row:
   - Detect platform from URL
   - Normalize URL
   - Check if postKey already exists (skip if duplicate)
   - Insert social_link
   - Create scrape_task
5. Return summary
```

---

## 📊 HELPER FUNCTIONS

### formatNumber (client-side)
```typescript
function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}
```

### getPlatformColor
```typescript
function getPlatformColor(platform: string): string {
  const colors = {
    tiktok: "bg-black text-white dark:bg-white dark:text-black",
    instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
    youtube: "bg-red-600 text-white",
    twitter: "bg-sky-500 text-white",
    facebook: "bg-blue-600 text-white",
  };
  return colors[platform.toLowerCase()] || "bg-muted";
}
```

### detectPlatform
```typescript
function detectPlatform(url: string): string | null {
  const patterns = {
    tiktok: /tiktok\.com/i,
    instagram: /instagram\.com/i,
    youtube: /youtube\.com|youtu\.be/i,
    twitter: /twitter\.com|x\.com/i,
    facebook: /facebook\.com/i,
  };

  for (const [platform, pattern] of Object.entries(patterns)) {
    if (pattern.test(url)) return platform;
  }

  return null;
}
```

### normalizeUrl
```typescript
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking params
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
```

---

## 🚀 DEPLOYMENT REQUIREMENTS

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Session
SESSION_SECRET=random-secure-string-min-32-chars

# Scraping APIs
SCRAPECREATORS_API_KEY=your-api-key
APIFY_API_TOKEN=your-apify-token

# Email
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=support@yourdomain.com

# App
NODE_ENV=production
APP_URL=https://yourdomain.com
```

### Build Commands
```bash
# Install dependencies
npm install

# Build frontend + backend
npm run build

# Run database migrations
npx drizzle-kit push

# Start production server
NODE_ENV=production node dist/index.cjs
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "tsx script/build.ts",
    "start": "NODE_ENV=production node dist/index.cjs",
    "db:push": "drizzle-kit push"
  }
}
```

---

## ✅ CRITICAL FEATURES TO IMPLEMENT

### Priority 1 (Must Have)
1. ✅ User authentication (signup, login, logout)
2. ✅ Email verification
3. ✅ Campaign CRUD
4. ✅ Social link CRUD
5. ✅ Automated scraping with ScrapeCreators API
6. ✅ Dashboard with KPI cards
7. ✅ Campaign detail page with table
8. ✅ Post status workflow (pending → briefed → active → done)
9. ✅ Search & filter posts
10. ✅ Sort by metrics
11. ✅ Platform detection from URL
12. ✅ Deduplication by postKey

### Priority 2 (Important)
13. ✅ Performance chart (time series)
14. ✅ CSV import
15. ✅ CSV export
16. ✅ Campaign sharing (public links)
17. ✅ Password-protected shares
18. ✅ Bulk actions (delete, update status)
19. ✅ Creator name autocomplete
20. ✅ Pagination (20 per page)
21. ✅ Responsive design (mobile, tablet, desktop)

### Priority 3 (Nice to Have)
22. ⏳ Workspace teams
23. ⏳ Email invitations
24. ⏳ Advanced date range picker
25. ⏳ Export to PDF
26. ⏳ Webhook integrations
27. ⏳ API access
28. ⏳ Dark/light mode toggle

---

## 🎯 KEY DIFFERENTIATORS

Make sure the AI web generator emphasizes these unique features:

1. **Music-Specific**: Song title + artist fields (not generic "content")
2. **Workflow Status**: pending/briefed/active/done badges
3. **Deduplication**: postKey system prevents double-counting
4. **Multi-Platform**: TikTok + Instagram + YouTube + Twitter + Facebook
5. **Automated Scraping**: Background queue with retry logic
6. **Clean Design**: Dark mode, purple brand color, minimal UI
7. **Real-time Updates**: TanStack Query for instant updates
8. **Team Collaboration**: Workspaces with role-based access

---

## 📝 FINAL NOTES FOR AI GENERATOR

- **Code Quality**: Use TypeScript strict mode, proper error handling
- **Performance**: Implement pagination, debouncing, lazy loading
- **Security**: Input validation with Zod, SQL injection prevention (use Drizzle ORM)
- **Accessibility**: ARIA labels, keyboard navigation, focus states
- **Responsive**: Mobile-first design, works on all screen sizes
- **SEO**: Proper meta tags, semantic HTML
- **Testing**: Include unit tests for critical functions
- **Documentation**: Add JSDoc comments to complex functions
- **Error Messages**: User-friendly, actionable error messages
- **Loading States**: Skeleton screens, spinners, progress indicators
- **Empty States**: Helpful messages with CTAs when no data exists
- **Success Feedback**: Toast notifications for all user actions

---

**END OF PROMPT**

This prompt contains everything needed to replicate dttracker.com from scratch. Give this to an AI web generator (like v0.dev, bolt.new, or GPT Engineer) for best results.
