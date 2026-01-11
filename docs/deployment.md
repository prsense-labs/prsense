# 🚀 Deploy PRSense to Production RIGHT NOW

## Fastest Path (5 Minutes)

### Step 1: Get API Key
```bash
# Go to: https://platform.openai.com/api-keys
# Click "Create new secret key"
# Copy the key (starts with sk-...)
```

### Step 2: Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd PRSense
vercel

# Follow prompts, press Enter for defaults
```

### Step 3: Add Secrets
```bash
# Add OpenAI key
vercel env add OPENAI_API_KEY
# Paste your key: sk-...

# Add GitHub token (get from https://github.com/settings/tokens)
vercel env add GITHUB_TOKEN
# Paste token: ghp_...

# Add webhook secret (make up a random string)
vercel env add GITHUB_WEBHOOK_SECRET
# Paste: your-random-secret-123
```

### Step 4: Configure GitHub Webhook
```
1. Go to your repo → Settings → Webhooks → Add webhook

2. Payload URL: https://your-app.vercel.app/webhook
   (Vercel shows you the URL after deploy)

3. Content type: application/json

4. Secret: your-random-secret-123
   (same as GITHUB_WEBHOOK_SECRET above)

5. Events: "Let me select individual events"
   ✅ Pull requests

6. Click "Add webhook"
```

### Step 5: Test
```
1. Open a test PR in your repo
2. Check webhook deliveries (GitHub settings)
3. Should see 200 response
4. If duplicate detected, bot comments automatically!
```

## Done! ✅

Your PRSense instance is now:
- ✅ Detecting duplicates automatically
- ✅ Commenting on PRs
- ✅ Using real OpenAI embeddings
- ✅ Running serverlessly (scales automatically)
- ✅ Costing ~$0-1/month

---

## Alternative: Self-Hosted (Docker)

### If you prefer Docker instead of Vercel:

```bash
# 1. Configure environment
cp .env.example .env
nano .env  # Add your keys

# 2. Start services
docker-compose up -d

# 3. Configure GitHub webhook
# URL: http://your-server-ip:3000/webhook

# Done!
```

---

## Free Alternative (No OpenAI Cost)

### Use built-in ONNX embeddings:

PRSense now includes **built-in local embeddings** via ONNX Runtime (Feature 7). No Python setup required!

```bash
# 1. Configure for local mode
vercel env add EMBEDDING_PROVIDER
# Enter: onnx

# 2. Remove OpenAI key (if present)
vercel env rm OPENAI_API_KEY

# 3. Redeploy
vercel --prod
```

**That's it!** The app will now run 100% free using the `all-MiniLM-L6-v2` model embedded in the application.

---

## Costs Summary

### With OpenAI (Recommended)
- **100 PRs/month**: $0.01/month ≈ **FREE**
- **1,000 PRs/month**: $0.10/month ≈ **FREE**
- **10,000 PRs/month**: $1/month + $20 Vercel = **$21/month**

### With Local ONNX (Free)
- **Any scale**: **$0/month**
- **Hardware**: CPU-only is sufficient
- **Privacy**: No data leaves your server

---

## What Happens After Deploy?

### 1. PR Opened
```
Developer opens PR #123: "Fix login bug"
```

### 2. Webhook Triggered
```
GitHub → Webhook → Your Vercel Function
```

### 3. PRSense Checks
```
✓ Generate embeddings
✓ Search for similar PRs
✓ Calculate similarity scores
✓ Make decision (2ms total)
```

### 4. Bot Responds
```
IF duplicate (>90% confidence):
  → Comment: "🔍 Duplicate of #100"
  → Add label: "duplicate"
  
IF possible (>82% confidence):
  → Comment: "ℹ️ Similar to #100, please review"
  
IF unique (<82%):
  → No action (avoid noise)
```

### 5. Maintainer Sees Result
```
🎉 Saved 30 minutes of review time!
```

---

## Troubleshooting

### "Webhook delivery failed"
```bash
# Check Vercel logs
vercel logs

# Verify secrets are set
vercel env ls

# Test webhook locally
curl -X POST https://your-app.vercel.app/webhook \
  -H "Content-Type: application/json" \
  -d '{"action":"opened","pull_request":{"number":1}}'
```

### "OpenAI API error"
```bash
# Check you have credits
# Go to: https://platform.openai.com/account/billing

# Or switch to free local embeddings (see above)
```

### "Database error"
```bash
# For development, just use SQLite (auto-configured)
# For production, set up Postgres:

# Option 1: Supabase (free tier has pgvector)
# https://supabase.com

# Option 2: Neon (free tier)
# https://neon.tech

# Add DATABASE_URL to vercel:
vercel env add DATABASE_URL
# postgresql://user:pass@host:5432/db
```

---

## Next Steps After Deploy

### Week 1: Monitor
- Check webhook deliveries in GitHub
- Review bot comments
- Adjust thresholds if needed

### Week 2: Tune
```bash
# Too many false positives?
vercel env add DUPLICATE_THRESHOLD
# Enter: 0.95 (stricter)

# Missing duplicates?
vercel env add DUPLICATE_THRESHOLD
# Enter: 0.85 (more aggressive)
```

### Week 3: Expand
- Add to more repos
- Track time saved
- Measure ROI

---

## Support

**Need help?**
- 📖 Read: [production-setup.md](production-setup.md)
- 🐛 Issue: [GitHub Issues](https://github.com/prsense-labs/prsense/issues)
- 💬 Discuss: [GitHub Discussions](https://github.com/prsense-labs/prsense/discussions)

---

## You're Ready! 🎉

PRSense is now:
- ✅ Deployed to production
- ✅ Integrated with GitHub
- ✅ Detecting duplicates automatically
- ✅ Saving maintainer time

**Estimated setup time**: 5 minutes  
**Estimated time saved**: 5 hours/week  
**ROI**: 6000% 🚀

Deploy now: `vercel`
