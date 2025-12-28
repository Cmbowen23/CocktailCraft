import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Package, Upload, FlaskConical, Filter, BookOpen, ExternalLink, Merge, Trash2, Scan } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import _ from "lodash";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { createPageUrl, parseRecipeData } from "@/utils";
import { convertToMl } from "@/components/utils/costCalculations";

import IngredientForm from "@/components/ingredients/IngredientForm";
import IngredientList from "@/components/ingredients/IngredientList";
import BulkIngredientImporter from "@/components/ingredients/BulkIngredientImporter";
import { saveIngredientWithPrepActions, updateRecipesWithNewIngredientName } from "@/components/ingredients/ingredientManagementService";
import AddIngredientModal from "@/components/ingredients/AddIngredientModal";
import BulkIngredientSpreadsheetImporter from "@/components/ingredients/BulkIngredientSpreadsheetImporter";
import IngredientActionsMenu from "@/components/ingredients/IngredientActionsMenu";
import MergeIngredientsModal from "@/components/ingredients/MergeIngredientsModal";
import FindDuplicatesModal from "@/components/ingredients/FindDuplicatesModal";
import BulkImageUploadModal from "@/components/ingredients/BulkImageUploadModal";
import InvoiceScanner from "@/components/ingredients/InvoiceScanner";
import { base44 } from "@/api/base44Client";

