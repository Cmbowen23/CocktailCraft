import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, calculateRecipeCost } from '../utils/costCalculations';

const themeConfig = {
  summer: {
    'beach_bar': {
      bg: 'bg-gradient-to-br from-sky-100 via-blue-50 to-amber-50',
      headerBg: 'bg-gradient-to-r from-sky-600 to-blue-500',
      cardBg: 'bg-white/80 backdrop-blur-sm',
      textColor: 'text-gray-900',
      accentColor: 'text-sky-600',
      borderColor: 'border-sky-200'
    },
    'tiki_bar': {
      bg: 'bg-gradient-to-br from-orange-100 via-yellow-50 to-green-50',
      headerBg: 'bg-gradient-to-r from-orange-600 to-amber-500',
      cardBg: 'bg-white/90 backdrop-blur-sm',
      textColor: 'text-gray-900',
      accentColor: 'text-orange-600',
      borderColor: 'border-orange-200'
    },
    'rooftop': {
      bg: 'bg-gradient-to-br from-purple-100 via-pink-50 to-orange-50',
      headerBg: 'bg-gradient-to-r from-purple-600 to-pink-500',
      cardBg: 'bg-white/85 backdrop-blur-sm',
      textColor: 'text-gray-900',
      accentColor: 'text-purple-600',
      borderColor: 'border-purple-200'
    },
    'default': {
      bg: 'bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50',
      headerBg: 'bg-gradient-to-r from-amber-600 to-orange-500',
      cardBg: 'bg-white/80 backdrop-blur-sm',
      textColor: 'text-gray-900',
      accentColor: 'text-amber-600',
      borderColor: 'border-amber-200'
    }
  },
  winter: {
    'speakeasy': {
      bg: 'bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900',
      headerBg: 'bg-gradient-to-r from-gray-900 to-gray-800',
      cardBg: 'bg-gray-800/90 backdrop-blur-sm',
      textColor: 'text-gray-100',
      accentColor: 'text-amber-400',
      borderColor: 'border-gray-700'
    },
    'hotel_bar': {
      bg: 'bg-gradient-to-br from-slate-100 via-gray-50 to-blue-50',
      headerBg: 'bg-gradient-to-r from-slate-700 to-gray-600',
      cardBg: 'bg-white/90 backdrop-blur-sm',
      textColor: 'text-gray-900',
      accentColor: 'text-slate-600',
      borderColor: 'border-slate-200'
    },
    'default': {
      bg: 'bg-gradient-to-br from-blue-50 via-slate-50 to-gray-100',
      headerBg: 'bg-gradient-to-r from-blue-800 to-slate-700',
      cardBg: 'bg-white/85 backdrop-blur-sm',
      textColor: 'text-gray-900',
      accentColor: 'text-blue-600',
      borderColor: 'border-blue-200'
    }
  },
  spring: {
    'craft_cocktail': {
      bg: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50',
      headerBg: 'bg-gradient-to-r from-green-600 to-emerald-500',
      cardBg: 'bg-white/85 backdrop-blur-sm',
      textColor: 'text-gray-900',
      accentColor: 'text-green-600',
      borderColor: 'border-green-200'
    },
    'default': {
      bg: 'bg-gradient-to-br from-pink-50 via-rose-50 to-green-50',
      headerBg: 'bg-gradient-to-r from-pink-600 to-rose-500',
      cardBg: 'bg-white/80 backdrop-blur-sm',
      textColor: 'text-gray-900',
      accentColor: 'text-pink-600',
      borderColor: 'border-pink-200'
    }
  },
  fall: {
    'steakhouse': {
      bg: 'bg-gradient-to-br from-amber-100 via-orange-50 to-red-50',
      headerBg: 'bg-gradient-to-r from-amber-800 to-red-700',
      cardBg: 'bg-white/85 backdrop-blur-sm',
      textColor: 'text-gray-900',
      accentColor: 'text-amber-700',
      borderColor: 'border-amber-300'
    },
    'default': {
      bg: 'bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-50',
      headerBg: 'bg-gradient-to-r from-orange-700 to-amber-600',
      cardBg: 'bg-white/80 backdrop-blur-sm',
      textColor: 'text-gray-900',
      accentColor: 'text-orange-600',
      borderColor: 'border-orange-200'
    }
  },
  'all': {
    'default': {
      bg: 'bg-gradient-to-br from-gray-50 to-white',
      headerBg: 'bg-gradient-to-r from-blue-600 to-blue-700',
      cardBg: 'bg-white',
      textColor: 'text-gray-900',
      accentColor: 'text-blue-600',
      borderColor: 'border-gray-200'
    }
  }
};

function getTheme(season, barType) {
  const seasonKey = season && season !== 'all' ? season.toLowerCase() : 'all';
  const barTypeKey = barType && barType !== 'all' ? barType.toLowerCase() : 'default';
  
  const seasonThemes = themeConfig[seasonKey] || themeConfig.all;
  return seasonThemes[barTypeKey] || seasonThemes.default || themeConfig.all.default;
}

export default function CustomerMenuDisplay({ sections, allRecipes, allIngredients, season = 'all', barType = 'all' }) {
  const theme = getTheme(season, barType);

  return (
    <div className={`min-h-screen ${theme.bg} p-8`}>
      <div className="max-w-4xl mx-auto">
        <div className={`${theme.headerBg} rounded-xl shadow-xl p-8 mb-8 text-white`}>
          <h1 className="text-4xl font-bold text-center mb-2">Cocktail Menu</h1>
          {season && season !== 'all' && (
            <p className="text-center text-lg opacity-90 capitalize">{season} Collection</p>
          )}
        </div>

        <div className="space-y-8">
          {sections.map((section) => {
            const sectionRecipes = section.recipes
              .map(id => allRecipes.find(r => r.id === id))
              .filter(Boolean);

            if (sectionRecipes.length === 0) return null;

            return (
              <div key={section.id} className="space-y-4">
                {sections.length > 1 && (
                  <h2 className={`text-2xl font-bold ${theme.accentColor} border-b-2 ${theme.borderColor} pb-2`}>
                    {section.name}
                  </h2>
                )}
                
                <div className="grid gap-4">
                  {sectionRecipes.map((recipe) => {
                    const { totalCost } = calculateRecipeCost(recipe, allIngredients);
                    
                    return (
                      <Card key={recipe.id} className={`${theme.cardBg} ${theme.borderColor} border-2 shadow-lg`}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className={`text-xl font-bold ${theme.textColor}`}>{recipe.name}</h3>
                          </div>
                          
                          {recipe.description && (
                            <p className={`${theme.textColor} opacity-80 mb-3 text-sm`}>
                              {recipe.description}
                            </p>
                          )}
                          
                          <div className="space-y-2">
                            <h4 className={`text-sm font-semibold ${theme.accentColor}`}>Ingredients:</h4>
                            <div className="grid grid-cols-1 gap-1">
                              {(recipe.ingredients || []).map((ing, idx) => (
                                <p key={idx} className={`text-sm ${theme.textColor} opacity-75`}>
                                  • {ing.amount} {ing.unit} {ing.ingredient_name}
                                  {ing.prep_action && ` (${ing.prep_action})`}
                                </p>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t flex justify-between items-center" style={{ borderColor: 'currentColor', opacity: 0.2 }}>
                            {recipe.garnish && (
                              <p className={`text-xs ${theme.textColor} opacity-60`}>
                                Garnish: {recipe.garnish}
                              </p>
                            )}
                            {recipe.glassware && (
                              <p className={`text-xs ${theme.textColor} opacity-60`}>
                                {recipe.glassware}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}