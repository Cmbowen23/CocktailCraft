# Migration Examples: Base44 → OpenAI

This document shows specific examples of how to replace Base44 function calls with OpenAI service calls in your components.

---

## Example 1: Recipe Parsing (CreateRecipeFlow.jsx)

### BEFORE (Base44):
```javascript
// src/components/recipes/CreateRecipeFlow.jsx
import { base44 } from '@/api/base44Client';

const handleImageUpload = async (file) => {
  // Upload file
  const uploadResponse = await base44.files.upload(file);
  toast.success("Image uploaded! Processing...");

  // Parse the image using Base44 AI
  const parseResponse = await base44.functions.invoke('parseRecipeDocument', {
    image_url: uploadResponse.file_url
  });

  if (parseResponse.data) {
    setRecipeData(parseResponse.data);
  }
};
```

### AFTER (OpenAI):
```javascript
// src/components/recipes/CreateRecipeFlow.jsx
import { base44 } from '@/api/base44Client';
import { parseRecipeFromImage } from '@/api/openaiService';

const handleImageUpload = async (file) => {
  // Still use Base44 for file upload (keep what works!)
  const uploadResponse = await base44.files.upload(file);
  toast.success("Image uploaded! Processing...");

  // Parse the image using OpenAI
  const parseResponse = await parseRecipeFromImage(
    uploadResponse.file_url,
    menuId
  );

  if (parseResponse.data) {
    setRecipeData(parseResponse.data);
  }
};
```

**Changes:**
- ✅ Still use `base44.files.upload` for file storage
- ✅ Replace `base44.functions.invoke('parseRecipeDocument')` with `parseRecipeFromImage`
- ✅ Same data structure returned

---

## Example 2: Text Recipe Parsing (TextFileParser.jsx)

### BEFORE (Base44):
```javascript
// src/components/menus/TextFileParser.jsx
const handleParse = async () => {
  setIsProcessing(true);
  try {
    const response = await base44.functions.invoke('parseRecipeDocument', {
      text: textInput,
      menu_id: new URLSearchParams(window.location.search).get('menuId')
    });

    if (response.data) {
      setParsedRecipes(response.data.recipes || []);
    }
  } catch (error) {
    console.error('Parse error:', error);
  } finally {
    setIsProcessing(false);
  }
};
```

### AFTER (OpenAI):
```javascript
// src/components/menus/TextFileParser.jsx
import { parseRecipeFromText } from '@/api/openaiService';

const handleParse = async () => {
  setIsProcessing(true);
  try {
    const menuId = new URLSearchParams(window.location.search).get('menuId');
    const response = await parseRecipeFromText(textInput, menuId);

    if (response.data) {
      setParsedRecipes(response.data.recipes || [response.data]);
    }
  } catch (error) {
    console.error('Parse error:', error);
    toast.error('Failed to parse recipe. Please try again.');
  } finally {
    setIsProcessing(false);
  }
};
```

---

## Example 3: Invoice Processing (InvoiceScanner.jsx)

### BEFORE (Base44):
```javascript
// src/components/ingredients/InvoiceScanner.jsx
const handleUpload = async (file) => {
  // Step 1: Upload file
  const uploadResult = await base44.files.upload(file);
  toast.success("File uploaded, processing invoice...");

  // Step 2: Process the invoice with Base44 AI
  const response = await base44.functions.invoke('processInvoice', {
    file_url: uploadResult.file_url
  });

  if (response.data) {
    setProposals(response.data);
  }
};

const handleApplyChanges = async () => {
  setIsApplying(true);
  try {
    const response = await base44.functions.invoke('applyInvoiceChanges', {
      toUpdate: proposals.toUpdate,
      toCreate: proposals.toCreate
    });

    toast.success('Changes applied!');
  } finally {
    setIsApplying(false);
  }
};
```

