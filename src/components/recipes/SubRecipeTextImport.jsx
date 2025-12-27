import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SubRecipeTextImport({ allIngredients, onComplete, onCancel }) {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleParse = async () => {
    if (!text.trim()) {
      setError('Please paste some recipe text to parse');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const prompt = `
      You are a professional bartender and recipe parser. Parse the following sub-recipe text and extract the recipe details.

      Sub-recipes can be: syrup, infusion, shrub, cordial, bitters, tincture, oleo_saccharum, foam, garnish_prep, wash, clarification, or other.

      Text to parse:
      ${text}

      Return a JSON object with the following structure:
      {
      "name": "Recipe Name",
      "category": "syrup|infusion|shrub|cordial|bitters|tincture|oleo_saccharum|foam|garnish_prep|wash|clarification|other",
      "clarificationMethod": "none|agar|milk_wash" (REQUIRED if category is clarification),
      "description": "Brief description",
      "ingredients": [
      {
      "ingredient_name": "Ingredient Name",
      "amount": 100,
      "unit": "ml",
      "notes": "optional notes"
      }
      ],
      "instructions": ["Step 1", "Step 2"],
      "yield_amount": 750,
      "yield_unit": "ml"
      }

      Important:
      - Detect the category based on keywords:
      * "clarification" if recipe contains milk wash, agar clarification, or clarified in name/instructions
      * When category is "clarification", you MUST also set clarificationMethod to either "milk_wash" or "agar" based on the ingredients/instructions
      * "syrup" for simple/rich syrups
      * "cordial" for liqueurs
      * "infusion" for infused spirits
      * "wash" for fat wash or other washes
      - Parse all ingredients with amounts and units
      - Extract or generate clear preparation instructions
      - Calculate or estimate the yield amount
      - If yield is not specified, estimate based on ingredients
      `;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string" },
            clarificationMethod: { type: "string" },
            description: { type: "string" },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ingredient_name: { type: "string" },
                  amount: { type: "number" },
                  unit: { type: "string" },
                  notes: { type: "string" }
                }
              }
            },
            instructions: {
              type: "array",
              items: { type: "string" }
            },
            yield_amount: { type: "number" },
            yield_unit: { type: "string" }
          }
        }
      });

      if (response) {
        // Clean up and validate the parsed recipe
        const recipe = {
          ...response,
          ingredients: response.ingredients || [],
          instructions: response.instructions || [],
          yield_amount: response.yield_amount || 0,
          yield_unit: response.yield_unit || 'ml',
          category: response.category || 'other',
          clarificationMethod: response.clarificationMethod || 'none'
        };

        // Pass the parsed recipe as an array (for audit component)
        onComplete([recipe]);
      } else {
        setError('Failed to parse recipe. Please try again or use manual entry.');
      }
    } catch (err) {
      console.error('Error parsing recipe:', err);
      setError('Failed to parse recipe. Please check the format and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="recipe-text" className="text-base font-semibold mb-2">
          Paste Sub-Recipe Text
        </Label>
        <p className="text-sm text-gray-600 mb-3">
          Paste a recipe from any source. The AI will detect the category (syrup, cordial, infusion, etc.) and extract the ingredients, instructions, and yield.
        </p>
        <Textarea
          id="recipe-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Example:

Rich Simple Syrup

A classic 2:1 sugar syrup used in cocktails.

Ingredients:
- 1000g white sugar
- 500ml filtered water

Instructions:
1. Combine sugar and water in a pot
2. Heat until sugar dissolves completely
3. Let cool and bottle

Yield: 1.2L`}
          className="min-h-[400px] font-mono text-sm"
          disabled={isProcessing}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleParse}
          disabled={isProcessing || !text.trim()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Parsing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Parse Recipe
            </>
          )}
        </Button>
      </div>
    </div>
  );
}