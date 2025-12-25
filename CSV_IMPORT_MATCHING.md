# CSV Import with Automatic Creator Matching

## Overview

The DTTracker CSV import system now supports **automatic matching** between Creator CSV imports and Post CSV imports. This prevents duplicate creators and ensures posts are correctly attached to their creators.

## How It Works

### Workflow

1. **Import Creators First** (optional but recommended)
   - Upload a CSV with creator handles/names
   - System creates "placeholder" entries for each creator
   - Status: `pending` (no posts yet)

2. **Import Posts Later**
   - Upload a CSV with post URLs and optional creator info
   - System automatically matches each post to existing creators
   - Matched creators get their placeholder replaced with real post URL
   - Status auto-updates to `active` when first post is attached

3. **Result**
   - No duplicate creators
   - Clean, organized campaign data
   - Automatic status management

---

## Matching Rules (Priority Order)

### Rule 1: Exact Match on Normalized Handle

If the post CSV includes a `creator` or `creatorName` column:

1. Normalize both the CSV value and existing creator handles:
   - Trim whitespace
   - Convert to lowercase
   - Remove leading `@` symbols
   - Remove trailing slashes
   - Collapse multiple spaces

2. Match on: `campaign_id + normalized_handle + platform`
   - If found → attach post to that creator
   - If not found → try without platform constraint

**Example:**
```
CSV: "@JohnDoe  "
Existing: "johndoe"
Result: ✅ MATCH
```

### Rule 2: Infer Handle from URL

If no creator column exists in the CSV, extract handle from the post URL:

**Platform-Specific Extraction:**

- **TikTok**: `https://tiktok.com/@username/video/123`
  - Extract: `username`

- **Instagram**: `https://instagram.com/username/p/ABC123`
  - Extract: `username` (when present in URL)
  - Note: Many Instagram post URLs don't include username

- **Twitter/X**: `https://twitter.com/username/status/456`
  - Extract: `username`

- **YouTube**: `https://youtube.com/@username/shorts/789`
  - Extract: `username` (from @handle or /c/ channel URLs)
  - Note: `watch?v=` URLs don't contain username

- **Facebook**: Limited extraction capability

After extracting, match using the same normalization rules as Rule 1.

### Rule 3: Create New Creator (Fallback)

If no match found:
- Create a new social_links entry for this creator
- Set `postStatus = "active"` (has a real post)
- Use provided creator name or "Unknown"

---

## CSV Format Requirements

### Creators CSV Format

Import creators without posts first:

```csv
handle,platform,profileUrl
johndoe,TikTok,https://tiktok.com/@johndoe
janesmith,Instagram,https://instagram.com/janesmith
creator123,YouTube,https://youtube.com/@creator123
```

**Columns:**
- `handle` (required): Creator username/handle
- `platform` (optional): TikTok, Instagram, YouTube, Twitter, Facebook
- `profileUrl` (optional): Profile URL

### Posts CSV Format

Import post URLs with optional creator info:

```csv
url,creatorName,platform,views,likes,comments,shares
https://tiktok.com/@johndoe/video/123456,johndoe,TikTok,10000,500,50,25
https://instagram.com/p/ABC123,janesmith,Instagram,5000,200,30,10
https://youtube.com/watch?v=XYZ789,creator123,YouTube,25000,1000,100,50
```

**Columns:**
- `url` (required): Full post URL
- `creatorName` (optional but recommended): Creator handle
- `platform` (optional): Auto-detected from URL if not provided
- `views`, `likes`, `comments`, `shares` (optional): Initial metrics

---

## API Endpoints

### 1. Import Creators

**Endpoint:** `POST /api/campaigns/:id/import-csv`

**Request Body:**
```json
{
  "mode": "creators",
  "rows": [
    {
      "handle": "johndoe",
      "platform": "TikTok",
      "profileUrl": "https://tiktok.com/@johndoe"
    }
  ]
}
```

**Response:**
```json
{
  "imported": 5,
  "skipped": 0,
  "duplicates": 0,
  "errors": []
}
```

### 2. Import Posts (with Matching)

**Endpoint:** `POST /api/campaigns/:id/import-csv`

**Request Body:**
```json
{
  "mode": "posts",
  "rows": [
    {
      "url": "https://tiktok.com/@johndoe/video/123456",
      "creatorName": "johndoe",
      "platform": "TikTok"
    }
  ]
}
```

**Response:**
```json
{
  "imported": 10,
  "skipped": 0,
  "duplicates": 0,
  "matched": 8,
  "created": 2,
  "errors": []
}
```

**Response Fields:**
- `imported`: Total posts successfully imported
- `skipped`: Rows skipped due to validation errors
- `duplicates`: Duplicate URLs within the import (skipped)
- `matched`: Posts matched to existing creators
- `created`: New creator entries created
- `errors`: List of error messages (max 10)

