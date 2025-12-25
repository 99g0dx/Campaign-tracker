# Domain Migration: dttracker.app

## Migration Date
December 25, 2025

## Changes Made

### 1. Environment Variables Updated

#### Local (.env file)
```bash
RESEND_FROM_EMAIL=support@dttracker.app
APP_URL=https://dttracker.app
RESEND_API_KEY=re_RMR4riHP_Kk5mTPfZmhncjzUPnhgwMzia
```

#### Railway Production
```bash
RESEND_FROM_EMAIL=support@dttracker.app
APP_URL=https://dttracker.app
RESEND_API_KEY=re_RMR4riHP_Kk5mTPfZmhncjzUPnhgwMzia
```

### 2. Email Configuration

All emails are now sent from: **support@dttracker.app**

Email functions affected:
- `sendVerificationEmail()` - Signup verification codes
- `sendPasswordResetEmail()` - Password reset links
- `sendWorkspaceInviteEmail()` - Workspace invitations

All email functions use the `RESEND_FROM_EMAIL` environment variable, ensuring consistency.

### 3. Application URLs

All email links now point to: **https://dttracker.app**

Affected links:
- Password reset: `https://dttracker.app/reset-password?token=...`
- Workspace invites: `https://dttracker.app/invite?token=...`

### 4. Code Verification

✅ No hardcoded email addresses found in codebase
✅ No references to old domain (dobbletap.com)
✅ All email sending goes through server/email.ts
✅ All functions use environment variables correctly

Email sending functions locations:
- `server/email.ts` - All email templates
- `server/authRoutes.ts` - Calls sendVerificationEmail (2 places)
- `server/profileRoutes.ts` - Calls sendVerificationEmail (2 places)
- `server/routes.ts` - Calls sendPasswordResetEmail and sendWorkspaceInviteEmail

## Resend Domain Setup Required

### DNS Records for dttracker.app

To ensure email delivery, add these records at your domain registrar:

#### 1. SPF Record
```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
```

#### 2. DKIM Record
```
Type: TXT
Name: resend._domainkey
Value: [Get this from Resend dashboard]
```

#### 3. DMARC Record
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@dttracker.app
```

### Verification Steps

1. **In Resend Dashboard:**
   - Go to Domains section
   - Verify dttracker.app is added
   - Check that all DNS records show as "Verified"
   - Test by sending a test email

2. **In Application:**
   - Try signing up with a new email
   - Verify you receive the verification code email
   - Check email comes from: noreply@dttracker.app
   - Try password reset flow
   - Try workspace invitation flow

## Railway Domain Setup

### Add Custom Domain

1. Go to Railway dashboard: https://railway.app
2. Navigate to Campaign-tracker service
3. Go to Settings → Domains
4. Click "+ Custom Domain"
5. Enter: `dttracker.app`

### Configure DNS at Registrar

Railway will provide one of these:

**Option A - CNAME:**
```
Type: CNAME
Name: @ (or dttracker.app)
Value: [Railway's CNAME value]
```

**Option B - A Record:**
```
Type: A
Name: @
Value: [Railway's IP address]
```

### SSL Certificate

Railway automatically provisions SSL certificates via Let's Encrypt once DNS is configured.

Wait 5-60 minutes for:
- DNS propagation
- SSL certificate generation
- Service to become accessible at https://dttracker.app

## Testing Checklist

### Email Delivery
- [ ] Signup verification email received
- [ ] Email from address shows: support@dttracker.app
- [ ] Password reset email received
- [ ] Workspace invitation email received
- [ ] All email links point to dttracker.app

### Domain Access
- [ ] https://dttracker.app loads correctly
- [ ] SSL certificate valid (green lock icon)
- [ ] Login works on new domain
- [ ] All features functional

### Environment Variables
- [ ] Railway variables confirmed via `railway variables`
- [ ] Service restarted after variable changes
- [ ] Logs show correct domain in email sending

## Troubleshooting

### Emails Not Sending

1. **Check Resend Dashboard**
   - View Logs → Recent sends
   - Look for failed deliveries
   - Check rejection reasons

2. **Verify DNS Records**
   - Use [MXToolbox](https://mxtoolbox.com/SuperTool.aspx)
   - Check SPF: `mxtoolbox.com/spf.aspx`
   - Check DKIM: Verify in Resend dashboard
   - Wait up to 24 hours for DNS propagation

3. **Check Railway Logs**
   ```bash
   railway logs
   ```
   Look for:
   - `[EMAIL] Verification code sent to...`
   - `[EMAIL] Password reset email sent to...`
   - `[EMAIL] Workspace invite sent to...`
   - Any Resend API errors

4. **Verify Environment Variables**
   ```bash
   railway variables | grep RESEND
   ```
   Should show:
   - `RESEND_API_KEY`: re_RMR4riHP_Kk5mTPfZmhncjzUPnhgwMzia
   - `RESEND_FROM_EMAIL`: support@dttracker.app

### Domain Not Loading

1. **Check DNS Propagation**
   - Use [WhatsMyDNS](https://whatsmydns.net)
   - Search for: dttracker.app
   - Verify it resolves correctly globally

2. **Check Railway Domain Settings**
   - Ensure custom domain is added
   - Verify DNS records match Railway's requirements
   - Check deployment status

3. **Clear Browser Cache**
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+F5 (Windows)
   - Try incognito/private mode
   - Test from different device

## Deployment Status

✅ Environment variables updated in Railway
✅ Service redeployed with new configuration
✅ Code verified - no hardcoded domains
✅ Email functions using environment variables

⏳ Pending:
- DNS configuration at domain registrar
- Resend domain verification
- SSL certificate provisioning
- End-to-end testing

## Support Resources

- **Resend Docs**: https://resend.com/docs
- **Railway Docs**: https://docs.railway.app
- **DNS Check**: https://mxtoolbox.com
- **Email Test**: Send test email via Resend dashboard

## Notes

- Old domain (dttracker.com) can remain active during transition
- No code changes needed - all configuration is environment-based
- Both domains can work simultaneously if needed
- Consider setting up redirect from .com to .app after migration complete
