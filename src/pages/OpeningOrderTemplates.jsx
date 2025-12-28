import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  FileText,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConceptBuilder from "../components/openingorder/ConceptBuilder";
import ProductSearchPanel from "../components/openingorder/ProductSearchPanel";
import LoadExistingTemplateDropdown from "../components/openingorder/LoadExistingTemplateDropdown";
import OrderItemsPanel from "../components/openingorder/OrderItemsPanel";
import ResolveInventoryVariantsModal from "@/components/inventory/ResolveInventoryVariantsModal";
// import CoverageCheckerPanel from "../components/openingorder/CoverageCheckerPanel"; // Removed per request

import { isAlcoholicIngredient } from "../components/utils/categoryDefinitions";
import { convertAmount } from "../components/utils/unitConverter";
import { findMatchingIngredient } from "../components/utils/costCalculations";

export default function OpeningOrderTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [variants, setVariants] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showShoppingMode, setShowShoppingMode] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [suggestedProductIds, setSuggestedProductIds] = useState([]);
  const [currentOrderItems, setCurrentOrderItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [menus, setMenus] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMenuId, setImportMenuId] = useState(null);
  const [showConceptResolutionModal, setShowConceptResolutionModal] = useState(false);
  const [pendingConceptIngredients, setPendingConceptIngredients] = useState([]);
  const [pendingConceptSuggestions, setPendingConceptSuggestions] = useState([]);

  const location = useLocation();
  const navigate = useNavigate();
  
  const fromMenuId = new URLSearchParams(location.search).get("from_menu");

  const openingOrderIngredients = useMemo(
    () =>
      (ingredients || []).filter(
        (ing) =>
          (isAlcoholicIngredient(ing) || ing.include_in_opening_orders) &&
          ing.ingredient_type !== "sub_recipe"
      ),
    [ingredients]
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      const [templatesData, ingredientsData, variantsData, accountsData, menusData] = await Promise.all([
        base44.entities.OpeningOrderTemplate.list("-created_at"),
        base44.entities.Ingredient.list(null, 10000),
        base44.entities.ProductVariant.list(null, 10000),
        base44.entities.Account.list(),
        base44.entities.Menu.list("-created_at"),
      ]);

      let visibleTemplates = templatesData || [];
      if (user?.role !== 'admin' && user?.account_id) {
          visibleTemplates = visibleTemplates.filter(t => t.account_id === user.account_id);
      }
      setTemplates(visibleTemplates);
      
      setIngredients(ingredientsData || []);
      setVariants(variantsData || []);
      setAccounts(accountsData || []);
      setMenus(menusData || []);

      const params = new URLSearchParams(location.search);
      const menuId = params.get("menuId");
      const accountId = params.get("accountId");
      if (menuId && accountId) {
        const [allRecipes, menu] = await Promise.all([
          base44.entities.Recipe.list("-created_at", 1000),
          base44.entities.Menu.get(menuId)
        ]);
        
        // Robust recipe fetching: Check both recipe_order and menu_id
        const menuRecipes = [];
        const addedRecipeIds = new Set();

        // 1. Add recipes from customer_menu_settings.recipe_order
        if (menu.customer_menu_settings?.recipe_order?.length > 0) {
          menu.customer_menu_settings.recipe_order.forEach(id => {
            const r = allRecipes.find(recipe => recipe.id === id);
            if (r && !addedRecipeIds.has(r.id)) {
              menuRecipes.push(r);
              addedRecipeIds.add(r.id);
            }
          });
        }

        // 2. Add recipes that have this menu_id (legacy/direct link)
        allRecipes.forEach(recipe => {
          if (recipe.menu_id === menuId && !addedRecipeIds.has(recipe.id)) {
            menuRecipes.push(recipe);
            addedRecipeIds.add(recipe.id);
          }
        });

        const alcoholicUsage = {};

        menuRecipes.forEach((recipe) => {
          recipe.ingredients?.forEach((recIng) => {
            // Use robust ingredient matching instead of strict exact match
            const ingredientDetail = findMatchingIngredient(recIng.ingredient_name, ingredientsData);

            if (ingredientDetail && isAlcoholicIngredient(ingredientDetail)) {
              const amountOz = convertAmount(
                recIng.amount,
                recIng.unit,
                "oz",
                ingredientsData,
                recIng.ingredient_name
              );

              if (amountOz !== null && !isNaN(amountOz) && amountOz > 0) {
                alcoholicUsage[ingredientDetail.id] =
                  (alcoholicUsage[ingredientDetail.id] || 0) + amountOz;
              }
            }
          });
        });

        const prePopulatedItems = Object.entries(alcoholicUsage)
          .map(([ingId, totalOz]) => {
            const ingredientDetail = ingredientsData.find((ing) => ing.id === ingId);
            if (!ingredientDetail) return null;

            let quantity = 1;
            let unit = "bottle";

            if (totalOz >= 2) {
              if (ingredientDetail.bottles_per_case && ingredientDetail.bottles_per_case > 0) {
                quantity = 1;
                unit = "case";
              } else {
                quantity = 3;
                unit = "bottle";
              }
            } else if (totalOz >= 1) {
              quantity = 3;
              unit = "bottle";
            }

            return {
              ingredient_id: ingId,
              ingredient_name: ingredientDetail.name,
              quantity,
              unit,
            };
          })
          .filter(Boolean);

        const accountName =
          accountsData.find((acc) => acc.id === accountId)?.name || "Account";

        const menuName = menu?.name || "Menu";
        setEditingTemplate({
          id: null,
          name: `${menuName} for ${accountName}`,
          description: `Generated from menu: ${menuName}`,
          account_id: accountId,
        });
        setCurrentOrderItems(prePopulatedItems);
        setShowShoppingMode(true);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTemplateInternal = async (templateData) => {
    let templateId = editingTemplate?.id;
    if (templateId) {
      await base44.entities.OpeningOrderTemplate.update(templateId, templateData);
    } else {
      const newTemplate = await base44.entities.OpeningOrderTemplate.create(templateData);
      templateId = newTemplate.id;
      setEditingTemplate(prev => ({ ...prev, id: templateId }));
    }
    return templateId;
  };

  const handleSubmit = async (templateData) => {
    try {
      await saveTemplateInternal(templateData);
      setEditingTemplate(null);
      setShowShoppingMode(false);
      loadData();
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template. Please try again.");
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate({
      ...template,
      account_id: template.account_id || null,
    });
    setCurrentOrderItems(template.items || []);
    setSuggestedProductIds([]);

    setShowShoppingMode(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate({
      id: null,
      name: "",
      description: "",
      account_id: (currentUser?.role !== 'admin' && currentUser?.account_id) ? currentUser.account_id : null,
    });
    setCurrentOrderItems([]);
    setSuggestedProductIds([]);

    setShowShoppingMode(true);
  };

  const handleDelete = async (templateId) => {
    if (window.confirm("Are you sure you want to delete this opening order template?")) {
      try {
        await base44.entities.OpeningOrderTemplate.delete(templateId);
        loadData();
      } catch (error) {
        console.error("Error deleting template:", error);
        alert("Failed to delete template. Please try again.");
      }
    }
  };

  const prepareItemsWithCost = (items) => {
    return items.map((item) => {
      const ingredient = ingredients.find((ing) => ing.id === item.ingredient_id);
      let costPerUnit = 0;

      if (ingredient) {
        // 1) Explicit stored cost_per_unit
        const explicit = parseFloat(ingredient.cost_per_unit || 0);
        if (!Number.isNaN(explicit) && explicit > 0) {
          costPerUnit = explicit;
        } else {
          // 2) Try variants
          const productVariants = variants.filter(
            (v) => v.ingredient_id === ingredient.id
          );
          const bestVariant =
            productVariants.find((v) => parseFloat(v.purchase_price) > 0) ||
            productVariants[0];

          let bottlePrice = 0;
          let casePrice = 0;
          let bottlesPerCase = 0;

          if (bestVariant) {
            bottlePrice = parseFloat(bestVariant.purchase_price) || 0;
            casePrice = parseFloat(bestVariant.case_price) || 0;
            bottlesPerCase = parseFloat(bestVariant.bottles_per_case) || 0;
          }

          // 3) Fallbacks from ingredient if variants aren't priced
          if (!bottlePrice && ingredient.purchase_price) {
            bottlePrice = parseFloat(ingredient.purchase_price) || 0;
          }
          if (!casePrice && ingredient.case_price) {
            casePrice = parseFloat(ingredient.case_price) || 0;
          }

          if (item.unit === "case") {
            if (casePrice > 0) {
              costPerUnit = casePrice;
            } else if (bottlePrice > 0 && bottlesPerCase > 0) {
              costPerUnit = bottlePrice * bottlesPerCase;
            } else {
              costPerUnit = bottlePrice;
            }
          } else {
            // treat everything else as bottle-level
            costPerUnit = bottlePrice;
          }
        }
      }

      const quantity = item.quantity || 1;
      const total_item_cost = costPerUnit * quantity;

      return {
        ingredient_id: item.ingredient_id,
        ingredient_name: item.ingredient_name,
        quantity,
        unit: item.unit,
        cost_at_time_of_addition: costPerUnit,
        total_item_cost,
      };
    });
  };




  const handleAddProduct = (product) => {
    setCurrentOrderItems((prev) => [
      ...prev,
      {
        temp_id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        ...product,
      },
    ]);
  };

  const handleImportFromMenu = (variants) => {
    const newItems = variants.map(v => ({
        temp_id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        ingredient_id: v.ingredient_id,
        ingredient_name: `${v.ingredient_name} (${v.size_ml < 10 ? v.size_ml + 'L' : v.size_ml + 'ml'})`,
        quantity: 1,
        unit: 'bottle'
    }));
    setCurrentOrderItems(prev => [...prev, ...newItems]);
  };

  const handleConceptResolution = (selectedVariants) => {
    // Merge selected variants with pending suggestion quantities
    const newItems = selectedVariants.map(v => {
        const suggestion = pendingConceptSuggestions.find(s => s.ingredient_id === v.ingredient_id);
        const qty = suggestion ? suggestion.quantity : 1;
        
        return {
            temp_id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            ingredient_id: v.ingredient_id,
            ingredient_name: `${v.ingredient_name} (${v.size_ml < 10 ? v.size_ml + 'L' : v.size_ml + 'ml'})`,
            quantity: qty,
            unit: 'bottle'
        };
    });
    
    setCurrentOrderItems(prev => [...prev, ...newItems]);
    setPendingConceptIngredients([]);
    setPendingConceptSuggestions([]);
  };

  const handleLoadExistingTemplate = (templateItems) => {
    const existingIds = new Set(currentOrderItems.map((item) => item.ingredient_id));
    const newItems = templateItems
      .filter((item) => !existingIds.has(item.ingredient_id))
      .map(item => ({
        ...item,
        temp_id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      }));
    setCurrentOrderItems(prev => [...prev, ...newItems]);
  };

  const filteredTemplates = templates.filter(
    (template) =>
      template.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-8 flex items-center justify-center">
        <LoadingSpinner className="w-24 h-24 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
              <Package className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Order Builder</h1>
              </div>
              <p className="text-gray-600">Create and manage orders and templates</p>
            </div>
            <Button onClick={handleNewTemplate} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" />
              New Order
            </Button>
          </div>
        </div>

        {showShoppingMode ? (
          <div className="space-y-6 mb-8">
            <ResolveInventoryVariantsModal
                isOpen={showImportModal}
                onClose={() => {
                    setShowImportModal(false);
                    if (!fromMenuId) setImportMenuId(null);
                }}
                menuId={importMenuId}
                accountId={editingTemplate?.account_id}
                mode="order"
                onResolve={handleImportFromMenu}
            />
            
            <ResolveInventoryVariantsModal
                isOpen={showConceptResolutionModal}
                onClose={() => {
                    setShowConceptResolutionModal(false);
                    setPendingConceptIngredients([]);
                    setPendingConceptSuggestions([]);
                }}
                ingredients={pendingConceptIngredients}
                accountId={editingTemplate?.account_id}
                mode="order"
                onResolve={handleConceptResolution}
            />
            <Card className="border-2 border-blue-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {editingTemplate && editingTemplate.id
                      ? `Edit: ${editingTemplate.name}`
                      : "New Opening Order Template"}
                  </CardTitle>
                  {fromMenuId ? (
                    <Button variant="outline" onClick={() => window.location.href = createPageUrl(`MenuDetails?id=${fromMenuId}`)}>
                      ← Back to Menu
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setShowShoppingMode(false)}>
                      ← Back to List
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="templateName">Template Name *</Label>
                    <Input
                      id="templateName"
                      placeholder="e.g., Standard Bar Opening Package"
                      value={editingTemplate?.name || ""}
                      onChange={(e) =>
                        setEditingTemplate((prev) => ({ ...(prev || {}), name: e.target.value }))
                      }
                    />
                  </div>
                  {currentUser?.role === 'admin' && (
                  <div>
                    <Label htmlFor="accountSelect">Account (Optional)</Label>
                    <Select
                      value={editingTemplate?.account_id || "none"}
                      onValueChange={(value) =>
                        setEditingTemplate((prev) => ({
                          ...(prev || {}),
                          account_id: value === "none" ? null : value,
                        }))
                      }
                    >
                      <SelectTrigger id="accountSelect">
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="templateDescription">Description</Label>
                  <Textarea
                    id="templateDescription"
                    placeholder="Describe this opening order template..."
                    value={editingTemplate?.description || ""}
                    onChange={(e) =>
                      setEditingTemplate((prev) => ({ ...(prev || {}), description: e.target.value }))
                    }
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-base">Quick Add</CardTitle>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2">
                        <Select 
                            value="placeholder" 
                            onValueChange={(val) => {
                                if (val !== "placeholder") {
                                    setImportMenuId(val);
                                    setShowImportModal(true);
                                }
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Import from Menu..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="placeholder" disabled>Import from Menu...</SelectItem>
                                {menus.map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <LoadExistingTemplateDropdown
                        onAddTemplateItems={handleLoadExistingTemplate}
                        existingTemplates={templates.filter(t => t.id !== editingTemplate?.id)}
                    />
                  </div>
                </div>
              </CardHeader>
            </Card>

            <ConceptBuilder
              onSuggestionsGenerated={(ids, suggestions) => {
                setSuggestedProductIds(ids);
                
                // Identify ingredients for resolution
                const ingredientsToResolve = suggestions
                    .map(s => openingOrderIngredients.find(ing => ing.id === s.ingredient_id))
                    .filter(Boolean);
                
                if (ingredientsToResolve.length > 0) {
                    setPendingConceptIngredients(ingredientsToResolve);
                    setPendingConceptSuggestions(suggestions);
                    setShowConceptResolutionModal(true);
                }
              }}
              alcoholicIngredients={openingOrderIngredients}
            />

            <ProductSearchPanel
              suggestedProductIds={suggestedProductIds}
              onAddProduct={handleAddProduct}
              currentItems={currentOrderItems}
              allIngredients={openingOrderIngredients}
            />

            <OrderItemsPanel
              items={currentOrderItems}
              ingredients={openingOrderIngredients}
              onUpdateItem={(index, field, value) => {
                const newItems = [...currentOrderItems];
                newItems[index] = { ...newItems[index], [field]: value };
                setCurrentOrderItems(newItems);
              }}
              onRemoveItem={(index) => {
                setCurrentOrderItems(currentOrderItems.filter((_, i) => i !== index));
              }}
              onAddProduct={handleAddProduct}
            />

            {/* CoverageCheckerPanel removed per request */}

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowShoppingMode(false)}>
                    Cancel
                  </Button>
                  


                  <Button
                    onClick={() => {
                      if (currentOrderItems.length === 0) {
                        alert("Please add at least one product");
                        return;
                      }
                      if (!editingTemplate?.name || !editingTemplate.name.trim()) {
                        alert("Please enter a template name");
                        return;
                      }

                      handleSubmit({
                        name: editingTemplate.name,
                        description: editingTemplate?.description || "",
                        account_id: editingTemplate?.account_id ?? null,
                        items: currentOrderItems,
                      });
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {editingTemplate?.id ? "Update Template" : "Save as Template"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <Card className="mb-8 border border-gray-200 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-blue-500"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredTemplates.length > 0 ? (
                  filteredTemplates.map((template) => (
                    <motion.div
                      key={template.id}
                      layout
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -50 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="border border-gray-200 shadow-sm bg-white h-full flex flex-col">
                        <CardHeader>
                          <CardTitle className="text-xl text-gray-800">{template.name}</CardTitle>
                          <CardDescription className="text-sm text-gray-600 mt-1">
                            {template.description || "No description provided."}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow flex flex-col justify-between">
                          <div className="mb-4">
                            <p className="text-sm text-gray-600">
                              <span className="font-semibold">{template.items?.length || 0}</span> products
                            </p>
                            {template.account_id && (
                              <p className="text-xs text-gray-500 mt-1">
                                For: {accounts.find((acc) => acc.id === template.account_id)?.name || "N/A"}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleEdit(template)}
                                variant="outline"
                                size="sm"
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 flex-1"
                              >
                                <Edit className="w-4 h-4 mr-2" /> Edit
                              </Button>
                              <Button
                                onClick={() => handleDelete(template.id)}
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full">
                    <Card className="border border-gray-200 shadow-sm bg-white">
                      <CardContent className="text-center py-12">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">
                          {searchTerm ? "No templates match your search" : "No templates yet"}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {searchTerm
                            ? "Try adjusting your search"
                            : "Create your first opening order template to get started"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}