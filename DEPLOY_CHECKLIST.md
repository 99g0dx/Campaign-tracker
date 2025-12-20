# Railway Deployment Checklist

## ✅ Pre-Deployment (Completed)

- [x] Migrated database from SQLite to PostgreSQL
- [x] Removed Replit-specific code
- [x] Updated dependencies
- [x] Tested build successfully
- [x] Created Railway configuration
- [x] Committed changes to git

## 📋 Deployment Steps

### 1. Push to GitHub (If Not Already)

```bash
# If you don't have a GitHub repository yet:
# 1. Create a new repository on GitHub
# 2. Add remote and push:

git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Railway

**Option A: Via Railway Website** (Recommended)

1. Go to [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will automatically detect the configuration

**Option B: Via Railway CLI**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize and deploy
railway init
railway up
```

### 3. Add PostgreSQL Database

1. In Railway project dashboard, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway auto-creates `DATABASE_URL` variable

### 4. Set Environment Variables

In Railway project settings → Variables, add:

**Required:**
```
SESSION_SECRET=<run: openssl rand -base64 32>
RESEND_API_KEY=<get from resend.com>
NODE_ENV=production
PORT=5000
```

**Recommended:**
```
RESEND_FROM_EMAIL=Campaign Tracker <noreply@yourdomain.com>
APP_URL=https://<your-app>.railway.app
```

**Optional:**
```
APIFY_API_TOKEN=<get from apify.com>
```

### 5. Generate Required Keys

**SESSION_SECRET:**
```bash
openssl rand -base64 32
```

**RESEND_API_KEY:**
- Sign up at [resend.com](https://resend.com)
- Go to API Keys
- Create new key

**APIFY_API_TOKEN (Optional):**
- Sign up at [apify.com](https://apify.com)
- Settings → Integrations
- Copy API token

### 6. Deploy & Verify

1. Railway will auto-deploy after adding variables
2. Check deployment logs for errors
3. Once deployed, test your app:
   - [ ] App loads
   - [ ] Can create account
   - [ ] Receive verification email
   - [ ] Can login
   - [ ] Can create campaign
   - [ ] Can add social links

### 7. Set Up Domain (Optional)

1. Railway project → Settings → Domains
2. Generate Railway domain or add custom domain
3. Update `APP_URL` variable with new domain

## 🚨 Troubleshooting

### Build Fails
- Check Railway logs
- Verify all files committed to git
- Run `npm run build` locally to test

### Database Errors
- Verify PostgreSQL service is running
- Check `DATABASE_URL` is set
- View logs: `railway logs`

### Email Not Working
- Verify `RESEND_API_KEY` is correct
- Check Resend dashboard for delivery logs
- Ensure `RESEND_FROM_EMAIL` uses verified domain

### App Won't Start
- Check all required environment variables are set
- View Railway logs for specific errors
- Ensure PostgreSQL is connected

## 📚 Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- [MIGRATION_NOTES.md](./MIGRATION_NOTES.md) - Migration details
- [.env.example](./.env.example) - Environment variable template

## 🎉 Next Steps After Deployment

1. Test all features thoroughly
2. Set up custom domain
3. Configure email sender domain in Resend
4. Set up Apify for social media scraping
5. Invite team members
6. Start tracking campaigns!

## 🔗 Useful Links

- Railway Dashboard: https://railway.app/dashboard
- Railway Docs: https://docs.railway.app
- Resend Dashboard: https://resend.com/emails
- Apify Dashboard: https://console.apify.com

---

**Need help?** Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.
