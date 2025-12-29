import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  MousePointer,
  X,
  ListPlus,
  Grid3X3,
  Images,
  ChevronDown,
  FlaskConical,
  BookOpen,
  Copy,
  Loader2,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CocktailLoader from "@/components/ui/CocktailLoader";
import { createPageUrl, parseRecipeData } from "@/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cocktailCategories, ingredientCategories } from '../components/utils/categoryDefinitions';
import { useLocation, Link } from 'react-router-dom';
import { useShowTags } from '../components/contexts/ShowTagsContext';
import { useAppSettings } from "@/components/contexts/AppSettingsContext";
import { findMatchingIngredient, mapAndSplitJuice } from '../components/utils/costCalculations';

import CreateRecipeFlow from "../components/recipes/CreateRecipeFlow";
import RecipeCard from "../components/recipes/RecipeCard";
import RecipeGalleryView from "../components/recipes/RecipeGalleryView";
import RecipeBookView from "../components/recipes/RecipeBookView";
import RecipeFilters from "../components/recipes/RecipeFilters";
import RecipeDetailWithCosting from "../components/recipes/RecipeDetailWithCosting";
import AddIngredientModal from "@/components/ingredients/AddIngredientModal";
import AddToMenuModal from "@/components/menus/AddToMenuModal";
import EditTagsModal from "@/components/recipes/EditTagsModal";
import PrepDrawer from "../components/prep/PrepDrawer";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [variantsLookup, setVariantsLookup] = useState({});
  const [allMenus, setAllMenus] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [displayMode, setDisplayMode] = useState("grid");
  const [recipeType, setRecipeType] = useState("cocktail");
  const [showBookView, setShowBookView] = useState(false);
  const [filters, setFilters] = useState({
    category: "all",
    difficulty: "all",
    base_spirit: "all"
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [viewingRecipe, setViewingRecipe] = useState(null);
  const [recipeViewModes, setRecipeViewModes] = useState({});
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [ingredientToAdd, setIngredientToAdd] = useState("");
  const [ingredientModalContext, setIngredientModalContext] = useState({});

  const [scrollPosition, setScrollPosition] = useState(0);

  const [selectedRecipeIds, setSelectedRecipeIds] = useState([]);
  const [isAddToMenuModalOpen, setIsAddToMenuModalOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [tastingId, setTastingId] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const { showTags, setShowTags} = useShowTags();
  const { settings } = useAppSettings();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [initialCreationMode, setInitialCreationMode] = useState(null);
  const [showPrepDrawer, setShowPrepDrawer] = useState(false);
  const [prepTask, setPrepTask] = useState(null);
  const [isDuplicateSelectionMode, setIsDuplicateSelectionMode] = useState(false);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [isDeletingRecipes, setIsDeletingRecipes] = useState(false);

  const saveScrollPosition = () => {
    setScrollPosition(window.scrollY);
  };

  const restoreScrollPosition = () => {
    window.scrollTo(0, scrollPosition);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tId = params.get('tastingId');
    const aId = params.get('accountId');
    const view = params.get('view');

    if (tId) {
      setTastingId(tId);
      setSelectionMode(true);
    }
    if (aId) {
      setAccountId(aId);
    }
    if (view === 'cocktails') {
      setRecipeType('cocktail');
    }
  }, [location.search]);

  useEffect(() => {
    loadData();
  }, []);

  const enrichRecipeWithIds = (recipe, allIngredients) => {
    if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) return recipe;
    
    const enrichedIngredients = recipe.ingredients.map(ing => {
      // Skip if already has both IDs
      if (ing.ingredient_id && ing.prep_action_id !== undefined) return ing;
      
      const { ingredient_name: baseNameFromText, prep_action: prepActionNameFromText } = mapAndSplitJuice(ing.ingredient_name || "", allIngredients);
      const matchedIng = findMatchingIngredient(baseNameFromText, allIngredients, ing.ingredient_id);
      
      if (!matchedIng) return ing;
      
      let displayName = ing.ingredient_name || matchedIng.name;
      let ingredientId = matchedIng.id;
      let prepActionId = null;
      
      if (prepActionNameFromText && matchedIng.prep_actions) {
        const matchedPrep = matchedIng.prep_actions.find(p => p.name === prepActionNameFromText);
        if (matchedPrep) {
          prepActionId = matchedPrep.id;
          displayName = `${matchedIng.name} - ${matchedPrep.name}`;
        }
      }
      
      return {
        ...ing,
        ingredient_name: displayName,
        ingredient_id: ingredientId,
        prep_action_id: prepActionId
      };
    });
    
    return {
      ...recipe,
      ingredients: enrichedIngredients
    };
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      // 1. Menus
      const menusData = await base44.entities.Menu.list().catch(err => {
        console.error("Error loading menus:", err);
        return [];
      });
      setAllMenus(menusData || []);
      
      await new Promise(r => setTimeout(r, 50));

      // 2. Ingredients (load first for enrichment)
      const ingredientsData = await base44.entities.Ingredient.list().catch(err => {
        console.error("Error loading ingredients:", err);
        return [];
      });
      setAllIngredients(ingredientsData || []);
      
      await new Promise(r => setTimeout(r, 50));

      // 3. Recipes
      const recipesData = await base44.entities.Recipe.list('-created_at').catch(err => {
        console.error("Error loading recipes:", err);
        return [];
      });

      // CRITICAL: Parse JSON fields first, then enrich recipes with ingredient_id and prep_action_id
      const parsedRecipes = (recipesData || []).map(recipe => parseRecipeData(recipe));
      const enrichedRecipes = parsedRecipes.map(recipe => enrichRecipeWithIds(recipe, ingredientsData || []));
      setRecipes(enrichedRecipes);
      
      await new Promise(r => setTimeout(r, 50));
      
      // 4. Variants
      const variantsData = await base44.entities.ProductVariant.list("-created_at", 5000).catch(err => {
        console.error("Error loading variants:", err);
        return [];
      });
      
      const lookup = {};
      (variantsData || []).forEach(variant => {
        if (variant.ingredient_id) {
          if (!lookup[variant.ingredient_id]) {
            lookup[variant.ingredient_id] = [];
          }
          lookup[variant.ingredient_id].push(variant);
        }
      });
      setVariantsLookup(lookup);
      
      await new Promise(r => setTimeout(r, 50));
      
      // 5. Accounts
      const accountsData = await base44.entities.Account.list().catch(err => {
        console.error("Error loading accounts:", err);
        return [];
      });
      setAllAccounts(accountsData || []);

    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load recipe data. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshIngredients = async () => {
    try {
      const ingredientsData = await base44.entities.Ingredient.list();
      setAllIngredients(ingredientsData || []);
    } catch (err) {
      console.error("Error loading ingredients:", err);
    }
  };

  const loadAndSelectDuplicates = async () => {
    setIsLoadingDuplicates(true);
    try {
      const query = `
        WITH duplicate_names AS (
          SELECT LOWER(TRIM(name)) as normalized_name
          FROM recipes
          GROUP BY LOWER(TRIM(name))
          HAVING COUNT(*) > 1
        )
        SELECT r.id
        FROM recipes r
        WHERE LOWER(TRIM(r.name)) IN (SELECT normalized_name FROM duplicate_names);
      `;

      const result = await base44.raw(query);
      const duplicateIds = (result || []).map(r => r.id);

      if (duplicateIds.length === 0) {
        toast.info("No duplicate recipes found");
        return;
      }

      setSelectedRecipeIds(duplicateIds);
      setSelectionMode(true);
      setIsDuplicateSelectionMode(true);
      toast.success(`Selected ${duplicateIds.length} duplicate recipes`);
    } catch (err) {
      console.error("Error loading duplicates:", err);
      toast.error("Failed to load duplicate recipes");
    } finally {
      setIsLoadingDuplicates(false);
    }
  };

  const bulkDeleteDuplicates = async () => {
    if (selectedRecipeIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedRecipeIds.length} duplicate recipes? This action cannot be undone and will be logged.`
    );

    if (!confirmed) return;

    setIsDeletingRecipes(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const recipeId of selectedRecipeIds) {
        try {
          const recipe = await base44.entities.Recipe.get(recipeId);

          await base44.raw(`
            INSERT INTO recipe_audit_log (recipe_id, action, recipe_data, performed_by, reason)
            VALUES (
              '${recipeId}',
              'deleted',
              '${JSON.stringify(recipe).replace(/'/g, "''")}',
              '${currentUser.id}',
              'Bulk duplicate deletion'
            );
          `);

          await base44.entities.Recipe.delete(recipeId);
          successCount++;
        } catch (err) {
          console.error(`Failed to delete recipe ${recipeId}:`, err);
          failCount++;
        }
      }

      await loadData();
      setSelectedRecipeIds([]);
      setSelectionMode(false);
      setIsDuplicateSelectionMode(false);

      if (failCount === 0) {
        toast.success(`Deleted ${successCount} recipes`);
      } else {
        toast.warning(`Deleted ${successCount}, failed to delete ${failCount}`);
      }
    } catch (err) {
      console.error("Error bulk deleting recipes:", err);
      toast.error("Error during bulk delete");
    } finally {
      setIsDeletingRecipes(false);
    }
  };

  const handleSaveRecipe = async (recipeData) => {
    try {
      await base44.entities.Recipe.create(recipeData);
      setShowCreateForm(false);
      loadData();
    } catch (err) {
      console.error("Error saving recipe:", err);
      setError("Failed to save recipe. Please try again.");
    }
  };

  const handleEdit = (recipe) => {
    const isAdmin = currentUser?.role === 'admin';
    const isCreator = recipe.created_by === currentUser?.email;
    if (!isAdmin && !isCreator) {
      alert("You can only edit recipes you created.");
      return;
    }
    const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = createPageUrl(`EditRecipe?id=${recipe.id}&from=${currentPath}`);
  };

  const handleDelete = async (recipeId) => {
    const recipe = recipes.find(r => r.id === recipeId);
    const isAdmin = currentUser?.role === 'admin';
    const isCreator = recipe?.created_by === currentUser?.email;
    if (!isAdmin && !isCreator) {
        alert("You can only delete recipes you created.");
        return;
    }
    try {
      await base44.entities.Recipe.delete(recipeId);
      await loadData();
    } catch (err) {
      console.error("Error deleting recipe:", err);
      setError("Failed to delete recipe. Please try again.");
    }
  };

  const handleView = (recipe) => {
    saveScrollPosition();
    setViewingRecipe(recipe);
  };

  const handleAddIngredientCost = (ingredientName, ingredientId) => {
    saveScrollPosition();
    setIngredientToAdd(ingredientName);
    setIngredientModalContext({ ingredientName, ingredientId });
    setShowAddIngredientModal(true);
  };

  const handleIngredientSaved = async () => {
    setShowAddIngredientModal(false);
    setIngredientToAdd("");
    setIngredientModalContext({});
    await refreshIngredients();
    if (!showCreateForm) {
        setTimeout(() => {
            loadData();
            restoreScrollPosition();
        }, 300);
    }
  };

  const handleRecipeUpdate = (updatedRecipe) => {
    setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));
    setViewingRecipe(updatedRecipe);
  };

  const handleViewModeChange = (recipeId, newMode) => {
    setRecipeViewModes(prev => ({ ...prev, [recipeId]: newMode }));
  };
  
  const handleRecipeTypeChange = (type) => {
    setRecipeType(type);
    setFilters({ category: "all", difficulty: "all", base_spirit: "all" });
  };

  const handleToggleSelection = (recipeId) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId]
    );
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode(prevMode => {
      if (tastingId) return true;
      if (prevMode) { setSelectedRecipeIds([]); }
      return !prevMode;
    });
  };
  
  const handleMenuUpdateComplete = () => {
    setIsAddToMenuModalOpen(false);
    setSelectedRecipeIds([]);
    if (tastingId) { window.location.href = createPageUrl('Dashboard'); }
  };

  const handleEditTags = (recipe) => { setEditingRecipe(recipe); };

  const handleTagsUpdate = (updatedRecipe) => {
    setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));
  };

  const handleRecipeImageUpdate = (updatedRecipe) => {
    setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));
  };

  const filteredRecipes = recipes.filter(recipe => {
    let typeMatches = true;
    if (recipeType === 'cocktail') {
      typeMatches = cocktailCategories.includes(recipe.category) || recipe.is_batched || recipe.is_cocktail;
    } else if (recipeType === 'sub_recipe') {
      typeMatches = ingredientCategories.includes(recipe.category) && !recipe.is_batched && !recipe.is_cocktail;
    }

    if (!typeMatches) {
      return false;
    }
    
    const searchLower = searchTerm.toLowerCase();
    const matchesName = recipe.name?.toLowerCase().includes(searchLower);
    const matchesDescription = recipe.description?.toLowerCase().includes(searchLower);
    const matchesIngredientName = recipe.ingredients?.some(recipeIng => 
      recipeIng.ingredient_name?.toLowerCase().includes(searchLower)
    );
    const matchesBrand = recipe.ingredients?.some(recipeIng => {
      const matchedIngredient = allIngredients.find(ing => 
        ing.name?.toLowerCase().trim() === recipeIng.ingredient_name?.toLowerCase().trim()
      );
      return matchedIngredient?.supplier?.toLowerCase().includes(searchLower);
    });
    
    const matchesSearch = matchesName || matchesDescription || matchesIngredientName || matchesBrand;
    const matchesCategory = filters.category === "all" || recipe.category === filters.category;
    const matchesDifficulty = (recipeType === 'sub_recipe' || filters.difficulty === "all") || recipe.difficulty === filters.difficulty;
    const matchesSpirit = (recipeType === 'sub_recipe' || filters.base_spirit === "all") || recipe.base_spirit === filters.base_spirit;

    return matchesSearch && matchesCategory && matchesDifficulty && matchesSpirit;
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="text-center py-12">
              <div className="text-red-500 mb-4">⚠️ {error}</div>
              <Button onClick={loadData} className="bg-blue-600 hover:bg-blue-700">Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-white overflow-hidden">
      <div className="w-full flex flex-col flex-1 px-3 sm:px-4 md:px-8 py-4 md:py-8 min-h-0 overflow-hidden">
        <div className="flex-shrink-0 w-full">
          <div className="flex flex-col gap-3 mb-4 md:mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Recipe Library</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your cocktail collection</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto sm:flex-shrink-0">
                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 mr-2">
                  <Button variant="ghost" size="sm" onClick={() => setDisplayMode("grid")} className={`h-7 px-2 sm:px-3 ${displayMode === "grid" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"}`} title="Grid View"><Grid3X3 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDisplayMode("gallery")} className={`h-7 px-2 sm:px-3 ${displayMode === "gallery" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"}`} title="Gallery View"><Images className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowBookView(true)} className="h-7 px-2 sm:px-3 text-gray-500 hover:text-gray-700 hover:bg-gray-200" title="Book View"><BookOpen className="w-4 h-4" /></Button>
                </div>
                {!selectionMode && !isDuplicateSelectionMode && (
                  <Button variant="outline" onClick={loadAndSelectDuplicates} size="sm" disabled={isLoadingDuplicates} className="border-gray-300 text-gray-700 hover:bg-gray-50 flex-1 sm:flex-none">
                    {isLoadingDuplicates ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 animate-spin" /> : <Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />}
                    <span className="hidden xs:inline">Duplicates</span>
                  </Button>
                )}
                <Button variant={selectionMode ? "default" : "outline"} onClick={handleToggleSelectionMode} size="sm" className={`${selectionMode ? "bg-blue-600 hover:bg-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"} flex-1 sm:flex-none`} disabled={!!tastingId}>
                  {selectionMode ? <><X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /><span>Exit</span></> : <><MousePointer className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /><span>Select</span></>}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none">
                      <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span>New</span>
                      <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setInitialCreationMode('text_import'); setShowCreateForm(true); saveScrollPosition(); window.scrollTo(0, 0); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      New Cocktail
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.location.href = createPageUrl('CreateSubRecipe')}>
                      <FlaskConical className="w-4 h-4 mr-2" />
                      New Sub-Recipe
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {selectionMode && (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-4 w-full">
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <MousePointer className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-blue-800 font-medium text-sm truncate">Selection Mode - Tap cards to select</span>
                      </div>
                      {selectedRecipeIds.length > 0 && <span className="text-blue-700 font-semibold text-sm flex-shrink-0">{selectedRecipeIds.length} selected</span>}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence onExitComplete={() => { loadData(); restoreScrollPosition(); }}>
            {showCreateForm && (
              <motion.div key="create-form" layout initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }} className="mb-4 w-full">
                <Card className="border border-gray-200 shadow-sm bg-white">
                  <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-base sm:text-lg">
                      {initialCreationMode === 'manual_cocktail' && 'Create New Cocktail'}
                      {initialCreationMode === 'manual_sub_recipe' && 'Create New Sub-Recipe'}
                      {initialCreationMode === 'text_import' && 'Create Recipes from Text'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <CreateRecipeFlow
                      allIngredients={allIngredients}
                      onSubmit={handleSaveRecipe}
                      onTextImportComplete={() => { setShowCreateForm(false); setInitialCreationMode(null); }}
                      onCancel={() => { setShowCreateForm(false); setInitialCreationMode(null); }}
                      onAddIngredientCost={handleAddIngredientCost}
                      initialCreationMode={initialCreationMode}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
          
          <Card className="mb-4 border border-gray-200 shadow-sm bg-white w-full">
            <CardContent className="p-3 space-y-3">
              <Tabs value={recipeType} onValueChange={handleRecipeTypeChange} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-8">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="cocktail" className="text-xs">Cocktails</TabsTrigger>
                  <TabsTrigger value="sub_recipe" className="text-xs">Sub-Recipes</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="space-y-3">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="Search recipes, ingredients, or brands..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 border-gray-300 focus:border-blue-500 w-full text-sm h-9" />
                </div>
                <div className="flex items-center justify-between w-full">
                  <RecipeFilters filters={filters} onFiltersChange={setFilters} recipeType={recipeType} />
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-tags" className="text-sm text-gray-700 whitespace-nowrap">Show Tags</Label>
                    <Switch id="show-tags" checked={showTags} onCheckedChange={setShowTags} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          {displayMode === 'gallery' ? (
            <RecipeGalleryView 
              recipes={filteredRecipes} 
              isLoading={isLoading} 
              onView={handleView} 
              onRecipeUpdate={handleRecipeImageUpdate} 
            />
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-20">
            <AnimatePresence>
              {isLoading ? (
                <div className="col-span-full py-12 flex flex-col items-center justify-center">
                  <CocktailLoader className="w-24 h-24 text-blue-600" />
                  <p className="mt-3 text-gray-600">Loading recipes...</p>
                </div>
              ) : filteredRecipes.length > 0 ? (
                filteredRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    allIngredients={allIngredients}
                    allRecipes={recipes}
                    variantsLookup={variantsLookup}
                    onEdit={handleEdit}
                    onView={handleView}
                    onDelete={handleDelete}
                    isSelected={selectedRecipeIds.includes(recipe.id)}
                    onToggleSelect={() => handleToggleSelection(recipe.id)}
                    selectionMode={selectionMode}
                    onEditTags={handleEditTags}
                    showTags={showTags}
                    currentUser={currentUser}
                  />
                ))
              ) : (
                <div className="col-span-full">
                  <Card className="border border-gray-200 shadow-sm bg-white">
                    <CardContent className="text-center py-8 px-4">
                      <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-base font-semibold text-gray-700 mb-2">{searchTerm || Object.values(filters).some(f => f !== "all") ? "No recipes match your criteria" : "No recipes yet"}</h3>
                      <p className="text-sm text-gray-600 mb-4">{searchTerm || Object.values(filters).some(f => f !== "all") ? "Try adjusting your search or filters" : "Start building your cocktail collection"}</p>
                      <Button onClick={() => { saveScrollPosition(); setShowCreateForm(true); window.scrollTo(0, 0); }} size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />Create Your First Recipe
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </AnimatePresence>
          </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedRecipeIds.length > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-0 left-0 right-0 z-50 p-3">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-2xl mx-auto">
              <p className="font-semibold text-gray-800 text-sm text-center sm:text-left">{selectedRecipeIds.length} selected</p>
              <div className="flex gap-2 w-full sm:w-auto">
                {!isDuplicateSelectionMode && (
                  <Button onClick={() => setIsAddToMenuModalOpen(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none">
                    <ListPlus className="w-4 h-4 mr-2" />Add to Menu
                  </Button>
                )}
                {isDuplicateSelectionMode && (
                  <Button onClick={bulkDeleteDuplicates} size="sm" variant="destructive" disabled={isDeletingRecipes} className="flex-1 sm:flex-none">
                    {isDeletingRecipes ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Delete Selected
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!viewingRecipe} onOpenChange={(open) => { if (!open) { setViewingRecipe(null); restoreScrollPosition(); }}}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{viewingRecipe?.name}</DialogTitle></DialogHeader>
            {viewingRecipe && (
              <RecipeDetailWithCosting
                recipe={viewingRecipe}
                currentUser={currentUser}
                allIngredients={allIngredients}
                allRecipes={recipes}
                allMenus={allMenus}
                allAccounts={allAccounts}
                onAddIngredientCost={handleAddIngredientCost}
                onEdit={() => { setViewingRecipe(null); handleEdit(viewingRecipe); }}
                onRecipeUpdate={handleRecipeUpdate}
                viewMode={recipeViewModes[viewingRecipe.id] || 'single_spec'}
                onViewModeChange={handleViewModeChange}
                ozInterpretation={settings?.oz_interpretation}
                onPrepOpen={(recipe) => {
                  const task = {
                    itemId: recipe.id,
                    name: recipe.name,
                    itemType: recipe.is_batched ? 'batch' : 'sub-recipe',
                    quantity: 1,
                    checklist: []
                  };
                  setPrepTask(task);
                  setShowPrepDrawer(true);
                }}
              />
            )}
        </DialogContent>
      </Dialog>

      {showAddIngredientModal && (
          <AddIngredientModal
              ingredientName={ingredientModalContext.ingredientName || ingredientToAdd}
              ingredientId={ingredientModalContext.ingredientId}
              allIngredients={allIngredients}
              allRecipes={recipes}
              customCategories={customCategories}
              onCategoryAdded={loadData}
              onSave={handleIngredientSaved}
              onClose={() => { setShowAddIngredientModal(false); setIngredientModalContext({}); restoreScrollPosition(); }}
              onAddIngredientCost={handleAddIngredientCost}
          />
      )}

      {isAddToMenuModalOpen && (
        <AddToMenuModal recipes={selectedRecipeIds} accountId={accountId} tastingId={tastingId} onSave={handleMenuUpdateComplete} onCancel={() => setIsAddToMenuModalOpen(false)} />
      )}

      {editingRecipe && (
        <EditTagsModal recipe={editingRecipe} onClose={() => setEditingRecipe(null)} onUpdate={handleTagsUpdate} />
      )}

      {showBookView && (
        <RecipeBookView recipes={filteredRecipes} onClose={() => setShowBookView(false)} />
      )}

      {showPrepDrawer && prepTask && (
        <PrepDrawer
          task={prepTask}
          onClose={() => setShowPrepDrawer(false)}
          onUpdateTask={(updatedTask) => setPrepTask(updatedTask)}
        />
      )}
    </div>
  );
}