### 3. Legacy File Upload

**Endpoint:** `POST /api/campaigns/:id/import-posts`

**Content-Type:** `multipart/form-data`

Upload a CSV file with columns: `creator_name`, `handle`, `url`, `status`

**Response:**
```json
{
  "ok": true,
  "inserted": 15,
  "matched": 10,
  "created": 5
}
```

---

## Status Automation

### Creator Status Rules

**Only 2 statuses exist:**
- `pending`: Creator has no posts attached yet
- `active`: Creator has at least 1 real post URL

**Automatic Status Updates:**

1. **New Creator Import (no URL)**
   - Status: `pending`
   - URL: `placeholder://...`

2. **New Post Import (real URL)**
   - Status: `active` immediately
   - URL: Actual post URL

3. **Match Post to Existing Creator**
   - Old status: `pending`
   - New status: `active`
   - Old URL: `placeholder://...`
   - New URL: Actual post URL

**Manual Status Changes:**
- Users can still manually change status via UI
- Import logic respects manual changes for non-placeholder entries

---

## Database Schema

### `social_links` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `campaign_id` | integer | FK to campaigns |
| `url` | text | Post URL or placeholder |
| `platform` | text | TikTok, Instagram, YouTube, etc. |
| `creator_name` | text | Original creator handle |
| `normalized_handle` | text | Auto-populated normalized handle |
| `post_status` | text | pending, briefed, active, done |
| `views`, `likes`, `comments`, `shares` | integer | Engagement metrics |

### Uniqueness Constraint

```sql
CREATE UNIQUE INDEX "idx_unique_creator_per_campaign"
ON "social_links"("campaign_id", "normalized_handle", "platform")
WHERE "normalized_handle" IS NOT NULL AND "url" LIKE 'placeholder://%';
```

**Purpose:** Prevents duplicate placeholder entries for the same creator in a campaign.

**Scope:** Only applies to placeholder URLs (creators without posts). Once a real URL is added, this constraint doesn't block it.

---

## Implementation Details

### Handle Normalization Function

Located in: `server/handleUtils.ts`

```typescript
export function normalizeHandle(handle: string): string {
  return handle
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')      // Remove leading @
    .replace(/\/+$/, '')     // Remove trailing /
    .replace(/\s+/g, ' ')    // Collapse spaces
    .trim();
}
```

### Handle Extraction Function

Located in: `server/handleUtils.ts`

Extracts creator handle from post URLs using platform-specific regex patterns.

### Database Trigger

Auto-populates `normalized_handle` column:

```sql
CREATE TRIGGER trigger_set_normalized_handle
  BEFORE INSERT OR UPDATE OF creator_name ON "social_links"
  FOR EACH ROW
  EXECUTE FUNCTION set_normalized_handle();
```

---

## Example Scenarios

### Scenario 1: Perfect Match

**Step 1 - Import Creators:**
```csv
handle,platform
johndoe,TikTok
```

Result: Creates `social_links` entry:
- `creator_name`: "johndoe"
- `normalized_handle`: "johndoe"
- `url`: "placeholder://1234/..."
- `post_status`: "pending"

**Step 2 - Import Posts:**
```csv
url,creatorName
https://tiktok.com/@johndoe/video/123,johndoe
```

Result: Updates existing entry:
- `url`: "https://tiktok.com/@johndoe/video/123"
- `post_status`: "active" (auto-updated)
- Same `id`, no duplicate created

### Scenario 2: Handle Variants Match

**Step 1 - Import Creators:**
```csv
handle
@JohnDoe
```

**Step 2 - Import Posts:**
```csv
url,creatorName
https://tiktok.com/@johndoe/video/123,johndoe
```

Result: ✅ **MATCH** - Normalized to same value: "johndoe"

### Scenario 3: Infer from URL

**Step 1 - Import Creators:**
```csv
handle,platform
johndoe,TikTok
```

**Step 2 - Import Posts (no creator column):**
```csv
url
https://tiktok.com/@johndoe/video/123
```

Result: ✅ **MATCH** - Extracted "johndoe" from URL

### Scenario 4: No Match - Create New

**Step 1 - Import Creators:**
```csv
handle,platform
johndoe,TikTok
```

**Step 2 - Import Posts:**
```csv
url,creatorName
https://tiktok.com/@janesmith/video/456,janesmith
```

Result: Creates new entry for "janesmith"

---

## Migration Guide

### Running the Migration

```bash
# Apply the migration
psql $DATABASE_URL -f migrations/0001_add_normalized_handle.sql
```

### What the Migration Does

1. Adds `normalized_handle` column to `social_links` table
2. Creates normalization function in PostgreSQL
3. Populates `normalized_handle` for existing records
4. Creates indexes for performance
5. Creates unique constraint for placeholder entries
6. Adds trigger to auto-populate `normalized_handle`

### Zero Downtime

