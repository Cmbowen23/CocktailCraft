# Setup Guide: OpenAI Integration for Base44 App

This guide walks you through setting up OpenAI in your Base44 CocktailCraft app to replace Base44's AI functions.

---

## Prerequisites

- Base44 CocktailCraft app (the working one, NOT Bolt)
- OpenAI account
- npm/yarn access to your project

---

## Step 1: Install Dependencies

In your **Base44 CocktailCraft** project directory, run:

```bash
npm install openai
```

That's it! The `openai` package is the official OpenAI Node.js SDK.

---

## Step 2: Get OpenAI API Key

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to **API Keys** (https://platform.openai.com/api-keys)
4. Click **"Create new secret key"**
5. Name it "CocktailCraft" or similar
6. **IMPORTANT**: Copy the key immediately - you won't see it again!
7. Save it securely (password manager, env file)

### Pricing (as of 2024):
- **GPT-4o**: $5 per 1M input tokens, $15 per 1M output tokens
- **GPT-4o-mini**: $0.15 per 1M input tokens, $0.60 per 1M output tokens (80% cheaper!)
- **DALL-E 3**: $0.04 per image (1024x1024, standard quality)

**Estimate**: For typical usage (parsing 100 recipes/month, 50 invoices/month), expect ~$10-30/month.

---

## Step 3: Add Environment Variable

### In Base44 Dashboard:

1. Log into your Base44 dashboard
2. Go to your CocktailCraft project settings
3. Find **Environment Variables** section
4. Add a new variable:
   - **Name**: `VITE_OPENAI_API_KEY`
   - **Value**: `sk-...` (your API key from Step 2)
5. Save and redeploy

### For Local Development:

Create `.env.local` in your project root (if not exists):

```bash
# .env.local
VITE_OPENAI_API_KEY=sk-proj-...your-actual-key-here...
```

**IMPORTANT**: Make sure `.env.local` is in your `.gitignore` so you don't commit your API key!

```bash
# Add to .gitignore if not already there
echo ".env.local" >> .gitignore
```

---

## Step 4: Optional - Add Unsplash for Image Search (Recommended)

Instead of using expensive DALL-E image generation ($0.04/image), use Unsplash's free API:

1. Go to https://unsplash.com/developers
2. Register your application (free)
3. Get your **Access Key**
4. Add to environment variables:

```bash
# .env.local
VITE_UNSPLASH_ACCESS_KEY=your-unsplash-access-key
```

**Free tier**: 50 requests/hour (plenty for bottle image searches)

---

## Step 5: Copy OpenAI Service to Your Base44 Project

1. Copy `src/api/openaiService.js` from this repository to your Base44 project:

```bash
# From this Bolt/testing directory, copy to your Base44 project
cp src/api/openaiService.js /path/to/your/base44-cocktailcraft/src/api/
```

2. Verify the import statement works with your Base44 setup:

```javascript
// At the top of openaiService.js
import OpenAI from 'openai';
```

---

## Step 6: Test the Integration

Create a test file to verify OpenAI is working:

**Create:** `src/api/testOpenAI.js`

```javascript
import { parseRecipeFromText } from './openaiService';

// Test function
export async function testOpenAIConnection() {
  try {
    console.log('Testing OpenAI connection...');

    const response = await parseRecipeFromText(
      `Margarita: 2 oz tequila, 1 oz lime juice, 1 oz Cointreau. Shake with ice, strain into glass.`,
      null
    );

    console.log('✅ OpenAI working!', response.data);
    return true;
  } catch (error) {
    console.error('❌ OpenAI test failed:', error);
    return false;
  }
}
```

Then in your browser console (or in a component):

```javascript
import { testOpenAIConnection } from '@/api/testOpenAI';

// Run test
testOpenAIConnection();
```

Expected output:
```json
{
  "name": "Margarita",
  "ingredients": [
    { "name": "tequila", "amount": 2, "unit": "oz" },
    { "name": "lime juice", "amount": 1, "unit": "oz" },
    { "name": "Cointreau", "amount": 1, "unit": "oz" }
  ],
  "steps": ["Shake with ice", "Strain into glass"],
  "category": "cocktail"
}
```

---

## Step 7: Start Migrating Functions

Follow the migration examples in `MIGRATION_EXAMPLES.md`:

### Recommended Order:

1. **Week 1**: Recipe parsing (highest usage)
   - ✅ Replace `parseRecipeDocument` in CreateRecipeFlow.jsx
   - ✅ Replace `parseRecipeDocument` in TextFileParser.jsx
   - ✅ Test thoroughly

2. **Week 2**: Document processing
   - ✅ Replace `processInvoice` in InvoiceScanner.jsx
   - ✅ Replace `parseDistributorPricing` in TestDistributorUpload.jsx
   - ✅ Test with real invoices

3. **Week 3**: NLP functions
   - ✅ Replace `parseBarConcept` in OpeningOrderForm.jsx
   - ✅ Replace `generateOpeningOrderSuggestions`
   - ✅ Replace `fetchBottleImageCandidates` (or use Unsplash)

4. **Week 4**: Cleanup & optimization
   - ✅ Remove unused Base44 function calls
   - ✅ Monitor costs and performance
   - ✅ Optimize prompts if needed

---

## Step 8: Monitor Usage and Costs

### OpenAI Dashboard:

1. Go to https://platform.openai.com/usage
2. Monitor your usage and costs
3. Set up usage limits if desired (Settings → Billing → Usage limits)

### In Your App:

Use the built-in usage tracking:

```javascript
import { getUsageStats, resetUsageStats } from '@/api/openaiService';

// Check usage
const stats = getUsageStats();
console.log('OpenAI Usage:', stats);
// { totalCalls: 42, totalTokens: 15234, estimatedCost: 0.75 }

// Reset monthly (optional)
resetUsageStats();
```

**Recommended**: Add usage stats to your admin dashboard so you can track costs.

---

## Troubleshooting

### Error: "Invalid API key"
- ✅ Check your API key is correct in environment variables
- ✅ Redeploy Base44 app after adding environment variable
- ✅ Clear browser cache and reload

### Error: "Rate limit exceeded"
- ✅ You've hit OpenAI's rate limit
- ✅ Implement exponential backoff (already included in `withRetry`)
- ✅ Consider upgrading to paid tier for higher limits

### Error: "Model not found"
- ✅ Check you're using `gpt-4o` (not `gpt-4`)
- ✅ If `gpt-4o` isn't available, use `gpt-4-turbo` instead
- ✅ Update CONFIG.DEFAULT_MODEL in openaiService.js

### Results Not as Good as Base44
- ✅ Improve prompts (be more specific)
- ✅ Add examples in the prompt (few-shot learning)
- ✅ Use `gpt-4o` instead of `gpt-4o-mini` for complex tasks
- ✅ Consider adding validation and retry logic

### Too Slow
- ✅ Use `gpt-4o-mini` for simple tasks (4x faster)
- ✅ Reduce `max_tokens` in prompts
- ✅ Process multiple items in parallel where possible

---

## Security Best Practices

### ⚠️ IMPORTANT: Never Expose API Keys

The current implementation uses `dangerouslyAllowBrowser: true` which exposes your API key in the browser. This is **ONLY** for development/testing.

### For Production:

**Create a backend proxy** to hide your API key:

1. Create a Base44 function or serverless endpoint
2. Move OpenAI calls to the backend
3. Frontend calls your backend, which calls OpenAI

**Example:**

```javascript
// backend/functions/parseRecipe.js (Base44 function)
import OpenAI from 'openai';

export async function parseRecipe({ imageUrl }) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // Server-side env variable
  });

  const response = await openai.chat.completions.create({
    // ... your prompt
  });

  return response;
}

// frontend: call your backend instead of OpenAI directly
const result = await base44.functions.invoke('parseRecipe', { imageUrl });
```

---

## Cost Optimization Tips

1. **Use GPT-4o-mini for simple tasks** (80% cheaper)
   - Ingredient detail enrichment
   - Simple text parsing
   - Category classification

2. **Use GPT-4o only for complex tasks**
   - Recipe extraction from images
   - Invoice parsing
   - Multi-step reasoning

3. **Reduce token usage**
   - Keep prompts concise
   - Lower `max_tokens` limits
   - Use `response_format: { type: "json_object" }` to get structured data

4. **Batch where possible**
   - Process multiple recipes in one call
   - Parse multiple invoice line items together

5. **Cache results**
   - Don't re-parse the same recipe twice
   - Store parsed data in database

---

## Next Steps

1. ✅ Complete this setup guide
2. ✅ Test OpenAI connection
3. ✅ Migrate one function (start with `parseRecipeFromText`)
4. ✅ Test thoroughly in Base44 dev environment
5. ✅ Deploy to production
6. ✅ Monitor costs and usage
7. ✅ Gradually migrate remaining functions

---

## Questions?

- OpenAI Docs: https://platform.openai.com/docs
- OpenAI Community: https://community.openai.com/
- Base44 Docs: https://base44.com/docs (for any Base44-specific questions)

**Ready to start?** Head to `MIGRATION_EXAMPLES.md` to see exactly how to replace each function!
