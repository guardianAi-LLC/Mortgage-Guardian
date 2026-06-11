# Quick Start - Deploy to Railway in 5 Minutes

This guide gets your Mortgage Guardian backend deployed to Railway as fast as possible.

## Prerequisites Checklist

- [ ] Railway account created at https://railway.app
- [ ] Anthropic API key from https://console.anthropic.com
- [ ] (Optional) Plaid credentials from https://dashboard.plaid.com
- [ ] Cloudmersive API key from https://account.cloudmersive.com (required — see below)

## Required Services

### Malware Scanning (Cloudmersive)

The upload route runs every uploaded buffer through Cloudmersive's hosted
HTTPS virus-scan API and fails closed on any infrastructure failure. There is
no silent dev bypass.

**Hard requirement:** `CLOUDMERSIVE_API_KEY` must be set in the backend
environment. If it is missing, the upload route returns
`502 { reason: 'scan_unavailable' }` for every request.

Local-dev options — pick one, there is no third:

1. Set `CLOUDMERSIVE_API_KEY` in `backend-express/.env` and accept that
   uploads consume from the free-tier quota (800 calls/month).
2. Leave it unset and accept that the upload route returns 502 in dev. Other
   routes are unaffected.

Optional env (sensible defaults applied if omitted):

- `CLOUDMERSIVE_BASE_URL` — default `https://api.cloudmersive.com`
- `CLOUDMERSIVE_TIMEOUT_MS` — default `15000`

Smoke test the integration after deploy or key rotation:

```bash
node scripts/cloudmersive-health-check.js
```

Operational detail (key rotation, quota monitoring, failure-mode triage)
lives in [docs/MALWARE_SCANNING.md](docs/MALWARE_SCANNING.md).

## Step-by-Step Deployment

### 1. Get Railway Token (1 minute)

```bash
# Visit https://railway.app/account/tokens
# Click "Create Token"
# Copy the token and run:
export RAILWAY_TOKEN='your-token-here'
```

### 2. Generate Secure Keys (30 seconds)

```bash
cd /Users/nickgarrison/Documents/GitHub/Mortgage-Guardian-2.0-Clean/backend-express
./setup-env.sh
```

Output:
- `.env.railway.local` - Environment configuration
- `export-env.sh` - Variables for deployment
- `set-railway-vars.sh` - Railway variable setter

### 3. Add Your API Keys (1 minute)

Edit `.env.railway.local`:

```bash
# Open in editor
nano .env.railway.local

# Update this line:
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-ACTUAL-KEY-HERE

# Optional: Add Plaid credentials
PLAID_CLIENT_ID=your-client-id
PLAID_SECRET=your-secret
```

Save and exit (Ctrl+X, Y, Enter for nano)

### 4. Deploy (2 minutes)

```bash
# Load environment variables
source export-env.sh

# Deploy to Railway
./deploy-railway.sh
```

The script will:
- Authenticate with Railway
- Create project with PostgreSQL & Redis
- Configure environment variables
- Deploy the application
- Run health checks
- Display your deployment URL

### 5. Test Deployment (30 seconds)

```bash
# Auto-detect URL and test
./test-deployment.sh

# Or specify URL manually
./test-deployment.sh https://your-app.up.railway.app
```

## Your Deployment is Live!

You'll get a URL like: `https://mortgage-guardian-backend-production.up.railway.app`

Test it:
```bash
curl https://your-url.up.railway.app/health
```

## Next Steps

### Update Frontend

Update your frontend API URL to point to Railway:

```javascript
// In your frontend config
const API_URL = 'https://your-railway-url.up.railway.app'
```

### Add Custom Domain (Optional)

```bash
# In Railway dashboard:
railway open
# Settings → Domains → Add Domain
# Add: api.mortgageguardian.org

# Then update DNS:
# Type: CNAME
# Name: api
# Value: your-app.up.railway.app
```

### Monitor Your Deployment

```bash
# View logs
railway logs

# Stream logs
railway logs --follow

# Check status
railway status

# Open dashboard
railway open
```

## Troubleshooting

### "RAILWAY_TOKEN not set"
```bash
export RAILWAY_TOKEN='your-token-from-railway'
```

### "Health check failed"
```bash
# Wait 60 seconds for startup, then test again
sleep 60
curl https://your-url.up.railway.app/health

# Check logs
railway logs
```

### "ANTHROPIC_API_KEY missing"
```bash
# Add it to Railway
railway variables set ANTHROPIC_API_KEY="sk-ant-api03-..."
```

### CORS errors from frontend
```bash
# Update allowed origins
railway variables set ALLOWED_ORIGINS="https://mortgageguardian.org,https://your-frontend-domain.com"
```

## Common Commands

```bash
# Deploy updates
git push
railway up

# View logs
railway logs

# Update environment variable
railway variables set KEY=value

# Rollback
railway rollback

# Get help
railway --help
```

## Cost

Railway Pricing:
- **Starter**: $5/month (500 execution hours)
- **Developer**: $20/month (2000 execution hours)
- **Pro**: $20/month + usage-based

Your current setup should fit in the Starter plan.

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- View logs: `railway logs`
- Check status: `railway status`

## Full Documentation

For detailed information, see:
- [RAILWAY-DEPLOYMENT.md](/Users/nickgarrison/Documents/GitHub/Mortgage-Guardian-2.0-Clean/backend-express/RAILWAY-DEPLOYMENT.md) - Complete deployment guide
- [README.md](/Users/nickgarrison/Documents/GitHub/Mortgage-Guardian-2.0-Clean/backend-express/README.md) - Backend API documentation

## Success!

Your Mortgage Guardian backend is now live on Railway with:
- ✓ PostgreSQL database
- ✓ Redis cache
- ✓ Auto-scaling
- ✓ HTTPS enabled
- ✓ Automatic deployments
- ✓ Health monitoring

Update your frontend and start testing!
