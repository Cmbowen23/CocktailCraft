import React, { useMemo, useState, useEffect } from "react";
import {
  Trash2,
  ShoppingCart,
  LayoutList,
  Scale,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function OrderItemsPanel({
  items,
  ingredients,
  onUpdateItem,
  onRemoveItem,
  onAddProduct,
}) {
  const [viewMode, setViewMode] = useState("spirit_type");
  const [variantsCache, setVariantsCache] = useState({});
  const [variantsLoaded, setVariantsLoaded] = useState(false);
  const [compareOpen, setCompareOpen] = useState({});

  // ---------------------------------------------------------------------------
  // basic helpers
  // ---------------------------------------------------------------------------

  const getIngredient = (ingredientId) =>
    ingredients.find((ing) => ing.id === ingredientId);

  const getSizeLabel = (variant) => {
    const sizeMl = parseFloat(variant?.size_ml) || 0;
    if (!sizeMl) return "N/A";
    return sizeMl >= 1000
      ? `${(sizeMl / 1000).toFixed(2)} L`
      : `${sizeMl.toFixed(0)} ml`;
  };

  const calculateItemCost = (ingredient, quantity, unit, selectedVariant) => {
    if (!ingredient || !selectedVariant) return 0;

    const bottlePrice = parseFloat(selectedVariant.purchase_price) || 0;
    const casePrice = parseFloat(selectedVariant.case_price) || 0;

    if (unit === "case" && casePrice > 0) return casePrice * quantity;
    if (unit === "bottle") return bottlePrice * quantity;
    return 0;
  };

  const getTotalCost = () =>
    items.reduce((total, item) => {
      const ingredient = getIngredient(item.ingredient_id);
      const rawVariants = variantsCache[item.ingredient_id] || [];
      const filteredVariants = rawVariants.filter((v) => {
        const ml = parseFloat(v.size_ml);
        return Number.isNaN(ml) || ml >= 30;
      });
      const variants =
        filteredVariants.length > 0 ? filteredVariants : rawVariants;
      const selectedVariant =
        variants.find((v) => v.id === item.variant_id) || variants[0];
      return (
        total +
        calculateItemCost(ingredient, item.quantity, item.unit, selectedVariant)
      );
    }, 0);

  const getTotalSKUs = () => items.length;

  const getTierColor = (tier) => {
    const colors = {
      well: "bg-slate-100 text-slate-700 border-slate-300",
      call: "bg-blue-100 text-blue-700 border-blue-300",
      premium: "bg-purple-100 text-purple-700 border-purple-300",
      top_shelf: "bg-amber-100 text-amber-700 border-amber-300",
      standard: "bg-gray-100 text-gray-700 border-gray-300",
    };
    return colors[tier] || colors.standard;
  };

  // ---------------------------------------------------------------------------
  // fetch ALL variants once (avoid rate limits)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const fetchAllVariants = async () => {
      if (variantsLoaded || !ingredients.length) return;

      try {
        const { base44 } = await import("@/api/base44Client");
        const allVariants =
          (await base44.entities.ProductVariant.list(
            "-created_date",
            5000
          )) || [];

        const byIngredient = {};
        allVariants.forEach((variant) => {
          const ingId = variant.ingredient_id;
          if (!ingId) return;
          if (!byIngredient[ingId]) byIngredient[ingId] = [];
          byIngredient[ingId].push(variant);
        });

        setVariantsCache(byIngredient);
        setVariantsLoaded(true);
      } catch (err) {
        console.warn(
          "[OrderItemsPanel] Error fetching variants:",
          err?.message || err
        );
        setVariantsLoaded(true);
      }
    };

    fetchAllVariants();
  }, [ingredients.length, variantsLoaded]);

  // ---------------------------------------------------------------------------
  // compare helpers
  // ---------------------------------------------------------------------------

  const getBottlePrice = (ingredient, variant) => {
    if (variant && variant.purchase_price != null) {
      const p = parseFloat(variant.purchase_price);
      if (!Number.isNaN(p) && p > 0) return p;
    }
    if (ingredient?.purchase_price != null) {
      const p = parseFloat(ingredient.purchase_price);
      if (!Number.isNaN(p) && p > 0) return p;
    }
    return 0;
  };

  const getPriceForIngredient = (ing) => {
    if (!ing) return 0;
    const variants = variantsCache[ing.id] || [];
    const withPrice = variants.find(
      (v) => v.purchase_price != null && !Number.isNaN(parseFloat(v.purchase_price))
    );
    if (withPrice) {
      const p = parseFloat(withPrice.purchase_price);
      if (!Number.isNaN(p) && p > 0) return p;
    }
    if (ing.purchase_price != null) {
      const p = parseFloat(ing.purchase_price);
      if (!Number.isNaN(p) && p > 0) return p;
    }
    return 0;
  };

  const getComparableProducts = (ingredient, basePrice) => {
    if (!ingredient || !basePrice || basePrice <= 0) {
      return { cheaper: [], pricier: [] };
    }

    const baseCategory = (ingredient.category || "").toLowerCase();
    const baseSpirit = (ingredient.spirit_type || "").toLowerCase();
    const baseSubstyle = (ingredient.substyle || "").toLowerCase();

    const strictCandidates = ingredients.filter((ing) => {
      if (!ing || ing.id === ingredient.id) return false;

      const cat = (ing.category || "").toLowerCase();
      const spirit = (ing.spirit_type || "").toLowerCase();
      const sub = (ing.substyle || ing.style || "").toLowerCase();
      const price = getPriceForIngredient(ing);

      return price > 0 && cat === baseCategory && spirit === baseSpirit && sub === baseSubstyle;
    });

    const candidates =
      strictCandidates.length > 0
        ? strictCandidates
        : ingredients.filter((ing) => {
            if (!ing || ing.id === ingredient.id) return false;

            const cat = (ing.category || "").toLowerCase();
            const spirit = (ing.spirit_type || "").toLowerCase();
            const price = getPriceForIngredient(ing);

            return price > 0 && cat === baseCategory && spirit === baseSpirit;
          });

    if (!candidates.length) return { cheaper: [], pricier: [] };

    const cheaper = [];
    const pricier = [];

    candidates.forEach((ing) => {
      const price = getPriceForIngredient(ing);
      const diff = price - basePrice;

      if (diff < 0) cheaper.push({ ing, diff: Math.abs(diff) });
      else if (diff > 0) pricier.push({ ing, diff });
    });

    cheaper.sort((a, b) => a.diff - b.diff);
    pricier.sort((a, b) => a.diff - b.diff);

    return {
      cheaper: cheaper.slice(0, 3).map((c) => c.ing),
      pricier: pricier.slice(0, 3).map((c) => c.ing),
    };
  };

  const renderCompareSection = (ingredient, selectedVariant, item, originalIndex) => {
    const basePrice = getBottlePrice(ingredient, selectedVariant);
    const { cheaper, pricier } = getComparableProducts(ingredient, basePrice);

    if (!cheaper.length && !pricier.length) {
      return (
        <div className="mt-2 text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-md px-3 py-2">
          No close comparables in this category.
        </div>
      );
    }

    const handleReplace = (newIng) => {
      onUpdateItem(originalIndex, "ingredient_id", newIng.id);
      onUpdateItem(originalIndex, "ingredient_name", newIng.name);
      const newVariants = variantsCache[newIng.id] || [];
      if (newVariants.length > 0) {
        onUpdateItem(originalIndex, "variant_id", newVariants[0].id);
      }
    };

    const handleAdd = (newIng) => {
      if (typeof onAddProduct === 'function') {
        const newVariants = variantsCache[newIng.id] || [];
        onAddProduct({
          ingredient_id: newIng.id,
          ingredient_name: newIng.name,
          quantity: 1,
          unit: "bottle",
          variant_id: newVariants.length > 0 ? newVariants[0].id : null,
        });
      }
    };

    const renderRow = (ing) => {
      const price = getPriceForIngredient(ing);
      return (
        <div
          key={ing.id}
          className="flex items-center justify-between gap-2 py-1.5 hover:bg-gray-100 rounded px-2"
        >
          <div className="truncate text-xs flex-1 min-w-0">
            <span>{ing.name}</span>
            {price > 0 && (
              <Badge variant="outline" className="ml-2 text-[10px]">
                ${price.toFixed(2)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => handleReplace(ing)}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Replace
            </Button>
            <Button
              size="sm"
              className="h-6 px-2 text-[10px] bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleAdd(ing)}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </div>
      );
    };

    return (
      <div className="mt-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 space-y-2">
        {cheaper.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
              💰 Cheaper alternatives
            </div>
            {cheaper.map(renderRow)}
          </div>
        )}
        {pricier.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-gray-700 mt-1 mb-1 flex items-center gap-1">
              ⭐ Premium options
            </div>
            {pricier.map(renderRow)}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // grouping for views
  // ---------------------------------------------------------------------------

  const organizedItems = useMemo(() => {
    if (viewMode === "flat") {
      return {
        type: "flat",
        items: [...items].sort((a, b) => {
          const ingA = getIngredient(a.ingredient_id);
          const ingB = getIngredient(b.ingredient_id);
          return (ingA?.name || "").localeCompare(ingB?.name || "");
        }),
      };
    }

    if (viewMode === "tier") {
      const groups = {};
      items.forEach((item) => {
        const ingredient = getIngredient(item.ingredient_id);
        if (!ingredient) return;
        const tier = ingredient.tier || "standard";
        if (!groups[tier]) groups[tier] = [];
        groups[tier].push(item);
      });

      Object.keys(groups).forEach((tier) => {
        groups[tier].sort((a, b) => {
          const ingA = getIngredient(a.ingredient_id);
          const ingB = getIngredient(b.ingredient_id);
          return (ingA?.name || "").localeCompare(ingB?.name || "");
        });
      });

      return { type: "tier", groups };
    }

    const groups = {};
    const spiritTypeOrder = ["Vodka", "Gin", "Rum", "Tequila", "Whiskey"];

    items.forEach((item) => {
      const ingredient = getIngredient(item.ingredient_id);
      if (!ingredient) return;
      const spiritType = ingredient.spirit_type || ingredient.category || "Other";
      const substyle = ingredient.substyle || ingredient.style || "Standard";

      if (!groups[spiritType]) groups[spiritType] = {};
      if (!groups[spiritType][substyle]) groups[spiritType][substyle] = [];
      groups[spiritType][substyle].push(item);
    });

    Object.keys(groups).forEach((spiritType) => {
      Object.keys(groups[spiritType]).forEach((substyle) => {
        groups[spiritType][substyle].sort((a, b) => {
          const ingA = getIngredient(a.ingredient_id);
          const ingB = getIngredient(b.ingredient_id);
          return (ingA?.name || "").localeCompare(ingB?.name || "");
        });
      });
    });

    return { type: "spirit_type", groups, spiritTypeOrder };
  }, [items, viewMode, ingredients]);

  // ---------------------------------------------------------------------------
  // render single cart row
  // ---------------------------------------------------------------------------

  const renderItem = (item) => {
    const originalIndex = items.indexOf(item);
    const ingredient = getIngredient(item.ingredient_id);

    const rawVariants = variantsCache[item.ingredient_id] || [];
    const filteredVariants = rawVariants.filter((v) => {
      const ml = parseFloat(v.size_ml);
      return Number.isNaN(ml) || ml >= 30;
    });
    const variants =
      filteredVariants.length > 0 ? filteredVariants : rawVariants;

    const selectedVariant =
      variants.find((v) => v.id === item.variant_id) || variants[0];

    const itemCost = selectedVariant
      ? calculateItemCost(ingredient, item.quantity, item.unit, selectedVariant)
      : 0;

    const isCompareOpen = ingredient && compareOpen[ingredient.id];

    return (
      <div
        key={item.temp_id || item.id || originalIndex}
        className="border border-gray-200 rounded-lg p-3 bg-white hover:border-blue-300 transition-colors"
      >
        {/* TOP GRID ROW */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:items-center">
          {/* name + bottle image - Full width on mobile, 3 cols on desktop */}
          <div className="col-span-1 md:col-span-3 flex items-center gap-2 mb-2 md:mb-0">
            {ingredient?.bottle_image_url && (
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                <img
                  src={ingredient.bottle_image_url}
                  alt={ingredient.name}
                  className="max-w-full max-h-full object-contain rounded"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-sm">
                {ingredient?.name || "Unknown Product"}
              </div>
              {selectedVariant?.sku_number && (
                <div className="text-[10px] text-gray-400">
                  SKU {selectedVariant.sku_number}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-1 md:col-span-9 grid grid-cols-2 md:grid-cols-9 gap-2 items-center">
            {/* Mobile: Spirit Type + Supplier + Tier row */}
            <div className="col-span-2 md:col-span-4 flex flex-wrap md:grid md:grid-cols-4 items-center gap-2 md:gap-0">
              {/* spirit type */}
              <div className="text-xs text-gray-600 md:col-span-1">
                {ingredient?.spirit_type}
              </div>

              {/* supplier */}
              <div className="text-xs text-gray-500 truncate md:col-span-2">
                {ingredient?.supplier}
              </div>

              {/* tier */}
              <div className="md:col-span-1">
                {ingredient?.tier && (
                  <Badge className={`text-[10px] ${getTierColor(ingredient.tier)}`}>
                    {ingredient.tier}
                  </Badge>
                )}
              </div>
            </div>

            {/* Mobile: Controls row */}
            <div className="col-span-2 md:col-span-5 grid grid-cols-12 gap-2 items-center">
              {/* size selector - always dropdown */}
              <div className="col-span-4 md:col-span-3">
                {variants.length >= 1 ? (
                  <Select
                    value={item.variant_id || selectedVariant?.id || ""}
                    onValueChange={(value) =>
                      onUpdateItem(originalIndex, "variant_id", value)
                    }
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Size">
                        {selectedVariant ? getSizeLabel(selectedVariant) : "Size"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {variants
                        .slice()
                        .sort(
                          (a, b) =>
                            (parseFloat(a.size_ml) || 0) -
                            (parseFloat(b.size_ml) || 0)
                        )
                        .map((variant) => (
                          <SelectItem key={variant.id} value={variant.id}>
                            {getSizeLabel(variant)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-xs text-gray-400">—</div>
                )}
              </div>

              {/* quantity */}
              <div className="col-span-3 md:col-span-2">
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) =>
                    onUpdateItem(
                      originalIndex,
                      "quantity",
                      parseFloat(e.target.value) || 1
                    )
                  }
                  className="h-8 text-sm w-full"
                />
              </div>

              {/* unit selector */}
              <div className="col-span-5 md:col-span-2">
                <Select
                  value={item.unit}
                  onValueChange={(value) =>
                    onUpdateItem(originalIndex, "unit", value)
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue>
                      {item.unit === "case" && selectedVariant?.bottles_per_case
                        ? `Case (${selectedVariant.bottles_per_case})`
                        : item.unit === "bottle"
                        ? "Bottle"
                        : item.unit}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottle">Bottle</SelectItem>
                    {selectedVariant?.bottles_per_case && (
                      <SelectItem value="case">
                        Case ({selectedVariant.bottles_per_case})
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* price + delete */}
              <div className="col-span-12 md:col-span-5 flex justify-between md:justify-end items-center gap-2 mt-2 md:mt-0">
                <span className="text-sm font-semibold text-green-600">
                  ${itemCost.toFixed(2)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveItem(originalIndex)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: Compare */}
        <div className="mt-2 flex items-center">
          {ingredient && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs flex items-center gap-1"
              onClick={() =>
                setCompareOpen((prev) => ({
                  ...prev,
                  [ingredient.id]: !prev[ingredient.id],
                }))
              }
            >
              <Scale className="w-3 h-3" />
              Compare
              {isCompareOpen ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </Button>
          )}
        </div>

        {isCompareOpen &&
          ingredient &&
          renderCompareSection(ingredient, selectedVariant, item, originalIndex)}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // empty state
  // ---------------------------------------------------------------------------

  if (items.length === 0) {
    return (
      <Card className="border-2 border-green-200 shadow-md">
        <CardHeader className="bg-green-50 border-b-2 border-green-200">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-600" />
            Opening Order Items
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No products added yet. Use the panels above to add products.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // main render
  // ---------------------------------------------------------------------------

  return (
    <Card className="border-2 border-green-200 shadow-md">
      <CardHeader className="bg-green-50 border-b-2 border-green-200">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-600" />
            Opening Order Items ({getTotalSKUs()} SKUs)
          </div>
          <div className="text-2xl font-bold text-green-700">
            ${getTotalCost().toFixed(2)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* view selector */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
          <LayoutList className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">View:</span>
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spirit_type">By Spirit Type</SelectItem>
              <SelectItem value="tier">By Tier</SelectItem>
              <SelectItem value="flat">Simple List</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* grouped items */}
        <div className="space-y-6">
          {organizedItems.type === "flat" && (
            <div className="space-y-2">
              {organizedItems.items.map((item) => renderItem(item))}
            </div>
          )}

          {organizedItems.type === "tier" && (
            <>
              {Object.entries(organizedItems.groups)
                .sort(([tierA], [tierB]) => {
                  const tierOrder = {
                    well: 1,
                    call: 2,
                    premium: 3,
                    top_shelf: 4,
                    standard: 5,
                  };
                  return (tierOrder[tierA] || 99) - (tierOrder[tierB] || 99);
                })
                .map(([tier, tierItems]) => (
                  <div key={tier} className="space-y-2">
                    <h3 className="text-base font-bold text-gray-900 border-b-2 border-blue-200 pb-2 flex items-center gap-2">
                      <Badge className={getTierColor(tier)}>{tier}</Badge>
                      <span className="text-sm text-gray-500">
                        ({tierItems.length} items)
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {tierItems.map((item) => renderItem(item))}
                    </div>
                  </div>
                ))}
            </>
          )}

          {organizedItems.type === "spirit_type" && (
            <>
              {Object.entries(organizedItems.groups)
                .sort(([typeA], [typeB]) => {
                  const order = organizedItems.spiritTypeOrder;
                  const idxA = order.indexOf(typeA);
                  const idxB = order.indexOf(typeB);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return typeA.localeCompare(typeB);
                })
                .map(([spiritType, substyles]) => {
                  const tequilaSubstyleOrder = [
                    "Blanco",
                    "Reposado",
                    "Anejo",
                    "Mezcal",
                    "Flavored",
                  ];

                  const sortedSubstyles = Object.entries(substyles).sort(
                    ([subA], [subB]) => {
                      if (spiritType.toLowerCase() === "tequila") {
                        const idxA = tequilaSubstyleOrder.findIndex(
                          (s) => s.toLowerCase() === subA.toLowerCase()
                        );
                        const idxB = tequilaSubstyleOrder.findIndex(
                          (s) => s.toLowerCase() === subB.toLowerCase()
                        );
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                      }
                      return subA.localeCompare(subB);
                    }
                  );

                  return (
                    <div key={spiritType} className="space-y-3">
                      <h3 className="text-lg font-bold text-gray-900 border-b-2 border-blue-200 pb-2">
                        {spiritType}
                      </h3>
                      {sortedSubstyles.map(([substyle, subItems]) => (
                        <div key={substyle} className="pl-3 space-y-2">
                          <h4 className="text-sm font-bold text-gray-800 border-l-4 border-blue-400 pl-2 flex items-center gap-2">
                            {substyle}
                            <span className="text-gray-500 text-xs font-normal">
                              ({subItems.length} items)
                            </span>
                          </h4>
                          <div className="pl-4 space-y-2">
                            {subItems.map((item) => renderItem(item))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}