import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CustomerMenuPreview() {
  const [menu, setMenu] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [account, setAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderedRecipes, setOrderedRecipes] = useState([]);
  const [lastSettings, setLastSettings] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const location = useLocation();

  const formatIngredientForDisplay = (ingredient) => {
    const name = ingredient.ingredient_name || '';
    const prep = ingredient.prep_action || '';
    
    const citrusFruits = [
      'lemon', 'lime', 'orange', 'grapefruit', 'blood orange', 
      'meyer lemon', 'key lime', 'mandarin', 'tangerine'
    ];
    
    const isCitrus = citrusFruits.some(citrus => 
      name.toLowerCase().includes(citrus)
    );
    
    const isJuicePrep = prep.toLowerCase() === 'juice';
    
    if (isCitrus && isJuicePrep) {
      return name;
    }
    
    if (prep && prep.toLowerCase() !== 'pour' && prep.toLowerCase() !== 'none' && prep.toLowerCase() !== 'add' && prep.toLowerCase() !== 'mix') {
      return `${name} (${prep})`;
    }
    
    return name;
  };

  useEffect(() => {
    const fetchMenuData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(location.search);
        const menuId = params.get('id');
        if (!menuId) {
          setError("No menu ID provided.");
          setIsLoading(false);
          return;
        }

        const [menuData, allRecipesData, accountsData] = await Promise.all([
          base44.entities.Menu.get(menuId),
          base44.entities.Recipe.list(),
          base44.entities.Account.list()
        ]);

        if (!menuData) {
          setError("Menu not found.");
          setIsLoading(false);
          return;
        }
        setMenu(menuData);
        
        if (menuData.account_id) {
          const foundAccount = accountsData.find(acc => acc.id === menuData.account_id);
          setAccount(foundAccount || null);
        }

        const recipeOrder = menuData?.customer_menu_settings?.recipe_order || [];
        
        if (recipeOrder.length > 0) {
          const orderedRecipesList = recipeOrder
            .map(id => allRecipesData.find(r => r.id === id))
            .filter(Boolean);
          setRecipes(orderedRecipesList);
        } else {
          const recipeData = await base44.entities.Recipe.filter({ menu_id: menuId });
          setRecipes(recipeData || []);
        }

      } catch (err) {
        console.error("Error fetching menu preview:", err);
        setError("Could not load the menu preview. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMenuData();
  }, [location.search]);

  useEffect(() => {
    if (!menu || !recipes) {
      return;
    }

    const storageKey = `menu-preview-settings-${menu.id}`;

    const updateOrderedRecipes = (settingsOverride) => {
      const effectiveSettings = settingsOverride || menu.customer_menu_settings || {};
      
      const excludedIds = new Set(effectiveSettings.excluded_recipes || []);
      
      let finalRecipeList;
      if (effectiveSettings.recipe_order && effectiveSettings.recipe_order.length > 0) {
          const recipeMap = new Map(recipes.map(r => [r.id, r]));
          finalRecipeList = effectiveSettings.recipe_order
              .map(id => recipeMap.get(id))
              .filter(Boolean)
              .filter(r => !excludedIds.has(r.id));
      } else {
          finalRecipeList = recipes.filter(r => !excludedIds.has(r.id));
      }
      
      setOrderedRecipes(finalRecipeList);
      setLastSettings(effectiveSettings);
    };

    let currentSettings = menu.customer_menu_settings || {};
    const storedSettingsRaw = localStorage.getItem(storageKey);
    if (storedSettingsRaw) {
        try {
            const storedSettings = JSON.parse(storedSettingsRaw);
            currentSettings = storedSettings;
        } catch (e) {
            console.error("Failed to parse settings from localStorage", e);
        }
    }
    updateOrderedRecipes(currentSettings);

    const handleStorageChange = (event) => {
      if (event.key === storageKey) {
        if (event.newValue) {
          try {
            const newSettings = JSON.parse(event.newValue);
            updateOrderedRecipes(newSettings);
          } catch (e) {
            console.error("Failed to parse new settings from storage event", e);
          }
        } else {
          updateOrderedRecipes(menu.customer_menu_settings);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [menu, recipes]);

  const handleExportPdf = async () => {
    if (!menu) return;
    
    setIsExporting(true);
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
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-stone-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-stone-100 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Menu</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const currentSettings = lastSettings || {};
  const displayTitle = currentSettings.title || account?.name || 'Menu';
  const displaySubtitle = currentSettings.subtitle || menu?.name || '';
  const footerText = currentSettings.footer_text || '';
  const recipeAlignmentClass = currentSettings.text_alignment === 'center' ? 'text-center' : 'text-left';
  const recipeTitleContainerClass = currentSettings.text_alignment === 'center' ? 'justify-center' : 'justify-between';

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;500&display=swap');
          
          .menu-title {
            font-family: 'Playfair Display', serif;
          }
          
          .menu-body {
            font-family: 'Lato', sans-serif;
          }
        `}
      </style>
      
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-stone-100 p-8">
        <div className="max-w-5xl mx-auto mb-6 flex justify-end">
          <Button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export to PDF
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center">
          <div 
            className="bg-white shadow-2xl overflow-hidden"
            style={{
              width: '5in',
              minHeight: '7in',
              maxWidth: '100%'
            }}
          >
            {/* Header - Always centered */}
            <div className="px-8 pt-10 pb-6 text-center">
              <h1 className="menu-title text-4xl font-bold mb-2 text-slate-800">{displayTitle}</h1>
              {displaySubtitle && (
                <h2 className="menu-body text-lg font-light opacity-90 text-slate-600">{displaySubtitle}</h2>
              )}
            </div>

            {/* Unified Price Banner - Always centered */}
            {currentSettings.show_prices && currentSettings.use_unified_price && (
              <div className="px-8 pb-6 text-center">
                <div className="menu-body text-lg font-medium text-slate-700">
                  All Cocktails ${currentSettings.unified_price_amount.toFixed(0)}
                </div>
              </div>
            )}

            {/* Menu Items - Dynamic alignment */}
            <div className="px-8 pb-10">
              <div className="space-y-6">
                {orderedRecipes.map((recipe) => {
                  const customName = currentSettings.custom_recipe_names?.[recipe.id];
                  const customDescription = currentSettings.custom_descriptions?.[recipe.id];
                  const displayName = customName || recipe.name;
                  
                  return (
                    <div key={recipe.id} className={`border-b border-slate-100 last:border-b-0 pb-5 last:pb-0 ${recipeAlignmentClass}`}>
                      <div className={`flex ${recipeTitleContainerClass} items-start mb-2`}>
                        <h3 className="menu-title text-xl font-semibold text-slate-800">
                          {displayName}
                        </h3>
                        {currentSettings.show_prices && !currentSettings.use_unified_price && (
                          <span className="menu-body text-lg font-medium text-slate-700 ml-4 flex-shrink-0">
                            ${(recipe.menu_price || 0).toFixed(0)}
                          </span>
                        )}
                      </div>
                      
                      {currentSettings.show_descriptions && (
                        <div className="menu-body text-sm text-slate-600 leading-relaxed">
                          {customDescription || (recipe.ingredients
                            ? recipe.ingredients.map(formatIngredientForDisplay).join(' \u2022 ')
                            : '')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            {footerText && (
              <div className="px-8 pb-6 text-center border-t border-slate-100 pt-6">
                <p className="menu-body text-sm text-slate-600 whitespace-pre-line">{footerText}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}