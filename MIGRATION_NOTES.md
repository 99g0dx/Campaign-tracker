# Migration from Replit to Railway - Completed Changes

This document outlines all changes made to migrate the Campaign Tracker app from Replit to Railway.

## Summary of Changes

### ✅ Database Migration (SQLite → PostgreSQL)

**Files Modified:**
- `shared/schema.ts` - Converted all tables from SQLite to PostgreSQL
  - Changed `sqliteTable` → `pgTable`
  - Changed `integer` auto-increment → `serial`
  - Changed `integer(..., { mode: "timestamp" })` → `timestamp`
  - Changed `integer(..., { mode: "boolean" })` → `boolean`
  - Changed `sql\`(unixepoch())\`` → `defaultNow()`
  - Changed UUID generation from SQLite → PostgreSQL (`gen_random_uuid()::text`)

- `server/db.ts` - Updated database connection
  - Replaced `better-sqlite3` with `pg` (node-postgres)
  - Changed from `drizzle-orm/better-sqlite3` to `drizzle-orm/node-postgres`
  - Added `DATABASE_URL` environment variable requirement

- `drizzle.config.ts` - Updated ORM configuration
  - Changed dialect from `sqlite` to `postgresql`
  - Updated connection to use `DATABASE_URL`

- `package.json` - Updated dependencies
  - Removed: `better-sqlite3`, `@types/better-sqlite3`
  - PostgreSQL support already included via `pg` package

### ✅ Removed Replit-Specific Code

**Files Modified:**
- `server/email.ts` - Simplified email configuration
  - Removed Replit Connectors integration
  - Changed to direct `RESEND_API_KEY` environment variable
  - Added `RESEND_FROM_EMAIL` environment variable

- `server/routes.ts` - Updated URL generation
  - Replaced `REPLIT_DEV_DOMAIN` and `REPLIT_DEPLOYMENT_URL` with `APP_URL`

- `server/authRoutes.ts` - Updated URL generation
  - Replaced Replit-specific domain logic with `APP_URL`

- `vite.config.ts` - Removed Replit Vite plugins
  - Removed `@replit/vite-plugin-runtime-error-modal`
  - Removed `@replit/vite-plugin-cartographer`
  - Removed `@replit/vite-plugin-dev-banner`

- `package.json` - Removed Replit dependencies
  - Removed all `@replit/vite-plugin-*` packages from devDependencies

### ✅ Railway Configuration

**Files Created:**
- `railway.json` - Railway deployment configuration
  - Build command: `npm run build`
  - Start command: `npm run start`
  - Restart policy configured

- `.env.example` - Environment variables template
  - All required variables documented
  - Example values provided

- `DEPLOYMENT.md` - Complete deployment guide
  - Step-by-step Railway deployment instructions
  - Environment variable setup
  - Troubleshooting guide

**Files Modified:**
- `.gitignore` - Added environment files
  - Added `.env` and `.env.local`
  - Added `*.log`

## Environment Variables Changes

### Old (Replit)
```
REPLIT_DEV_DOMAIN
REPLIT_DEPLOYMENT_URL
REPLIT_CONNECTORS_HOSTNAME
REPL_IDENTITY
WEB_REPL_RENEWAL
```

### New (Railway)
```
DATABASE_URL (auto-set by Railway PostgreSQL)
SESSION_SECRET
RESEND_API_KEY
RESEND_FROM_EMAIL
APP_URL
NODE_ENV
PORT
APIFY_API_TOKEN (optional)
```

## Breaking Changes

⚠️ **Important:** The following changes are breaking and require action:

1. **Database:** Must migrate data from SQLite to PostgreSQL
   - Old SQLite database file (`sqlite.db`) will not work
   - Need to export data and import to PostgreSQL if migrating existing data

2. **Environment Variables:** Must set new environment variables
   - `DATABASE_URL` - Required for database connection
   - `SESSION_SECRET` - Required for session security
   - `RESEND_API_KEY` - Required for email functionality

3. **Email Configuration:** Must configure Resend directly
   - No longer uses Replit Connectors
   - Must create Resend account and get API key

## Next Steps

1. **Test Locally** (Optional but recommended):
   ```bash
   # Set up local PostgreSQL database
   # Create .env file with DATABASE_URL
   cp .env.example .env
   # Edit .env with your values

   # Install dependencies
   npm install

   # Run migrations
   npm run db:push

   # Start dev server
   npm run dev
   ```

2. **Deploy to Railway**:
   - Follow instructions in `DEPLOYMENT.md`
   - Create GitHub repository if not already done
   - Connect to Railway
   - Add PostgreSQL database
   - Set environment variables
   - Deploy!

3. **Data Migration** (if you have existing data):
   - Export data from SQLite database
   - Convert to PostgreSQL format
   - Import to Railway PostgreSQL instance

## Testing Checklist

After deployment, verify:
- [ ] App builds successfully
- [ ] Database connection works
- [ ] User signup works
- [ ] Email verification works
- [ ] Login/logout works
- [ ] Campaign creation works
- [ ] Social link scraping works
- [ ] All features functional

## Rollback Plan

If issues occur, you can:
1. Check Railway logs for errors
2. Verify environment variables are set correctly
3. Ensure PostgreSQL database is running
4. Review this migration document for missed steps

## Files Changed Summary

**Total files modified:** 10
**New files created:** 4
**Dependencies removed:** 5
**Dependencies updated:** 1

## Build Verification

✅ Build tested successfully:
```
vite v5.4.20 building for production...
✓ 2544 modules transformed.
../dist/public/index.html                   2.27 kB │ gzip:   0.90 kB
../dist/public/assets/index-Rn1SYJmP.css   81.47 kB │ gzip:  13.22 kB
../dist/public/assets/index-CGJ-xxdY.js   893.26 kB │ gzip: 253.44 kB
✓ built in 1.63s
```

## Migration Complete! 🎉

Your app is now ready to deploy to Railway. Follow the [DEPLOYMENT.md](./DEPLOYMENT.md) guide to get started.
