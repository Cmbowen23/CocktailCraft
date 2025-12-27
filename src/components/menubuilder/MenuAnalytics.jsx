import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, TrendingUp, AlertCircle, Info } from "lucide-react";
import { formatCurrency, calculateRecipeCost } from '../utils/costCalculations';

function MenuBalanceInsights({ sections, allRecipes }) {
  const allRecipesInMenu = sections.flatMap(s => 
    s.recipes.map(id => allRecipes.find(r => r.id === id)).filter(Boolean)
  );

  // Category distribution
  const categoryCount = {};
  allRecipesInMenu.forEach(recipe => {
    const cat = recipe.category || 'uncategorized';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  // Base spirit distribution
  const spiritCount = {};
  allRecipesInMenu.forEach(recipe => {
    const spirit = recipe.base_spirit || 'none';
    spiritCount[spirit] = (spiritCount[spirit] || 0) + 1;
  });

  // Difficulty distribution
  const difficultyCount = {};
  allRecipesInMenu.forEach(recipe => {
    const diff = recipe.difficulty || 'unknown';
    difficultyCount[diff] = (difficultyCount[diff] || 0) + 1;
  });

  // Generate insights
  const insights = [];

  // Check for category dominance
  const totalRecipes = allRecipesInMenu.length;
  Object.entries(categoryCount).forEach(([category, count]) => {
    const percentage = (count / totalRecipes) * 100;
    if (percentage > 40) {
      insights.push({
        type: 'warning',
        message: `${category.replace(/_/g, ' ')} cocktails dominate the menu (${count}/${totalRecipes})`,
        suggestion: 'Consider adding more variety in cocktail styles'
      });
    }
  });

  // Check for complexity
  const hardRecipes = difficultyCount['hard'] || 0;
  if (hardRecipes > totalRecipes * 0.5) {
    insights.push({
      type: 'warning',
      message: 'Many complex recipes on the menu',
      suggestion: 'Balance with easier drinks for faster service'
    });
  }

  // Check for menu size
  if (totalRecipes < 5) {
    insights.push({
      type: 'info',
      message: 'Small menu size',
      suggestion: 'Consider adding more options for variety'
    });
  } else if (totalRecipes > 15) {
    insights.push({
      type: 'info',
      message: 'Large menu size',
      suggestion: 'Ensure all recipes can be executed consistently'
    });
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Menu Balance</h4>
      
      {/* Category breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">By Category:</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(categoryCount).map(([category, count]) => (
            <Badge key={category} variant="outline" className="text-xs">
              {category.replace(/_/g, ' ')}: {count}
            </Badge>
          ))}
        </div>
      </div>

      {/* Base spirit breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">By Base Spirit:</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(spiritCount).map(([spirit, count]) => (
            <Badge key={spirit} variant="outline" className="text-xs">
              {spirit}: {count}
            </Badge>
          ))}
        </div>
      </div>

      {/* Difficulty breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">By Difficulty:</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(difficultyCount).map(([difficulty, count]) => (
            <Badge key={difficulty} variant="outline" className="text-xs capitalize">
              {difficulty}: {count}
            </Badge>
          ))}
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2 mt-4">
          <p className="text-xs font-medium text-gray-600">Insights:</p>
          {insights.map((insight, idx) => (
            <div key={idx} className={`flex gap-2 p-2 rounded-lg text-xs ${
              insight.type === 'warning' ? 'bg-yellow-50 text-yellow-800' : 'bg-blue-50 text-blue-800'
            }`}>
              {insight.type === 'warning' ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Info className="w-4 h-4 flex-shrink-0" />
              )}
              <div>
                <p className="font-medium">{insight.message}</p>
                <p className="text-xs opacity-80 mt-0.5">{insight.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MenuAnalytics({ sections, allRecipes, allIngredients }) {
  const allRecipesInMenu = sections.flatMap(s => 
    s.recipes.map(id => allRecipes.find(r => r.id === id)).filter(Boolean)
  );

  const costs = allRecipesInMenu.map(recipe => {
    const { totalCost } = calculateRecipeCost(recipe, allIngredients);
    return totalCost;
  });

  const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
  const minCost = costs.length > 0 ? Math.min(...costs) : 0;
  const maxCost = costs.length > 0 ? Math.max(...costs) : 0;
  const suggestedPrice = avgCost > 0 ? avgCost / 0.3 : 0;

  // Calculate unique ingredients
  const uniqueIngredients = new Set();
  allRecipesInMenu.forEach(recipe => {
    recipe.ingredients?.forEach(ing => {
      uniqueIngredients.add(ing.ingredient_name.toLowerCase());
    });
  });

  // Find most used ingredients
  const ingredientFrequency = {};
  allRecipesInMenu.forEach(recipe => {
    recipe.ingredients?.forEach(ing => {
      const name = ing.ingredient_name.toLowerCase();
      ingredientFrequency[name] = (ingredientFrequency[name] || 0) + 1;
    });
  });

  const topIngredients = Object.entries(ingredientFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Card className="border border-gray-200 shadow-sm bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Menu Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cost Analysis */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Cost Analysis
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Average Cost</p>
              <p className="text-lg font-bold text-blue-700">${formatCurrency(avgCost)}</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Suggested Price</p>
              <p className="text-lg font-bold text-emerald-700">${formatCurrency(suggestedPrice)}</p>
              <p className="text-xs text-gray-500">30% cost target</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Min Cost</p>
              <p className="text-sm font-semibold text-gray-700">${formatCurrency(minCost)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Max Cost</p>
              <p className="text-sm font-semibold text-gray-700">${formatCurrency(maxCost)}</p>
            </div>
          </div>
        </div>

        {/* Ingredient Usage */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Ingredient Usage
          </h4>
          <div className="space-y-2">
            <div className="bg-purple-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Unique Ingredients</p>
              <p className="text-2xl font-bold text-purple-700">{uniqueIngredients.size}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-2">Most Used:</p>
              <div className="space-y-1">
                {topIngredients.map(([ingredient, count]) => (
                  <div key={ingredient} className="flex justify-between items-center text-xs">
                    <span className="text-gray-700 capitalize">{ingredient}</span>
                    <Badge variant="secondary" className="text-xs">{count}x</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Balance Insights */}
        <MenuBalanceInsights sections={sections} allRecipes={allRecipes} />
      </CardContent>
    </Card>
  );
}