The migration is designed to be non-blocking:
- Uses `IF NOT EXISTS` for safe re-runs
- Populates existing data
- New inserts work immediately via trigger

---

## Testing Recommendations

### Test Case 1: Basic Matching
1. Import 3 creators
2. Import 3 posts with exact handle matches
3. Verify: 3 matched, 0 created, all status = "active"

### Test Case 2: Case Insensitive
1. Import creator: "@JohnDoe"
2. Import post with: "johndoe"
3. Verify: Match successful

### Test Case 3: URL Inference
1. Import creator: "johndoe"
2. Import post: "https://tiktok.com/@johndoe/video/123" (no creatorName column)
3. Verify: Match via URL extraction

### Test Case 4: Platform Mismatch
1. Import creator: "johndoe" (TikTok)
2. Import post: "https://instagram.com/p/ABC" with creatorName="johndoe" (Instagram)
3. Verify: Should still match (platform is secondary)

### Test Case 5: Duplicate Prevention
1. Import creator: "johndoe" twice in same CSV
2. Verify: Only 1 entry created, 1 marked as duplicate

---

## Best Practices

1. **Always Provide Creator Column in Posts CSV**
   - Most reliable matching method
   - URL inference can fail for some platforms (Instagram, YouTube watch URLs)

2. **Import Creators First**
   - Ensures clean creator list before adding posts
   - Easier to review and manage

3. **Use Consistent Handle Format**
   - Stick with either "@username" or "username"
   - System normalizes, but consistency helps debugging

4. **Include Platform Column**
   - Helps with matching accuracy
   - Important if same handle exists across platforms

5. **Review Import Summary**
   - Check `matched` vs `created` counts
   - High `created` count may indicate matching issues

---

## Troubleshooting

### Problem: Posts Not Matching Creators

**Possible Causes:**
1. Handle spelling mismatch in CSV
2. Platform mismatch (if enforced)
3. Creator wasn't imported first

**Solution:**
- Check exact spelling in both CSVs
- Review normalization logic
- Verify creator exists as placeholder

### Problem: Duplicate Creators

**Possible Causes:**
1. Importing posts before creators
2. Different handle variations
3. Multiple imports without checking existing

**Solution:**
- Always import creators first
- Use consistent handle format
- Check campaign before import

### Problem: Status Not Auto-Updating

**Possible Causes:**
1. Manual status override
2. Post update failed
3. Database trigger not installed

**Solution:**
- Check migration was applied
- Verify trigger exists: `\d social_links` in psql
- Check logs for update errors

---

## API Integration Examples

### JavaScript/TypeScript

```typescript
// Import creators
const creatorsResponse = await fetch(`/api/campaigns/${campaignId}/import-csv`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'creators',
    rows: [
      { handle: 'johndoe', platform: 'TikTok' },
      { handle: 'janesmith', platform: 'Instagram' }
    ]
  })
});

const { imported, skipped, duplicates } = await creatorsResponse.json();
console.log(`Imported ${imported} creators`);

// Import posts with matching
const postsResponse = await fetch(`/api/campaigns/${campaignId}/import-csv`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'posts',
    rows: [
      {
        url: 'https://tiktok.com/@johndoe/video/123',
        creatorName: 'johndoe'
      }
    ]
  })
});

const { imported, matched, created } = await postsResponse.json();
console.log(`Matched ${matched} posts to existing creators`);
console.log(`Created ${created} new creators`);
```

### cURL

```bash
# Import creators
curl -X POST http://localhost:5000/api/campaigns/123/import-csv \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "creators",
    "rows": [
      {"handle": "johndoe", "platform": "TikTok"}
    ]
  }'

# Import posts
curl -X POST http://localhost:5000/api/campaigns/123/import-csv \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "posts",
    "rows": [
      {
        "url": "https://tiktok.com/@johndoe/video/123",
        "creatorName": "johndoe"
      }
    ]
  }'
```

---

## Future Enhancements

### Planned Features

1. **Manual Assignment UI**
   - For unmatched posts from Instagram (no handle in URL)
   - Dropdown to select creator for each unmatched post
   - Bulk assignment capability

2. **Fuzzy Matching**
   - Levenshtein distance for typos
   - "Did you mean?" suggestions
   - Confidence scores

3. **Batch Processing**
   - Process large CSVs in background
   - Progress indicators
   - Email notifications when complete

4. **Import History**
   - Track all imports per campaign
   - Ability to rollback/undo
   - Audit trail

5. **Smart Platform Detection**
   - Better Instagram handle extraction
   - Facebook post parsing improvements
   - Support for more platforms (Snapchat, LinkedIn)

---

## Support

For issues or questions:
1. Check this documentation first
2. Review error messages in API response
3. Check database logs for constraint violations
4. Open an issue on GitHub with:
   - Sample CSV (sanitized)
   - Expected vs actual behavior
   - Error messages
