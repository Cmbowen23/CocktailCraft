import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Scale, Edit, FlaskConical, Users, Trash2, Info, AlertTriangle, ChevronDown, ChevronRight, Droplet, UserCog } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAppSettings } from "@/components/contexts/AppSettingsContext";
import { isSubRecipe } from "../utils/categoryDefinitions";
import { base44 } from "@/api/base44Client";

import BatchScalingModal from "./BatchScalingModal";
import { convertToMl, calculateRecipeCost, findMatchingIngredient, formatCurrency, formatIngredientAmount } from "../utils/costCalculations";

const exemptIngredients = [
  'water', 'filtered water', 'tap water', 'distilled water', 'spring water',
  'sparkling water', 'soda water', 'club soda', 'ice', 'coconut water'
];

const formatAmountDisplay = formatIngredientAmount;

export default function RecipeDetailWithCosting({ 
    recipe: initialRecipe, 
    allIngredients,
    allRecipes = [],
    allMenus = [],
    allAccounts = [],
    onAddIngredientCost, 
    onEdit,
    onRecipeUpdate,
    viewMode,
    onViewModeChange,
    hideFinancials = false,
    showSuggestedPrice = false,
    onDelete,
    showActionButtons = true,
    hideMenuInfo = false,
    ingredientsClickable = true, 
    onBatchPrep, 
    ozInterpretation = 'auto',
    variantsLookup = null, 
    comparisonRecipe = null,
    onPrepOpen,
}) {
    const { settings } = useAppSettings();
    const targetPourCost = settings?.target_pour_cost || 20;
    
    const [recipe, setRecipe] = useState(initialRecipe);
    const [expandedSubRecipes, setExpandedSubRecipes] = useState({});

    useEffect(() => {
        setRecipe(initialRecipe);
    }, [initialRecipe]);

    const [isBatching, setIsBatching] = useState(false);
    const [currentMenuPrice, setCurrentMenuPrice] = useState(0);
    const [isEditingPrice, setIsEditingPrice] = useState(false);

    useEffect(() => {
        setCurrentMenuPrice(recipe?.menu_price || 0);
    }, [recipe]);

    useEffect(() => {
        if (!recipe || !recipe.id || currentMenuPrice === recipe.menu_price) return;
        const handler = setTimeout(async () => {
            if (recipe && recipe.id && typeof currentMenuPrice === 'number') {
                try {
                    await base44.entities.Recipe.update(recipe.id, { menu_price: currentMenuPrice });
                    if (onRecipeUpdate) onRecipeUpdate({ ...recipe, menu_price: currentMenuPrice });
                } catch (error) {
                    console.error("Failed to update menu price:", error);
                    setCurrentMenuPrice(recipe?.menu_price || 0);
                }
            }
        }, 1000); 
        return () => clearTimeout(handler);
    }, [currentMenuPrice, recipe, onRecipeUpdate]);
    
    const saveBatchSettings = async (updatedRecipe) => {
        setRecipe(updatedRecipe); 
        if (onRecipeUpdate) onRecipeUpdate(updatedRecipe);
    };

    const toggleSubRecipe = (id) => {
        setExpandedSubRecipes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handlePriceClick = () => setIsEditingPrice(true);
    const handlePriceBlur = () => setIsEditingPrice(false);
    const handlePriceSubmit = (e) => { if (e.key === 'Enter') setIsEditingPrice(false); };
    
    const isClarifyingAgent = (ingName = '') => {
        const n = ingName.toLowerCase();
        return n.includes('milk') || n.includes('agar') || n.includes('casein') || 
               n.includes('gelatin') || n.includes('bentonite') || n.includes('isinglass');
    };
    
    const { totalCost, ingredientsWithCost: displayItems } = useMemo(() => {
        const mode = 'total';
        const result = calculateRecipeCost(recipe, allIngredients, mode, false, variantsLookup, ozInterpretation, allRecipes);
        
        const isSellable = recipe?.is_sellable_item || recipe?.is_cocktail;
        const servingSize = recipe?.serving_size_amount || recipe?.serving_size || 0;
        const yieldTotal = recipe?.yield_total_amount || recipe?.yield_amount || 0;
        
        let filteredIngredients = result.ingredientsWithCost || [];
        
        // Filter out processing agents AND clarifying agents by name for sellable items
        if (isSellable) {
            filteredIngredients = filteredIngredients.filter(ing => 
                ing.ingredient_role !== 'processing_agent' && !isClarifyingAgent(ing.ingredient_name)
            );
        }
        
        if (isSellable && servingSize > 0 && yieldTotal > 0 && filteredIngredients.length > 0) {
            const numServings = yieldTotal / servingSize;
            const scaledIngredients = filteredIngredients.map(ing => ({
                ...ing,
                amount: parseFloat((parseFloat(ing.amount) / numServings).toFixed(3)),
                cost: ing.cost ? ing.cost / numServings : 0
            }));
            const scaledCost = result.totalCost / numServings;
            return { totalCost: scaledCost, ingredientsWithCost: scaledIngredients };
        }
        
        return { totalCost: result.totalCost, ingredientsWithCost: filteredIngredients };
    }, [recipe, allIngredients, viewMode, ozInterpretation, variantsLookup, allRecipes]);

    const pourCostPercentage = (currentMenuPrice && totalCost) ? (totalCost / currentMenuPrice) * 100 : 0;
    
    const metrics = useMemo(() => {
        const isSellable = recipe?.is_sellable_item || recipe?.is_cocktail;
        const servingSize = recipe?.serving_size_amount || recipe?.serving_size || 0;
        const servingUnit = recipe?.serving_size_unit || recipe?.serving_unit || 'oz';
        
        let totalVolume = 0;
        let totalAlcoholVolume = 0;
        
        (recipe?.ingredients || []).forEach(ing => {
            const mlAmount = convertToMl(ing.amount, ing.unit, ing.ingredient_name, allIngredients);
            totalVolume += mlAmount;
            const matchedIngredient = findMatchingIngredient(ing.ingredient_name, allIngredients);
            if (matchedIngredient && matchedIngredient.abv) {
                totalAlcoholVolume += mlAmount * (matchedIngredient.abv / 100);
            }
        });
        
        const dilutedVolume = totalVolume * 1.25; 
        const abv = dilutedVolume > 0 ? (totalAlcoholVolume / dilutedVolume) * 100 : 0;
        
        // If sellable, show serving size instead of total batch yield
        if (isSellable && servingSize > 0) {
            return {
                yieldAmount: servingSize,
                yieldUnit: servingUnit,
                abv: abv,
            };
        }
        
        return {
            yieldAmount: totalVolume / 29.5735, 
            yieldUnit: 'oz',
            abv: abv,
        };
    }, [recipe?.ingredients, recipe?.is_sellable_item, recipe?.is_cocktail, recipe?.serving_size_amount, recipe?.serving_size, recipe?.serving_size_unit, recipe?.serving_unit, allIngredients]); 

    const getIngredientCostStatus = (ingredientName, ingredientId) => {
        if (!ingredientName || !ingredientName.trim()) return 'no_cost';
        const normalizedName = ingredientName.toLowerCase().trim();
        const isExempt = exemptIngredients.some(exempt => normalizedName.includes(exempt.toLowerCase()) || exempt.toLowerCase().includes(normalizedName));
        if (isExempt) return 'has_cost';
        const match = findMatchingIngredient(ingredientName, allIngredients, ingredientId);
        if (!match) return 'not_found';
        const costPerUnit = parseFloat(match.cost_per_unit) || 0;
        if (costPerUnit > 0) return 'has_cost';
        if (match.ingredient_type === 'purchased' && match.id && variantsLookup && variantsLookup[match.id]) {
             const variants = variantsLookup[match.id];
             if (variants && variants.some(v => (parseFloat(v.purchase_price) > 0 && parseFloat(v.purchase_quantity) > 0) || (parseFloat(v.case_price) > 0 && parseFloat(v.bottles_per_case) > 0))) {
                 return 'has_cost';
             }
        }
        if (match.ingredient_type === 'sub_recipe' && !match.sub_recipe_id) return 'no_cost'; 
        return 'no_cost';
    };

    const menusUsingRecipe = useMemo(() => {
        if (!recipe?.id || !allMenus?.length) return [];
        const menusWithRecipe = allMenus.filter(menu => {
            const inRecipeOrder = menu.recipe_order?.includes(recipe.id);
            const hasMenuId = recipe.menu_id === menu.id;
            return inRecipeOrder || hasMenuId;
        });
        return menusWithRecipe.map(menu => {
            const account = allAccounts.find(acc => acc.id === menu.account_id);
            return { ...menu, accountName: account?.name || 'Unknown Account' };
        });
    }, [recipe, allMenus, allAccounts]);

    const hasClarifyingAgent = recipe?.ingredients?.some(ing => isClarifyingAgent(ing.ingredient_name));
    const isClarificationRecipe = recipe?.category?.toLowerCase().includes('clarif') || hasClarifyingAgent;

    if (!recipe) {
        return <Card><CardContent className="p-6 text-center text-gray-500"><p>No recipe data to display.</p></CardContent></Card>;
    }
    
    return (
        <>
            <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm overflow-hidden w-full">
                <CardHeader className="p-4 sm:p-6 pb-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="min-w-0">
                           <div className="flex items-center gap-2">
                               <CardTitle className="text-xl sm:text-2xl font-bold text-blue-900">{recipe.name}</CardTitle>
                               {isClarificationRecipe && (
                                   <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
                                       <Droplet className="w-3 h-3 mr-1" />
                                       Clarified
                                   </Badge>
                               )}
                           </div>
                           {recipe.description && <p className="text-sm text-gray-600 mt-1">{recipe.description}</p>}
                        </div>
                        {showActionButtons && (
                            <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                                {!isSubRecipe(recipe) && (
                                    <Button variant="outline" size="sm" onClick={() => onBatchPrep ? onBatchPrep(recipe) : setIsBatching(true)}>
                                        <Users className="w-4 h-4 mr-2" />Batch Prep
                                    </Button>
                                )}
                                {isSubRecipe(recipe) && onPrepOpen && (
                                    <Button variant="outline" size="sm" onClick={() => onPrepOpen(recipe)}>
                                        <FlaskConical className="w-4 h-4 mr-2" />Batch Prep
                                    </Button>
                                )}
                                {onEdit && (
                                    <Button variant="outline" size="sm" onClick={() => onEdit(recipe)}>
                                        <Edit className="w-4 h-4 mr-2" />Edit
                                    </Button>
                                )}
                                {onDelete && (
                                    <Button variant="ghost" size="icon" onClick={() => onDelete(recipe.id)} className="text-red-500 hover:bg-red-50 hover:text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                    {!isSubRecipe(recipe) && onViewModeChange && (
                        <div className="flex items-center gap-4 mt-4">
                            <span className={`text-sm font-medium ${viewMode === 'single_spec' ? 'text-blue-900' : 'text-gray-500'}`}>Single Build</span>
                            <Switch checked={viewMode === 'service_spec'} onCheckedChange={(checked) => onViewModeChange(recipe.id, checked ? 'service_spec' : 'single_spec')} className="data-[state=checked]:bg-blue-600" />
                            <span className={`text-sm font-medium ${viewMode === 'service_spec' ? 'text-blue-900' : 'text-gray-500'}`}>Service Spec</span>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                        <div className="space-y-3 min-w-0">
                            {displayItems.map((ing, index) => {
                                const isBatchItem = !!ing.isBatch;
                                const costStatus = isBatchItem ? 'has_cost' : getIngredientCostStatus(ing.ingredient_name, ing.ingredient_id);
                                const needsCostAttention = !isBatchItem && ing.matched?.ingredient_type !== 'sub_recipe' && (costStatus === 'no_cost' || costStatus === 'not_found');
                                
                                // Look up sub-recipe data if applicable
                                const subRecipeId = ing.matched?.sub_recipe_id;
                                const subRecipe = subRecipeId ? allRecipes.find(r => r.id === subRecipeId) : null;
                                const isExpanded = expandedSubRecipes[ing.id || index];

                                return (
                                    <div key={ing.id || `${ing.ingredient_name}-${index}`} className="flex flex-col">
                                        <div className={`flex items-center justify-between gap-2 p-2 rounded-md ${isBatchItem ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50/70'} min-w-0 transition-colors`}>
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className="w-12 text-center font-bold text-blue-800 text-sm flex-shrink-0">{formatAmountDisplay(ing.amount || '0')}</div>
                                                <span className="w-8 text-gray-500 text-xs flex-shrink-0">{ing.unit?.toLowerCase() === 'ounces' ? 'oz' : (ing.unit || '')}</span>
                                                <div className="flex-1 min-w-0">
                                                    {isBatchItem ? (
                                                        <div>
                                                            <span className="font-medium text-blue-900 break-words text-sm">{ing.ingredient_name}</span>
                                                            {ing.notes && <div className="text-xs text-blue-700 break-words mt-1">{ing.notes}</div>}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1">
                                                            <span className={`font-medium text-sm ${needsCostAttention ? 'text-red-600' : 'text-blue-800'} break-words`}>
                                                                {ing.ingredient_name} {ing.prep_action && !['pour','none','add'].includes(ing.prep_action.toLowerCase()) ? `, ${ing.prep_action}` : ''}
                                                            </span>
                                                            
                                                            {/* Show Info Icon for Sub-Recipes to Expand */}
                                                            {subRecipe && (
                                                                <button onClick={() => toggleSubRecipe(ing.id || index)} className="text-blue-400 hover:text-blue-600 ml-1 focus:outline-none">
                                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                </button>
                                                            )}
                                                            
                                                            {ingredientsClickable && ing.matched?.ingredient_type === 'sub_recipe' && subRecipeId && (
                                                                <Link to={createPageUrl(`SubRecipeDetail?id=${subRecipeId}&returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>
                                                                    <FlaskConical className="w-3 h-3 text-blue-500 ml-1" />
                                                                </Link>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {!hideFinancials && (
                                                <div className={`font-bold text-xs ${needsCostAttention ? 'text-red-500' : 'text-blue-600'} flex-shrink-0`}>${formatCurrency(ing.cost || 0)}</div>
                                            )}
                                        </div>
                                        
                                        {/* EXPANDED SUB-RECIPE INGREDIENTS */}
                                        {subRecipe && (
                                            <div className={`pl-14 pr-2 py-2 text-xs text-gray-600 bg-gray-50/50 border-l-2 border-blue-100 ml-4 rounded-b-md ${isExpanded ? 'block' : 'hidden'}`}>
                                                <div className="font-semibold text-blue-800 mb-1">Batch Contents:</div>
                                                <ul className="list-disc pl-4 space-y-0.5">
                                                    {subRecipe.ingredients.map((subIng, idx) => (
                                                        <li key={idx}>
                                                            {subIng.ingredient_name} 
                                                            {subIng.amount && ` (${subIng.amount} ${subIng.unit})`}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        
                                        {/* Default Preview for Sub-Recipes (Always visible if no expansion logic used, but here we toggle) */}
                                        {subRecipe && !isExpanded && (
                                            <div className="text-[10px] text-gray-400 pl-14 pt-0.5 truncate">
                                                Includes: {subRecipe.ingredients.map(i => i.ingredient_name).slice(0,3).join(', ')}{subRecipe.ingredients.length > 3 ? '...' : ''}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-3">
                            {!hideFinancials && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-gray-50 p-2 rounded-lg text-center">
                                            <div className="text-gray-600 font-medium text-xs">Yield</div>
                                            <div className="text-lg font-bold text-gray-900 flex items-center justify-center gap-1">
                                                <span>{metrics.yieldAmount.toFixed(2)}</span>
                                                <span>{metrics.yieldUnit}</span>
                                                <Scale className="w-4 h-4 text-gray-400" />
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded-lg text-center">
                                            <div className="text-gray-600 font-medium text-xs">ABV (25% dilution)</div>
                                            <div className="text-lg font-bold text-gray-900">{metrics.abv.toFixed(1)}%</div>
                                        </div>
                                    </div>

                                    {showSuggestedPrice && (
                                        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-3 rounded-lg border border-amber-200">
                                            <div className="text-center">
                                                <div className="text-yellow-800 font-medium text-xs">Suggested Menu Price</div>
                                                <div className="text-2xl font-bold text-yellow-900 my-1 flex items-center justify-center gap-2">
                                                    <span>$</span>
                                                    {isEditingPrice ? (
                                                        <Input
                                                            type="number"
                                                            step="1.00"
                                                            value={currentMenuPrice.toString()}
                                                            onChange={(e) => setCurrentMenuPrice(parseFloat(e.target.value) || 0)}
                                                            onBlur={handlePriceBlur}
                                                            onKeyDown={handlePriceSubmit}
                                                            autoFocus
                                                            className="w-20 bg-transparent border-none focus-visible:ring-1 focus-visible:ring-amber-300 focus-visible:ring-offset-0 shadow-none text-2xl font-bold text-yellow-900 p-0 text-center rounded-md"
                                                        />
                                                    ) : (
                                                        <span onClick={handlePriceClick} className="cursor-pointer hover:bg-amber-100 px-2 py-1 rounded transition-colors text-2xl font-bold text-yellow-900" title="Click to edit price">
                                                            {currentMenuPrice.toFixed(2)}
                                                        </span>
                                                    )}
                                                    {pourCostPercentage > targetPourCost && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild><Info className="w-4 h-4 text-amber-500 cursor-help" /></TooltipTrigger>
                                                                <TooltipContent><p>Pour cost is {pourCostPercentage.toFixed(1)}% (Target: {targetPourCost}%)</p></TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                </div>
                                                <div className="text-xs text-yellow-700">{pourCostPercentage.toFixed(0)}% Pour Cost</div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                                        <div className="text-blue-800 font-medium text-xs">Total Cost</div>
                                        <div className="text-2xl font-bold text-blue-900 my-1 flex items-center justify-center"><span>${formatCurrency(totalCost)}</span></div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    {!hideFinancials && (recipe.garnish || recipe.glassware) && (
                        <div className="mt-6 pt-4 border-t border-blue-100/80">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {recipe.glassware && (<div><h4 className="font-semibold text-gray-600">Glassware</h4><p className="text-gray-800">{recipe.glassware}</p></div>)}
                                {recipe.garnish && (<div><h4 className="font-semibold text-gray-600">Garnish</h4><p className="text-gray-800">{recipe.garnish}</p></div>)}
                            </div>
                        </div>
                    )}
                    {!hideMenuInfo && (
                        <div className="mt-6 pt-4 border-t border-blue-100/80">
                            <h4 className="font-semibold text-gray-600 mb-3">On Menus</h4>
                            {menusUsingRecipe.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {menusUsingRecipe.map(menu => (
                                        <Link key={menu.id} to={createPageUrl(`MenuDetails?id=${menu.id}`)} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors">
                                            {menu.accountName} - {menu.name}
                                        </Link>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-gray-500 italic">This recipe is not currently on any menus.</p>}
                        </div>
                    )}
                </CardContent>
            </Card>
            {isBatching && <BatchScalingModal isOpen={isBatching} onClose={() => setIsBatching(false)} recipe={recipe} allIngredients={allIngredients} onSave={saveBatchSettings} />}
        </>
    );
}