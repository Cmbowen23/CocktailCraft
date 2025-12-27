import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Loader2, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ProductSearchPanel({
  suggestedProductIds = [],
  onAddProduct,
  currentItems = [],
  allIngredients = [],
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [substyleFilter, setSubstyleFilter] = useState("");
  const [flavorFilter, setFlavorFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showSuggestedFirst, setShowSuggestedFirst] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [quantities, setQuantities] = useState({});
  const [units, setUnits] = useState({});
  const [selectedVariants, setSelectedVariants] = useState({});
  
  const [variantsCache, setVariantsCache] = useState({});
  const [variantsLoaded, setVariantsLoaded] = useState(false);

  const alcoholicIngredients = useMemo(
    () =>
      (allIngredients || []).filter((ing) => {
        if (ing.ingredient_type === "sub_recipe") return false;
        if (ing.abv != null && Number(ing.abv) === 0) return false;
        return true;
      }),
    [allIngredients]
  );

  const availableCategories = useMemo(() => {
    const set = new Set();
    alcoholicIngredients.forEach((ing) => {
      if (ing.category) set.add(ing.category);
    });
    return Array.from(set).sort();
  }, [alcoholicIngredients]);

  const availableSubstyles = useMemo(() => {
    const set = new Set();
    alcoholicIngredients.forEach((ing) => {
      if (ing.substyle) set.add(ing.substyle);
    });
    return Array.from(set).sort();
  }, [alcoholicIngredients]);

  const availableFlavors = useMemo(() => {
    const set = new Set();
    alcoholicIngredients.forEach((ing) => {
      if (ing.flavor) set.add(ing.flavor);
    });
    return Array.from(set).sort();
  }, [alcoholicIngredients]);

  const availableTiers = useMemo(() => {
    const set = new Set();
    alcoholicIngredients.forEach((ing) => {
      if (ing.tier) set.add(ing.tier);
    });
    return Array.from(set).sort();
  }, [alcoholicIngredients]);

  const availableSuppliers = useMemo(() => {
    const set = new Set();
    alcoholicIngredients.forEach((ing) => {
      if (ing.supplier) set.add(ing.supplier);
    });
    return Array.from(set).sort();
  }, [alcoholicIngredients]);

  const mapIngredientToProduct = (ing) => ({
    id: ing.id,
    name: ing.name,
    bottle_image_url:
      ing.bottle_image_url || ing.image_url || ing.image || null,
    spirit_type: ing.spirit_type || ing.category || null,
    substyle: ing.substyle || null,
    supplier: ing.supplier || null,
    tier: ing.tier || null,
    purchase_price:
      ing.purchase_price != null ? Number(ing.purchase_price) : null,
    bottles_per_case:
      ing.bottles_per_case != null ? ing.bottles_per_case : null,
    sku_number: ing.sku_number || null,
    abv: ing.abv != null ? Number(ing.abv) : null,
    isSuggested:
      Array.isArray(suggestedProductIds) &&
      suggestedProductIds.includes(ing.id),
  });

  const [filteredProducts, setFilteredProducts] = useState([]);

  useEffect(() => {
    setIsSearching(true);
    setError(null);

    // Debounce search to prevent freezing UI on every keystroke
    const timeoutId = setTimeout(() => {
      try {
        let list = alcoholicIngredients.slice();

        if (categoryFilter) {
          list = list.filter((ing) => ing.category === categoryFilter);
        }
        if (substyleFilter) {
          list = list.filter((ing) => ing.substyle === substyleFilter);
        }
        if (flavorFilter) {
          list = list.filter((ing) => ing.flavor === flavorFilter);
        }
        if (tierFilter) {
          list = list.filter((ing) => ing.tier === tierFilter);
        }
        if (supplierFilter) {
          list = list.filter((ing) => ing.supplier === supplierFilter);
        }

        const min = priceMin !== "" ? Number(priceMin) : null;
        const max = priceMax !== "" ? Number(priceMax) : null;
        if (min != null && !Number.isNaN(min)) {
          list = list.filter((ing) => {
            const p = ing.purchase_price != null ? Number(ing.purchase_price) : null;
            return p != null && p >= min;
          });
        }
        if (max != null && !Number.isNaN(max)) {
          list = list.filter((ing) => {
            const p = ing.purchase_price != null ? Number(ing.purchase_price) : null;
            return p != null && p <= max;
          });
        }

        const term = (searchTerm || "").toLowerCase().trim();
        if (term) {
          list = list.filter((ing) => {
            const name = (ing.name || "").toLowerCase();
            const sku = String(ing.sku_number || "").toLowerCase();
            const substyle = (ing.substyle || "").toLowerCase();
            const flavor = (ing.flavor || "").toLowerCase();
            const supplier = (ing.supplier || "").toLowerCase();
            const category = (ing.category || "").toLowerCase();
            const spiritType = (ing.spirit_type || "").toLowerCase();

            const ingVariants = variantsCache[ing.id] || [];
            const variantSkuMatch = ingVariants.some((v) => {
              const vSku = String(v.sku_number || "").toLowerCase();
              return vSku.length > 0 && vSku.includes(term);
            });

            return (
              name.includes(term) ||
              sku.includes(term) ||
              variantSkuMatch ||
              substyle.includes(term) ||
              flavor.includes(term) ||
              supplier.includes(term) ||
              category.includes(term) ||
              spiritType.includes(term)
            );
          });
        }

        let mapped = list.map(mapIngredientToProduct);

        mapped.sort((a, b) => {
          if (showSuggestedFirst) {
            if (a.isSuggested && !b.isSuggested) return -1;
            if (!a.isSuggested && b.isSuggested) return 1;
          }
          return (a.name || "").localeCompare(b.name || "");
        });

        setFilteredProducts(mapped);
      } catch (err) {
        console.error("[ProductSearchPanel] Error searching products:", err);
        setError(err.message || "Failed to filter products.");
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [
    alcoholicIngredients,
    categoryFilter,
    substyleFilter,
    flavorFilter,
    tierFilter,
    supplierFilter,
    priceMin,
    priceMax,
    searchTerm,
    showSuggestedFirst,
    variantsCache,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil((filteredProducts.length || 0) / pageSize)
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pagedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  useEffect(() => {
    const fetchAllVariants = async () => {
      if (variantsLoaded) return;
      try {
        const allVariants = await base44.entities.ProductVariant.list("-created_date", 5000);
        const byIngredient = {};
        (allVariants || []).forEach((v) => {
          if (!v.ingredient_id) return;
          if (!byIngredient[v.ingredient_id]) byIngredient[v.ingredient_id] = [];
          byIngredient[v.ingredient_id].push(v);
        });
        setVariantsCache(byIngredient);
        setVariantsLoaded(true);
      } catch (err) {
        console.error("Error fetching variants:", err);
      }
    };
    fetchAllVariants();
  }, [variantsLoaded]);

  const getSizeLabel = (variant) => {
    const sizeMl = parseFloat(variant?.size_ml) || 0;
    if (!sizeMl) return "Standard";
    return sizeMl >= 1000
      ? `${(sizeMl / 1000).toFixed(2)}L`
      : `${sizeMl.toFixed(0)}ml`;
  };

  const isInCart = (ingredientId) =>
    currentItems.some((item) => item.ingredient_id === ingredientId);

  const getCartQuantity = (ingredientId) => {
    const item = currentItems.find((i) => i.ingredient_id === ingredientId);
    return item?.quantity || 0;
  };

  const handleAdd = (product) => {
    const qty = quantities[product.id] || 1;
    const unit = units[product.id] || "bottle";
    const variantId = selectedVariants[product.id] || null;

    onAddProduct({
      ingredient_id: product.id,
      ingredient_name: product.name,
      quantity: qty,
      unit,
      variant_id: variantId,
    });
  };

  return (
    <Card className="h-full flex flex-col border-2 border-blue-200 shadow-md">
      <CardHeader className="pb-3 bg-blue-50 border-b-2 border-blue-200">
        <CardTitle className="flex items-center gap-2 text-base text-blue-800">
          <Search className="w-4 h-4 text-blue-600" />
          Product Search
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="product-search">Search</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  id="product-search"
                  placeholder="Search by name, SKU, style, supplier…"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-col">
                <Label htmlFor="min-price">Min Price ($)</Label>
                <Input
                  id="min-price"
                  type="number"
                  value={priceMin}
                  onChange={(e) => {
                    setPriceMin(e.target.value);
                    setPage(1);
                  }}
                  className="w-24"
                  min="0"
                />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="max-price">Max Price ($)</Label>
                <Input
                  id="max-price"
                  type="number"
                  value={priceMax}
                  onChange={(e) => {
                    setPriceMax(e.target.value);
                    setPage(1);
                  }}
                  className="w-24"
                  min="0"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Category</Label>
              <Select
                value={categoryFilter || "__all__"}
                onValueChange={(val) => {
                  setCategoryFilter(val === "__all__" ? "" : val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Categories</SelectItem>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Substyle</Label>
              <Select
                value={substyleFilter || "__all__"}
                onValueChange={(val) => {
                  setSubstyleFilter(val === "__all__" ? "" : val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Substyles</SelectItem>
                  {availableSubstyles.map((substyle) => (
                    <SelectItem key={substyle} value={substyle}>
                      {substyle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableFlavors.length > 0 && (
              <div>
                <Label className="text-xs">Flavor</Label>
                <Select
                  value={flavorFilter || "__all__"}
                  onValueChange={(val) => {
                    setFlavorFilter(val === "__all__" ? "" : val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Flavors</SelectItem>
                    {availableFlavors.map((flavor) => (
                      <SelectItem key={flavor} value={flavor}>
                        {flavor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs">Tier</Label>
              <Select
                value={tierFilter || "__all__"}
                onValueChange={(val) => {
                  setTierFilter(val === "__all__" ? "" : val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Tiers</SelectItem>
                  {availableTiers.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Supplier</Label>
              <Select
                value={supplierFilter || "__all__"}
                onValueChange={(val) => {
                  setSupplierFilter(val === "__all__" ? "" : val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Suppliers</SelectItem>
                  {availableSuppliers.map((supplier) => (
                    <SelectItem key={supplier} value={supplier}>
                      {supplier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Filter className="w-4 h-4 text-gray-500" />
              <span>Show AI-suggested first</span>
            </div>
            <Switch
              checked={showSuggestedFirst}
              onCheckedChange={setShowSuggestedFirst}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md p-2 space-y-2">
          {isSearching && (
            <div className="flex items-center justify-center py-6 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Searching products…
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              {error}
            </div>
          )}

          {!isSearching && !error && pagedProducts.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              No products found. Try adjusting filters.
            </div>
          )}

          {pagedProducts.map((product) => {
            const inCart = isInCart(product.id);
            const qty = quantities[product.id] || 1;
            const unit = units[product.id] || "bottle";
            
            const variants = variantsCache[product.id] || [];
            const sortedVariants = [...variants].sort((a, b) => 
              (parseFloat(a.size_ml) || 0) - (parseFloat(b.size_ml) || 0)
            );
            const selectedVariantId = selectedVariants[product.id] || (sortedVariants.length > 0 ? sortedVariants[0]?.id : null);
            const selectedVariant = sortedVariants.find((v) => v.id === selectedVariantId) || sortedVariants[0];
            
            const variantBottlePrice = selectedVariant?.purchase_price != null 
              ? Number(selectedVariant.purchase_price) 
              : null;
            const variantCasePrice = selectedVariant?.case_price != null
              ? Number(selectedVariant.case_price)
              : null;
            const basePrice = variantBottlePrice ?? product.purchase_price;
            const displayPrice = unit === "case" && variantCasePrice != null
              ? variantCasePrice
              : basePrice;
            const priceLabel =
              displayPrice != null && !Number.isNaN(displayPrice)
                ? `$${displayPrice.toFixed(2)}`
                : "N/A";
            
            const bottlesPerCase = selectedVariant?.bottles_per_case || product.bottles_per_case;

            return (
              <div
                key={product.id}
                className={`flex items-center justify-between rounded-md border p-2 text-sm ${
                  inCart ? "bg-green-50 border-green-200" : "bg-white"
                }`}
              >
                {product.bottle_image_url && (
                  <div className="w-10 h-10 flex-shrink-0 mr-3 flex items-center justify-center bg-white rounded-md border border-gray-100 overflow-hidden">
                    <img
                      src={product.bottle_image_url}
                      alt={product.name}
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{product.name}</div>
                    {product.isSuggested && (
                      <Badge
                        variant="outline"
                        className="text-xs border-blue-400 text-blue-700"
                      >
                        AI Suggested
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 flex flex-wrap gap-1">
                    {product.category && <span>{product.category}</span>}
                    {product.spirit_type && <span>• {product.spirit_type}</span>}
                    {product.supplier && (
                      <span className="truncate max-w-[180px]">
                        • {product.supplier}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500 flex items-center gap-2">
                    {product.abv != null && !Number.isNaN(product.abv) && (
                      <span>ABV: {product.abv.toFixed(1)}%</span>
                    )}
                    {product.sku_number && (
                      <span className="text-[10px] text-gray-500">
                        SKU {product.sku_number}
                      </span>
                    )}
                  </div>

                </div>

                <div className="flex items-center gap-2 ml-3">
                  {!inCart ? (
                    <>
                      {sortedVariants.length >= 1 && (
                        <Select
                          value={selectedVariantId || "__default__"}
                          onValueChange={(val) =>
                            setSelectedVariants((prev) => ({
                              ...prev,
                              [product.id]: val === "__default__" ? null : val,
                            }))
                          }
                        >
                          <SelectTrigger className="w-[85px] h-8 text-sm">
                            <SelectValue>
                              {selectedVariant ? getSizeLabel(selectedVariant) : "Size"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {sortedVariants.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {getSizeLabel(v)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [product.id]: parseInt(e.target.value, 10) || 1,
                          }))
                        }
                        className="w-14 h-8 text-sm"
                      />

                      <Select
                        value={unit}
                        onValueChange={(val) =>
                          setUnits((prev) => ({
                            ...prev,
                            [product.id]: val,
                          }))
                        }
                      >
                        <SelectTrigger className="w-[100px] h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottle">Bottle</SelectItem>
                          {bottlesPerCase && (
                            <SelectItem value="case">
                              Case ({bottlesPerCase}pk)
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      <span className="text-sm font-semibold text-green-600 min-w-[70px] text-right">
                        {priceLabel}
                      </span>

                      <Button
                        size="icon"
                        className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleAdd(product)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs border-green-400 text-green-700"
                    >
                      In order ({getCartQuantity(product.id)})
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}