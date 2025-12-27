import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import RecipeGalleryCard from "./RecipeGalleryCard";

export default function RecipeGalleryView({
  recipes = [],
  isLoading,
  onView,
  onRecipeUpdate
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="aspect-[3/4] bg-white rounded-xl animate-pulse border border-gray-200" />
        ))}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="col-span-full">
        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardContent className="text-center py-12 px-4">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-gray-700 mb-2">
              No recipes match your criteria
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Try adjusting your search or filters
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
      {recipes.map((recipe) => (
        <div key={recipe.id} className="h-full">
          <RecipeGalleryCard
            recipe={recipe}
            onView={onView}
            onRecipeUpdate={onRecipeUpdate}
          />
        </div>
      ))}
    </div>
  );
}