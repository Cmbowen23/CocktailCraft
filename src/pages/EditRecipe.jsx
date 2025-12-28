import React, { useState, useEffect, useRef } from "react";
import { Recipe } from "@/api/entities";
import { Ingredient } from "@/api/entities";
import RecipeForm from "../components/recipes/RecipeForm";
import AddIngredientModal from "../components/ingredients/AddIngredientModal";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ingredientCategories } from '../components/utils/categoryDefinitions';
import { convertToMl, isClarifyingAgent } from "../components/utils/costCalculations";

export default function EditRecipePage() {
    const [recipe, setRecipe] = useState(null);
    const [allIngredients, setAllIngredients] = useState([]);
    const [allRecipes, setAllRecipes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
    const [ingredientToAdd, setIngredientToAdd] = useState("");
    const [ingredientModalContext, setIngredientModalContext] = useState({
        contextRecipeId: null,
        originalIngredientName: null
    });

    const [clarificationMethod, setClarificationMethod] = useState("none");

    const urlParams = new URLSearchParams(window.location.search);
    const recipeId = urlParams.get('id');
    const fromUrl = urlParams.get('from');
    const navigate = useNavigate();
    const recipeFormRef = useRef(null);

    useEffect(() => {
        if (recipeId) {
            loadData();
        } else {
            setError("No recipe ID provided.");
            setIsLoading(false);
        }
    }, [recipeId]);



    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const user = await base44.auth.me();
            setCurrentUser(user);

            const [recipeData, ingredientsData, recipesData, allProductVariants] = await Promise.all([
                Recipe.get(recipeId),
                Ingredient.list(),
                Recipe.list(),
                base44.entities.ProductVariant.list('-created_at', 5000)
            ]);
            
            // Permission check
            if (recipeData && user) {
                const isAdmin = user.role === 'admin';
                const isCreator = recipeData.created_by === user.email;
                if (!isAdmin && !isCreator) {
                    setError("You do not have permission to edit this recipe.");
                    setRecipe(null);
                    setAllIngredients([]);
                    setIsLoading(false);
                    return;
                }
            }

            // Enrich ingredients with variant data
            const enrichedIngredients = (ingredientsData || []).map(ing => {
                const variants = (allProductVariants || []).filter(v => v.ingredient_id === ing.id);
                return { ...ing, variants };
            });

            setRecipe(recipeData);
            setAllIngredients(enrichedIngredients);
            setAllRecipes(recipesData || []);
        } catch (err) {
            console.error("Failed to load data:", err);
            setError("Failed to load recipe data.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (data, options = {}) => {
        setIsSaving(true);
        try {
            // Update Recipe directly (no more versions)
            await Recipe.update(recipeId, data);
            console.log("fromUrl:", fromUrl);
            console.log("Decoded fromUrl:", fromUrl ? decodeURIComponent(fromUrl) : "none");
            
            // Use window.location.href for consistent navigation
            if (fromUrl) {
                const decodedUrl = decodeURIComponent(fromUrl);
                console.log("Navigating to:", decodedUrl);
                
                // Ensure it's a full URL starting with the base
                if (decodedUrl.startsWith('/')) {
                    window.location.href = decodedUrl;
                } else {
                    // Fallback: assume it's a page name
                    window.location.href = createPageUrl(decodedUrl);
                }
            } else {
                console.log("No fromUrl, navigating to Recipes");
                window.location.href = createPageUrl("Recipes");
            }
        } catch (error) {
            console.error("Failed to save recipe:", error);
            setError("Failed to save recipe.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const saveDraft = async () => {
        if (recipeFormRef.current) {
            await recipeFormRef.current.submit(true);
        }
    };

    const handleAddIngredientCost = async (ingredientName, contextRecipeId, originalIngredientName, ingredientId) => {
        await saveDraft();
        setIngredientToAdd(ingredientName);
        setShowAddIngredientModal(true);
        setIngredientModalContext({
            contextRecipeId: contextRecipeId || recipeId,
            originalIngredientName: originalIngredientName || ingredientName,
            ingredientId: ingredientId
        });
    };

    const handleIngredientSaved = () => {
        setShowAddIngredientModal(false);
        setIngredientToAdd("");
        setIngredientModalContext({ contextRecipeId: null, originalIngredientName: null });
        loadData();
    };

    const handleCancel = () => {
        // Use the same navigation logic as handleSave for consistency
        if (fromUrl) {
            const decodedUrl = decodeURIComponent(fromUrl);
            if (decodedUrl.startsWith('/')) {
                window.location.href = decodedUrl;
            } else {
                window.location.href = createPageUrl(decodedUrl);
            }
        } else {
            window.location.href = createPageUrl("Recipes");
        }
    };

    // Calculate total volume in ml for clarification calculator
    const calculateTotalVolumeMl = (excludeClarifiers = false) => {
        if (!recipe?.ingredients) return 0;
        let totalVol = 0;
        recipe.ingredients.forEach(ing => {
            if (ing.ingredient_name && ing.amount && ing.unit) {
                if (excludeClarifiers && isClarifyingAgent(ing.ingredient_name)) {
                    return;
                }
                const vol = convertToMl(parseFloat(ing.amount), ing.unit, ing.ingredient_name, allIngredients);
                if (!isNaN(vol) && vol !== null) {
                    totalVol += vol;
                }
            }
        });
        return totalVol;
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
    }

    if (error) {
        return <div className="text-red-500 text-center mt-8">{error}</div>;
    }

    const returnPath = fromUrl ? decodeURIComponent(fromUrl) : createPageUrl("Recipes");

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <button 
                        onClick={handleCancel}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors mb-4 bg-transparent border-none cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Previous Page
                    </button>
                </div>
                <Card className="border border-gray-200 shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle>Edit: {recipe?.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RecipeForm
                            ref={recipeFormRef}
                            recipe={recipe}
                            currentUser={currentUser}
                            allIngredients={allIngredients}
                            allRecipes={allRecipes}
                            onSubmit={handleSave}
                            onCancel={handleCancel}
                            onAddIngredientCost={handleAddIngredientCost}
                            isSubRecipe={recipe && ingredientCategories.includes(recipe.category)}
                            clarificationMethod={clarificationMethod}
                            setClarificationMethod={setClarificationMethod}
                            calculateTotalVolumeMl={() => calculateTotalVolumeMl(true)}
                            onRecipeChange={setRecipe}
                        />
                    </CardContent>
                </Card>

                {showAddIngredientModal && (
                    <AddIngredientModal
                        ingredientName={ingredientToAdd}
                        ingredientId={ingredientModalContext.ingredientId}
                        allIngredients={allIngredients}
                        allRecipes={[]} 
                        onSave={handleIngredientSaved}
                        onClose={() => setShowAddIngredientModal(false)}
                        contextRecipeId={ingredientModalContext.contextRecipeId}
                        originalIngredientName={ingredientModalContext.originalIngredientName}
                    />
                )}
            </div>
        </div>
    );
}