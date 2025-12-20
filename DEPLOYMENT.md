# Deployment Guide - Campaign Tracker

This guide will help you deploy the Campaign Tracker app to Railway.

## Prerequisites

1. A [Railway](https://railway.app/) account (sign up for free)
2. A [Resend](https://resend.com/) account for email functionality
3. An [Apify](https://apify.com/) account for social media scraping (optional)

## Quick Deploy to Railway

### Step 1: Create a New Railway Project

1. Go to [Railway](https://railway.app/)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select the repository containing this code

### Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will automatically create a `DATABASE_URL` environment variable

### Step 3: Configure Environment Variables

In your Railway project settings, add the following environment variables:

#### Required Variables:

```
SESSION_SECRET=<generate-a-random-secret-key>
RESEND_API_KEY=<your-resend-api-key>
NODE_ENV=production
PORT=5000
```

#### Optional Variables:

```
RESEND_FROM_EMAIL=Campaign Tracker <noreply@yourdomain.com>
APIFY_API_TOKEN=<your-apify-token>
APP_URL=https://<your-app>.railway.app
```

**How to generate SESSION_SECRET:**
```bash
# On macOS/Linux:
openssl rand -base64 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**How to get RESEND_API_KEY:**
1. Sign up at [Resend](https://resend.com/)
2. Go to API Keys section
3. Create a new API key

**How to get APIFY_API_TOKEN:**
1. Sign up at [Apify](https://apify.com/)
2. Go to Settings → Integrations
3. Copy your API token

### Step 4: Run Database Migrations

After the initial deployment:

1. Go to your Railway project
2. Open the service settings
3. Click on **"Variables"** tab
4. Make sure `DATABASE_URL` is set (automatically configured by Railway)
5. The app will automatically create tables on first run

Alternatively, you can run migrations manually:

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login to Railway:
   ```bash
   railway login
   ```

3. Link to your project:
   ```bash
   railway link
   ```

4. Run migrations:
   ```bash
   railway run npm run db:push
   ```

### Step 5: Deploy

Railway will automatically build and deploy your app after you push to GitHub.

**Build Command:** `npm run build`
**Start Command:** `npm run start`

## Post-Deployment Setup

### 1. Set up your domain (Optional)

1. Go to your Railway service settings
2. Click on **"Settings"** → **"Domains"**
3. Generate a Railway domain or add your custom domain
4. Update the `APP_URL` environment variable with your domain

### 2. Test Email Functionality

1. Sign up for a new account on your deployed app
2. Check if you receive the verification email
3. If emails aren't working, verify your `RESEND_API_KEY` is correct

### 3. Verify Database Connection

The app should automatically connect to the PostgreSQL database. Check the logs:

```bash
railway logs
```

Look for successful database connection messages.

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string (auto-set by Railway) | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | ✅ Yes | Secret key for session encryption | Random 32-char string |
| `RESEND_API_KEY` | ✅ Yes | Resend API key for emails | `re_xxxxx` |
| `NODE_ENV` | ✅ Yes | Environment mode | `production` |
| `PORT` | ✅ Yes | Server port | `5000` |
| `RESEND_FROM_EMAIL` | ⚠️ Recommended | Email sender address | `noreply@yourdomain.com` |
| `APP_URL` | ⚠️ Recommended | Your app's URL (for email links) | `https://app.railway.app` |
| `APIFY_API_TOKEN` | ❌ Optional | Apify token for social scraping | `apify_xxxxx` |

## Troubleshooting

### Build Fails

**Issue:** Build fails with TypeScript errors
**Solution:** Run `npm run check` locally to fix type errors before deploying

### Database Connection Errors

**Issue:** App can't connect to database
**Solution:**
1. Verify `DATABASE_URL` is set in Railway
2. Check Railway logs: `railway logs`
3. Ensure PostgreSQL service is running in Railway

### Emails Not Sending

**Issue:** Verification emails aren't being sent
**Solution:**
1. Verify `RESEND_API_KEY` is correct
2. Check Resend dashboard for delivery logs
3. Ensure `RESEND_FROM_EMAIL` uses a verified domain

### App Crashes on Startup

**Issue:** App restarts repeatedly
**Solution:**
1. Check Railway logs for errors
2. Verify all required environment variables are set
3. Make sure database migrations ran successfully

## Updating Your Deployment

To update your deployed app:

1. Push changes to your GitHub repository:
   ```bash
   git add .
   git commit -m "Your update message"
   git push
   ```

2. Railway will automatically detect the changes and redeploy

## Alternative: Manual Deployment with Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to existing project (if already created)
railway link

# Add PostgreSQL
railway add -d postgres

# Set environment variables
railway variables set SESSION_SECRET=your-secret
railway variables set RESEND_API_KEY=your-key
railway variables set NODE_ENV=production

# Deploy
railway up
```

## Monitoring

Monitor your app's health:

1. **Logs:** `railway logs` or view in Railway dashboard
2. **Metrics:** Check Railway dashboard for CPU, memory usage
3. **Database:** Monitor PostgreSQL metrics in Railway

## Scaling

Railway offers automatic scaling. To configure:

1. Go to your service settings
2. Navigate to **"Resources"**
3. Adjust vCPU and memory as needed

## Support

- Railway Docs: https://docs.railway.app/
- Resend Docs: https://resend.com/docs
- Apify Docs: https://docs.apify.com/

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Configure environment variables
3. ✅ Set up custom domain (optional)
4. ✅ Test email functionality
5. ✅ Configure Apify for social media scraping
6. ✅ Invite team members
7. ✅ Start tracking campaigns!
