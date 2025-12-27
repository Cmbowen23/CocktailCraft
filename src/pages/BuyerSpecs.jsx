
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Menu } from "@/api/entities";
import { Recipe } from "@/api/entities";
import { Ingredient } from "@/api/entities";
import { Account } from "@/api/entities";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Search, ArrowLeft, Printer, FileDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SendEmail } from "@/api/integrations";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link2, Check, Loader2, Mail } from "lucide-react";
import { format } from 'date-fns';
import { PublicLink } from "@/api/entities";

import RecipeDetailWithCosting from "../components/recipes/RecipeDetailWithCosting";
import AddIngredientModal from "../components/ingredients/AddIngredientModal";
import ProductBreakdownTable from "../components/menus/ProductBreakdownTable";
import { isSubRecipe } from "../components/utils/categoryDefinitions";
import { calculateRecipeCost, formatCurrency } from "../components/utils/costCalculations";
import BuyerSpecSubRecipeCard from "../components/recipes/BuyerSpecSubRecipeCard";

export default function MenuSpecsPage() {
    const [menu, setMenu] = useState(null);
    const [account, setAccount] = useState(null);
    const [recipes, setRecipes] = useState([]); // This will hold the main menu recipes
    const [allIngredients, setAllIngredients] = useState([]);
    const [allRecipesDB, setAllRecipesDB] = useState([]); // To hold ALL recipes from DB
    const [isLoading, setIsLoading] = useState(true);
    const [recipeViewModes, setRecipeViewModes] = useState({});
    const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
    const [ingredientToAdd, setIngredientToAdd] = useState("");
    const [contextRecipeId, setContextRecipeId] = useState(null);
    const [hideFinancials, setHideFinancials] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailForm, setEmailForm] = useState({
        recipientEmail: '',
        subject: '',
        message: ''
    });
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    const urlParams = new URLSearchParams(window.location.search);
    const menuId = urlParams.get('id');
    const targetAudience = urlParams.get('target') || 'buyer';

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        if (!menuId) {
             setError("Menu not found.");
             setIsLoading(false);
             return;
        }
        try {
            const menuData = await Menu.get(menuId);
            if (!menuData) {
                setError("Menu not found.");
                setIsLoading(false);
                return;
            }
            setMenu(menuData);

            let accountData = null;
            if (menuData.account_id) {
                try {
                    const allAccounts = await Account.list();
                    if (Array.isArray(allAccounts)) {
                        accountData = allAccounts.find(acc => acc.id === menuData.account_id) || null;
                    }
                } catch (accountError) {
                    console.warn("Could not load accounts:", accountError);
                    accountData = null;
                }
            }
            setAccount(accountData);

            const [allRecipeData, ingredientsData] = await Promise.all([
                Recipe.list().catch(err => {
                    console.error("Error loading all recipes:", err);
                    return [];
                }),
                Ingredient.list().catch(err => {
                    console.error("Error loading ingredients:", err);
                    return [];
                })
            ]);

            setAllRecipesDB(Array.isArray(allRecipeData) ? allRecipeData : []);
            setAllIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);

            const menuRecipes = (Array.isArray(allRecipeData) ? allRecipeData : [])
                .filter(r => r.menu_id === menuId && !isSubRecipe(r));

            let sortedRecipes = [...menuRecipes];
            const order = menuData.customer_menu_settings?.recipe_order || menuData.recipe_order;
            if (order && Array.isArray(order)) {
                sortedRecipes.sort((a, b) => {
                    const indexA = order.indexOf(a.id);
                    const indexB = order.indexOf(b.id);

                    if (indexA === -1 && indexB === -1) return 0;
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;

                    return indexA - indexB;
                });
            }

            setRecipes(sortedRecipes);

        } catch (err) {
            console.error("Error loading menu data:", err);
            setError("Failed to load menu data. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, [menuId]); // Ensure loadData re-runs if menuId changes

    useEffect(() => {
        loadData();
    }, [loadData]); // Now useEffect depends on the memoized loadData

    const handleRecipeUpdate = (updatedRecipe) => {
        setRecipes(prevRecipes =>
            prevRecipes.map(r => r.id === updatedRecipe.id ? updatedRecipe : r)
        );
        setAllRecipesDB(prevAllRecipes =>
            prevAllRecipes.map(r => r.id === updatedRecipe.id ? updatedRecipe : r)
        );
    };

    const handleViewModeChange = (recipeId, newMode) => {
        setRecipeViewModes(prev => ({ ...prev, [recipeId]: newMode }));
    };

    const handleAddIngredientCost = (ingredientName, recipeId) => {
        setIngredientToAdd(ingredientName);
        setContextRecipeId(recipeId);
        setShowAddIngredientModal(true);
    };

    const handleIngredientSaved = async () => {
        setShowAddIngredientModal(false);
        setIngredientToAdd("");
        setContextRecipeId(null);
        await loadData();
    };

    const handleGeneratePublicLink = async () => {
        if (!menuId) return;

        setIsGeneratingLink(true);
        setError(null); // Clear any previous errors
        try {
            const token = crypto.randomUUID();
            await PublicLink.create({ token, menu_id: menuId });

            // Construct the full URL using the current window origin
            const publicUrl = new URL(createPageUrl(`PublicMenuSpec?token=${token}`), window.location.origin).href;

            await navigator.clipboard.writeText(publicUrl);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000); // Reset after 3 seconds

        } catch (error) {
            console.error("Failed to generate public link:", error);
            setError("Could not generate the public link. Please try again.");
        } finally {
            setIsGeneratingLink(false);
        }
    };

    const printSpecs = () => {
        window.print();
    };

    const exportToPDF = () => {
        window.print();
    };

    const handleEmailToBuyer = () => {
        if (!menu || !account) return;

        const linkText = `${account.name} - ${menu.name} Menu Specifications`;
        const linkUrl = window.location.href;
        const emailBodyHtml = `
            <p>Please click the link below to view the menu specifications:</p>
            <p><a href="${linkUrl}" style="font-size: 16px; font-family: sans-serif; color: #059669; text-decoration: none; font-weight: bold;">${linkText}</a></p>
            <br>
            <p style="font-size: 12px; color: #555;">Sent via CocktailCraft</p>
        `;

        setEmailForm({
            recipientEmail: '',
            subject: `Menu Specifications: ${menu.name} for ${account.name}`,
            message: emailBodyHtml
        });
        setShowEmailModal(true);
    };

    const handleSendEmail = async (e) => {
        e.preventDefault();
        if (!emailForm.recipientEmail.trim()) return;

        setIsSendingEmail(true);
        setError(null);
        try {
            await SendEmail({
                to: emailForm.recipientEmail,
                subject: emailForm.subject,
                body: emailForm.message,
                from_name: account?.name || 'CocktailCraft'
            });

            setShowEmailModal(false);
            setEmailForm({ recipientEmail: '', subject: '', message: '' });
        } catch (err) {
            console.error('Failed to send email:', err);
            setError('Failed to send email. Please try again.');
        } finally {
            setIsSendingEmail(false);
        }
    };

    const subRecipesInMenu = useMemo(() => {
        const subRecipeIds = new Set();

        recipes.forEach(recipe => {
            recipe.ingredients?.forEach(ingredient => {
                const matchedIngredient = allIngredients.find(ing =>
                    ing.name?.toLowerCase().trim() === ingredient.ingredient_name?.toLowerCase().trim()
                );

                if (matchedIngredient?.ingredient_type === 'sub_recipe' && matchedIngredient.sub_recipe_id) {
                    subRecipeIds.add(matchedIngredient.sub_recipe_id);
                }
            });
        });

        const foundSubRecipes = [];
        subRecipeIds.forEach(id => {
            const subRecipe = allRecipesDB.find(r => r.id === id);
            if (subRecipe && isSubRecipe(subRecipe)) {
                foundSubRecipes.push(subRecipe);
            }
        });

        return foundSubRecipes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [recipes, allIngredients, allRecipesDB]);

    const summaryMetrics = useMemo(() => {
        const includedRecipes = recipes;
        if (includedRecipes.length === 0) {
            return { numberOfCocktails: 0, avgCost: 0, avgProfit: 0 };
        }

        let totalCost = 0;
        let totalProfit = 0;

        includedRecipes.forEach(recipe => {
            const { totalCost: recipeCost } = calculateRecipeCost(recipe, allIngredients);
            totalCost += recipeCost;

            if (recipe.menu_price && recipe.menu_price > 0) {
                const profit = recipe.menu_price - recipeCost;
                totalProfit += profit;
            }
        });

        const numberOfCocktails = includedRecipes.length;
        const avgCost = totalCost > 0 ? totalCost / numberOfCocktails : 0;
        const avgProfit = totalProfit > 0 ? totalProfit / numberOfCocktails : 0;

        return { numberOfCocktails, avgCost, avgProfit };
    }, [recipes, allIngredients]);

    const groupedRecipes = useMemo(() => {
        return {
            cocktails: recipes,
            sub_recipes: subRecipesInMenu
        };
    }, [recipes, subRecipesInMenu]);


    if (isLoading) {
        return <div className="p-12 text-center">Loading Menu Specs...</div>;
    }

    if (error) {
        return <div className="p-12 text-center text-red-600">{error}</div>;
    }

    if (!menu) {
        return <div className="p-12 text-center text-red-600">Could not load menu data.</div>;
    }

    return (
        <>
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #printable-area, #printable-area * {
                            visibility: visible;
                        }
                        #printable-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                        }
                        .no-print {
                            display: none !important;
                        }
                        .recipe-card-print-wrapper {
                           page-break-inside: avoid;
                           margin-bottom: 2rem;
                        }
                    }
                `}
            </style>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
                <div id="printable-area">
                    <div className="no-print">
                        <div className="max-w-7xl mx-auto p-4 md:p-8">
                            <div className="mb-8">
                                <Link to={createPageUrl(`MenuDetails?id=${menu.id}`)} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors mb-4">
                                    <ArrowLeft className="w-4 h-4" />
                                    Back to Menu Details
                                </Link>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-gray-900">{menu?.name}</h1>
                                        <p className="text-gray-700 text-lg mt-2">Menu Specifications & Costing</p>
                                        <div className="text-sm text-gray-600 mt-1">
                                            Account: {account?.name} | Generated: {format(new Date(), 'PPP')}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Button
                                            onClick={handleGeneratePublicLink}
                                            disabled={isGeneratingLink || linkCopied}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            {isGeneratingLink ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : linkCopied ? (
                                                <Check className="w-4 h-4 mr-2" />
                                            ) : (
                                                <Link2 className="w-4 h-4 mr-2" />
                                            )}
                                            {linkCopied ? "Link Copied!" : "Generate Public Link"}
                                        </Button>
                                        <Button
                                            onClick={handleEmailToBuyer}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Mail className="w-4 h-4 mr-2" />
                                            Email to Buyer
                                        </Button>
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id="hide-financials"
                                                checked={hideFinancials}
                                                onCheckedChange={setHideFinancials}
                                            />
                                            <Label htmlFor="hide-financials" className="text-sm font-medium text-gray-800">
                                                Training Mode
                                            </Label>
                                        </div>
                                        <Button onClick={printSpecs} variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
                                            <Printer className="w-4 h-4 mr-2" />
                                            Print
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {!hideFinancials && (
                                <Card className="mb-8 border border-gray-200 shadow-sm bg-white">
                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium">Number of Cocktails</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold">{summaryMetrics.numberOfCocktails}</div>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium">Average Cost</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold">${formatCurrency(summaryMetrics.avgCost)}</div>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                    <CardTitle className="text-sm font-medium">Average Profit</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold">${formatCurrency(summaryMetrics.avgProfit)}</div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                    <div className="max-w-7xl mx-auto p-4 md:p-8">
                        {groupedRecipes.cocktails.length === 0 && groupedRecipes.sub_recipes.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No recipes found.</div>
                        ) : (
                            <>
                                {/* Main Recipes (Cocktails) section */}
                                {groupedRecipes.cocktails.length > 0 && (
                                    <section>
                                        <h2 className="text-3xl font-bold text-gray-900 mb-6 pb-2 border-b-2 border-gray-200">Cocktails</h2>
                                        <AnimatePresence>
                                            <div className="space-y-6">
                                                {groupedRecipes.cocktails.map(recipe => (
                                                    <motion.div
                                                        key={`${recipe.id}-${recipe.menu_price || 'no-price'}`}
                                                        layout
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -20 }}
                                                        className="bg-white shadow-md recipe-card-print-wrapper break-inside-avoid rounded-lg overflow-hidden"
                                                    >
                                                        <RecipeDetailWithCosting
                                                            recipe={recipe}
                                                            allIngredients={allIngredients}
                                                            allRecipes={allRecipesDB}
                                                            onAddIngredientCost={(ingName) => handleAddIngredientCost(ingName, recipe.id)}
                                                            onEdit={() => window.location.href = createPageUrl(`EditRecipe?id=${recipe.id}&from=BuyerSpecs?id=${menuId}`)}
                                                            onRecipeUpdate={handleRecipeUpdate}
                                                            viewMode={recipeViewModes[recipe.id] || 'single_spec'}
                                                            onViewModeChange={handleViewModeChange}
                                                            showSuggestedPrice={!hideFinancials}
                                                            showActionButtons={false}
                                                            showInstructions={true}
                                                            hideFinancials={hideFinancials}
                                                            hideMenuInfo={true}
                                                            ingredientsClickable={false}
                                                        />
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </AnimatePresence>
                                    </section>
                                )}

                                {/* Sub-Recipes & Preparations section */}
                                {groupedRecipes.sub_recipes.length > 0 && (
                                    <section>
                                        <h2 className="text-3xl font-bold text-gray-900 mb-6 mt-12 pb-2 border-b-2 border-gray-200">Sub-Recipes & Preparations</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {groupedRecipes.sub_recipes.map(recipe => (
                                                <BuyerSpecSubRecipeCard
                                                    key={recipe.id}
                                                    recipe={recipe}
                                                    allIngredients={allIngredients}
                                                    allRecipes={allRecipesDB}
                                                    hideFinancials={hideFinancials}
                                                    hideMenuInfo={true}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </>
                        )}

                        {showAddIngredientModal && (
                            <AddIngredientModal
                                ingredientName={ingredientToAdd}
                                allIngredients={allIngredients}
                                allRecipes={allRecipesDB}
                                onSave={handleIngredientSaved}
                                onClose={() => setShowAddIngredientModal(false)}
                                contextRecipeId={contextRecipeId}
                                originalIngredientName={ingredientToAdd}
                            />
                        )}

                        {!hideFinancials && (
                            <div className="mt-12 no-print">
                                 <Card className="border border-gray-200 shadow-sm bg-white">
                                    <CardHeader>
                                        <CardTitle className="text-xl font-bold text-gray-900">Full Product Breakdown</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ProductBreakdownTable
                                            recipes={recipes}
                                            allIngredients={allIngredients}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Email Modal */}
            {showEmailModal && (
                <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Email Menu Specs to Buyer</DialogTitle>
                            <DialogDescription>
                                Send a direct link to the detailed menu specifications page.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSendEmail} className="space-y-4">
                            <div>
                                <Label htmlFor="recipientEmail">Buyer's Email Address *</Label>
                                <Input
                                    id="recipientEmail"
                                    type="email"
                                    value={emailForm.recipientEmail}
                                    onChange={(e) => setEmailForm(prev => ({...prev, recipientEmail: e.target.value}))}
                                    required
                                    className="mt-1"
                                    placeholder="buyer@example.com"
                                />
                            </div>
                            <div>
                                <Label htmlFor="subject">Subject *</Label>
                                <Input
                                    id="subject"
                                    type="text"
                                    value={emailForm.subject}
                                    onChange={(e) => setEmailForm(prev => ({...prev, subject: e.target.value}))}
                                    required
                                    className="mt-1"
                                />
                            </div>
                            <div className="pt-4 flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={isSendingEmail || !emailForm.recipientEmail.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 w-28"
                                >
                                    {isSendingEmail ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        'Send Email'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
