# Base44 AI Functions → OpenAI Migration Plan

## Strategy
Stay on Base44 platform for hosting, database, and auth. Only replace AI-powered functions with OpenAI to reduce vendor lock-in and prepare for future scalability.

## Phase 1: Setup OpenAI Integration

### 1.1 Install Dependencies
```bash
npm install openai pdf-parse
```

### 1.2 Environment Variables
Add to your Base44 environment settings:
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o  # or gpt-4o-mini for cost savings
```

### 1.3 Create OpenAI Service Module
Create `src/api/openaiService.js` to centralize all OpenAI calls.

---

## Phase 2: Function-by-Function Migration

### Priority 1: Image & Vision Functions (HIGH USAGE)

#### ✅ `parseRecipeDocument` - Recipe Parsing from Text/Image
**Current**: Base44 vision AI
**Replace with**: OpenAI GPT-4o Vision API
**Usage**: CreateRecipeFlow.jsx, TextFileParser.jsx

**Implementation**:
```javascript
// OpenAI Vision API for image parsing
export async function parseRecipeFromImage(imageUrl) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Extract recipe details: name, ingredients (with amounts), steps, and category." },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }],
    response_format: { type: "json_object" }
  });
  return JSON.parse(response.choices[0].message.content);
}

// OpenAI Text parsing for text input
export async function parseRecipeFromText(text) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: `Extract recipe details from this text: ${text}. Return JSON with: name, ingredients (array with name, amount, unit), steps (array), category.`
    }],
    response_format: { type: "json_object" }
  });
  return JSON.parse(response.choices[0].message.content);
}
```

---

#### ✅ `fetchBottleImageCandidates` - Bottle Image Search
**Current**: Base44 image search
**Replace with**: OpenAI DALL-E 3 for generation OR external image API (Unsplash/Pexels)
**Usage**: BottleImagePickerModal.jsx

**Option A - Use External Image API** (Recommended - cheaper):
```javascript
export async function fetchBottleImages(ingredientName, supplier) {
  // Use Unsplash or Pexels API (free tier available)
  const query = `${ingredientName} ${supplier} bottle`;
  const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10`, {
    headers: { 'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}` }
  });
  const data = await response.json();
  return data.results.map(r => ({ url: r.urls.regular, thumb: r.urls.thumb }));
}
```

**Option B - Generate with DALL-E**:
```javascript
export async function generateBottleImage(ingredientName, supplier) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: `Professional product photo of ${ingredientName} by ${supplier}, bottle on white background, studio lighting`,
    size: "1024x1024",
    quality: "standard"
  });
  return response.data[0].url;
}
```

---

#### ✅ `processInvoice` - Invoice OCR & Parsing
**Current**: Base44 document AI
**Replace with**: OpenAI GPT-4o Vision
**Usage**: InvoiceScanner.jsx

```javascript
export async function processInvoiceImage(fileUrl) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: "Extract invoice data: supplier, date, line items (product name, quantity, unit price, total). Return JSON."
        },
        { type: "image_url", image_url: { url: fileUrl } }
      ]
    }],
    response_format: { type: "json_object" }
  });
  return JSON.parse(response.choices[0].message.content);
}
```

---

#### ✅ `parseDistributorPricing` - Distributor Price List Parsing
**Current**: Base44 document AI
**Replace with**: OpenAI GPT-4o Vision
**Usage**: TestDistributorUpload.jsx

```javascript
export async function parseDistributorPriceList(primaryFileUrl, secondaryFileUrl) {
  const messages = [{
    role: "user",
    content: [
      {
        type: "text",
        text: "Extract pricing data: product name, size, unit, case price, bottle price. Return JSON array."
      },
      { type: "image_url", image_url: { url: primaryFileUrl } }
    ]
  }];

  if (secondaryFileUrl) {
    messages[0].content.push({ type: "image_url", image_url: { url: secondaryFileUrl } });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    response_format: { type: "json_object" }
  });
  return JSON.parse(response.choices[0].message.content);
}
```

---

### Priority 2: Text Generation & NLP Functions (MEDIUM USAGE)

#### ✅ `parseBarConcept` - Bar Concept NLP
**Current**: Base44 NLP
**Replace with**: OpenAI GPT-4o
**Usage**: OpeningOrderForm.jsx

```javascript
export async function parseBarConcept(conceptDescription) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "system",
      content: "You are a bar consultant. Extract key details from bar concept descriptions."
    }, {
      role: "user",
      content: `Analyze this bar concept: "${conceptDescription}". Return JSON with: concept_type, target_audience, drink_style, key_ingredients, atmosphere.`
    }],
    response_format: { type: "json_object" }
  });
  return JSON.parse(response.choices[0].message.content);
}
```

---

#### ✅ `generateOpeningOrderSuggestions` - AI Inventory Suggestions
**Current**: Base44 AI
**Replace with**: OpenAI GPT-4o
**Usage**: OpeningOrderForm.jsx

```javascript
export async function generateInventorySuggestions(parsedConcept, availableProducts) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "system",
      content: "You are an expert bar inventory manager."
    }, {
      role: "user",
      content: `Based on this bar concept: ${JSON.stringify(parsedConcept)}, suggest which products to stock from: ${JSON.stringify(availableProducts)}. Return JSON array of recommended product IDs with quantities.`
    }],
    response_format: { type: "json_object" }
  });
  return JSON.parse(response.choices[0].message.content);
}
```

---

#### ✅ `backfillIngredientDetails` - Auto-populate Ingredient Info
**Current**: Base44 AI (possibly)
**Replace with**: OpenAI GPT-4o
**Usage**: Admin functions

```javascript
export async function enrichIngredientDetails(ingredientName) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",  // cheaper model for simple data
    messages: [{
      role: "user",
      content: `For the ingredient "${ingredientName}", provide: category, abv (if alcoholic), typical_supplier, description. Return JSON.`
    }],
    response_format: { type: "json_object" }
  });
  return JSON.parse(response.choices[0].message.content);
}
```

---

### Priority 3: PDF Generation (LOW - May not need AI)

#### ⚠️ `exportCustomerMenuPdf`, `exportPresentationPdf`
**Current**: Base44 PDF generator
**Assessment**: These likely don't use AI - just PDF rendering
**Recommendation**: Keep using Base44 for now, or migrate to React-PDF library

```javascript
// If you want to replace, use react-pdf/renderer
import { Document, Page, Text, View, PDFDownloadLink } from '@react-pdf/renderer';

