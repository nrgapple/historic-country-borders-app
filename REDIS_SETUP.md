# Redis Setup for AI Response Caching

This app uses **Vercel KV** (Redis) to cache AI responses, improving performance and reducing API calls to Google Gemini.

## Benefits of Redis Caching

- ⚡ **Faster responses** - Cached results return instantly
- 💰 **Cost savings** - Reduces API calls to Gemini (60/minute rate limit)
- 🏃 **Better UX** - Users get immediate responses for previously requested countries/years
- 🔧 **Automatic expiration** - Cache TTL of 1 hour keeps content fresh

## Vercel KV Setup

### Option 1: Automatic Setup (Recommended)

If deploying to Vercel, KV can be set up automatically:

1. **Deploy to Vercel** (if not already deployed)
   ```bash
   npx vercel --prod
   ```

2. **Add KV Database** via Vercel Dashboard:
   - Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to **Storage** tab
   - Click **Create Database**
   - Select **KV (Redis)**
   - Choose a name (e.g., `historic-borders-cache`)
   - Click **Create**

3. **Environment Variables** are automatically added:
   - `KV_URL`
   - `KV_REST_API_URL` 
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

### Option 2: Manual Setup

1. **Create KV Database**:
   ```bash
   npx vercel env add KV_URL
   npx vercel env add KV_REST_API_URL
   npx vercel env add KV_REST_API_TOKEN
   npx vercel env add KV_REST_API_READ_ONLY_TOKEN
   ```

2. **Pull Environment Variables**:
   ```bash
   npx vercel env pull .env.local
   ```

### Option 3: Local Development

For local development, you can either:

**A) Use Vercel KV remotely** (recommended):
```bash
# Pull production environment variables
npx vercel env pull .env.local
```

**B) Use Redis locally** (advanced):
```bash
# Install and run Redis locally
brew install redis  # macOS
redis-server

# Add to .env.local:
KV_URL=redis://localhost:6379
```

## Environment Variables

After setup, your `.env.local` should include:

```bash
# Existing variables
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_GA_FOUR=your_google_analytics_id

# Vercel KV (Redis) - Added automatically by Vercel
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

## Cache Behavior

### Cache Keys
```
ai:{country_name}:{year}
```
Examples:
- `ai:france:1789`
- `ai:holy_roman_empire:1500`
- `ai:united_states:1776`

### Cache TTL
- **Duration**: 1 hour (3600 seconds)
- **Automatic expiration**: Yes
- **Manual invalidation**: Not needed (content is historical)

### Cache Strategy
1. **Check cache first** - Look for existing response
2. **Cache miss** - Make API call to Gemini
3. **Store result** - Cache successful responses for 1 hour
4. **Error handling** - App continues working if Redis is unavailable

## Monitoring Cache Performance

The app tracks comprehensive Redis cache analytics:

### Cache Hit/Miss Events
- `cache_hit` - Response served from cache (faster)
- `cache_miss` - No cached response, API call made
- `cache_error` - Redis unavailable (fallback to API)

### Cache Write Events  
- `cache_write_success` - Response successfully cached
- `cache_write_error` - Failed to cache (logs warning)

### Performance Benefits
In Google Analytics, monitor:
- **Cache hit ratio** - Higher is better (saves API calls)
- **Response times** - Cache hits should be <100ms
- **API usage** - Should decrease as cache warms up

## Troubleshooting

### Common Issues

**"Redis cache error (continuing without cache)"**
- Normal fallback behavior
- App continues working without caching
- Check Vercel KV dashboard for database status

**Slow first requests, fast subsequent ones**
- Expected behavior - first request populates cache
- Subsequent requests for same country/year are cached

**Cache not working in development**
- Ensure `.env.local` has KV environment variables
- Run `npx vercel env pull .env.local` to sync

### Vercel KV Limits

**Hobby Plan (Free)**:
- 30,000 requests/month
- 256 MB storage
- Perfect for most use cases

**Pro Plan**:
- Higher limits available
- See [Vercel KV Pricing](https://vercel.com/docs/storage/vercel-kv/limits-and-pricing)

### Manual Cache Management

**Clear cache** (if needed):
```bash
# Using Vercel CLI
npx vercel kv clear

# Or via Redis CLI (if using local Redis)
redis-cli FLUSHALL
```

**View cache contents**:
```bash
# List all keys
npx vercel kv keys "ai:*"

# Get specific value  
npx vercel kv get "ai:france:1789"
```

## Architecture

```
User Request
     ↓
Check Redis Cache
     ↓
Cache Hit? → Return Cached Response (fast)
     ↓
Cache Miss → Call Gemini API
     ↓
Store in Redis → Return Response
```

This caching layer significantly improves the user experience while reducing costs and API rate limit concerns. 