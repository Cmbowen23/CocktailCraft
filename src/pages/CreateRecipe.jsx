import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Recipe } from "@/api/entities";
import { Ingredient } from "@/api/entities";
import { Menu } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, PlusCircle, AlertTriangle } from "lucide-react";
import CreateRecipeFlow from "../components/recipes/CreateRecipeFlow"; // Use Flow instead of Form directly
import AddIngredientModal from "../components/ingredients/AddIngredientModal";

export default function CreateRecipePage() {
  const [allIngredients, setAllIngredients] = useState([]);
  const [menu, setMenu] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [recipe, setRecipe] = useState(null);
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [ingredientToAdd, setIngredientToAdd] = useState("");
  const [originalIngredientName, setOriginalIngredientName] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const menuId = urlParams.get('menuId');
  const storageKey = `new-recipe-draft-${menuId}`;

  useEffect(() => {
    if (!menuId) {
      setError("No menu specified. Please create a recipe from a menu's detail page.");
      setIsLoading(false);
      return;
    }
    loadInitialData();
  }, [menuId]);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ingredientsData, menuData] = await Promise.all([
        Ingredient.list(),
        Menu.get(menuId)
      ]);
      setAllIngredients(ingredientsData || []);
      setMenu(menuData);

      // Load recipe draft from localStorage (for manual mode)
      const draft = localStorage.getItem(storageKey);
      if (draft) {
        setRecipe(JSON.parse(draft));
      } else {
        setRecipe({ 
          name: "",
          ingredients: [{ ingredient_name: "", amount: "", unit: "ml", notes: "" }],
          instructions: [""]
        });
      }
    } catch (err) {
      console.error("Error loading data for new recipe:", err);
      setError("Failed to load initial data. The specified menu might not exist.");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshIngredients = async () => {
    try {
        const ingredientsData = await Ingredient.list();
        setAllIngredients(ingredientsData || []);
    } catch (error) {
        console.error("Error refreshing ingredients:", error);
    }
  }

  // Persist recipe draft to localStorage whenever it changes
  useEffect(() => {
    if (recipe && menuId) {
      localStorage.setItem(storageKey, JSON.stringify(recipe));
    }
  }, [recipe, storageKey, menuId]);

  // Handle submission from Manual Form
  const handleSubmit = async (recipeData) => {
    try {
      await Recipe.create({ ...recipeData, menu_id: menuId });
      localStorage.removeItem(storageKey);
      window.location.href = createPageUrl(`MenuDetails?id=${menuId}&_refresh=${new Date().getTime()}`);
    } catch (err) {
      console.error("Error creating recipe:", err);
      alert("Failed to create recipe. Please try again.");
    }
  };

  // Handle completion from Text Parser (recipes already created by backend)
  const handleTextImportComplete = () => {
      window.location.href = createPageUrl(`MenuDetails?id=${menuId}&_refresh=${new Date().getTime()}`);
  };

  const handleCancel = () => {
    if (window.confirm("Are you sure you want to cancel? Any unsaved changes will be lost.")) {
      localStorage.removeItem(storageKey);
      window.location.href = createPageUrl(`MenuDetails?id=${menuId}`);
    }
  };

  const handleAddIngredientCost = (ingredientName) => {
    setIngredientToAdd(ingredientName);
    setOriginalIngredientName(ingredientName);
    setShowAddIngredientModal(true);
  };

  const handleIngredientSaved = async () => {
    setShowAddIngredientModal(false);
    await refreshIngredients();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-md mx-auto border-red-200 bg-red-50/70">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-6 h-6" />
                    Invalid Page Access
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-red-800 mb-4">{error}</p>
                <Button asChild>
                    <Link to={createPageUrl("Accounts")}>Go to Accounts</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !recipe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading Recipe Creator...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link to={createPageUrl(`MenuDetails?id=${menuId}`)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to {menu?.name || 'Menu'}
          </Link>
          <Card>
            {/* Removed Header because CreateRecipeFlow has its own internal header/tabs structure, or we can keep it simple */}
            <CardContent className="pt-6">
               {/* Use the CreateRecipeFlow component which includes the tabs */}
              <CreateRecipeFlow
                // Props for Manual Form
                onSubmit={handleSubmit}
                allIngredients={allIngredients}
                onAddIngredientCost={handleAddIngredientCost}
                
                // Props for Text Parser
                onTextImportComplete={handleTextImportComplete}
                
                // Common Props
                onCancel={handleCancel}
              />
            </CardContent>
          </Card>
        </div>
      </div>
      
      {showAddIngredientModal && (
        <AddIngredientModal
          ingredientName={ingredientToAdd}
          allIngredients={allIngredients}
          allRecipes={[]} 
          onSave={handleIngredientSaved}
          onClose={() => setShowAddIngredientModal(false)}
          originalIngredientName={originalIngredientName}
        />
      )}
    </div>
  );
}