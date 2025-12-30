# OpenAI Integration - Quick Reference

One-page reference for replacing Base44 AI functions with OpenAI.

---

## Installation

```bash
npm install openai
```

---

## Environment Variables

```bash
# Required
VITE_OPENAI_API_KEY=sk-proj-...

# Optional (for image search)
VITE_UNSPLASH_ACCESS_KEY=...
```

---

## Import Statement

```javascript
import {
  parseRecipeFromImage,
  parseRecipeFromText,
  processInvoice,
  parseDistributorPricing,
  parseBarConcept,
  generateOpeningOrderSuggestions,
  fetchBottleImageCandidates,
  backfillIngredientDetails
} from '@/api/openaiService';
```

---

## Function Replacements

| Base44 Function | OpenAI Replacement | Usage |
|----------------|-------------------|-------|
| `base44.functions.invoke('parseRecipeDocument', { image_url })` | `parseRecipeFromImage(imageUrl, menuId)` | Recipe from image |
| `base44.functions.invoke('parseRecipeDocument', { text })` | `parseRecipeFromText(text, menuId)` | Recipe from text |
| `base44.functions.invoke('processInvoice', { file_url })` | `processInvoice(fileUrl)` | Invoice OCR |
| `base44.functions.invoke('parseDistributorPricing', { ... })` | `parseDistributorPricing(primaryUrl, secondaryUrl)` | Pricing extraction |
| `base44.functions.invoke('parseBarConcept', { conceptDescription })` | `parseBarConcept(description)` | Bar concept NLP |
| `base44.functions.invoke('generateOpeningOrderSuggestions', { ... })` | `generateOpeningOrderSuggestions(parsedIntent, products)` | AI suggestions |
| `base44.functions.invoke('fetchBottleImageCandidates', { ... })` | `fetchBottleImageCandidates(name, supplier, category)` | Image search/gen |
| `base44.functions.invoke('backfillIngredientDetails', { ... })` | `backfillIngredientDetails(ingredientName)` | Enrich data |

---

## Keep Using Base44 For

```javascript
// ✅ File uploads
await base44.files.upload(file);

// ✅ Database operations
await base44.entities.Recipe.list();
await base44.entities.Ingredient.create({ ... });
await base44.entities.Recipe.update(id, { ... });

// ✅ Authentication
base44.auth.signIn();
base44.auth.signOut();
base44.auth.getUser();
```

---

## Example: Before & After

### BEFORE
```javascript
const response = await base44.functions.invoke('parseRecipeDocument', {
  image_url: uploadResponse.file_url
});
setParsedRecipe(response.data);
```

### AFTER
```javascript
import { parseRecipeFromImage } from '@/api/openaiService';

const response = await parseRecipeFromImage(uploadResponse.file_url);
setParsedRecipe(response.data);
```

---

## Model Selection

```javascript
// Fast & cheap (80% cheaper)
CONFIG.FAST_MODEL = 'gpt-4o-mini'  // Use for: ingredient enrichment, simple parsing

// Powerful (use for complex tasks)
CONFIG.DEFAULT_MODEL = 'gpt-4o'    // Use for: recipe parsing, invoice OCR, NLP
```

---

## Cost Estimates

| Task | Model | Tokens | Cost/Call | Monthly (100 calls) |
|------|-------|--------|-----------|-------------------|
| Recipe parsing | GPT-4o | ~800 | $0.01 | $1.00 |
| Invoice OCR | GPT-4o | ~1500 | $0.02 | $2.00 |
| Ingredient enrich | GPT-4o-mini | ~300 | $0.0003 | $0.03 |
| Image generation | DALL-E 3 | N/A | $0.04 | $4.00 |

**Total estimated monthly cost (typical usage): $10-30/month**

---

## Error Handling

All functions include automatic retry logic (3 attempts with exponential backoff).

```javascript
try {
  const response = await parseRecipeFromImage(imageUrl);
  // Success
} catch (error) {
  console.error('OpenAI error:', error);
  toast.error('Failed to parse recipe. Please try again.');
}
```

---

## Usage Tracking

```javascript
import { getUsageStats, resetUsageStats } from '@/api/openaiService';

const stats = getUsageStats();
console.log(stats);
// { totalCalls: 42, totalTokens: 15234, estimatedCost: 0.75 }

resetUsageStats(); // Reset monthly
```

---

## Migration Checklist

- [ ] Install `openai` package
- [ ] Add `VITE_OPENAI_API_KEY` to environment
- [ ] Copy `openaiService.js` to project
- [ ] Test connection with sample recipe
- [ ] Replace recipe parsing functions
- [ ] Replace invoice processing
- [ ] Replace pricing extraction
- [ ] Replace bar concept NLP
- [ ] Replace image search (or use Unsplash)
- [ ] Monitor costs in OpenAI dashboard
- [ ] Add usage tracking to admin panel

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Check environment variable, redeploy app |
| "Rate limit exceeded" | Wait 60s or upgrade OpenAI tier |
| Results not accurate | Improve prompts, use GPT-4o instead of mini |
| Too slow | Use GPT-4o-mini for simple tasks |
| API key exposed | Move to backend proxy (see SETUP_OPENAI.md) |

---

## Testing Commands

```javascript
// Browser console
import { parseRecipeFromText } from '@/api/openaiService';

const test = await parseRecipeFromText('Margarita: 2oz tequila, 1oz lime, 1oz Cointreau');
console.log(test.data);
```

---

## Resources

- **OpenAI Docs**: https://platform.openai.com/docs
- **API Keys**: https://platform.openai.com/api-keys
- **Usage Dashboard**: https://platform.openai.com/usage
- **Pricing**: https://openai.com/api/pricing/

---

## Support

- Full migration plan: `MIGRATION_PLAN_BASE44_TO_OPENAI.md`
- Detailed examples: `MIGRATION_EXAMPLES.md`
- Setup guide: `SETUP_OPENAI.md`

**Start here**: `SETUP_OPENAI.md` → Test connection → Replace one function → Deploy → Repeat
