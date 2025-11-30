# Redis Setup for AI Response Caching

This app uses **Redis** to cache AI responses, improving performance and reducing API calls to Google Gemini.

## Benefits of Redis Caching

- ⚡ **Faster responses** - Cached results return instantly
- 💰 **Cost savings** - Reduces API calls to Gemini (60/minute rate limit)
- 🏃 **Better UX** - Users get immediate responses for previously requested countries/years
- 🔧 **Automatic expiration** - Cache TTL of 1 hour keeps content fresh

## Redis Setup

### Option 1: Vercel Redis (Recommended)

If deploying to Vercel, you can use Vercel's Redis service:

1. **Deploy to Vercel** (if not already deployed)
   ```bash
   npx vercel --prod
   ```

2. **Add Redis Database** via Vercel Dashboard:
   - Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to **Storage** tab
   - Click **Create Database**
   - Select **Redis**
   - Choose a name (e.g., `historic-borders-cache`)
   - Click **Create**

3. **Environment Variables** are automatically added:
   - `REDIS_URL` - This is what the app uses

### Option 2: External Redis Provider

You can use any Redis provider (Redis Cloud, AWS ElastiCache, etc.):

1. **Create Redis Database** with your preferred provider
2. **Get Connection URL** (usually in format: `redis://username:password@host:port`)
3. **Add Environment Variable**:
   ```bash
   REDIS_URL=redis://your-connection-string-here
   ```

### Option 3: Local Development

For local development, you can either:

**A) Use Remote Redis** (recommended):
```bash
# Add your Redis URL to .env.local
REDIS_URL=redis://your-remote-redis-url
```

**B) Use Redis locally** (advanced):
```bash
# Install and run Redis locally
brew install redis  # macOS
redis-server

# Add to .env.local:
REDIS_URL=redis://localhost:6379
```

## Environment Variables

After setup, your `.env.local` should include:

```bash
# Existing variables
NEXT_PUBLIC_GA_FOUR=your_google_analytics_id

# Redis for AI response caching
REDIS_URL=redis://your-redis-connection-string

# Gemini API key (server-side only)
GEMINI_API_KEY=your_gemini_api_key_here
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
- Check Vercel Redis dashboard for database status

**"Redis OOM error - cannot cache X MB value"**
- **Problem**: Redis has reached its `maxmemory` limit and cannot store new values
- **Impact**: Caching fails, but app continues working (falls back to API calls)
- **Solutions**:
  1. **Configure Eviction Policy** (Recommended): Set Redis to evict least recently used keys when memory is full
     - For Vercel Redis: This is typically configured automatically, but check your Redis provider settings
     - For self-hosted Redis: Run `CONFIG SET maxmemory-policy allkeys-lru` or add to `redis.conf`:
       ```
       maxmemory-policy allkeys-lru
       ```
  2. **Increase maxmemory**: Upgrade your Redis plan or increase memory limit
  3. **Reduce Cache Size**: 
     - Reduce cache TTL (currently 24 hours for PA districts, 24 hours for AI responses)
     - Consider not caching very large values (>20MB)
  4. **Clear Cache**: Manually clear old cache entries (see Manual Cache Management below)
- **Note**: The app handles OOM errors gracefully and continues working without caching

**Slow first requests, fast subsequent ones**
- Expected behavior - first request populates cache
- Subsequent requests for same country/year are cached

**Cache not working in development**
- Ensure `.env.local` has REDIS_URL environment variable
- Run `npx vercel env pull .env.local` to sync

### Vercel Redis Limits

**Hobby Plan (Free)**:
- 30,000 requests/month
- 256 MB storage
- Perfect for most use cases

**Pro Plan**:
- Higher limits available
- See [Vercel Redis Pricing](https://vercel.com/docs/storage/vercel-redis/limits-and-pricing)

### Manual Cache Management

**Clear cache** (if needed):
```bash
# Using Redis CLI (connect to your Redis instance)
redis-cli -u $REDIS_URL FLUSHALL

# Or connect directly and run commands
redis-cli -u $REDIS_URL
> FLUSHALL
```

**View cache contents**:
```bash
# List all AI cache keys
redis-cli -u $REDIS_URL KEYS "ai:*"

# Get specific value  
redis-cli -u $REDIS_URL GET "ai:france:1789"
```

**Check Redis memory usage**:
```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Check memory info
> INFO memory

# Check current eviction policy
> CONFIG GET maxmemory-policy

# Check maxmemory setting
> CONFIG GET maxmemory

# Get memory usage for specific key
> MEMORY USAGE "pa-school-districts:geojson"
```

**Configure eviction policy** (if you have access):
```bash
# Set to evict least recently used keys when memory is full
redis-cli -u $REDIS_URL CONFIG SET maxmemory-policy allkeys-lru

# Or use allkeys-lfu (least frequently used) - also good for caching
redis-cli -u $REDIS_URL CONFIG SET maxmemory-policy allkeys-lfu
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