import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ImageOff, ArrowLeft, BookOpen, Sparkles, GalleryHorizontal, RefreshCw, Download } from "lucide-react";
import PresentationCard from '../components/presentation/PresentationCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { base44 } from '@/api/base44Client';

// Define bar setting options with their prompt descriptions
const barSettings = {
  classic_speakeasy: {
    name: "Classic Speakeasy",
    description: "set within a classic speakeasy bar environment with dark wood paneling, warm amber lighting, vintage leather details, and rich mahogany surfaces"
  },
  modern_minimalist: {
    name: "Modern Minimalist Bar",
    description: "set in a modern minimalist bar with clean lines, polished concrete surfaces, subtle steel accents, and contemporary lighting"
  },
  tropical_beach: {
    name: "Tropical Beach Bar",
    description: "set at a tropical beach bar with natural bamboo elements, lush green foliage, warm sand textures, and bright coastal lighting"
  },
  rooftop_lounge: {
    name: "Rooftop Lounge",
    description: "set on an elegant rooftop bar with city skyline views, sleek modern furniture, open air ambiance, and dramatic sunset lighting"
  },
  industrial_loft: {
    name: "Industrial Loft Bar",
    description: "set in an industrial loft bar with exposed brick walls, metal fixtures, Edison bulb lighting, and rustic-chic elements"
  },
  cozy_pub: {
    name: "Cozy Neighborhood Pub",
    description: "set in a cozy neighborhood pub with warm wood furnishing, soft intimate lighting, familiar decor, and welcoming atmosphere"
  },
  luxury_lounge: {
    name: "High-End Cocktail Lounge",
    description: "set in a luxurious cocktail lounge with velvet upholstery, polished brass details, art deco elements, and sophisticated ambient lighting"
  },
  garden_terrace: {
    name: "Garden Terrace",
    description: "set on a beautiful garden terrace with natural stone surfaces, potted herbs and flowers, dappled sunlight, and organic textures"
  }
};

// Define image style options
const imageStyles = {
  photorealistic: {
    name: "Photorealistic",
    description: "photorealistic style"
  },
  cinematic: {
    name: "Cinematic",
    description: "cinematic film still style with dramatic lighting and shallow depth of field"
  },
  studio_shot: {
    name: "Studio Shot",
    description: "professional studio shot style with a clean, controlled lighting setup and elegant backdrop"
  },
  natural_light: {
    name: "Natural Light",
    description: "natural light photography style, bright and airy, with soft shadows and authentic ambiance"
  }
};