### AFTER (OpenAI):
```javascript
// src/components/ingredients/InvoiceScanner.jsx
import { processInvoice } from '@/api/openaiService';
import { base44 } from '@/api/base44Client';

const handleUpload = async (file) => {
  // Step 1: Upload file (still use Base44)
  const uploadResult = await base44.files.upload(file);
  toast.success("File uploaded, processing invoice...");

  // Step 2: Process with OpenAI
  const response = await processInvoice(uploadResult.file_url);

  if (response.data) {
    setProposals(response.data);
  }
};

const handleApplyChanges = async () => {
  setIsApplying(true);
  try {
    // Apply changes using direct Base44 entity API (not AI)
    const { toUpdate, toCreate } = proposals;

    // Update existing ingredients
    for (const item of toUpdate) {
      await base44.entities.Ingredient.update(item.id, {
        current_price: item.new_price,
        updated_at: new Date().toISOString()
      });
    }

    // Create new ingredients
    for (const item of toCreate) {
      await base44.entities.Ingredient.create({
        name: item.name,
        current_price: item.price,
        supplier: item.supplier,
        // ... other fields
      });
    }

    toast.success(`Updated ${toUpdate.length}, created ${toCreate.length} ingredients`);
  } finally {
    setIsApplying(false);
  }
};
```

**Note:** `applyInvoiceChanges` is NOT an AI function - it's just database updates. Use direct entity API calls instead.

---

## Example 4: Bottle Image Search (BottleImagePickerModal.jsx)

### BEFORE (Base44):
```javascript
// src/components/ingredients/BottleImagePickerModal.jsx
const searchImages = async () => {
  setIsSearching(true);
  setCandidates([]);

  try {
    const response = await base44.functions.invoke('fetchBottleImageCandidates', {
      ingredientName: ingredient.name,
      supplier: ingredient.supplier,
      category: ingredient.category,
    });

    if (response.data && response.data.candidates) {
      setCandidates(response.data.candidates);
    }
  } catch (error) {
    console.error('Image search failed:', error);
  } finally {
    setIsSearching(false);
  }
};
```

### AFTER (OpenAI with Unsplash):
```javascript
// src/components/ingredients/BottleImagePickerModal.jsx
// Option A: Use Unsplash (recommended - cheaper and faster)
const searchImages = async () => {
  setIsSearching(true);
  setCandidates([]);

  try {
    const query = `${ingredient.name} ${ingredient.supplier} bottle`;
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12`,
      {
        headers: {
          'Authorization': `Client-ID ${import.meta.env.VITE_UNSPLASH_ACCESS_KEY}`
        }
      }
    );

    const data = await response.json();
    const candidates = data.results.map(img => ({
      url: img.urls.regular,
      thumbnail: img.urls.thumb,
      source: 'unsplash'
    }));

    setCandidates(candidates);
  } catch (error) {
    console.error('Image search failed:', error);
    toast.error('Failed to fetch images');
  } finally {
    setIsSearching(false);
  }
};
```

**OR use DALL-E for generation:**
```javascript
// Option B: Generate with DALL-E (more expensive but custom)
import { fetchBottleImageCandidates } from '@/api/openaiService';

const searchImages = async () => {
  setIsSearching(true);
  setCandidates([]);

  try {
    const response = await fetchBottleImageCandidates(
      ingredient.name,
      ingredient.supplier,
      ingredient.category
    );

    if (response.data && response.data.candidates) {
      setCandidates(response.data.candidates);
    }
  } catch (error) {
    console.error('Image generation failed:', error);
  } finally {
    setIsSearching(false);
  }
};
```

---

## Example 5: Bar Concept Parsing (OpeningOrderForm.jsx)

### BEFORE (Base44):
```javascript
// src/components/openingorder/OpeningOrderForm.jsx
const handleParseIntent = async () => {
  setIsParsing(true);
  try {
    const response = await base44.functions.invoke('parseBarConcept', {
      conceptDescription: conceptDescription.trim()
    });

    if (response.data) {
      setParsedConcept(response.data);
    }
  } catch (error) {
    console.error(error);
  } finally {
    setIsParsing(false);
  }
};

const handleGenerateSuggestions = async () => {
  setIsSuggestingAI(true);
  try {
    const response = await base44.functions.invoke('generateOpeningOrderSuggestions', {
      parsedIntent: parsedConcept,
      availableProducts: alcoholicIngredients.map(ing => ({
        name: ing.name,
        category: ing.category,
        id: ing.id
      }))
    });

    if (response.data && response.data.suggestions) {
      setSuggestedProducts(response.data.suggestions);
    }
  } finally {
    setIsSuggestingAI(false);
  }
};
```

### AFTER (OpenAI):
```javascript
// src/components/openingorder/OpeningOrderForm.jsx
import { parseBarConcept, generateOpeningOrderSuggestions } from '@/api/openaiService';

