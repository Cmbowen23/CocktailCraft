import React, { useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, ImageOff, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Recipe } from "@/api/entities";

export default function RecipeGalleryCard({
  recipe,
  onView,
  onRecipeUpdate
}) {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleGenerateImage = async (e) => {
    e.stopPropagation(); // Prevent triggering onView
    setIsGeneratingImage(true);
    try {
      let prompt = recipe.custom_image_prompt || 
                   `A stunning, professional cocktail photograph of a '${recipe.name}' with a sophisticated background.`;
      
      if (recipe.description) prompt += ` It features: ${recipe.description}.`;
      if (recipe.base_spirit) prompt += ` Base spirit: ${recipe.base_spirit}.`;
      if (recipe.garnish) prompt += ` Garnished with: ${recipe.garnish}.`;
      if (recipe.glassware) prompt += ` Served in a ${recipe.glassware}.`;
      prompt += ` Style: ${recipe.category}.`;
      prompt += ` Photorealistic, high detail, studio lighting.`;

      const response = await base44.integrations.Core.GenerateImage({ prompt });
      
      if (response.url) {
        const updatedRecipe = await Recipe.update(recipe.id, {
          image_url: response.url,
          image_generation_prompt: prompt // Store the prompt used for generation
        });
        toast.success("Recipe image generated successfully!");
        if (onRecipeUpdate) {
          onRecipeUpdate(updatedRecipe);
        }
      } else {
        toast.error("Failed to generate image. Please try again.");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Error generating image. " + (error.message || "Please try again."));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <Card className="group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-blue-500 bg-white h-full flex flex-col">
      <div className="relative w-full aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <ImageOff className="w-12 h-12 mb-2" />
            <span className="text-xs font-medium">No Image</span>
          </div>
        )}
        
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleGenerateImage}
            disabled={isGeneratingImage}
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-700 hover:text-blue-600 shadow-md"
            title="Generate New Image"
          >
            {isGeneratingImage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <Button
            onClick={() => onView(recipe)}
            className="w-full bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-semibold shadow-sm transition-all duration-300 transform translate-y-4 group-hover:translate-y-0"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Recipe
          </Button>
        </div>
      </div>
      <CardHeader className="p-4 flex-1">
        <div className="flex justify-between items-start gap-2 mb-1">
          <CardTitle className="text-lg font-bold text-gray-900 leading-tight">
            {recipe.name}
          </CardTitle>
          {recipe.abv > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
              {recipe.abv}%
            </span>
          )}
        </div>
        <CardDescription className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
          {recipe.description || <span className="italic text-gray-400">No description provided.</span>}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}