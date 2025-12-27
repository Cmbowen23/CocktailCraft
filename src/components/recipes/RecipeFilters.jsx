import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import { cocktailCategories, ingredientCategories, difficulties, spiritStyles } from '../utils/categoryDefinitions';

export default function RecipeFilters({ filters, onFiltersChange, recipeType }) {
  const handleFilterChange = (key, value) => {
    onFiltersChange(prev => ({ ...prev, [key]: value }));
  };
  
  const getCategoryOptions = () => {
    let categories;
    if (recipeType === 'cocktail') {
      categories = cocktailCategories;
    } else if (recipeType === 'sub_recipe') {
      categories = ingredientCategories;
    } else {
      categories = [...cocktailCategories, ...ingredientCategories];
    }
    return categories.map(cat => ({ 
      value: cat, 
      label: cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) 
    }));
  };

  const categoryOptions = getCategoryOptions();
  const difficultyOptions = difficulties.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }));
  const spiritOptions = spiritStyles.map(s => ({ value: s, label: s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }));

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Filter className="w-4 h-4 text-blue-500" />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
        <Select
          value={filters.category}
          onValueChange={(value) => handleFilterChange('category', value)}
        >
          <SelectTrigger className="h-8 border-gray-300 text-xs">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categoryOptions.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {recipeType !== 'sub_recipe' && (
          <>
            <Select
              value={filters.difficulty}
              onValueChange={(value) => handleFilterChange('difficulty', value)}
            >
              <SelectTrigger className="h-8 border-gray-300 text-xs">
                <SelectValue placeholder="All Difficulties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                {difficultyOptions.map(diff => (
                  <SelectItem key={diff.value} value={diff.value}>{diff.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.base_spirit}
              onValueChange={(value) => handleFilterChange('base_spirit', value)}
            >
              <SelectTrigger className="h-8 border-gray-300 text-xs">
                <SelectValue placeholder="All Spirits" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Spirits</SelectItem>
                {spiritOptions.map(spirit => (
                  <SelectItem key={spirit.value} value={spirit.value}>{spirit.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
    </div>
  );
}