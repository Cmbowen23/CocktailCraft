# Database Cleanup Scripts

This directory contains utility scripts for maintaining and fixing data issues in the database.

## fix-recipe-json.js

Fixes malformed JSON in recipe fields by attempting to parse and correct common JSON errors.

### What it does:
- Scans all recipes in the database
- Identifies JSON fields with parsing errors (ingredients, tags, garnish, allergens, prep_actions, batch_settings)
- Attempts to fix common issues:
  - Unquoted property names (e.g., `{name: "test"}` → `{"name": "test"}`)
  - Unquoted string values (e.g., `"type": Nutmeg` → `"type": "Nutmeg"`)
  - Trailing commas (e.g., `[1, 2,]` → `[1, 2]`)
- Updates recipes with corrected JSON
- Sets empty arrays for fields that cannot be fixed

### Usage:

```bash
# Load environment variables
source .env

# Run the script
node scripts/fix-recipe-json.js
```

### Output:
The script will log:
- Each recipe being processed
- Success/failure for each field fix attempt
- Summary of total recipes, fixes, and errors

### Safety:
- The script only updates fields with malformed JSON
- Invalid fields are set to safe defaults (empty arrays for list fields, null for object fields)
- No data is deleted, only corrected or defaulted

### When to use:
- After importing recipes from external sources
- When recipe pages show blank or have console errors about JSON parsing
- As part of database maintenance