const MenuPDF = ({ menu, recipes }) => (
  <Document>
    <Page>
      <View><Text>{menu.name}</Text></View>
      {recipes.map(recipe => (
        <View key={recipe.id}>
          <Text>{recipe.name}</Text>
        </View>
      ))}
    </Page>
  </Document>
);
```

---

## Phase 3: Implementation Steps

### Step 1: Create OpenAI Service (Week 1)
1. Create `src/api/openaiService.js` with all helper functions
2. Add error handling and retry logic
3. Add usage tracking/logging
4. Test each function in isolation

### Step 2: Replace High-Priority Functions (Week 1-2)
1. ✅ Replace `parseRecipeDocument` (highest usage)
2. ✅ Replace `processInvoice`
3. ✅ Replace `parseDistributorPricing`
4. Test thoroughly in Base44 development environment

### Step 3: Replace Medium-Priority Functions (Week 2)
1. ✅ Replace `parseBarConcept`
2. ✅ Replace `generateOpeningOrderSuggestions`
3. ✅ Replace `fetchBottleImageCandidates`

### Step 4: Update Function Calls (Week 2-3)
Update each component to use new OpenAI service instead of `base44.functions.invoke()`:

**Before:**
```javascript
const response = await base44.functions.invoke('parseRecipeDocument', {
  image_url: uploadResponse.file_url
});
```

**After:**
```javascript
import { parseRecipeFromImage } from '@/api/openaiService';

const parsedRecipe = await parseRecipeFromImage(uploadResponse.file_url);
```

### Step 5: Testing & Validation (Week 3)
- Test each replaced function
- Compare results with Base44 originals
- Monitor OpenAI costs vs Base44 costs
- Performance testing

---

## Cost Comparison

### Base44 Pricing
- Unknown (bundled with platform)
- Risk: Wix acquisition may change pricing

### OpenAI Pricing (as of 2024)
- **GPT-4o**: $5/1M input tokens, $15/1M output tokens
- **GPT-4o-mini**: $0.15/1M input tokens, $0.60/1M output tokens (80% cheaper)
- **DALL-E 3**: $0.040 per image (standard quality)

**Recommendation**: Use GPT-4o-mini for simple tasks (ingredient enrichment, text parsing), GPT-4o for complex tasks (invoice processing, recipe parsing).

---

## Keep Using Base44 For

✅ Database (entities API)
✅ Authentication
✅ File uploads/storage
✅ Hosting
✅ Non-AI backend functions

## Replace with OpenAI

✅ Recipe parsing (text & image)
✅ Invoice OCR
✅ Distributor pricing extraction
✅ Bar concept analysis
✅ Inventory suggestions
✅ Image search/generation
✅ Ingredient detail enrichment

---

## Success Criteria

- [ ] All AI functions working with OpenAI
- [ ] No degradation in accuracy
- [ ] Cost tracking implemented
- [ ] Error handling robust
- [ ] Performance acceptable (< 5s for most operations)
- [ ] Base44 app still fully functional
- [ ] Ready to migrate remaining functions if needed

---

## Next Steps

1. **Review this plan** - Adjust priorities based on your needs
2. **Set up OpenAI account** - Get API key
3. **Create openaiService.js** - Start with one function (parseRecipeDocument)
4. **Test in Base44 dev environment**
5. **Gradually replace functions** one at a time
6. **Monitor costs** - Track OpenAI usage vs Base44

**Want me to start implementing the OpenAI service module?**
