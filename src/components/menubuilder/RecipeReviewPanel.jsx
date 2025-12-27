import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Edit, Save, Plus, Menu as MenuIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Recipe } from "@/api/entities";
import RecipeForm from "../recipes/RecipeForm";
import AddToMenuModal from "../menus/AddToMenuModal";

function GeneratedRecipeCard({ recipe, onSave, onEdit, isSaved }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden transition-all hover:shadow-md">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg text-emerald-900">{recipe.name}</CardTitle>
              <CardDescription className="italic text-emerald-700 mt-1">
                {recipe.tasting_notes || recipe.description}
              </CardDescription>
            </div>
            {isSaved ? (
              <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                <CheckCircle className="w-4 h-4 mr-2" />
                Saved
              </Badge>
            ) : (
               <Button size="sm" onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit & Save
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {recipe.ingredients.map((ing, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {ing.amount} {ing.unit} {ing.ingredient_name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function RecipeReviewPanel({ generatedRecipes, allIngredients, onBack, tastingId, accountId }) {
  const [recipes, setRecipes] = useState(generatedRecipes);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [savedRecipeIds, setSavedRecipeIds] = useState([]);
  const [savedRecipeObjects, setSavedRecipeObjects] = useState([]);
  const [showAddToMenuModal, setShowAddToMenuModal] = useState(false);

  const handleEdit = (recipe) => {
    setEditingRecipe(recipe);
  };

  const handleSave = async (recipeData) => {
    try {
      const newRecipe = await Recipe.create(recipeData);
      setSavedRecipeIds(prev => [...prev, recipeData.name]); // Use name as temporary unique ID
      setSavedRecipeObjects(prev => [...prev, newRecipe]); // Store actual saved recipe objects
      setEditingRecipe(null);
    } catch (error) {
      console.error("Failed to save recipe:", error);
      alert("There was an error saving the recipe. Please try again.");
    }
  };

  const handleAddToMenu = () => {
    if (savedRecipeObjects.length === 0) {
      alert("Please save some recipes first before adding them to a menu.");
      return;
    }
    setShowAddToMenuModal(true);
  };

  const handleMenuSaveComplete = () => {
    setShowAddToMenuModal(false);
    // Optionally redirect back to dashboard or show success message
    alert("Recipes have been successfully added to the menu!");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-emerald-900">Review Generated Recipes</h2>
          <p className="text-emerald-600 mt-1">
            Fine-tune the AI's creations and save your favorites to the recipe library.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Concepts
          </Button>
          {tastingId && accountId && savedRecipeObjects.length > 0 && (
            <Button onClick={handleAddToMenu} className="bg-emerald-600 hover:bg-emerald-700">
              <MenuIcon className="w-4 h-4 mr-2" />
              Add to Menu ({savedRecipeObjects.length})
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence>
          {recipes.map((recipe, index) => (
            <GeneratedRecipeCard
              key={recipe.name} // Using name as key, assuming it's unique from generation
              recipe={recipe}
              isSaved={savedRecipeIds.includes(recipe.name)}
              onEdit={() => handleEdit(recipe)}
            />
          ))}
        </AnimatePresence>
      </div>
      
      <Dialog open={!!editingRecipe} onOpenChange={(open) => !open && setEditingRecipe(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit & Save Recipe: {editingRecipe?.name}</DialogTitle>
          </DialogHeader>
          {editingRecipe && (
            <div className="py-4">
              <RecipeForm 
                recipe={editingRecipe}
                allIngredients={allIngredients}
                onSubmit={handleSave}
                onCancel={() => setEditingRecipe(null)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showAddToMenuModal && (
        <AddToMenuModal
          recipes={savedRecipeObjects.map(r => r.id)}
          accountId={accountId}
          tastingId={tastingId}
          onSave={handleMenuSaveComplete}
          onCancel={() => setShowAddToMenuModal(false)}
        />
      )}
    </div>
  );
}