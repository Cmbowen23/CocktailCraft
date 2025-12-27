import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { VIBRANT_CHART_COLORS as COLORS } from '../utils/chartColors';
import { findMatchingIngredient } from '../utils/costCalculations';
import { isAlcoholicIngredient } from '../utils/categoryDefinitions';

const CustomLegend = (props) => {
  const { payload } = props;

  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="max-h-[280px] overflow-y-auto text-sm text-gray-700 pl-4">
      <h3 className="font-bold text-base text-gray-800 mb-2">Spirits</h3>
      <ul className="space-y-1">
        {
          payload.map((entry, index) => (
            <li key={`item-${index}`} className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
              <span>{entry.value} {entry.payload.value} ({(entry.payload.percent * 100).toFixed(1)}%)</span>
            </li>
          ))
        }
      </ul>
    </div>
  );
};

export default function SpiritTypeChart({ recipes = [], allIngredients = [] }) {
  const spiritData = useMemo(() => {
    if (!Array.isArray(recipes) || recipes.length === 0 || !Array.isArray(allIngredients) || allIngredients.length === 0) {
        return [];
    }

    const spiritCounts = {};

    recipes.forEach(recipe => {
      const uniqueSpiritsInRecipe = new Set();
      
      (recipe.ingredients || []).forEach(ing => {
        const matchedIngredient = findMatchingIngredient(ing.ingredient_name, allIngredients);
        if (matchedIngredient && isAlcoholicIngredient(matchedIngredient)) {
          // Use spirit_type if available, otherwise fall back to the ingredient name
          const spiritType = matchedIngredient.spirit_type || matchedIngredient.name;
          uniqueSpiritsInRecipe.add(spiritType.trim());
        }
      });

      uniqueSpiritsInRecipe.forEach(spirit => {
        spiritCounts[spirit] = (spiritCounts[spirit] || 0) + 1;
      });
    });

    if (Object.keys(spiritCounts).length === 0) {
        return [];
    }

    return Object.entries(spiritCounts).map(([name, value]) => ({
      name,
      value,
    })).sort((a, b) => b.value - a.value);
  }, [recipes, allIngredients]);

  if (spiritData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No spirit data available for this menu.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={spiritData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={false}
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
          nameKey="name"
        >
          {spiritData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#ffffff" strokeWidth={2}/>
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${value} recipe(s)`, name]}
          contentStyle={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(5px)',
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          }}
          cursor={{ fill: 'rgba(209, 250, 229, 0.5)' }}
        />
        <Legend 
            content={<CustomLegend />}
            layout="vertical" 
            align="right" 
            verticalAlign="middle" 
        />
      </PieChart>
    </ResponsiveContainer>
  );
}