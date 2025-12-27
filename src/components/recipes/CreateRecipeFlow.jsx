import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RecipeForm from './RecipeForm';
import TextFileParser from '../menus/TextFileParser';
import RecipeAuditAndMapping from './RecipeAuditAndMapping';
import { Edit, FileText, Camera, Upload, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function CreateRecipeFlow({
  onSubmit,
  onTextImportComplete,
  onCancel,
  allIngredients,
  onAddIngredientCost,
  initialCreationMode = 'manual_cocktail', // 'manual_cocktail', 'manual_sub_recipe', 'text_import', 'picture_import'
  defaultTab = null
}) {
  const [parsedRecipes, setParsedRecipes] = useState(null);
  const [activeTab, setActiveTab] = useState(
    defaultTab || (initialCreationMode === 'text_import' ? 'text' : 'manual')
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);

  const handleTextImportComplete = (recipes) => {
      setParsedRecipes(recipes);
  };

  const handleAuditComplete = () => {
      if (onTextImportComplete) onTextImportComplete();
  };

  const handleImageUpload = async (file) => {
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      if (uploadResponse.file_url) {
        setUploadedImageUrl(uploadResponse.file_url);
        toast.success("Image uploaded! Processing...");
        
        // Parse the image
        const parseResponse = await base44.functions.invoke('parseRecipeDocument', {
          image_url: uploadResponse.file_url
        });
        
        if (parseResponse.data?.recipes && parseResponse.data.recipes.length > 0) {
          setParsedRecipes(parseResponse.data.recipes);
          toast.success(`Found ${parseResponse.data.recipes.length} recipe(s)!`);
        } else {
          toast.error("No recipes found in image");
        }
      }
    } catch (error) {
      console.error('Error uploading/parsing image:', error);
      toast.error("Failed to process image. Please try again.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (parsedRecipes) {
      return (
          <div className="py-4">
              <RecipeAuditAndMapping
                  parsedRecipes={parsedRecipes}
                  allIngredients={allIngredients}
                  onSaveComplete={handleAuditComplete}
                  onCancel={() => setParsedRecipes(null)}
              />
          </div>
      );
  }

  return (
    <div className="py-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Create New Recipe</h3>
        <p className="text-sm text-gray-600">
          Choose a method to add a new recipe to your library.
        </p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="manual">
            <Edit className="w-4 h-4 mr-2" />
            Create Manually
          </TabsTrigger>
          <TabsTrigger value="text">
            <FileText className="w-4 h-4 mr-2" />
            Create from Text
          </TabsTrigger>
          <TabsTrigger value="picture">
            <Camera className="w-4 h-4 mr-2" />
            Create from Picture
          </TabsTrigger>
        </TabsList>
        <TabsContent value="manual" className="pt-4">
          <RecipeForm
            onSubmit={onSubmit}
            onCancel={onCancel}
            allIngredients={allIngredients}
            onAddIngredientCost={onAddIngredientCost}
            isSubRecipe={false}
          />
        </TabsContent>
        <TabsContent value="text" className="pt-4">
          <TextFileParser
            onComplete={handleTextImportComplete}
            onCancel={onCancel}
          />
        </TabsContent>
        <TabsContent value="picture" className="pt-4">
          <div className="space-y-4">
            <div className="text-center">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Upload Recipe Image</h4>
              <p className="text-sm text-gray-600 mb-6">
                Take a photo or upload an image of a handwritten or printed recipe. Our AI will extract the recipe details.
              </p>
            </div>
            
            {uploadedImageUrl && (
              <div className="mb-4">
                <img 
                  src={uploadedImageUrl} 
                  alt="Uploaded recipe" 
                  className="max-w-full h-auto rounded-lg border border-gray-200 mx-auto max-h-96 object-contain"
                />
              </div>
            )}
            
            <div className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploadingImage}
                  id="camera-input"
                />
                <Button 
                  type="button"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isUploadingImage}
                  asChild
                >
                  <label htmlFor="camera-input" className="cursor-pointer">
                    {isUploadingImage ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5 mr-2" />
                        Take Photo
                      </>
                    )}
                  </label>
                </Button>
              </div>
              
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploadingImage}
                  id="upload-input"
                />
                <Button 
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isUploadingImage}
                  asChild
                >
                  <label htmlFor="upload-input" className="cursor-pointer">
                    <Upload className="w-5 h-5 mr-2" />
                    Upload from Gallery
                  </label>
                </Button>
              </div>
              
              <Button 
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isUploadingImage}
              >
                Cancel
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}