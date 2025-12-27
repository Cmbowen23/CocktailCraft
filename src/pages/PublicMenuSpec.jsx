import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Printer, Eye, EyeOff, DollarSign, TrendingUp, Wine, Users } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import RecipeDetailWithCosting from '../components/recipes/RecipeDetailWithCosting';
import BuyerSpecSubRecipeCard from '../components/recipes/BuyerSpecSubRecipeCard';
import ProductBreakdownTable from '../components/menus/ProductBreakdownTable';
import BatchScalingModal from '../components/recipes/BatchScalingModal';
import { getPublicMenuData } from '@/api/functions';
import { calculateRecipeCost } from '../components/utils/costCalculations';
import { isSubRecipe } from '../components/utils/categoryDefinitions';
import { calculateBatchCostAndYield } from '../components/utils/batchCalculations';
import { FlaskConical } from 'lucide-react';
import { formatCurrency } from '../components/utils/costCalculations';
import { updateRecipeBatchSettings } from '../components/utils/batchSettingsService';
import { base44 } from "@/api/base44Client";

export default function PublicMenuSpec() {
    const [menuData, setMenuData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hideFinancials, setHideFinancials] = useState(false);
    const [recipeViewModes, setRecipeViewModes] = useState({});
    const [batchingRecipe, setBatchingRecipe] = useState(null);

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    useEffect(() => {
        const loadData = async () => {
            if (!token) {
                setError('No token provided in URL');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const response = await getPublicMenuData({ token });
                
                if (response.data) {
                    setMenuData(response.data);
                } else {
                    setError(response.data?.error || 'Failed to load menu data');
                }
            } catch (err) {
                console.error('Error loading public menu data:', err);
                setError('Access denied. The link may be invalid or expired.');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [token]);

    // Calculate summary metrics
    const summaryMetrics = useMemo(() => {
        if (!menuData || !menuData.recipes || !menuData.allIngredients) {
            return { totalRecipes: 0, avgCost: 0, avgProfit: 0 };
        }

        const { recipes, allIngredients } = menuData;
        const totalRecipes = recipes.length;
        
        if (totalRecipes === 0) {
            return { totalRecipes: 0, avgCost: 0, avgProfit: 0 };
        }

        let totalCost = 0;
        let totalProfit = 0;

        recipes.forEach(recipe => {
            const { totalCost: recipeCost } = calculateRecipeCost(recipe, allIngredients, 'single_spec');
            const menuPrice = recipe.menu_price || 0;
            const profit = menuPrice - recipeCost;
            
            totalCost += recipeCost;
            totalProfit += profit;
        });

        return {
            totalRecipes,
            avgCost: totalCost / totalRecipes,
            avgProfit: totalProfit / totalRecipes
        };
    }, [menuData]);

    const handlePrint = () => {
        window.print();
    };

    const handleViewModeChange = (recipeId, newMode) => {
        setRecipeViewModes(prev => ({
            ...prev,
            [recipeId]: newMode
        }));
    };

    const handleBatchModalClose = () => {
        setBatchingRecipe(null);
    };

    const handleBatchSettingsSave = async (newSettings) => {
        if (!batchingRecipe) {
            setBatchingRecipe(null);
            return;
        }

        const updatedRecipe = await updateRecipeBatchSettings({
            recipe: batchingRecipe,
            newBatchSettings: newSettings,
            allIngredients: menuData?.allIngredients || [],
            accountId: menuData?.account?.id
        });

        // Keep local menu data in sync so the UI reflects the change immediately
        if (updatedRecipe) {
            setMenuData((prevData) => {
                if (!prevData) return prevData;

                return {
                    ...prevData,
                    recipes: (prevData.recipes || []).map((r) =>
                        r.id === updatedRecipe.id ? { ...r, ...updatedRecipe } : r
                    ),
                    subRecipes: (prevData.subRecipes || []).map((r) =>
                        r.id === updatedRecipe.id ? { ...r, ...updatedRecipe } : r
                    ),
                };
            });
        }

        setBatchingRecipe(null);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cream-50 to-emerald-50/30 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
                        <p className="text-emerald-700 font-medium">Loading menu specifications...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cream-50 to-emerald-50/30 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-red-200">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                        <h2 className="text-xl font-bold text-red-700 mb-2">Access Denied</h2>
                        <p className="text-red-600 text-center">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!menuData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cream-50 to-emerald-50/30 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-gray-600">No menu data available</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { menu, account, recipes, subRecipes, allIngredients } = menuData;

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cream-50 to-emerald-50/30">
            {/* Header Section */}
            <div className="bg-white border-b border-emerald-100/50 print:border-b-2 print:border-emerald-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-emerald-900 mb-2">{menu.name}</h1>
                            {account && (
                                <p className="text-emerald-600 text-lg">{account.name}</p>
                            )}
                            {menu.description && (
                                <p className="text-gray-600 mt-2">{menu.description}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-4 print:hidden">
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                                {menu.status}
                            </Badge>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 print:hidden">
                        <div className="flex items-center gap-3 bg-white rounded-lg border border-emerald-200 px-4 py-2">
                            <div className="flex items-center gap-2">
                                {hideFinancials ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                                <Label htmlFor="training-mode" className="text-sm font-medium cursor-pointer">
                                    Training Mode
                                </Label>
                            </div>
                            <Switch
                                id="training-mode"
                                checked={hideFinancials}
                                onCheckedChange={setHideFinancials}
                            />
                        </div>
                        <Button onClick={handlePrint} variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                        </Button>
                    </div>

                    {/* Summary Cards */}
                    {!hideFinancials && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                            <Card className="border-emerald-100">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                                        <Wine className="w-4 h-4" />
                                        Total Cocktails
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-emerald-900">{summaryMetrics.totalRecipes}</div>
                                </CardContent>
                            </Card>
                            <Card className="border-emerald-100">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" />
                                        Avg Cost
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-emerald-900">${summaryMetrics.avgCost.toFixed(2)}</div>
                                </CardContent>
                            </Card>
                            <Card className="border-emerald-100">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" />
                                        Avg Profit
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-emerald-900">${summaryMetrics.avgProfit.toFixed(2)}</div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Cocktails Section */}
                {recipes && recipes.length > 0 && (
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold text-emerald-900 mb-6">Cocktails</h2>
                        <div className="space-y-6">
                            {recipes.map((recipe) => (
                                <React.Fragment key={recipe.id}>
                                    <RecipeDetailWithCosting
                                        recipe={recipe}
                                    allIngredients={allIngredients}
                                    allRecipes={recipes}
                                    onAddIngredientCost={() => {}} // No-op for public page
                                    onEdit={null} // Hide edit button
                                    onRecipeUpdate={() => {}} // No-op for public page
                                    viewMode={recipeViewModes[recipe.id] || 'single_spec'}
                                    onViewModeChange={handleViewModeChange}
                                    hideFinancials={hideFinancials}
                                    showSuggestedPrice={!hideFinancials}
                                    showActionButtons={true}
                                    onDelete={null} // Hide delete button
                                    hideMenuInfo={true}
                                    ingredientsClickable={false}
                                    onBatchPrep={(recipe) => {
                                        // Ensure we have the latest recipe data if possible, or just use what we have.
                                        // Ideally we should fetch the latest, but for now we use the one in state.
                                        setBatchingRecipe(recipe);
                                    }} 
                                />
                                {recipe.batch_settings && (
                                    <div className="mt-2 mb-6 px-1">
                                        {(() => {
                                            const batchData = calculateBatchCostAndYield({ recipe, allIngredients });
                                            if (!batchData) return null;
                                            return (
                                                <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 px-3 py-2 rounded-md border border-purple-100 w-fit">
                                                    <FlaskConical className="w-4 h-4" />
                                                    <span className="font-medium">Batch Prep:</span>
                                                    <span>
                                                        {batchData.containerType === 'Custom' ? 'Custom Container' : batchData.containerType}
                                                        {batchData.containerCount > 1 ? ` (x${batchData.containerCount})` : ''}
                                                    </span>
                                                    <span className="text-purple-400">•</span>
                                                    <span>~{Math.round(batchData.servings)} serves</span>
                                                    <span className="text-purple-400">•</span>
                                                    <span>${formatCurrency(batchData.costPerContainer)} / batch</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </React.Fragment>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sub-Recipes Section */}
                {subRecipes && subRecipes.length > 0 && (
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold text-emerald-900 mb-6">Sub-Recipes & Preparations</h2>
                        <div className="space-y-6">
                            {subRecipes.map((subRecipe) => (
                                <BuyerSpecSubRecipeCard
                                    key={subRecipe.id}
                                    recipe={subRecipe}
                                    allIngredients={allIngredients}
                                    hideFinancials={hideFinancials}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Product Breakdown Table */}
                {!hideFinancials && (
                    <div className="mt-12">
                        <ProductBreakdownTable
                            recipes={recipes}
                            allIngredients={allIngredients}
                        />
                    </div>
                )}
            </div>

            {/* Batch Scaling Modal */}
            {batchingRecipe && (
                <BatchScalingModal
                    isOpen={!!batchingRecipe}
                    onClose={handleBatchModalClose}
                    recipe={batchingRecipe}
                    allIngredients={allIngredients}
                    onSave={handleBatchSettingsSave}
                />
            )}
        </div>
    );
}