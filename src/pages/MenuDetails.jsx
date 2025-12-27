import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Menu } from "@/api/entities";
import { Recipe } from "@/api/entities";
import { RecipeVersion } from "@/api/entities";
import { Ingredient } from "@/api/entities";
import { Account } from "@/api/entities";
import { User } from "@/api/entities";

import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, AlertTriangle, Scale, Edit, FlaskConical, Users, Printer, Bot, DollarSign, ExternalLink, Trash2, Info, ArrowLeft, Search, BookOpen, Upload, CheckSquare, Eye, BarChart3, Image, Share2, ShoppingCart } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MenuPresentation } from "@/api/entities";
import MenuActionsDropdown from "@/components/menus/MenuActionsDropdown";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";

import RecipeForm from "../components/recipes/RecipeForm";
import BulkRecipeImporter from "../components/recipes/BulkRecipeImporter";
import IngredientChecklist from "../components/recipes/IngredientChecklist";
import RecipeDetailWithCosting from "../components/recipes/RecipeDetailWithCosting";
import AddIngredientModal from "../components/ingredients/AddIngredientModal";
import CustomerMenuBuilder from "../components/menus/CustomerMenuBuilder";
import ShareMenuModal from '../components/menus/ShareMenuModal';
import { isAlcoholicIngredient } from "../components/utils/categoryDefinitions";
import { findMatchingIngredient } from "../components/utils/costCalculations";
// TEMP HACK: define Package to stop runtime error if anything still references it
const Package = () => null;


// Helper function to retry base44.auth.me() with exponential backoff
const fetchUserWithRetry = async (maxAttempts = 3) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const user = await base44.auth.me();
            if (user) {
                return user;
            }
        } catch (error) {
            if (attempt === maxAttempts) {
                return null;
            }
            const delay = 200 * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
};