export default function PresentationPage() {
  const [presentation, setPresentation] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [account, setAccount] = useState(null);
  const [allIngredients, setAllIngredients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [selectedGlobalBarSetting, setSelectedGlobalBarSetting] = useState('modern_minimalist');
  const [selectedGlobalImageStyle, setSelectedGlobalImageStyle] = useState('photorealistic');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // State for sequential image generation
  const [generationQueue, setGenerationQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [generatingRecipeId, setGeneratingRecipeId] = useState(null);

  const loadData = useCallback(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const presentationId = urlParams.get('id');
    const menuIdFromUrl = urlParams.get('menuId');
    setMenuId(menuIdFromUrl);

    if (!presentationId) {
      setError("No presentation ID provided.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const presentationData = await base44.entities.MenuPresentation.get(presentationId);
      console.log('[pages/Presentation.js] Loaded presentation data:', presentationData);
      setPresentation(presentationData);

      if (!presentationData || !presentationData.recipe_ids || presentationData.recipe_ids.length === 0) {
        console.log('Presentation has no recipe_ids:', presentationData);
        setRecipes([]);
        if (presentationData?.account_id) {
          const accountData = await base44.entities.Account.get(presentationData.account_id);
          setAccount(accountData);
        }
        setIsLoading(false);
        return;
      }

      console.log('[pages/Presentation.js] Fetching recipes with IDs:', presentationData.recipe_ids);

      const recipePromises = presentationData.recipe_ids.map(id => 
        base44.entities.Recipe.get(id).catch(err => {
          console.error(`Error fetching recipe with ID ${id}:`, err);
          return null;
        })
      );
      const fetchedIndividualRecipes = await Promise.all(recipePromises);
      const validFetchedRecipes = fetchedIndividualRecipes.filter(Boolean);

      const [accountData, ingredientsData] = await Promise.all([
        base44.entities.Account.get(presentationData.account_id),
        base44.entities.Ingredient.list()
      ]);

      console.log('[pages/Presentation.js] Fetched recipes data:', validFetchedRecipes);

      const recipeMap = new Map((validFetchedRecipes || []).map(r => r && [r.id, r]));
      const orderedRecipes = presentationData.recipe_ids
        .map(id => recipeMap.get(id))
        .filter(Boolean);

      console.log('[pages/Presentation.js] Ordered recipes:', orderedRecipes);

      setRecipes(orderedRecipes);
      setAccount(accountData);
      setAllIngredients(ingredientsData || []);

    } catch (err) {
      console.error("Error loading presentation data:", err);
      setError("Failed to load presentation data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecipeUpdate = useCallback((updatedRecipe) => {
    setRecipes(currentRecipes =>
      currentRecipes.map(r => (r.id === updatedRecipe.id ? updatedRecipe : r))
    );
  }, []);

  const generateRecipeImage = useCallback(async (recipe, isCustom, customPrompt) => {
    let finalPrompt;
    if (isCustom && customPrompt) {
      finalPrompt = customPrompt;
    } else {
      const imageStyle = imageStyles[selectedGlobalImageStyle].description;
      const barSetting = barSettings[selectedGlobalBarSetting].description;
      const basePrompt = `A beautifully crafted ${recipe.name} cocktail, presented in ${recipe.glassware || 'an appropriate glass'}. ${recipe.garnish ? `The drink is garnished with ${recipe.garnish}.` : ''}`;
      finalPrompt = `${imageStyle}, ${basePrompt}, ${barSetting}. The composition emphasizes craftsmanship and quality with realistic reflections and natural depth of field. The mood is inviting and sophisticated.`;
    }

    try {
      const response = await base44.integrations.Core.GenerateImage({ prompt: finalPrompt });
      if (!response || !response.url) throw new Error("No image URL returned");

      const updatedRecipeData = {
        image_url: response.url,
        image_generation_prompt: finalPrompt,
        custom_image_prompt: isCustom ? customPrompt : null
      };

      const updatedRecipe = await base44.entities.Recipe.update(recipe.id, updatedRecipeData);
      handleRecipeUpdate(updatedRecipe);
    } catch (error) {
      console.error(`Failed to generate image for ${recipe.name}:`, error);
      throw error;
    }
  }, [selectedGlobalImageStyle, selectedGlobalBarSetting, handleRecipeUpdate]);

  const handleUploadRecipeImage = useCallback(async (recipe, file) => {
    setGeneratingRecipeId(recipe.id);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error("File upload failed.");

      const updatedRecipe = await base44.entities.Recipe.update(recipe.id, {
        image_url: file_url,
        image_generation_prompt: null,
        custom_image_prompt: null
      });
      handleRecipeUpdate(updatedRecipe);
    } catch (error) {
      console.error(`Failed to upload image for ${recipe.name}:`, error);
    } finally {
      setGeneratingRecipeId(null);
    }
  }, [handleRecipeUpdate]);

  useEffect(() => {
    if (generationQueue.length > 0 && !isProcessingQueue) {
      setIsProcessingQueue(true);
      const { recipeId, isCustom, customPrompt } = generationQueue[0];
      const recipe = recipes.find(r => r.id === recipeId);

      if (recipe) {
        setGeneratingRecipeId(recipe.id);

        generateRecipeImage(recipe, isCustom, customPrompt)
          .catch(error => {
            console.error(`Error during image generation for recipe ${recipe.id}:`, error);
          })
          .finally(() => {
            setGeneratingRecipeId(null);
            setGenerationQueue(q => q.slice(1));
            setIsProcessingQueue(false);
          });
      } else {
        console.warn(`Recipe with ID ${recipeId} not found while processing generation queue. Skipping.`);
        setGenerationQueue(q => q.slice(1));
        setIsProcessingQueue(false);
      }
    }
  }, [generationQueue, isProcessingQueue, recipes, generateRecipeImage]);

  const queueAllForRegeneration = useCallback(() => {
    const recipesToQueue = recipes
      .filter(recipe => !recipe.custom_image_prompt)
      .map(recipe => ({ recipeId: recipe.id, isCustom: false, customPrompt: null }));
    setGenerationQueue(recipesToQueue);
  }, [recipes]);

  const handleGlobalSettingChange = useCallback(() => {
    queueAllForRegeneration();
  }, [queueAllForRegeneration]);

  const handleRegenerateOne = useCallback((recipeId, isCustom, customPrompt) => {
    setGenerationQueue(q => {
      const newQueue = q.filter(item => item.recipeId !== recipeId);
      return [{ recipeId, isCustom, customPrompt }, ...newQueue];
    });
  }, []);

  const handleExportPdf = async () => {
    if (!presentation?.id) return;
    
    setIsExportingPdf(true);
    try {
      console.log('[PDF Export] Calling function with presentationId:', presentation.id);
      const response = await base44.functions.invoke('exportPresentationPdf', {
        presentationId: presentation.id
      });
      
      console.log('[PDF Export] Raw response:', response);
      console.log('[PDF Export] Response type:', typeof response);
      console.log('[PDF Export] Response.data type:', typeof response.data);
      console.log('[PDF Export] Response.data:', response.data);
      
      // Check if response.data is already an object (JSON)
      if (response.data && typeof response.data === 'object' && !ArrayBuffer.isView(response.data) && !(response.data instanceof Blob)) {
        console.log('[PDF Export] Response is JSON object');
        if (response.data.diagnostic) {
          console.log('=== DIAGNOSTIC DATA ===');
          console.log('Full Response:', response.data);
          console.log('Recipe:', response.data.recipe);
          console.log('Image Data:', response.data.imageData);
          alert('Diagnostic data logged to console. Check the browser console (F12) for details.');
          return;
        }
      }
      
      // Try to parse as text/JSON
      let responseText;
      if (response.data instanceof Blob) {
        console.log('[PDF Export] Response is Blob');
        responseText = await response.data.text();
      } else if (response.data instanceof ArrayBuffer) {
        console.log('[PDF Export] Response is ArrayBuffer');
        responseText = new TextDecoder().decode(response.data);
      } else if (typeof response.data === 'string') {
        console.log('[PDF Export] Response is string');
        responseText = response.data;
      } else {
        console.log('[PDF Export] Response is unknown type, stringifying');
        responseText = JSON.stringify(response.data);
      }
      
      console.log('[PDF Export] Response text (first 500 chars):', responseText.substring(0, 500));
      
      // Try to parse as JSON
      let jsonData;
      try {
        jsonData = JSON.parse(responseText);
        console.log('[PDF Export] Successfully parsed as JSON:', jsonData);
      } catch (e) {
        console.log('[PDF Export] Failed to parse as JSON:', e.message);
        jsonData = null;
      }
      
      // Check if it's diagnostic JSON
      if (jsonData && jsonData.diagnostic) {
        console.log('=== DIAGNOSTIC DATA ===');
        console.log('Full Response:', jsonData);
        console.log('Recipe:', jsonData.recipe);
        console.log('Image Data:', jsonData.imageData);
        alert('Diagnostic data logged to console. Check the browser console (F12) for details.');
        return;
      }
      
      // It's a PDF, download it
      console.log('[PDF Export] Treating as PDF');
      const blob = response.data instanceof Blob 
        ? response.data 
        : new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${presentation.name || 'presentation'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('[PDF Export] Error:', error);
      alert('Failed to export presentation. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-8">
        <Card className="text-center p-8 bg-white border border-gray-200 shadow-sm">
          <ImageOff className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-red-700">Error Loading Presentation</h2>
          <p className="text-gray-600 mt-2">{error}</p>
          <Link to={createPageUrl("Accounts")}>
            <Button variant="outline" className="mt-6 border-gray-300 text-gray-800">Back to Accounts</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 print:mb-4">
          {menuId && (
            <Link to={createPageUrl(`MenuDetails?id=${menuId}`)} className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 transition-colors mb-4 print:hidden">
              <ArrowLeft className="w-4 h-4" />
              Back to Menu Details
            </Link>
          )}
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">{presentation?.name || "Menu Presentation"}</h1>
          {account && (
            <p className="mt-3 text-lg text-gray-600">For {account.name}</p>
          )}
        </div>

        <Card className="p-6 mb-8 print:hidden bg-white border border-gray-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="space-y-2">
                    <Label htmlFor="imageStyle" className="flex items-center gap-2 font-medium text-gray-700">
                        <Sparkles className="w-4 h-4 text-blue-600"/> Image Style
                    </Label>
                    <Select value={selectedGlobalImageStyle} onValueChange={(value) => { setSelectedGlobalImageStyle(value); handleGlobalSettingChange(); }}>
                        <SelectTrigger id="imageStyle"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Object.entries(imageStyles).map(([key, { name }]) => (
                                <SelectItem key={key} value={key}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="barSetting" className="flex items-center gap-2 font-medium text-gray-700">
                        <GalleryHorizontal className="w-4 h-4 text-blue-600"/> Bar Setting
                    </Label>
                    <Select value={selectedGlobalBarSetting} onValueChange={(value) => { setSelectedGlobalBarSetting(value); handleGlobalSettingChange(); }}>
                        <SelectTrigger id="barSetting"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Object.entries(barSettings).map(([key, { name }]) => (
                                <SelectItem key={key} value={key}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button
                  onClick={queueAllForRegeneration}
                  variant="outline"
                  className="w-full"
                  disabled={isProcessingQueue}
                >
                    <RefreshCw className="w-4 h-4 mr-2"/>
                    {isProcessingQueue && generationQueue.length > 0
                      ? `Generating... (${generationQueue.length} pending)`
                      : generationQueue.length > 0
                        ? `Regenerate All Images (${generationQueue.length} pending)`
                        : "Regenerate All Images"}
                </Button>
                <Button
                  onClick={handleExportPdf}
                  variant="default"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isExportingPdf || recipes.length === 0}
                >
                    {isExportingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2"/>
                        Export to PDF
                      </>
                    )}
                </Button>
            </div>
        </Card>

        <div className="space-y-8">
          {recipes.length > 0 ? (
            recipes.map(recipe => (
              <PresentationCard
                key={recipe.id}
                recipe={recipe}
                account={account}
                allIngredients={allIngredients}
                isGenerating={generatingRecipeId === recipe.id}
                onRegenerate={handleRegenerateOne}
                onUpload={handleUploadRecipeImage}
                onRecipeUpdate={handleRecipeUpdate}
              />
            ))
          ) : (
            <Card className="text-center p-8 bg-white border border-gray-200 shadow-sm">
              <BookOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700">No Recipes in this Presentation</h2>
              <p className="text-gray-600 mt-2">Add recipes to the menu to see them here.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}