// Retry helper with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 5, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      // Retry on 429 (Rate Limit) or 5xx (Server Errors)
      const isRetryable = err?.response?.status === 429 || (err?.response?.status >= 500 && err?.response?.status < 600);
      
      if (isRetryable && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 500;
        console.warn(`Request failed with ${err.response?.status}, retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
};

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState([]);
  const [allRecipes, setAllRecipes] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ingredientToAdd, setIngredientToAdd] = useState("");
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [spiritTypeFilter, setSpiritTypeFilter] = useState("all");
  const [substyleFilter, setSubstyleFilter] = useState("all");
  const [showSpreadsheetImporter, setShowSpreadsheetImporter] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFindDuplicates, setShowFindDuplicates] = useState(false);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [showInvoiceScanner, setShowInvoiceScanner] = useState(false);
  const [showAlcoholicOnly, setShowAlcoholicOnly] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  // Cache for all data loaded once
  const [allIngredientsCache, setAllIngredientsCache] = useState([]);

  const isSalesRep = currentUser && ['sales_rep', 'on_premise'].includes(currentUser.user_type) && currentUser.role !== 'admin';

  const debouncedSetSearchTerm = React.useMemo(
    () => _.debounce((value) => {
      setSearchTerm(value);
      setPage(1);
    }, 300),
    []
  );

  const saveScrollPosition = () => {
    setScrollPosition(window.scrollY);
  };

  const restoreScrollPosition = () => {
    setTimeout(() => {
      window.scrollTo(0, scrollPosition);
    }, 100);
  };

  // Load all data once with retry logic
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      // FAST LOADING: Fetch everything in parallel
      const [allIngs, recipeData, categoryData, allProductVariants] = await Promise.all([
        retryWithBackoff(() => base44.entities.Ingredient.list('name', 5000)),
        retryWithBackoff(() => base44.entities.Recipe.list()),
        retryWithBackoff(() => base44.entities.IngredientCategory.list()),
        retryWithBackoff(() => base44.entities.ProductVariant.list('created_at', 5000))
      ]);

      // Check for essential ingredients (Water/Ice) and create if missing (Client-side check to avoid double fetch)
      const freeIngredients = [
          { name: "Water", category: "mixer", notes: "Essential base ingredient - no cost assigned" },
          { name: "Ice", category: "mixer", notes: "Essential chilling ingredient - no cost assigned" }
      ];

      for (const freeIng of freeIngredients) {
          const existing = allIngs.find(ing => ing.name.toLowerCase() === freeIng.name.toLowerCase());
          if (!existing) {
            try {
                const newIng = await retryWithBackoff(() => base44.entities.Ingredient.create({
                  name: freeIng.name,
                  category: freeIng.category,
                  unit: "oz",
                  cost_per_unit: 0,
                  supplier: "House",
                  abv: 0,
                  notes: freeIng.notes,
                  ingredient_type: 'purchased',
                  purchase_price: 0,
                  purchase_quantity: 1,
                  purchase_unit: "gallon"
                }));
                allIngs.push(newIng);
            } catch (e) {
                console.warn("Failed to auto-create free ingredient", freeIng.name, e);
            }
          }
      }

      // Attach variants and calculate costs
      const ingredientsWithVariantSkus = (allIngs || []).map(ing => {
        const variants = (allProductVariants || []).filter(pv => pv.ingredient_id === ing.id);
        
        let frontlineCostPerOz = null;
        let bestCostPerOz = null;
        let bestVariant = null;
        let frontlineVariant = null;

        if (variants.length > 0) {
          variants.forEach(v => {
             // Recalculate size_ml from quantity/unit to ensure accuracy and fix legacy data
             let sizeMl = v.size_ml;
             if (v.purchase_quantity && v.purchase_unit) {
                 const calculatedMl = convertToMl(v.purchase_quantity, v.purchase_unit);
                 // Use calculated value if it's valid
                 if (calculatedMl > 0) {
                     sizeMl = calculatedMl;
                 }
             }
             // Fallback for missing size_ml
             sizeMl = sizeMl || convertToMl(v.purchase_quantity, v.purchase_unit);

             const sizeOz = sizeMl / 29.5735;
             if (sizeOz <= 0) return;

             // Bottle cost per oz
             const bottleCost = parseFloat(v.purchase_price) || 0;
             const bottleCostPerOz = bottleCost > 0 ? bottleCost / sizeOz : 0;
             
             // Case cost per oz
             let caseCostPerOz = Infinity;
             if (v.case_price && v.bottles_per_case) {
                 const casePrice = parseFloat(v.case_price);
                 const bottles = parseFloat(v.bottles_per_case);
                 if (bottles > 0 && casePrice > 0) {
                     caseCostPerOz = (casePrice / bottles) / sizeOz;
                 }
             }

             // Logic for frontline cost: prioritize 750ml bottle, otherwise first valid bottle price
             if (bottleCostPerOz > 0) {
                 if (frontlineCostPerOz === null) {
                   frontlineCostPerOz = bottleCostPerOz;
                   frontlineVariant = { ...v, size_ml: sizeMl };
                 }
                 // If this variant is closer to 750ml, prefer it as the "frontline" standard
                 if (Math.abs(sizeMl - 750) < 10) {
                   frontlineCostPerOz = bottleCostPerOz;
                   frontlineVariant = { ...v, size_ml: sizeMl };
                 }
             }
             
             // Logic for best cost: strictly the lowest price per oz available
             const minCostForVariant = Math.min(bottleCostPerOz > 0 ? bottleCostPerOz : Infinity, caseCostPerOz);
             
             if (minCostForVariant < Infinity && (bestCostPerOz === null || minCostForVariant < bestCostPerOz)) {
                 bestCostPerOz = minCostForVariant;
                 bestVariant = { ...v, size_ml: sizeMl }; // Ensure size_ml is set
             }
          });
        }

        const allSkuNumbers = variants.map(v => v.sku_number).filter(Boolean);
        
        return { 
            ...ing, 
            all_sku_numbers: allSkuNumbers,
            frontlineCostPerOz: frontlineCostPerOz || parseFloat(ing.cost_per_unit) || 0,
            bestCostPerOz: bestCostPerOz || parseFloat(ing.cost_per_unit) || 0,
            bestVariant,
            frontlineVariant,
            variants // Attach variants for potential future use
        };
      });

      setAllIngredientsCache(ingredientsWithVariantSkus);

      const parsedRecipes = (recipeData || []).map(recipe => parseRecipeData(recipe));
      setAllRecipes(parsedRecipes);

      setCustomCategories(categoryData || []);
    } catch (err) {
      console.error("Error loading data:", err);
      if (err?.response?.status === 429) {
        setError("Rate limit exceeded. Please wait a moment and refresh the page.");
      } else {
        setError("Failed to load data. Please refresh the page.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Client-side filtering only - no API calls
  const filterAndSetIngredients = useCallback(() => {
    if (!allIngredientsCache.length) return;

    let filtered = [...allIngredientsCache];

    // Text search
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((ing) => {
        const fields = [
          ing.name,
          ing.category,
          ing.spirit_type,
          ing.substyle,
          ing.supplier,
          ing.region,
          ing.brand,
          ing.notes,
          ing.sku_number,
          ...(ing.all_sku_numbers || []),
          ...(ing.aliases || []),
          ];
        return fields.some((val) => String(val || "").toLowerCase().includes(term));
      });
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (ing) => (ing.category || "").toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    // Spirit type filter
    if (spiritTypeFilter !== "all") {
      filtered = filtered.filter(
        (ing) => (ing.spirit_type || "").toLowerCase() === spiritTypeFilter.toLowerCase()
      );
    }

    // Substyle filter
    if (substyleFilter !== "all") {
      filtered = filtered.filter(
        (ing) => (ing.substyle || "").toLowerCase() === substyleFilter.toLowerCase()
      );
    }

    // Alcoholic-only filter
    if (showAlcoholicOnly) {
      filtered = filtered.filter((ing) => Number(ing.abv || 0) > 0);
    }

    // Exclude sub-recipes
    filtered = filtered.filter((ing) => ing.ingredient_type !== "sub_recipe");

    // Exclude common non-alcoholic
    const commonNonAlcIgnored = ["water", "ice"];
    filtered = filtered.filter(
      (ing) => !commonNonAlcIgnored.includes((ing.name || "").toLowerCase())
    );

    // Sort alphabetically
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // Pagination
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    let currentPage = page;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const paged = filtered.slice(startIndex, startIndex + pageSize);

    setIngredients(paged);
    setTotalPages(totalPages);
    setTotalCount(totalCount);
    if (currentPage !== page) setPage(currentPage);
  }, [
    allIngredientsCache,
    searchTerm,
    categoryFilter,
    spiritTypeFilter,
    substyleFilter,
    showAlcoholicOnly,
    page,
    pageSize,
  ]);

  // Initial data load
  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (allIngredientsCache.length > 0) {
      filterAndSetIngredients();
    }
  }, [searchTerm, categoryFilter, spiritTypeFilter, substyleFilter, showAlcoholicOnly, page, filterAndSetIngredients, allIngredientsCache]);

  const refreshData = async () => {
    await loadAllData();
  };

  const handleAddIngredientCost = (ingredientName) => {
    saveScrollPosition();
    setIngredientToAdd(ingredientName);
    setShowAddIngredientModal(true);
  };

  const handleSubmit = async (ingredientData) => {
    setIsSaving(true);
    try {
        const { productVariants, ...ingredientDataWithoutVariants } = ingredientData;
        
        let savedIngredient;
        if (ingredientData.id) {
            const finalData = { ...ingredientDataWithoutVariants, cost_per_unit: parseFloat(ingredientDataWithoutVariants.cost_per_unit) || 0 };
            savedIngredient = await retryWithBackoff(() => base44.entities.Ingredient.update(ingredientData.id, finalData));
            
            if (ingredientData.originalName && ingredientData.name && ingredientData.originalName !== ingredientData.name) {
               await updateRecipesWithNewIngredientName(ingredientData.originalName, ingredientData.name);
            }
        } else {
            const finalData = { ...ingredientDataWithoutVariants, cost_per_unit: parseFloat(ingredientDataWithoutVariants.cost_per_unit) || 0 };
            savedIngredient = await retryWithBackoff(() => base44.entities.Ingredient.create(finalData));
        }

        const ingredientId = savedIngredient?.id || ingredientData.id;

        if (productVariants && productVariants.length > 0) {
            const existingVariants = await retryWithBackoff(() => base44.entities.ProductVariant.filter({ ingredient_id: ingredientId }));
            
            for (const variant of productVariants) {
                const variantData = {
                    ingredient_id: ingredientId,
                    size_ml: parseFloat(variant.purchase_quantity) || 0,
                    purchase_quantity: parseFloat(variant.purchase_quantity) || 0,
                    purchase_unit: variant.purchase_unit || 'ml',
                    purchase_price: parseFloat(variant.purchase_price) || 0,
                    case_price: variant.case_price ? parseFloat(variant.case_price) : null,
                    bottles_per_case: variant.bottles_per_case ? parseFloat(variant.bottles_per_case) : null,
                    sku_number: variant.sku_number || ''
                };

                if (variant.id && !variant.isNew) {
                    await retryWithBackoff(() => base44.entities.ProductVariant.update(variant.id, variantData));
                } else {
                    await retryWithBackoff(() => base44.entities.ProductVariant.create(variantData));
                }
            }

            const variantIdsInForm = productVariants.filter(v => v.id && !v.isNew).map(v => v.id);
            const variantsToDelete = existingVariants.filter(v => !variantIdsInForm.includes(v.id));
            for (const variant of variantsToDelete) {
                await retryWithBackoff(() => base44.entities.ProductVariant.delete(variant.id));
            }
        }

        setShowForm(false);
        setEditingIngredient(null);
        refreshData();
        restoreScrollPosition();
    } catch(err) {
        console.error("Error saving ingredient:", err);
        if (err?.response?.status === 429) {
          setError("Rate limit exceeded. Please wait and try again.");
        } else {
          setError("Failed to save ingredient. Please try again.");
        }
    } finally {
        setIsSaving(false);
    }
  };

  const handleEdit = (ingredient) => {
    saveScrollPosition();
    setEditingIngredient(ingredient);
    setShowForm(true);
  };
  
  const handleDelete = async (id) => {
    if (isSalesRep) return;
    const ingredient = ingredients.find(ing => ing.id === id);
    if (!ingredient) return;

    const recipesUsingIngredient = allRecipes.filter(recipe => 
      recipe.ingredients?.some(ing => ing.ingredient_name?.toLowerCase().trim() === ingredient.name.toLowerCase().trim())
    );

    if (recipesUsingIngredient.length > 0) {
      const recipeNames = recipesUsingIngredient.map(r => r.name).join(', ');
      const confirmed = window.confirm(
        `Warning: "${ingredient.name}" is used in ${recipesUsingIngredient.length} recipe(s): ${recipeNames}\n\nAre you sure you want to delete it? This may affect those recipes.`
      );
      if (!confirmed) return;
    }

    try {
      await retryWithBackoff(() => base44.entities.Ingredient.delete(id));
      refreshData();
    } catch (err) {
      console.error("Error deleting ingredient:", err);
      setError("Failed to delete ingredient. Please try again.");
    }
  };

  const handleImportComplete = () => {
    setShowImporter(false);
    refreshData();
    restoreScrollPosition();
  };

  const handleSpreadsheetImportComplete = () => {
    setShowSpreadsheetImporter(false);
    refreshData();
    restoreScrollPosition();
  };

  const handleIngredientSaved = () => {
    setShowAddIngredientModal(false);
    setIngredientToAdd("");
    refreshData();
    restoreScrollPosition();
  };

  const availableCategories = React.useMemo(() => {
    const categories = new Set();
    allIngredientsCache.forEach(ing => {
      if (ing.category) {
        categories.add(ing.category.toLowerCase());
      }
    });
    return Array.from(categories).sort();
  }, [allIngredientsCache]);

  const availableSpiritTypes = React.useMemo(() => {
    const spiritTypes = new Set();
    allIngredientsCache.forEach(ing => {
      const categoryMatches = categoryFilter === "all" || 
        (ing.category && ing.category.toLowerCase() === categoryFilter.toLowerCase());
      
      if (categoryMatches && ing.spirit_type && ing.spirit_type.trim()) {
        spiritTypes.add(ing.spirit_type.trim());
      }
    });
    return Array.from(spiritTypes).sort((a, b) => a.localeCompare(b));
  }, [allIngredientsCache, categoryFilter]);

  const availableSubstyles = React.useMemo(() => {
    const substyles = new Set();
    allIngredientsCache.forEach(ing => {
      const categoryMatches = categoryFilter === "all" || 
        (ing.category && ing.category.toLowerCase() === categoryFilter.toLowerCase());
      
      const spiritTypeMatches = spiritTypeFilter === "all" ||
        (ing.spirit_type && ing.spirit_type.trim().toLowerCase() === spiritTypeFilter.toLowerCase());
      
      if (categoryMatches && spiritTypeMatches && ing.substyle && ing.substyle.trim()) {
        substyles.add(ing.substyle.trim());
      }
    });
    return Array.from(substyles).sort((a, b) => a.localeCompare(b));
  }, [allIngredientsCache, categoryFilter, spiritTypeFilter]);

  const handleCategoryFilterChange = (value) => {
    setCategoryFilter(value);
    setSpiritTypeFilter("all");
    setSubstyleFilter("all");
    setPage(1);
  };

  const handleSpiritTypeFilterChange = (value) => {
    setSpiritTypeFilter(value);
    setSubstyleFilter("all");
    setPage(1);
  };

  const handleMergeIngredients = async (primaryId) => {
    setError('');
    setIsLoading(true);
    try {
      const secondaryIds = selectedIds.filter(id => id !== primaryId);
      const response = await base44.functions.invoke('mergeIngredients', {
        primaryIngredientId: primaryId,
        secondaryIngredientIds: secondaryIds
      });
      
      if (response.data.success) {
        setSelectedIds([]);
        setShowMergeModal(false);
        await loadAllData();
      }
    } catch (err) {
      console.error("Error merging ingredients:", err);
      setError(err.response?.data?.error || "Failed to merge ingredients.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async (force = false) => {
    setError('');
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('bulkDeleteIngredients', {
        ingredientIds: selectedIds,
        force
      });
      
      if (response.data.requiresConfirmation) {
        const deps = response.data.dependencies;
        const recipeList = deps.map(d => d.recipe).join(', ');
        const confirmed = window.confirm(
          `Warning: These ingredients are used in ${deps.length} recipe(s):\n\n${recipeList}\n\nDeleting them may affect those recipes. Are you sure you want to proceed?`
        );
        
        if (confirmed) {
          await handleBulkDelete(true);
        } else {
          setShowDeleteConfirm(false);
          setIsLoading(false);
        }
        return;
      }
      
      if (response.data.success) {
        setSelectedIds([]);
        setShowDeleteConfirm(false);
        await loadAllData();
      }
    } catch (err) {
      console.error("Error deleting ingredients:", err);
      const errorMsg = err.response?.data?.error || "Failed to delete ingredients.";
      setError(errorMsg);
      setShowDeleteConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMergeDuplicateGroups = async (groupsToMerge) => {
  setError('');
  setIsLoading(true);
  try {
    for (const { primaryId, group } of groupsToMerge) {
      const secondaryIds = group.filter(ing => ing.id !== primaryId).map(ing => ing.id);
      if (secondaryIds.length > 0) {
        await base44.functions.invoke('mergeIngredients', {
          primaryIngredientId: primaryId,
          secondaryIngredientIds: secondaryIds
        });
      }
    }
    setShowFindDuplicates(false);
    await loadAllData();
  } catch (err) {
    console.error("Error merging duplicate groups:", err);
    setError(err.response?.data?.error || "Failed to merge duplicate groups.");
  } finally {
    setIsLoading(false);
  }
  };

  const handleImageUploadComplete = () => {
  setShowImageUploadModal(false);
  refreshData();
  };

  const handleInvoiceScanComplete = () => {
    setShowInvoiceScanner(false);
    refreshData();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md mx-auto">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="text-center py-12 px-6">
              <div className="text-red-500 text-lg font-semibold mb-4">⚠️ Error</div>
              <p className="text-gray-700 mb-6">{error}</p>
              <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ingredients</h1>
            <p className="text-gray-600 mt-1">
              Manage your bar's ingredient inventory and costs
            </p>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            {!isSalesRep && (
              <div className="hidden md:flex gap-3 flex-wrap">
                <Button
                  onClick={() => setShowInvoiceScanner(!showInvoiceScanner)}
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Scan className="w-4 h-4 mr-2" />
                  Scan Invoice
                </Button>
                <IngredientActionsMenu 
                  onImportSpreadsheet={() => setShowSpreadsheetImporter(true)}
                  onBulkImport={() => setShowImporter(true)}
                  onFindDuplicates={() => setShowFindDuplicates(true)}
                  onBulkImageUpload={() => setShowImageUploadModal(true)}
                />
              </div>
            )}

            {/* Mobile Actions (Selection based) */}
            <div className="md:hidden flex gap-2">
              {!isSalesRep && selectedIds.length >= 1 && (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Desktop Selection Actions */}
            {!isSalesRep && (
              <div className="hidden md:flex gap-3">
                {selectedIds.length >= 2 && (
                  <Button
                    onClick={() => setShowMergeModal(true)}
                    variant="outline"
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Merge className="w-4 h-4 mr-2" />
                    Merge ({selectedIds.length})
                  </Button>
                )}
                {selectedIds.length >= 1 && (
                  <Button
                    onClick={() => setShowDeleteConfirm(true)}
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete ({selectedIds.length})
                  </Button>
                )}
              </div>
            )}

            <Button
              onClick={() => {
                saveScrollPosition();
                setShowForm(true);
                setEditingIngredient(null);
              }}
              className="bg-blue-600 hover:bg-blue-700 ml-auto md:ml-0"
            >
              <Plus className="w-5 h-5 md:mr-2" />
              <span className="hidden md:inline">Add Ingredient</span>
              <span className="md:hidden">Add</span>
            </Button>
          </div>
        </div>

        <Dialog open={showForm} onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingIngredient(null);
        }}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingIngredient ? 'Edit Ingredient' : 'New Ingredient'}</DialogTitle>
            </DialogHeader>
            <IngredientForm
              key={editingIngredient?.id || 'new'}
              ingredient={editingIngredient}
              allRecipes={allRecipes}
              allIngredients={ingredients}
              customCategories={customCategories}
              onCategoryAdded={refreshData}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingIngredient(null);
              }}
              onSubRecipeSave={refreshData}
              onAddIngredientCost={handleAddIngredientCost}
              isSaving={isSaving}
              readOnlyPricing={isSalesRep}
              readOnly={isSalesRep && !!editingIngredient}
            />
            
            {editingIngredient && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Used In Recipes</h3>
                <UsedInRecipesList 
                  ingredient={editingIngredient}
                  allRecipes={allRecipes}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AnimatePresence>
          {showSpreadsheetImporter && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-8">
             <BulkIngredientSpreadsheetImporter
      allIngredients={allIngredientsCache}
      onComplete={handleSpreadsheetImportComplete}
      onCancel={() => setShowSpreadsheetImporter(false)}
/>

            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showImporter && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <BulkIngredientImporter
                existingIngredients={allIngredientsCache}
                onComplete={handleImportComplete}
                onCancel={() => setShowImporter(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showInvoiceScanner && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <InvoiceScanner onComplete={handleInvoiceScanComplete} />
            </motion.div>
          )}
        </AnimatePresence>



        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search ingredients..."
                  value={localSearchTerm}
                  onChange={(e) => {
                    setLocalSearchTerm(e.target.value);
                    debouncedSetSearchTerm(e.target.value);
                  }}
                  className="pl-10 border-gray-300 focus:border-blue-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="alcoholic-only"
                    checked={showAlcoholicOnly}
                    onCheckedChange={setShowAlcoholicOnly}
                  />
                  <Label htmlFor="alcoholic-only" className="text-sm cursor-pointer">
                    Alcoholic Only
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-500" />
                  <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
                    <SelectTrigger className="w-40 border-gray-300">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {availableCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {availableSpiritTypes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-500" />
                    <Select value={spiritTypeFilter} onValueChange={handleSpiritTypeFilterChange}>
                      <SelectTrigger className="w-40 border-gray-300">
                        <SelectValue placeholder="Filter by spirit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Spirits</SelectItem>
                        {availableSpiritTypes.map(spiritType => (
                          <SelectItem key={spiritType} value={spiritType.toLowerCase()}>
                            {spiritType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {availableSubstyles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-500" />
                    <Select value={substyleFilter} onValueChange={(value) => {
                      setSubstyleFilter(value);
                      setPage(1);
                    }}>
                      <SelectTrigger className="w-40 border-gray-300">
                        <SelectValue placeholder="Filter by substyle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Substyles</SelectItem>
                        {availableSubstyles.map(substyle => (
                          <SelectItem key={substyle} value={substyle.toLowerCase()}>
                            {substyle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <LoadingSpinner className="w-24 h-24 text-blue-600" />
              </div>
            ) : (
              <IngredientList 
                ingredients={ingredients} 
                onEdit={handleEdit} 
                onDelete={handleDelete}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                isSalesRep={isSalesRep}
              />
            )}
            {ingredients.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {searchTerm || categoryFilter !== "all" || substyleFilter !== "all" || spiritTypeFilter !== "all" ? "No ingredients match your filters" : "No ingredients yet"}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || categoryFilter !== "all" || substyleFilter !== "all" || spiritTypeFilter !== "all" ? "Try adjusting your search terms or filters" : "Add your first ingredient to get started"}
                </p>
              </div>
            )}
            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {ingredients.length} of {totalCount} ingredients
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {showAddIngredientModal && (
          <AddIngredientModal 
              ingredientName={ingredientToAdd}
              allIngredients={allIngredientsCache}
              allRecipes={allRecipes}
              onSave={handleIngredientSaved}
              onClose={() => setShowAddIngredientModal(false)}
              onAddIngredientCost={handleAddIngredientCost}
          />
      )}

      <MergeIngredientsModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        selectedIngredients={allIngredientsCache.filter(ing => selectedIds.includes(ing.id))}
        onMerge={handleMergeIngredients}
      />

      <FindDuplicatesModal
        isOpen={showFindDuplicates}
        onClose={() => setShowFindDuplicates(false)}
        ingredients={allIngredientsCache}
        onMergeSelected={handleMergeDuplicateGroups}
      />

      <BulkImageUploadModal 
        isOpen={showImageUploadModal}
        onClose={() => setShowImageUploadModal(false)}
        onComplete={handleImageUploadComplete}
        allIngredients={allIngredientsCache}
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Confirm Bulk Delete</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete {selectedIds.length} ingredient(s)? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => handleBulkDelete()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2 text-white" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function isSubRecipe(recipe) {
  return recipe.category?.toLowerCase() === 'sub-recipe' || recipe.type?.toLowerCase() === 'sub-recipe';
}

function UsedInRecipesList({ ingredient, allRecipes }) {
  const recipesUsingIngredient = React.useMemo(() => {
    if (!ingredient?.name || !allRecipes?.length) {
      return [];
    }
    const ingredientNameLower = ingredient.name.toLowerCase().trim();
    return allRecipes.filter(recipe => {
      if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
        return false;
      }
      return recipe.ingredients.some(ing => ing.ingredient_name?.toLowerCase().trim() === ingredientNameLower);
    });
  }, [ingredient, allRecipes]);

  const cocktailsUsingIngredient = recipesUsingIngredient.filter(r => !isSubRecipe(r));
  const subRecipesUsingIngredient = recipesUsingIngredient.filter(r => isSubRecipe(r));

  if (recipesUsingIngredient.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        This ingredient is not currently used in any recipes.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-h-56 overflow-y-auto p-2 bg-gray-50/70 rounded-lg">
      {cocktailsUsingIngredient.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-600 mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            Cocktails ({cocktailsUsingIngredient.length})
          </h4>
          <ul className="space-y-1 text-sm list-disc pl-5">
            {cocktailsUsingIngredient.map(recipe => (
              <li key={recipe.id}>
                <a 
                  href={createPageUrl(`EditRecipe?id=${recipe.id}`)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  {recipe.name}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {subRecipesUsingIngredient.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-600 mb-2 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-blue-600" />
            Sub-Recipes ({subRecipesUsingIngredient.length})
          </h4>
          <ul className="space-y-1 text-sm list-disc pl-5">
            {subRecipesUsingIngredient.map(recipe => (
              <li key={recipe.id}>
                <a 
                  href={createPageUrl(`EditRecipe?id=${recipe.id}`)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  {recipe.name}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}