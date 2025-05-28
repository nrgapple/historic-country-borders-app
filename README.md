# [Historic Borders](https://historicborders.app/)

Visualize country borders from different times in history (2000 BC-1994)

As seen on [r/dataisbeautiful](https://www.reddit.com/r/dataisbeautiful/comments/l52krh/an_app_i_made_for_visualizing_country_borders/).

## Screenshot

<img width="1023" alt="screen-shot-of-app" src="https://user-images.githubusercontent.com/10817537/175097196-e746778d-241a-4bee-b406-aac294849597.png">

## Features

### Information Sources

The app provides country information through two sources:

1. **Wikipedia** (default) - Fetches real-time information from Wikipedia
2. **AI-powered** - Uses Google Gemini AI to generate country information with historical context

You can switch between these sources using the toggle button in the top-right corner of the app.

### AI Information Setup (Optional)

To enable AI-powered country information, you can set up a free Google Gemini API key:

1. Visit [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key)
2. Create a free Google account if you don't have one
3. Generate your API key (no credit card required)
4. Create a `.env.local` file in the project root:
   ```
   NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
   ```

**Benefits of Gemini API:**
- **Generous Free Tier**: 60 requests per minute
- **No Credit Card Required**: Completely free to get started
- **High Quality**: Advanced AI model with excellent historical knowledge
- **Reliable**: No rate limit issues like other providers

## Development

### Getting Started

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build
```

### Testing

This project uses [Vitest](https://vitest.dev/) for testing with React Testing Library.

```bash
# Run tests in watch mode
yarn test

# Run tests once
yarn test:run

# Run tests with UI
yarn test:ui

# Run tests with coverage
yarn test:coverage
```

For more details about testing, see [test/README.md](test/README.md).

## Data

The data is pulled from [aourednik's](https://github.com/aourednik/historical-basemaps) historical basemaps repo.

## Keep in Mind

1. historical boundaries are even more disputed than contemporary ones, that
2. the actual concept of territory and national boundary becomes meaningful, in Europe, only since the [Peace of Westphalia](https://en.wikipedia.org/wiki/Peace_of_Westphalia) (1648), that
3. areas of civilizations actually overlap, especially in ancient history, and that
4. overlaying these ancient vector maps on contemporary physical maps can be misleading; rivers, lakes, shorelines _do_ change very much over millenia; think for instance about the evolution of the [Aral sea](https://en.wikipedia.org/wiki/Aral_Sea) since the 1980s.

Finally, note that overlapping areas are useally dealt with as topological errors in traditional GIS. Fuzzy borders are difficult to handle. Certainly a field to investigate...

## AI Features & Setup

### Getting a Google Gemini API Key

1. Go to [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key)
2. Sign in with your Google account
3. Click "Create API Key" 
4. Copy your API key and add it to your `.env.local` file

### Why We Switched to Gemini

We migrated from Hugging Face to Google Gemini API because:

- **No Rate Limit Issues**: Gemini offers 60 requests/minute vs HF's restrictive limits
- **No Credit Card Required**: Completely free to get started
- **Better Reliability**: No "exceeded credits" errors
- **High Quality**: Advanced AI with excellent historical knowledge
- **Easy Setup**: Simple API key generation process

### Troubleshooting AI Issues

1. **"AI information requires Gemini API key setup"**
   - Get your free API key from [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key)
   - Add it to your `.env.local` file as `NEXT_PUBLIC_GEMINI_API_KEY=your_key`
   - Restart your development server

2. **"Something went wrong with AI information"**
   - Check your internet connection
   - Verify your API key is correct
   - Use Wikipedia as fallback

3. **Rate limits (rare with Gemini)**
   - Gemini offers 60 requests/minute, which should be sufficient for most use cases
   - If you need higher limits, consider upgrading to a paid plan

### API Comparison

| Provider | Free Requests | Credit Card Required | Rate Limit Issues |
|----------|---------------|---------------------|-------------------|
| **Google Gemini** | 60/minute | ❌ No | ❌ Rare |
| Hugging Face | Variable | ❌ No | ✅ Common |
| OpenAI | Limited | ✅ Yes | ✅ Common |

**Recommendation**: Use Google Gemini for the best free AI experience.
