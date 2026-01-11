# 🚀 Production Setup Guide

## Quick Start Options

### Option 1: Vercel (Easiest - 5 minutes)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Add secrets
vercel env add OPENAI_API_KEY
vercel env add GITHUB_TOKEN
vercel env add DATABASE_URL

# 4. Configure GitHub webhook
# URL: https://your-app.vercel.app/webhook
# Secret: your-webhook-secret
```

### Option 2: Docker (Self-hosted)

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env with your keys
nano .env

# 3. Start services
docker-compose up -d

# 4. Configure GitHub webhook
# URL: http://your-server:3000/webhook
```

### Option 3: Local Development

```bash
# 1. Install dependencies
npm install
npm install better-sqlite3 pg express

# 2. Set environment variables
cp .env.example .env
# Edit .env with your keys

# 3. Build
npm run build

# 4. Start server
npm run server
```

---

## Step-by-Step Production Setup

### 1. Get API Keys

#### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy to `.env` as `OPENAI_API_KEY`

**Cost**: ~$0.0001 per PR (very cheap!)

#### GitHub Token
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token with scopes:
   - `repo` (for private repos)
   - `public_repo` (for public repos)
   - `write:discussion` (for comments)
3. Copy to `.env` as `GITHUB_TOKEN`

### 2. Setup Database

#### Option A: PostgreSQL + pgvector (Recommended for production)

```bash
# Using Docker
docker run -d \
  --name prsense-db \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=prsense \
  -p 5432:5432 \
  ankane/pgvector

# Or use managed PostgreSQL:
# - Supabase (has pgvector built-in, free tier)
# - Neon (pgvector support, free tier)
# - AWS RDS (requires pgvector setup)
```

Then enable extension:
```sql
CREATE EXTENSION vector;
```

#### Option B: SQLite (For small deployments)

No setup needed! Just set:
```bash
# In .env - leave DATABASE_URL empty
# PRSense will use SQLite automatically
```

### 3. Configure GitHub Webhook

1. Go to your repo → Settings → Webhooks → Add webhook

2. Configure:
   ```
   Payload URL: https://your-app.vercel.app/webhook
   Content type: application/json
   Secret: (generate random string, add to .env)
   Events: Pull requests
   ```

3. Test webhook:
   - Open a test PR
   - Check webhook deliveries in GitHub settings
   - Should see 200 response

### 4. Deploy

#### Vercel (Serverless)

```bash
# Deploy
vercel --prod

# Add environment variables
vercel env add OPENAI_API_KEY
vercel env add GITHUB_TOKEN
vercel env add GITHUB_WEBHOOK_SECRET
vercel env add DATABASE_URL
vercel env add EMBEDDING_PROVIDER # Optional: 'onnx'
```

#### Docker

```bash
# Build and run
docker-compose up -d

# Check logs
docker-compose logs -f prsense

# Check health
curl http://localhost:3000/health
```

#### Manual Server

```bash
# Build
npm run build

# Start
npm run server

# Or with PM2 (recommended)
npm i -g pm2
pm2 start dist/src/server.js --name prsense
pm2 save
```

---

## Cost Estimate

### Small Repo (100 PRs/month)
- OpenAI: $0.01/month
- Vercel: Free tier
- **Total: ~Free**

### Medium Repo (1000 PRs/month)
- OpenAI: $0.10/month
- Vercel: Free tier
- Supabase DB: Free tier
- **Total: ~Free**

### Large Repo (10,000 PRs/month)
- OpenAI: $1/month
- Vercel: $20/month (Pro plan)
- Supabase: Free or $25/month
- **Total: $21-46/month**

**Alternative (free)**: Use local embeddings instead of OpenAI

---

## Alternative: Local Embeddings (Free!)

### Use Built-in ONNX Support

PRSense now supports running embeddings locally within the Node.js process using ONNX Runtime.

1. Install dependency:
   ```bash
   npm install onnxruntime-node
   ```

2. updates environment variables:
   ```bash
   EMBEDDING_PROVIDER=onnx
   # OPENAI_API_KEY is not needed!
   
   # Note: Default ONNX model (all-MiniLM-L6-v2) has 384 dimensions.
   # If using Postgres, ensure your vector column matches:
   # vector(384) instead of vector(1536)
   ```

**Cost**: $0/month. No separate Python server required.

---

## Monitoring

### Check Health

```bash
# Vercel
curl https://your-app.vercel.app/health

# Docker
curl http://localhost:3000/health
```

### View Logs

```bash
# Vercel
vercel logs

# Docker
docker-compose logs -f prsense

# PM2
pm2 logs prsense
```

### Metrics to Track

- PRs processed per day
- Duplicates detected
- False positive rate (from user feedback)
- API latency
- OpenAI costs

---

## Security Checklist

✅ Verify GitHub webhook signatures  
✅ Use environment variables (never commit keys)  
✅ Enable HTTPS (automatic with Vercel)  
✅ Rotate API keys regularly  
✅ Limit GitHub token scopes  
✅ Use read-only DB credentials where possible  

---

## Troubleshooting

### "OpenAI API error"
- Check API key is valid
- Check you have credits
- Check rate limits

### "Database connection failed"
- Verify DATABASE_URL format
- Check pgvector extension is installed
- Test connection: `psql $DATABASE_URL`

### "Webhook not triggering"
- Check webhook deliveries in GitHub
- Verify webhook secret matches
- Check server logs

### "High latency"
- Use connection pooling
- Cache embeddings
- Reduce EMBEDDING_DIMENSIONS (512 → 256)
- Use local embeddings (ONNX) instead of API

---

## Next Steps

1. ✅ Deploy to production
2. ✅ Monitor for 1 week
3. ✅ Adjust thresholds based on feedback
4. ✅ Add custom rules per repository
5. ✅ Integrate with CI/CD

Need help? Open an issue: https://github.com/prsense-labs/prsense/issues