const handleParseIntent = async () => {
  setIsParsing(true);
  try {
    const response = await parseBarConcept(conceptDescription.trim());

    if (response.data) {
      setParsedConcept(response.data);
      toast.success('Bar concept analyzed!');
    }
  } catch (error) {
    console.error(error);
    toast.error('Failed to parse concept. Please try again.');
  } finally {
    setIsParsing(false);
  }
};

const handleGenerateSuggestions = async () => {
  setIsSuggestingAI(true);
  try {
    const availableProducts = alcoholicIngredients.map(ing => ({
      id: ing.id,
      name: ing.name,
      category: ing.category,
      bottle_size_ml: ing.bottle_size_ml
    }));

    const response = await generateOpeningOrderSuggestions(
      parsedConcept,
      availableProducts
    );

    if (response.data && response.data.suggestions) {
      setSuggestedProducts(response.data.suggestions);
      toast.success(`Generated ${response.data.suggestions.length} suggestions`);
    }
  } catch (error) {
    console.error(error);
    toast.error('Failed to generate suggestions');
  } finally {
    setIsSuggestingAI(false);
  }
};
```

---

## Example 6: Distributor Pricing (TestDistributorUpload.jsx)

### BEFORE (Base44):
```javascript
// src/pages/TestDistributorUpload.jsx
const handleParseFiles = async () => {
  try {
    // Upload files
    const uploadRes = await base44.files.upload(primaryFile);
    const caseUploadRes = caseFile ? await base44.files.upload(caseFile) : null;

    // Parse with Base44 AI
    const res = await base44.functions.invoke('parseDistributorPricing', {
      primary_file_url: uploadRes.file_url,
      secondary_file_url: caseUploadRes ? caseUploadRes.file_url : null
    });

    setParsedData(res.data.price_list);
  } catch (error) {
    console.error(error);
  }
};
```

### AFTER (OpenAI):
```javascript
// src/pages/TestDistributorUpload.jsx
import { parseDistributorPricing } from '@/api/openaiService';

const handleParseFiles = async () => {
  try {
    // Upload files (still use Base44 for storage)
    const uploadRes = await base44.files.upload(primaryFile);
    const caseUploadRes = caseFile ? await base44.files.upload(caseFile) : null;

    // Parse with OpenAI
    const res = await parseDistributorPricing(
      uploadRes.file_url,
      caseUploadRes ? caseUploadRes.file_url : null
    );

    if (res.data && res.data.price_list) {
      setParsedData(res.data.price_list);
      toast.success(`Parsed ${res.data.price_list.length} products`);
    }
  } catch (error) {
    console.error(error);
    toast.error('Failed to parse pricing data');
  }
};
```

---

## Summary of Changes

### What to KEEP using Base44 for:
- ✅ File uploads: `base44.files.upload()`
- ✅ Database operations: `base44.entities.X.list/create/update/delete()`
- ✅ Authentication: `base44.auth`
- ✅ Hosting and deployment

### What to REPLACE with OpenAI:
- ✅ Recipe parsing: `parseRecipeFromImage()`, `parseRecipeFromText()`
- ✅ Invoice processing: `processInvoice()`
- ✅ Distributor pricing: `parseDistributorPricing()`
- ✅ Bar concept analysis: `parseBarConcept()`
- ✅ Inventory suggestions: `generateOpeningOrderSuggestions()`
- ✅ Image search: Use Unsplash or `fetchBottleImageCandidates()`
- ✅ Ingredient enrichment: `backfillIngredientDetails()`

### What to do DIRECTLY (not AI):
- ✅ Data updates: Use `base44.entities.X.update()` instead of AI functions
- ✅ Search: Use database queries instead of AI search
- ✅ Merging/deleting: Use entity API calls

---

## Testing Checklist

After replacing each function:

- [ ] Test with sample data (recipes, invoices, etc.)
- [ ] Compare results with Base44 originals
- [ ] Check error handling
- [ ] Monitor OpenAI costs (check usage stats)
- [ ] Ensure performance is acceptable (< 5 seconds for most operations)
- [ ] Update any TypeScript types if needed

---

## Rollback Plan

If OpenAI doesn't work as expected:

1. Keep both implementations side-by-side temporarily
2. Add feature flag to switch between Base44 and OpenAI
3. Compare results before fully committing

```javascript
// Feature flag approach
const USE_OPENAI = import.meta.env.VITE_USE_OPENAI === 'true';

const parseRecipe = USE_OPENAI
  ? () => parseRecipeFromImage(url)
  : () => base44.functions.invoke('parseRecipeDocument', { image_url: url });
```
