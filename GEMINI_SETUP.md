# Google Gemini API Setup Guide

## Quick Setup (2 minutes)

### 1. Get Your Free API Key

1. Visit [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key)
2. Sign in with your Google account (or create one if needed)
3. Click **"Create API Key"**
4. Copy the generated API key

### 2. Add to Your Project

Create a `.env.local` file in your project root:

```bash
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
```

### 3. Restart Your Server

```bash
yarn dev
```

## Benefits

✅ **60 requests per minute** - generous free tier  
✅ **No credit card required** - completely free  
✅ **High quality AI** - advanced language model  
✅ **Reliable** - no rate limit issues like other providers  
✅ **Historical knowledge** - excellent for country information  

## Troubleshooting

**"AI information requires Gemini API key setup"**
- Make sure your API key is in `.env.local`
- Restart your development server
- Check that the key starts with your expected format

**API errors**
- Verify your internet connection
- Check that your API key is valid
- Use Wikipedia as a fallback option

## Why Gemini?

We switched from Hugging Face to Google Gemini because:
- No "exceeded credits" errors
- Much higher rate limits (60/min vs variable)
- Better reliability and uptime
- No credit card required for free tier
- Superior AI quality for historical information

---

**Need help?** Check the main [README.md](./README.md) for more details. 