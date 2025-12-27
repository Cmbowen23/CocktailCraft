import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, AlertTriangle, RefreshCw, Upload } from "lucide-react";
import { calculateRecipeCost, formatCurrency } from "../utils/costCalculations";
import { Recipe } from '@/api/entities';

export default function PresentationCard({ recipe, account, allIngredients, isGenerating, onRegenerate, onUpload }) {
  const [customPrompt, setCustomPrompt] = useState(recipe?.custom_image_prompt || '');
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const { totalCost } = calculateRecipeCost(recipe, allIngredients, 'single_spec');

  const handleCustomGenerate = async () => {
    if (!customPrompt.trim()) return;
    // Update the recipe with the custom prompt first
    await Recipe.update(recipe.id, { custom_image_prompt: customPrompt });
    onRegenerate(recipe.id, true, customPrompt);
  };

  const handleRegenerate = () => {
    onRegenerate(recipe.id, !!customPrompt, customPrompt);
  };
  
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadError(null);
    try {
        await onUpload(recipe, file);
    } catch (error) {
        console.error("Upload failed in card:", error);
        setUploadError("Image upload failed. Please try again.");
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full max-w-5xl mx-auto border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden rounded-2xl">
      <div className="grid md:grid-cols-2">
        {/* Left side - Recipe Details */}
        <div className="p-8 flex flex-col">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-3xl font-bold text-gray-900 leading-tight mb-2">
              {recipe.name}
            </CardTitle>
            {recipe.description && (
              <p className="text-gray-600 text-base leading-relaxed">{recipe.description}</p>
            )}
          </CardHeader>

          <CardContent className="p-0 space-y-4 flex-grow">
            <div className="space-y-1">
              {recipe.ingredients?.map((ingredient, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <span className="text-gray-700">
                    {ingredient.prep_action && ingredient.prep_action !== 'none' && ingredient.prep_action !== 'pour' 
                      ? `${ingredient.ingredient_name}, ${ingredient.prep_action}` 
                      : ingredient.ingredient_name}
                  </span>
                  <span className="text-gray-800 font-medium">
                    {ingredient.amount} {ingredient.unit}
                  </span>
                </div>
              ))}
            </div>

            {recipe.instructions && (
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Instructions</h4>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">
                  {recipe.instructions.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </CardContent>

          <div className="mt-8 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center text-xl font-bold">
              <span className="text-gray-600">Total Cost:</span>
              <span className="text-emerald-700">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>

        {/* Right side - Image */}
        <div className="bg-gray-100 p-4 flex flex-col items-center justify-between">
          <div className="w-full aspect-square bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center relative">
            {isGenerating && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
                <p className="text-white mt-2">Generating Image...</p>
              </div>
            )}
            {uploadError && !isGenerating && (
              <div className="absolute inset-0 bg-red-50 flex flex-col items-center justify-center text-center p-4">
                <AlertTriangle className="w-8 h-8 text-red-500 mb-2"/>
                <p className="text-red-700 font-medium">{uploadError}</p>
              </div>
            )}
            {recipe.image_url && (
              <img src={recipe.image_url} alt={`Cocktail: ${recipe.name}`} className="w-full h-full object-cover" />
            )}
            {!isGenerating && (
              <Button onClick={handleRegenerate} size="icon" variant="secondary" className="absolute top-3 right-3 z-20" title="Regenerate Image">
                <RefreshCw className="w-5 h-5" />
              </Button>
            )}
          </div>
          
          <div className="w-full space-y-3 mt-4">
            <div className="space-y-1">
                <Input 
                    type="text"
                    placeholder="Add custom details to override global settings..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="bg-white"
                />
                <Button onClick={handleCustomGenerate} disabled={isGenerating || !customPrompt.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <Sparkles className="w-4 h-4 mr-2"/>
                    Generate with Custom Prompt
                </Button>
            </div>

            <Button onClick={triggerFileUpload} variant="outline" className="w-full" disabled={isGenerating}>
                <Upload className="w-4 h-4 mr-2" />
                Upload New Image
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/png, image/jpeg, image/webp" />
          </div>
        </div>
      </div>
    </Card>
  );
}