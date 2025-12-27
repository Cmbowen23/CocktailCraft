import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import AISuggestionsModal from "./AISuggestionsModal";

/**
 * ConceptBuilder
 *
 * Props:
 *  - alcoholicIngredients: Ingredient[]
 *  - onSuggestionsGenerated: (ids: string[], suggestions: Suggestion[]) => void
 *
 * Suggestion shape:
 *  { ingredient_id, ingredient_name, quantity, unit }
 */
export default function ConceptBuilder({
  alcoholicIngredients = [],
  onSuggestionsGenerated,
}) {
  const [conceptText, setConceptText] = useState("");
  const [targetSkuCount, setTargetSkuCount] = useState(30);
  const [prioritizeExclusive, setPrioritizeExclusive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [generatedSuggestions, setGeneratedSuggestions] = useState([]);
  const [isRefreshingModal, setIsRefreshingModal] = useState(false);

  const handleGenerate = async () => {
    if (!alcoholicIngredients.length) {
      setError("No alcoholic products in catalog to build from.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const text = (conceptText || "").toLowerCase();

      const isHighEnd = /high end|upscale|fine dining|luxury|speakeasy|craft|cocktail bar/.test(
        text
      );
      const isCasual = /dive|sports bar|college|neighborhood|casual|pub/.test(text);

      // -------------------------------------------------------------------
      // 1) Spirit weights from concept keywords
      // -------------------------------------------------------------------
      const spiritWeights = {
        vodka: 1,
        gin: 1,
        rum: 1,
        tequila: 1,
        mezcal: 1,
        whiskey: 1,
        bourbon: 1,
        rye: 1,
        scotch: 1,
        amaro: 1.1,
        liqueur: 1.1,
        vermouth: 0.9,
        brandy: 0.7,
        cognac: 0.8,
        other: 0.8,
      };

      const bump = (keys, amount) => {
        keys.forEach((k) => {
          spiritWeights[k] = (spiritWeights[k] || 0.8) + amount;
        });
      };

      const primarySpiritKeys = new Set();

      // tequila / mezcal focused
      if (/mexican|taqueria|agave|margarita|tequila|mezcal/.test(text)) {
        bump(["tequila", "mezcal"], 3);
        primarySpiritKeys.add("tequila");
        primarySpiritKeys.add("mezcal");
      }

      // whiskey / bourbon focused
      if (/whiskey|whisky|bourbon|rye|scotch/.test(text)) {
        bump(["whiskey", "bourbon", "rye", "scotch"], 3);
        if (/bourbon/.test(text)) {
          primarySpiritKeys.add("bourbon");
        } else {
          primarySpiritKeys.add("whiskey");
        }
      }

      // martini / amaro / aperitivo things
      if (/martini|negroni|spritz|aperitivo|aperol|campari|vermouth/.test(text)) {
        bump(["gin", "vermouth", "amaro", "liqueur"], 2);
        primarySpiritKeys.add("gin");
        primarySpiritKeys.add("amaro");
      }

      if (/tiki|caribbean|rum bar|beach bar/.test(text)) {
        bump(["rum"], 3);
        primarySpiritKeys.add("rum");
      }

      if (/vodka bar|ultra lounge|club/.test(text)) {
        bump(["vodka"], 2);
        primarySpiritKeys.add("vodka");
      }

      // -------------------------------------------------------------------
      // 2) Categorise an ingredient into a spirit key
      // -------------------------------------------------------------------
      const getSpiritKey = (ing) => {
        const spiritRaw = (ing.spirit_type || ing.category || "").toLowerCase();
        const styleRaw = (ing.style || ing.substyle || "").toLowerCase();
        const haystack = spiritRaw + " " + styleRaw;

        if (haystack.includes("tequila")) return "tequila";
        if (haystack.includes("mezcal")) return "mezcal";
        if (haystack.includes("vodka")) return "vodka";
        if (haystack.includes("gin")) return "gin";
        if (haystack.includes("rum")) return "rum";

        if (haystack.includes("bourbon")) return "bourbon";
        if (haystack.includes("rye")) return "rye";
        if (haystack.includes("scotch")) return "scotch";
        if (haystack.includes("whiskey") || haystack.includes("whisky"))
          return "whiskey";

        if (haystack.includes("amaro")) return "amaro";
        if (haystack.includes("vermouth")) return "vermouth";
        if (haystack.includes("brandy")) return "brandy";
        if (haystack.includes("cognac")) return "cognac";
        if (haystack.includes("liqueur") || haystack.includes("cordial"))
          return "liqueur";

        return "other";
      };

      const tierWeight = (ing) => {
        const tier = (ing.tier || "").toLowerCase();

        if (isHighEnd) {
          if (tier.includes("top")) return 1.6;
          if (tier.includes("premium")) return 1.4;
          if (tier.includes("call")) return 1.1;
          if (tier.includes("well")) return 0.7;
        } else if (isCasual) {
          if (tier.includes("well")) return 1.4;
          if (tier.includes("call")) return 1.2;
          if (tier.includes("premium")) return 1.0;
          if (tier.includes("top")) return 0.8;
        } else {
          if (tier.includes("well")) return 1.0;
          if (tier.includes("call")) return 1.1;
          if (tier.includes("premium")) return 1.2;
          if (tier.includes("top")) return 1.1;
        }

        return 1.0;
      };

      const priceWeight = (ing) => {
        const price = parseFloat(ing.purchase_price);
        if (!price || Number.isNaN(price)) return 1.0;

        if (isHighEnd) {
          if (price >= 50) return 1.4;
          if (price >= 30) return 1.2;
          if (price <= 18) return 0.8;
        } else if (isCasual) {
          if (price <= 18) return 1.3;
          if (price <= 25) return 1.15;
          if (price >= 40) return 0.8;
        } else {
          if (price >= 50) return 1.1;
          if (price >= 30) return 1.05;
          if (price <= 16) return 1.05;
        }

        return 1.0;
      };

      const baseFilter = (ing) => {
        if (!ing) return false;
        if (ing.abv !== undefined && ing.abv !== null && Number(ing.abv) === 0)
          return false;
        return true;
      };

      // scored list with spiritKey attached
      const scored = alcoholicIngredients
        .filter(baseFilter)
        .map((ing) => {
          const spiritKey = getSpiritKey(ing);
          const baseSpirit = spiritWeights[spiritKey] || spiritWeights.other || 0.8;
          const tWeight = tierWeight(ing);
          const pWeight = priceWeight(ing);
          const jitter = 0.9 + Math.random() * 0.3;

          let score = baseSpirit * tWeight * pWeight * jitter;

          if (prioritizeExclusive && ing.exclusive) {
            score *= 1.5;
          }

          return { ing, score, spiritKey };
        })
        .sort((a, b) => b.score - a.score);

      const limit = Math.min(
        Math.max(Number(targetSkuCount) || 20, 5),
        scored.length
      );

      let chosen = [];

      if (primarySpiritKeys.size > 0) {
        // Use ~70% of slots for primary spirits if possible
        const primaryOnly = scored.filter((s) =>
          primarySpiritKeys.has(s.spiritKey)
        );
        const primaryTarget = Math.min(
          Math.max(Math.round(limit * 0.7), 5),
          primaryOnly.length
        );

        chosen = primaryOnly.slice(0, primaryTarget);

        if (chosen.length < limit) {
          const chosenIds = new Set(chosen.map((c) => c.ing.id));
          const fillers = scored.filter((s) => !chosenIds.has(s.ing.id));
          chosen = chosen.concat(fillers.slice(0, limit - chosen.length));
        }
      } else {
        // No primary spirit specified – just top N overall
        chosen = scored.slice(0, limit);
      }

      const suggestions = chosen.map(({ ing }) => {
        const tier = (ing.tier || "").toLowerCase();
        let quantity = 3;

        if (tier.includes("well")) quantity = isCasual ? 18 : 12;
        else if (tier.includes("call")) quantity = isCasual ? 12 : 8;
        else if (tier.includes("premium")) quantity = isHighEnd ? 6 : 4;
        else if (tier.includes("top")) quantity = isHighEnd ? 4 : 2;

        return {
          ingredient_id: ing.id,
          ingredient_name: ing.name,
          quantity,
          unit: "bottle",
        };
      });

      // Store suggestions and open modal for user selection
      setGeneratedSuggestions(suggestions);
      setShowModal(true);
    } catch (err) {
      console.error("[ConceptBuilder] Error generating concept suggestions:", err);
      setError(
        "Something went wrong generating suggestions. You can still search and add products manually."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setConceptText("");
    setTargetSkuCount(30);
    setError(null);
    setGeneratedSuggestions([]);
    if (onSuggestionsGenerated) {
      onSuggestionsGenerated([], []);
    }
  };

  const handleAddSelectedFromModal = (selectedSuggestions) => {
    const ids = selectedSuggestions.map(s => s.ingredient_id);
    if (onSuggestionsGenerated) {
      onSuggestionsGenerated(ids, selectedSuggestions);
    }
  };

  const handleRefreshSuggestions = async () => {
    setIsRefreshingModal(true);
    await handleGenerate();
    setIsRefreshingModal(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          Opening Order Concept
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="conceptText">Describe the bar / program</Label>
          <Textarea
            id="conceptText"
            placeholder="e.g. High-end bourbon bar with deep American whiskey list and a supporting cast of agave spirits and amaro."
            value={conceptText}
            onChange={(e) => setConceptText(e.target.value)}
            rows={4}
          />
          <p className="text-[11px] text-gray-500">
            Mention key ideas like style (Mexican, speakeasy, hotel lobby, dive),
            focus spirits (bourbon, tequila, gin, amaro), and how premium or
            casual the program should feel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label htmlFor="targetSkuCount">Target # of SKUs</Label>
            <Input
              id="targetSkuCount"
              type="number"
              min={5}
              max={100}
              value={targetSkuCount}
              onChange={(e) => setTargetSkuCount(e.target.value)}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
             <Label htmlFor="prioritizeExclusive" className="cursor-pointer">Prioritize Exclusive Products</Label>
             <input 
                type="checkbox" 
                id="prioritizeExclusive"
                checked={prioritizeExclusive}
                onChange={(e) => setPrioritizeExclusive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
             />
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !alcoholicIngredients.length}
            className="flex-1 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Suggestions
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isGenerating}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </Button>
        </div>

        <AISuggestionsModal
          open={showModal}
          onOpenChange={setShowModal}
          suggestions={generatedSuggestions}
          allIngredients={alcoholicIngredients}
          onAddSelected={handleAddSelectedFromModal}
          onRefresh={handleRefreshSuggestions}
          isRefreshing={isRefreshingModal}
        />
      </CardContent>
    </Card>
  );
}