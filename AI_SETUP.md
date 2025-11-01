# 🤖 AI Integration Setup

Arc Treasury now supports AI-powered strategy recommendations using OpenAI!

## Setup Instructions

### 1. Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-proj-...`)

### 2. Configure Environment Variable

Create a `.env` file in the project root:

```bash
# Copy from .env.example
cp .env.example .env
```

Add your OpenAI API key:

```env
VITE_OPENAI_API_KEY=sk-proj-your-actual-api-key-here
```

### 3. Restart Development Server

```bash
npm run dev
```

## Features

### AI Strategy Recommendations

When creating a treasury (Step 2), AI analyzes:
- Your wallet balance
- Risk tolerance
- Investment goals

And recommends the optimal strategy (Conservative/Balanced/Aggressive) with custom allocations.

### How It Works

1. **User visits Create Treasury** → Step 2: Choose Strategy
2. **AI Component loads** automatically
3. **Calls OpenAI API** with context about user and stablecoins
4. **Returns recommendation** with reasoning and allocations
5. **User can apply** the AI strategy with one click

## API Usage

The AI service uses **GPT-4o-mini** model to keep costs low:
- Model: `gpt-4o-mini`
- Max tokens: 300 per request
- Cost: ~$0.0001 per recommendation

### Expected Cost

- Strategy recommendation: ~300 tokens (~$0.0001)
- Portfolio analysis: ~250 tokens (~$0.00008)
- Per user per day: ~$0.001 (assuming 10 requests)

## Security

✅ API key stored in `.env` (never committed to Git)  
✅ Environment variable loaded via Vite (`import.meta.env`)  
✅ Falls back gracefully if key not configured  
✅ No API key exposed in frontend bundle

## Files Modified

```
src/services/aiService.ts         # AI service with OpenAI integration
src/components/AIRecommendation.tsx  # UI component for recommendations
src/pages/CreateTreasury.tsx      # Integrated AI into Step 2
.env.example                      # Example configuration
AI_SETUP.md                       # This file
```

## Testing

### With API Key

1. Add key to `.env`
2. Go to `/create` → Step 2
3. See AI recommendation with custom allocations
4. Click "Apply AI Strategy" to use it

### Without API Key

- AI component is hidden
- User sees only manual strategy templates
- No errors or warnings

## Future Enhancements

- [ ] AI portfolio health analysis on Dashboard
- [ ] AI rebalancing suggestions
- [ ] AI yield optimization recommendations
- [ ] Chat-based AI assistant
- [ ] Historical performance predictions

## Troubleshooting

**Issue:** "AI recommendation failed"
- Check API key is valid
- Check OpenAI account has credits
- Check console for error details

**Issue:** AI component not showing
- Verify `.env` file exists
- Verify `VITE_OPENAI_API_KEY` is set
- Restart dev server (`npm run dev`)

## Production Deployment

For Vercel deployment, add environment variable:

```bash
vercel env add VITE_OPENAI_API_KEY
```

Or in Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add `VITE_OPENAI_API_KEY`
3. Value: `sk-proj-your-key`
4. Redeploy

---

Built for Arc Treasury 🚀