export default function MenuDetailsPage() {
  const [menu, setMenu] = useState(null);
  const [account, setAccount] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [allRecipes, setAllRecipes] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [variantsLookup, setVariantsLookup] = useState({});

  const [showImporter, setShowImporter] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showChecklist, setShowChecklist] = useState(false);
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [ingredientToAdd, setIngredientToAdd] = useState("");
  const [recipeViewModes, setRecipeViewModes] = useState({});

  const [scrollPosition, setScrollPosition] = useState(0);

  const [contextRecipeId, setContextRecipeId] = useState(null);
  const [originalIngredientName, setOriginalIngredientName] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const menuId = urlParams.get('id');
  const refreshFlag = urlParams.get('_refresh');
  const initialTab = urlParams.get('tab');

  const [showCustomerMenuBuilder, setShowCustomerMenuBuilder] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
      const loadUser = async () => {
          try {
              const user = await fetchUserWithRetry();
              setCurrentUser(user);
          } catch (error) {
              console.error('Error loading user:', error);
          }
      };
      loadUser();
  }, []);

  // Determine user type for navigation logic
  const isAdmin = currentUser?.role === 'admin';
  const isBuyerUser = !isAdmin && currentUser?.user_type === 'buyer_admin' && currentUser?.account_id;

  const saveScrollPosition = () => {
    try {
      setScrollPosition(window.scrollY);
    } catch (e) {
      console.warn("Could not save scroll position:", e);
    }
  };

  const restoreScrollPosition = () => {
    try {
      window.scrollTo(0, scrollPosition);
    } catch (e) {
      console.warn("Could not restore scroll position:", e);
    }
  };

  const showRecipeDetail = (recipe) => {
    if (!recipe) return null;
    const mode = recipeViewModes[recipe.id] || 'single_spec';
    return (
      <RecipeDetailWithCosting
        key={`${recipe.id}-${refreshFlag || 'initial'}`}
        recipe={recipe}
        allIngredients={allIngredients || []}
        onAddIngredientCost={handleAddIngredientCost}
        onEdit={(recipeToEdit) => {
          if (!recipeToEdit || !recipeToEdit.id) return;
          window.location.href = createPageUrl(`EditRecipe?id=${recipeToEdit.id}&from=MenuDetails?id=${menuId}`);
        }}
        onRecipeUpdate={handleRecipeUpdate}
        viewMode={mode}
        onViewModeChange={handleViewModeChange}
        showSuggestedPrice={true}
        onDelete={handleDeleteRecipe}
        hideMenuInfo={true}
        variantsLookup={variantsLookup}
      />
    );
  };

  const costValidation = useMemo(() => {
    if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
      return { allCostsSet: true, missingCosts: [] };
    }

    if (!allIngredients || !Array.isArray(allIngredients)) {
      return { allCostsSet: true, missingCosts: [] };
    }

    const exemptIngredients = [
      'water', 'filtered water', 'tap water', 'distilled water', 'spring water',
      'sparkling water', 'soda water', 'club soda', 'ice', 'coconut water'
    ];

    const missingCosts = [];

    recipes.forEach(recipe => {
      if (!recipe) return;
      const currentIngredients = recipe?.ingredients && Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      
      currentIngredients.forEach(recipeIngredient => {
          if (!recipeIngredient) return;
          const ingredientName = recipeIngredient?.ingredient_name;
          if (!ingredientName || typeof ingredientName !== 'string' || !ingredientName.trim()) return;

          const normalizedName = ingredientName.toLowerCase().trim();

          const isExempt = exemptIngredients.some(exempt =>
            normalizedName.includes(exempt.toLowerCase()) || exempt.toLowerCase().includes(normalizedName)
          );

          if (isExempt) return;

          const matchedIngredient = allIngredients.find(ing =>
            ing && ing.name && typeof ing.name === 'string' && ing.name.toLowerCase().trim() === normalizedName
          );

          if (!matchedIngredient) {
            missingCosts.push({
              recipeName: recipe?.name || 'Unknown Recipe',
              ingredientName: ingredientName,
              issue: 'not_found'
            });
          } else {
            const costPerUnit = parseFloat(matchedIngredient.cost_per_unit) || 0;
            if (costPerUnit <= 0) {
              missingCosts.push({
                recipeName: recipe?.name || 'Unknown Recipe',
                ingredientName: ingredientName,
                issue: 'no_cost'
              });
            }
          }
        });
    });

    return {
      allCostsSet: missingCosts.length === 0,
      missingCosts: missingCosts
    };
  }, [recipes, allIngredients]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const menuData = await Menu.get(menuId);
      if (!menuData) {
        setError("Menu not found.");
        setIsLoading(false);
        return;
      }
      setMenu(menuData);

      let accountData = null;
      if (menuData.account_id) {
        try {
          const allAccounts = await Account.list();
          if (Array.isArray(allAccounts)) {
            accountData = allAccounts.find(acc => acc && acc.id === menuData.account_id) || null;
          }
        } catch (accountError) {
          console.warn("Could not load accounts:", accountError);
          accountData = null;
        }
      }
      setAccount(accountData);

      const [allRecipesData, ingredientsData, variantsData, allVersionsData] = await Promise.all([
        Recipe.list().catch(err => {
          console.error("Error loading all recipes:", err);
          return [];
        }),
        Ingredient.list().catch(err => {
          console.error("Error loading ingredients:", err);
          return [];
        }),
        base44.entities.ProductVariant.list("-created_date", 5000).catch(err => {
          console.error("Error loading variants:", err);
          return [];
        }),
        RecipeVersion.list().catch(err => {
          console.error("Error loading all recipe versions:", err);
          return [];
        })
      ]);

      // Merge recipes with their active versions to get LIVE ingredients
      const versionsMap = new Map((Array.isArray(allVersionsData) ? allVersionsData : []).map(v => [v.id, v]));
      const processedRecipes = (Array.isArray(allRecipesData) ? allRecipesData : []).map(recipe => {
          const activeVersion = recipe.default_version_id ? versionsMap.get(recipe.default_version_id) : null;
          if (activeVersion) {
              return {
                  ...recipe,
                  ingredients: activeVersion.ingredients || recipe.ingredients,
                  instructions: activeVersion.instructions || recipe.instructions,
                  batch_settings: activeVersion.batch_settings || recipe.batch_settings,
                  garnish: activeVersion.garnish || recipe.garnish,
                  glassware: activeVersion.glassware || recipe.glassware,
                  menu_price: activeVersion.menu_price || recipe.menu_price,
                  version_id: activeVersion.id
              };
          }
          return recipe;
      });

      setAllRecipes(processedRecipes);
      setAllIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);

      // Build variants lookup
      const lookup = {};
      if (Array.isArray(variantsData)) {
        variantsData.forEach(variant => {
          if (variant.ingredient_id) {
            if (!lookup[variant.ingredient_id]) {
              lookup[variant.ingredient_id] = [];
            }
            lookup[variant.ingredient_id].push(variant);
          }
        });
      }
      setVariantsLookup(lookup);

      // Get recipes for this menu from customer_menu_settings.recipe_order
      const recipeOrder = menuData?.customer_menu_settings?.recipe_order || [];
      
      if (recipeOrder.length > 0) {
        // Filter and order recipes based on recipe_order
        const orderedRecipes = recipeOrder
          .map(id => processedRecipes.find(r => r.id === id))
          .filter(Boolean);
        setRecipes(orderedRecipes);
      } else {
        // Fallback to old behavior - filter by menu_id
        const recipeData = await Recipe.filter({ menu_id: menuId }).catch(err => {
          console.error("Error loading recipes:", err);
          return [];
        });
        setRecipes(Array.isArray(recipeData) ? recipeData : []);
      }

    } catch (err) {
      console.error("Error loading menu data:", err);
      setError("Failed to load menu data. Please try again.");
      setMenu(null);
      setAccount(null);
      setRecipes([]);
      setAllRecipes([]);
      setAllIngredients([]);
    } finally {
      setIsLoading(false);
    }
  }, [menuId]);

  useEffect(() => {
    if (menuId) {
      loadData();
    }
    if(initialTab === 'checklist') {
      setShowChecklist(true);
    }
  }, [menuId, refreshFlag, initialTab, loadData]);

  const refreshIngredients = async () => {
    try {
      const ingredientsData = await Ingredient.list();
      setAllIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);
    } catch (err) {
      console.error("Error refreshing ingredients:", err);
      setAllIngredients([]);
    }
  };

  const handleDeleteRecipe = async (recipeId) => {
    if (window.confirm("Are you sure you want to delete this recipe? This action cannot be undone.")) {
      try {
        await Recipe.delete(recipeId);
        setRecipes(prev => (prev || []).filter(r => r && r.id !== recipeId));
      } catch (err) {
        console.error("Error deleting recipe:", err);
        setError("Failed to delete recipe. Please try again.");
      }
    }
  };

  const handleRecipeUpdate = (updatedRecipe) => {
    if (!updatedRecipe || !updatedRecipe.id) return;
    setRecipes(prevRecipes =>
        (prevRecipes || []).map(r => r && r.id === updatedRecipe.id ? updatedRecipe : r)
    );
  };

  const handleViewModeChange = (recipeId, newMode) => {
    setRecipeViewModes(prev => ({
      ...prev,
      [recipeId]: newMode
    }));
  };

  const handleStatusChange = async (newStatus) => {
    if (!menu) return;

    if (newStatus === 'tasting' && !costValidation.allCostsSet) {
      alert('Cannot set menu to Tasting status until all ingredient costs are set. Please update missing ingredient costs first.');
      return;
    }

    try {
      await Menu.update(menu.id, { status: newStatus });
      setMenu(prevMenu => ({ ...prevMenu, status: newStatus }));
    } catch (err) {
      console.error("Failed to update menu status:", err);
      setError("Failed to update menu status.");
    }
  };

  const handleImportComplete = async () => {
    setShowImporter(false);
    
    setTimeout(async () => {
      console.log('Reloading menu data after bulk import...');
      await loadData();
      console.log('Menu data reloaded after bulk import');
    }, 2000);
    
    restoreScrollPosition();
  };

  const handleAddIngredientCost = (ingredientName, contextRecipeId = null, originalIngredientName = null) => {
    saveScrollPosition();
    setIngredientToAdd(ingredientName || "");
    setContextRecipeId(contextRecipeId);
    setOriginalIngredientName(originalIngredientName);
    setShowAddIngredientModal(true);
  };

  const handleIngredientSaved = async () => {
    setShowAddIngredientModal(false);
    setIngredientToAdd("");
    setContextRecipeId(null);
    setOriginalIngredientName(null);

    await loadData();
    restoreScrollPosition();
  };

  const handleCustomerMenuBuilderSave = async (settings) => {
    if (!menu) return;
    try {
      await Menu.update(menu.id, {
        ...menu,
        customer_menu_settings: settings
      });
      setShowCustomerMenuBuilder(false);
      loadData();
    } catch (err) {
      console.error("Error saving customer menu settings:", err);
      setError("Failed to save customer menu settings. Please try again.");
    }
  };



  const handleCreatePresentation = async () => {
    if (!menu || !account) {
        alert('Menu and account data must be loaded to create a presentation.');
        return;
    }

    const menuRecipeIds = filteredRecipes.map(recipe => recipe.id);
    
    if (menuRecipeIds.length === 0) {
        alert('This menu has no recipes. Please add recipes to the menu first.');
        return;
    }

    try {
        const presentationData = {
            name: `${menu.name} - ${account.name} Presentation`,
            account_id: menu.account_id,
            menu_id: menu.id,
            recipe_ids: menuRecipeIds,
            description: `Presentation for ${menu.name} menu at ${account.name}`
        };

        console.log('Creating presentation with data:', presentationData);
        const savedPresentation = await MenuPresentation.create(presentationData);
        console.log('Created presentation:', savedPresentation);
        
        window.location.href = createPageUrl(`Presentation?id=${savedPresentation.id}&menuId=${menu.id}`);
    } catch (error) {
        console.error('Error creating presentation:', error);
        alert('Failed to create presentation. Please try again.');
    }
  };

  const handleExportMenuPdf = async () => {
    if (!menu) return;

    try {
      const response = await base44.functions.invoke('exportCustomerMenuPdf', {
        menuId: menu.id
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${menu.name.replace(/[^a-z0-9]/gi, '_')}_menu.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error exporting menu PDF:', error);
      alert('Failed to export menu PDF. Please try again.');
    }
  };

  const handleCreateOpeningOrder = () => {
    if (!menu || !account) {
      alert("Menu and account data must be loaded to create an opening order.");
      return;
    }
    window.location.href = createPageUrl(`OpeningOrderTemplates?menuId=${menu.id}&accountId=${account.id}&from_menu=${menu.id}`);
  };

  const filteredRecipes = useMemo(() => {
    if (!recipes || !Array.isArray(recipes)) {
      return [];
    }
    return recipes.filter(recipe =>
      recipe && 
      recipe.name && 
      typeof recipe.name === 'string' &&
      recipe.name.toLowerCase().includes((searchTerm || '').toLowerCase())
    );
  }, [recipes, searchTerm]);

  // Determine back link and text based on user type
  const backLink = isBuyerUser 
    ? createPageUrl(`AccountDetails?id=${currentUser?.account_id}`)
    : createPageUrl(`AccountDetails?id=${account?.id}`);
  
  const backLinkText = isBuyerUser 
    ? 'My Menus'
    : account?.name || 'Account';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="w-full h-96 bg-white/50 rounded-xl animate-pulse border border-gray-200"></div>
        </div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="text-center py-12">
              <div className="text-red-500 mb-4 text-xl font-semibold">⚠️ {error || "Menu not found"}</div>
              <p className="text-gray-600 mb-6">There was an issue loading the menu. Please check your connection or try again.</p>
              <div className="flex gap-3 justify-center">
                <Link to={createPageUrl("Accounts")}>
                  <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Accounts
                  </Button>
                </Link>
                <Button onClick={loadData} className="bg-blue-600 hover:bg-blue-700">
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isInternalUser = currentUser && (currentUser.role === 'admin' || currentUser.user_type === 'internal');
  console.log('MenuDetails: isInternalUser =', isInternalUser, 'currentUser =', currentUser);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link to={backLink} className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to {backLinkText}
          </Link>

          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{menu?.name}</h1>
                  <p className="text-gray-600 mt-1">{menu?.description || 'Manage this menu and its recipes.'}</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Link to={createPageUrl(`CreateRecipe?menuId=${menu.id}`)}>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-5 h-5 mr-2" />
                      New Recipe
                    </Button>
                  </Link>
                  <MenuActionsDropdown
                    menu={menu}
                    account={account}
                    filteredRecipes={filteredRecipes}
                    isInternalUser={isInternalUser}
                    saveScrollPosition={saveScrollPosition}
                    setShowChecklist={setShowChecklist}
                    setShowImporter={setShowImporter}
                    setShowCustomerMenuBuilder={setShowCustomerMenuBuilder}
                    setShowShareModal={setShowShareModal}
                    handleExportMenuPdf={handleExportMenuPdf}
                    handleCreatePresentation={handleCreatePresentation}
                    handleCreateOpeningOrder={handleCreateOpeningOrder}
                  />
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {showImporter && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8"
          >
            <BulkRecipeImporter
              menuId={menuId}
              account={account}
              allIngredients={Array.isArray(allIngredients) ? allIngredients : []}
              onComplete={handleImportComplete}
              onCancel={() => {
                setShowImporter(false);
                restoreScrollPosition();
              }}
              onIngredientsUpdated={(updatedIngredients) => {
                console.log('Updating ingredients from bulk importer:', updatedIngredients.length);
                setAllIngredients(updatedIngredients);
              }}
            />
          </motion.div>
        )}

        {showChecklist && (
          <Dialog open={showChecklist} onOpenChange={setShowChecklist}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ingredient Checklist</DialogTitle>
                <DialogDescription>
                  Review the ingredients across all recipes in this menu.
                </DialogDescription>
              </DialogHeader>
              <IngredientChecklist
                isOpen={showChecklist}
                menuId={menu.id}
                recipes={filteredRecipes}
                allIngredients={allIngredients}
                onClose={() => {
                  setShowChecklist(false);
                  restoreScrollPosition();
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        {showAddIngredientModal && (
            <AddIngredientModal
                ingredientName={ingredientToAdd}
                allIngredients={allIngredients}
                allRecipes={allRecipes || []}
                onSave={handleIngredientSaved}
                onClose={() => {
                    setShowAddIngredientModal(false);
                    setIngredientToAdd("");
                    setContextRecipeId(null);
                    setOriginalIngredientName(null);
                    restoreScrollPosition();
                }}
                contextRecipeId={contextRecipeId}
                originalIngredientName={originalIngredientName}
            />
        )}

        {showCustomerMenuBuilder && (
            <Dialog open={showCustomerMenuBuilder} onOpenChange={setShowCustomerMenuBuilder}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Customize Customer Menu</DialogTitle>
                        <DialogDescription>
                            Configure how your menu appears to customers - reorder items, customize names, set pricing display, and more.
                        </DialogDescription>
                    </DialogHeader>
                    <CustomerMenuBuilder
                        menu={menu}
                        recipes={recipes}
                        account={account}
                        onUpdate={handleCustomerMenuBuilderSave}
                        onClose={() => {
                            setShowCustomerMenuBuilder(false);
                            restoreScrollPosition();
                        }}
                    />
                </DialogContent>
            </Dialog>
        )}

        <Card className="mb-8 border border-gray-200 shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search recipes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-300 focus:border-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        <div>
          <AnimatePresence>
            {Array.isArray(filteredRecipes) && filteredRecipes.length > 0 ? (
              <div className="space-y-6">
                {filteredRecipes.map((recipe) => (
                  recipe && recipe.id ? (
                    <motion.div
                      key={recipe.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="w-full"
                    >
                      <div className="w-full overflow-hidden">
                        {showRecipeDetail(recipe)}
                      </div>
                    </motion.div>
                  ) : null
                ))}
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="border border-gray-200 shadow-sm bg-white">
                  <CardContent className="text-center py-12">
                    <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      {searchTerm ? "No recipes match your search" : "No recipes in this menu yet"}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {searchTerm ? "Try adjusting your search" : "Add your first recipe to get started"}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {showShareModal && menu && (
          <ShareMenuModal
              menu={menu}
              onClose={() => setShowShareModal(false)}
          />
      )}
    </div>
  );
}