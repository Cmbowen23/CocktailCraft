
import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Menu } from '@/api/entities';
import { Recipe } from '@/api/entities';
import { Ingredient } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, BarChart3, Building2, Package, AlertTriangle, Hash } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { formatCurrency, calculateRecipeCost } from '../components/utils/costCalculations';
import SpiritTypeChart from '../components/menus/SpiritTypeChart';
import SupplierChart from '../components/menus/SupplierChart';
import ProductBreakdownTable from '../components/menus/ProductBreakdownTable';

export default function MenuReport() {
  const [menu, setMenu] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const menuId = urlParams.get('id');

  useEffect(() => {
    if (!menuId) {
      setError("No menu ID provided.");
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const menuData = await Menu.get(menuId);
        if (!menuData) {
          throw new Error("Menu not found.");
        }
        setMenu(menuData);

        const [recipeData, ingredientsData] = await Promise.all([
          Recipe.filter({ menu_id: menuId }),
          Ingredient.list()
        ]);

        setRecipes(recipeData || []);
        setAllIngredients(ingredientsData || []);
      } catch (err) {
        console.error("Error loading menu report data:", err);
        setError("Failed to load menu report data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [menuId]);

  const { numberOfRecipes, averageCost } = React.useMemo(() => {
    if (!recipes || recipes.length === 0) {
      return { numberOfRecipes: 0, averageCost: 0 };
    }

    const recipesWithCosts = recipes.map(recipe => {
      const { totalCost } = calculateRecipeCost(recipe, allIngredients);
      return { ...recipe, totalCost };
    });

    const validRecipes = recipesWithCosts.filter(r => r.totalCost > 0);
    if (validRecipes.length === 0) {
        return { numberOfRecipes: recipes.length, averageCost: 0 };
    }

    const totalCostSum = validRecipes.reduce((sum, r) => sum + r.totalCost, 0);
    const averageCost = totalCostSum / validRecipes.length;

    return { numberOfRecipes: recipes.length, averageCost };
  }, [recipes, allIngredients]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 p-8">
        <div className="text-center bg-white p-10 rounded-lg shadow-sm border border-gray-200">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-800">Error Loading Report</h2>
            <p className="text-red-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link to={createPageUrl(`MenuDetails?id=${menu?.id}`)} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Menu
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{menu?.name} - Cost Analysis</h1>
              <p className="text-gray-600 mt-1">Detailed breakdown of menu costs and pricing</p>
            </div>
          </div>
        </div>

        {/* Cost Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="border border-gray-200 shadow-sm bg-white">
             <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Number of Recipes</CardTitle>
              <Hash className="w-4 h-4 text-gray-400"/>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {numberOfRecipes}
              </div>
              <p className="text-xs text-gray-500 mt-1">total recipes</p>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Average Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                ${formatCurrency(averageCost)}
              </div>
              <p className="text-xs text-gray-500 mt-1">per cocktail</p>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Charts */}
        <Card className="border border-gray-200 shadow-sm bg-white mb-8">
          <CardHeader>
            <CardTitle className="text-gray-900">Menu Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="spirits" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="spirits" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Spirit Analysis
                </TabsTrigger>
                <TabsTrigger value="suppliers" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Supplier Analysis
                </TabsTrigger>
              </TabsList>
              <TabsContent value="spirits" className="mt-6">
                <SpiritTypeChart recipes={recipes} allIngredients={allIngredients} />
              </TabsContent>
              <TabsContent value="suppliers" className="mt-6">
                <SupplierChart allIngredients={allIngredients} recipes={recipes} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* Product Breakdown */}
        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Product Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductBreakdownTable allIngredients={allIngredients} recipes={recipes} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
