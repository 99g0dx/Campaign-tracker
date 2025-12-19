# CSV Import Guide

## Overview

The Campaign Tracker now supports robust CSV import with two distinct modes:
- **Creators List Mode**: Import creator names/handles without requiring post URLs
- **Posts Mode**: Import post URLs with optional metrics

## Import Modes

### 1. Creators List Mode

Import a list of creators to track later. No URLs required!

**Required Fields** (at least one):
- `Creator`, `Handle`, `Username`, `User`, or `Name` (case-insensitive)

**Optional Fields**:
- `Platform` (tiktok, instagram, youtube, x, facebook)
- `Profile URL` (creator's profile link)

**Example CSV:**
```csv
Creator,Platform,Profile URL
@johndoe,tiktok,https://tiktok.com/@johndoe
janedoe,instagram,https://instagram.com/janedoe
mike_music,youtube,
sarah_smith,tiktok,https://tiktok.com/@sarah_smith
```

**What Happens:**
- Each creator is added as a placeholder entry in the campaign
- Status is set to "pending"
- URLs can be added later
- Duplicates are automatically detected by handle + platform

### 2. Posts Mode

Import actual post URLs with metrics.

**Required Fields**:
- `URL`, `Post URL`, `Post`, or `Link` (must start with http/https)

**Optional Fields**:
- `Creator`, `Handle`, `Username` (if missing, set to "Unknown")
- `Platform` (auto-detected from URL if not provided)
- `Views`, `Likes`, `Comments`, `Shares` (supports comma formatting: "12,500")

**Example CSV:**
```csv
URL,Creator,Platform,Views,Likes,Comments,Shares
https://tiktok.com/@user1/video/123,user1,tiktok,"12,500",450,23,15
https://instagram.com/p/abc123,user2,instagram,"5,200",320,18,8
https://youtube.com/watch?v=xyz789,user3,youtube,"25,000","1,200",145,35
```

**What Happens:**
- Posts are created with the provided URLs
- Metrics are imported if provided
- Platform is auto-detected if not specified
- Duplicates are automatically detected by URL

## Flexible Column Names

The parser accepts many variations of column names (case-insensitive):

**Creator/Handle:**
- Creator, Handle, Username, User, Name

**Platform:**
- Platform, Network, Social

**URL (Posts mode):**
- URL, Post URL, Post, Link

**Profile URL (Creators mode):**
- Profile URL, Profile, Profile Link

**Metrics:**
- Views, View Count, View_Count
- Likes, Like Count, Like_Count
- Comments, Comment Count, Comment_Count
- Shares, Share Count, Share_Count

## CSV Format Requirements

1. **Headers Required**: First row must contain column names
2. **Comma-Separated**: Standard CSV format
3. **Quoted Fields**: Use quotes for fields containing commas (e.g., "12,500")
4. **@ Symbol**: Automatically removed from handles

## Error Handling

### Clear Error Messages

**Creators Mode:**
- "No valid creator rows found. Add a column like Creator/Handle/Username."

**Posts Mode:**
- "No valid post rows found. Add a column like URL/Post URL with links starting with http."

### Preview Table

Before importing, you'll see:
- ✅ Valid rows (green checkmark)
- ❌ Invalid rows (red X)
- Specific errors and warnings for each row
- First 10 rows preview

### Import Results

After import, you'll see:
- Number of rows imported
- Number of rows skipped
- Number of duplicates detected
- Specific error messages (first 10)

## Usage Instructions

1. **Click "Import CSV"** button in campaign detail page
2. **Select Mode**: Choose "Creators List" or "Posts"
3. **Upload File**: Select your CSV file
4. **Preview**: Review the parsed data and validation results
5. **Confirm**: Click "Import X Rows" to complete

## Sample CSV Files

Sample CSV files are included:
- `sample_creators.csv` - Example creators list
- `sample_posts.csv` - Example posts with metrics

## Tips

- Start with **Creators List mode** to bulk-add your creator roster
- Use **Posts mode** when you have actual URLs to track
- Empty columns are allowed in Creators mode
- Platform is optional - can be filled in later
- Numbers with commas are automatically parsed (12,500 → 12500)
- Duplicate detection prevents importing the same creator/post twice

## API Endpoint

```
POST /api/campaigns/:id/import-csv
Content-Type: application/json

{
  "mode": "creators" | "posts",
  "rows": [
    { "handle": "johndoe", "platform": "tiktok" },
    ...
  ]
}

Response:
{
  "imported": 10,
  "skipped": 2,
  "duplicates": 1,
  "errors": ["..."]
}
```
