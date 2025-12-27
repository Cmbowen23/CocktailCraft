import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Eye, AlertTriangle, Tags, PackagePlus, Loader2, Wine } from "lucide-react";
import { InventoryService } from "@/components/inventory/InventoryService";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  formatCurrency,
  calculateRecipeCost,
  getIngredientInfo,
  formatIngredientAmount,
  isClarifyingAgent
} from '../utils/costCalculations';
import { isSubRecipe } from '../utils/categoryDefinitions';
import { Checkbox } from "@/components/ui/checkbox";
import PrepDrawer from "@/components/prep/PrepDrawer";

export default function RecipeCard({
  recipe,
  allIngredients,
  allRecipes = [],
  onEdit,
  onView,
  onDelete,
  isSelected,
  onToggleSelect,
  selectionMode = false,
  onEditTags,
  showTags = true,
  variantsLookup = null,
  currentUser
}) {
  const [isAddingToInventory, setIsAddingToInventory] = React.useState(false);
  const [showPrepDrawer, setShowPrepDrawer] = React.useState(false);
  const [prepTask, setPrepTask] = React.useState(null);

  const isSellable = !!(recipe?.is_sellable_item || recipe?.is_cocktail);
  const servingSize = recipe?.serving_size_amount || recipe?.serving_size || 0;
  const yieldTotal = recipe?.yield_total_amount || recipe?.yield_amount || 0;

  const { totalCost, ingredientsWithCost } = React.useMemo(() => {
    try {
      // Always use 'total' mode to get batch totals, then scale down manually
      const mode = 'total';

      return calculateRecipeCost(
        recipe,
        allIngredients,
        mode,
        false,
        variantsLookup,
        'auto',
        allRecipes
      );
    } catch (e) {
      console.error("RecipeCard calculateRecipeCost failed:", e);
      return { totalCost: 0, ingredientsWithCost: [] };
    }
  }, [recipe, allIngredients, variantsLookup, allRecipes]);

  const displayCost = isSellable && servingSize > 0 && yieldTotal > 0
    ? Number(totalCost || 0) / (yieldTotal / servingSize)
    : Number(totalCost || 0);

  const visibleIngredients = React.useMemo(() => {
    let list = Array.isArray(ingredientsWithCost) ? ingredientsWithCost.filter(Boolean) : [];
    if (!list.length) list = recipe?.ingredients || [];
    
    // Filter out clarifying agents if this is a sellable item, but keep other processing agents
    if (isSellable) {
      list = list.filter(ing => !(ing.ingredient_role === 'processing_agent' && isClarifyingAgent(ing.ingredient_name)));
    }
    
    // Calculate per-serving amounts if sellable
    if (isSellable && servingSize > 0 && yieldTotal > 0) {
      const numServings = yieldTotal / servingSize;
      return list.map(ing => ({
        ...ing,
        amount: parseFloat((parseFloat(ing.amount) / numServings).toFixed(3)),
        cost: ing.cost ? ing.cost / numServings : 0
      }));
    }
    
    return list;
  }, [ingredientsWithCost, recipe?.ingredients, isSellable, servingSize, yieldTotal]);

  const handleAddToInventory = async (e) => {
    e.stopPropagation();
    const accountId = currentUser?.account_id;
    if (!accountId) {
      toast.error("No account linked.");
      return;
    }
    setIsAddingToInventory(true);
    try {
      const count = await InventoryService.addRecipesToInventory([recipe], accountId);
      toast.success(count > 0 ? `Added ${count} new items` : "Items already in inventory");
    } catch (error) {
      toast.error("Failed to add to inventory");
    } finally {
      setIsAddingToInventory(false);
    }
  };

  const handleCardClick = (e) => {
    if (!selectionMode) return;
    if (e.target.closest('button, a, [role="checkbox"]')) return;
    onToggleSelect();
  };

  const handleOpenPrepDrawer = (e) => {
    e.stopPropagation();
    const task = {
      itemId: recipe.id,
      name: recipe.name,
      itemType: recipe.is_batched ? 'batch' : 'sub-recipe',
      quantity: 1,
      checklist: []
    };
    setPrepTask(task);
    setShowPrepDrawer(true);
  };

  return (
    <>
      <motion.div layout>
        <Card
          className={`h-full flex flex-col transition-all duration-300 backdrop-blur-sm bg-white hover:shadow-xl relative z-10 border border-gray-200 ${isSelected ? 'ring-2 ring-blue-500 shadow-xl' : 'border-0 shadow-lg'} ${selectionMode ? 'cursor-pointer' : ''}`}
          onClick={handleCardClick}
        >
          <CardHeader className="p-4 pb-2 relative">
            <div className="flex justify-between items-start">
              <div className={`flex-1 min-w-0 pr-8`}>
                <CardTitle className="text-base font-bold text-blue-900 truncate">
                  {recipe.name}
                </CardTitle>

                <CardDescription className="text-xs text-blue-700 capitalize mt-1">
                  {(() => {
                    const cat = recipe.category?.toLowerCase();
                    if (!cat) return 'Uncategorized';
                    if (cat === 'clarification') return 'Clarified';
                    if (cat === 'batch') {
                      // If it's marked as batch but is a sub-recipe, keep "Batch"
                      // Otherwise it's likely a cocktail miscategorized
                      return isSubRecipe(recipe) ? 'Batch' : 'Cocktail';
                    }
                    return recipe.category.replace(/_/g, ' ');
                  })()}

                  {isSellable && servingSize && (recipe.serving_size_unit || recipe.serving_unit) && (
                    <span className="ml-1">• {servingSize} {recipe.serving_size_unit || recipe.serving_unit} Serving</span>
                  )}
                </CardDescription>
              </div>

              <div className="flex-shrink-0 ml-2 text-right">
                <p className="font-bold text-blue-800 text-lg">
                  ${formatCurrency(displayCost)}
                </p>
                <p className="text-xs text-blue-600">
                  {isSellable ? 'Per Serving' : 'Total Cost'}
                </p>
              </div>
            </div>

            {showTags && recipe.tags && recipe.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {recipe.tags.slice(0, 3).map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5">
                    {tag}
                  </Badge>
                ))}
                {recipe.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    +{recipe.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="flex-grow flex flex-col justify-between p-4 pt-0 min-h-[140px]">
            <div className="flex-1 flex flex-col">
              <div>
                <h5 className="text-xs font-semibold text-gray-500 mb-2">Key Ingredients</h5>

                <div className="space-y-1">
                  {(visibleIngredients || []).slice(0, 4).map((ing, index) => {
                    const ingName = ing.ingredient_name || ing.name || "Ingredient";
                    const prepAction = ing.prep_action;

                    const { costStatus, displayValue } = getIngredientInfo(
                      ing, // Pass full ingredient object with ingredient_id and prep_action_id
                      allIngredients,
                      variantsLookup,
                      allRecipes
                    );

                    const needsAttention = costStatus === 'no_cost' || costStatus === 'not_found';

                    const lineCost =
                      typeof ing.cost === "number"
                        ? ing.cost
                        : (Array.isArray(ingredientsWithCost)
                            ? ingredientsWithCost.find((x) => x?.ingredient_name === ingName)?.cost
                            : 0);

                    return (
                      <div key={index} className="flex justify-between items-center text-xs">
                        <div className="text-gray-700 truncate flex-1">
                          <span className="font-medium">
                            {formatIngredientAmount(ing.amount)} {ing.unit}
                          </span>{" "}
                          {displayValue}

                          {ing.isDerivedFromBatchSubRecipe ? (
                            <span className="ml-1 text-[10px] uppercase tracking-wider text-gray-400">
                              batch
                            </span>
                          ) : null}

                          {needsAttention && (
                            <AlertTriangle className="w-3 h-3 text-yellow-500 inline ml-1" />
                          )}
                        </div>

                        <span className="text-blue-700 font-semibold ml-2 flex-shrink-0">
                          ${formatCurrency(lineCost || 0)}
                        </span>
                      </div>
                    );
                  })}

                  {(visibleIngredients || []).length > 4 && (
                    <p className="text-xs text-gray-500 mt-1">
                      + {(visibleIngredients || []).length - 4} more
                    </p>
                  )}

                  {(!visibleIngredients || visibleIngredients.length === 0) && (
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      <Wine className="w-4 h-4" /> No ingredients
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto pt-3 pb-2 text-[10px] text-gray-400 flex items-center justify-between border-t border-dashed border-gray-100">
                <span>Created by {recipe.creator_name || (currentUser && recipe.created_by === currentUser.email ? 'You' : (recipe.created_by ? recipe.created_by.split('@')[0] : 'Unknown'))}</span>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 mt-2 pt-3 border-t border-blue-100">
              <div className="flex items-center gap-2">
                {selectionMode && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={onToggleSelect}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white"
                  />
                )}

                {onEditTags && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:bg-blue-50 h-8 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTags(recipe);
                    }}
                  >
                    <Tags className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 h-8 px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(recipe);
                  }}
                >
                  <Edit className="w-3 h-3 mr-1.5" />
                  Edit
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 h-8 px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(recipe);
                  }}
                >
                  <Eye className="w-3 h-3 mr-1.5" />
                  View
                </Button>



                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400 hover:bg-red-50 hover:text-red-600 h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(recipe.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-blue-400 hover:bg-blue-50 hover:text-blue-600 h-8 w-8"
                  onClick={handleAddToInventory}
                  disabled={isAddingToInventory}
                >
                  {isAddingToInventory ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PackagePlus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {showPrepDrawer && prepTask && (
        <PrepDrawer
          task={prepTask}
          onClose={() => setShowPrepDrawer(false)}
          onUpdateTask={(updatedTask) => setPrepTask(updatedTask)}
        />
      )}
    </>
  );
}