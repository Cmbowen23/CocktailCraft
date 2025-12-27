import React, { useState, useMemo } from 'react';
import { findMatchingIngredient, convertToMl } from '../utils/costCalculations';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '../utils/costCalculations';

export default function ProductBreakdownTable({ recipes, allIngredients }) {
  const [showCaseCost, setShowCaseCost] = useState(false);

  const productData = useMemo(() => {
    const usedProducts = new Map();

    recipes.forEach(recipe => {
      if (recipe.ingredients) {
        recipe.ingredients.forEach(ing => {
          const matchedIngredient = findMatchingIngredient(ing.ingredient_name, allIngredients);
          if (matchedIngredient && matchedIngredient.ingredient_type === 'purchased' && matchedIngredient.abv > 0) {
            if (!usedProducts.has(matchedIngredient.id)) {
              usedProducts.set(matchedIngredient.id, matchedIngredient);
            }
          }
        });
      }
    });

    return Array.from(usedProducts.values());
  }, [recipes, allIngredients]);

  if (productData.length === 0) {
    return <p className="text-center text-gray-500 py-4">No alcoholic products to display.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-end space-x-2 mb-4">
        <Label htmlFor="cost-mode">Bottle Cost</Label>
        <Switch
          id="cost-mode"
          checked={showCaseCost}
          onCheckedChange={setShowCaseCost}
        />
        <Label htmlFor="cost-mode">Case Cost</Label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald-200">
              <th className="text-left p-3 font-semibold text-emerald-800">Product Name</th>
              <th className="text-left p-3 font-semibold text-emerald-800 hidden sm:table-cell">Supplier</th>
              <th className="text-right p-3 font-semibold text-emerald-800">ABV</th>
              <th className="text-right p-3 font-semibold text-emerald-800">Cost</th>
              <th className="text-right p-3 font-semibold text-emerald-800">Cost/oz</th>
              <th className="text-right p-3 font-semibold text-emerald-800 hidden sm:table-cell">Bottles/Case</th>
            </tr>
          </thead>
          <tbody>
            {productData.map((product, index) => {
              const bottleSizeMl = convertToMl(product.purchase_quantity || 0, product.purchase_unit || 'ml');
              const bottleSizeOz = bottleSizeMl / 29.5735;
              let costPerOz = 0;
              const displayCost = showCaseCost ? (product.case_price || 0) : (product.purchase_price || 0);

              if (bottleSizeOz > 0) {
                if (showCaseCost && product.case_price && product.bottles_per_case) {
                  costPerOz = product.case_price / (product.bottles_per_case * bottleSizeOz);
                } else if (!showCaseCost && product.purchase_price) {
                  costPerOz = product.purchase_price / bottleSizeOz;
                }
              }

              return (
                <tr key={product.id} className={`border-b border-emerald-50 ${index % 2 === 0 ? 'bg-white/50' : 'bg-emerald-25/30'}`}>
                  <td className="p-3 font-medium text-emerald-900 break-words">{product.name}</td>
                  <td className="p-3 text-gray-600 hidden sm:table-cell">{product.supplier || '-'}</td>
                  <td className="p-3 text-right">{(product.abv || 0)}%</td>
                  <td className="p-3 text-right font-medium">${formatCurrency(displayCost)}</td>
                  <td className="p-3 text-right">${formatCurrency(costPerOz)}</td>
                  <td className="p-3 text-right hidden sm:table-cell">{product.bottles_per_case || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}