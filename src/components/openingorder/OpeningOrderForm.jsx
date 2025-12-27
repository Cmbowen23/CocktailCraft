import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Sparkles, Loader2, Scale } from "lucide-react";
import { isAlcoholicIngredient } from "../utils/categoryDefinitions";
import { convertToOz } from "../utils/costCalculations";
import ProductComparison from "./ProductComparison";
import AddProductSearchModal from "./AddProductSearchModal";

export default function OpeningOrderForm({ template, ingredients, accounts, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    account_id: template?.account_id || '',
    items: template?.items?.map(item => ({...item, temp_id: item.id || Math.random().toString(36).substring(2, 9)})) || []
  });

  const [conceptDescription, setConceptDescription] = useState('');
  const [parsedConcept, setParsedConcept] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSuggestingAI, setIsSuggestingAI] = useState(false);
  const [expandedComparisonIndex, setExpandedComparisonIndex] = useState(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  const alcoholicIngredients = ingredients.filter(ing => isAlcoholicIngredient(ing));

  const groupedProductsForDisplay = useMemo(() => {
    // Initialize structure with expected categories
    const structure = {
      'Spirits': {}, // Spirits will be further grouped by spirit_type
      'Liqueurs': [],
      'Vermouth': [],
      'Wine': [],
      'Beer': [],
      'Other': []
    };

    // Filter out items that no longer have a valid ingredient or are not alcoholic
    const validItems = formData.items.filter(item => 
      alcoholicIngredients.some(ing => ing.id === item.ingredient_id)
    );

    validItems.forEach(item => {
      const ingredient = alcoholicIngredients.find(ing => ing.id === item.ingredient_id);
      if (!ingredient) return; // Should not happen with the filter above, but good for type safety

      const category = ingredient.category?.toLowerCase();
      
      if (['spirit', 'spirits'].includes(category)) {
        const spiritType = ingredient.spirit_type || 'Other Spirits';
        if (!structure['Spirits'][spiritType]) {
          structure['Spirits'][spiritType] = [];
        }
        structure['Spirits'][spiritType].push(item);
      } else if (['liqueur', 'liqueurs'].includes(category)) {
        structure['Liqueurs'].push(item);
      } else if (['vermouth', 'vermouths'].includes(category)) {
        structure['Vermouth'].push(item);
      } else if (['wine', 'wines'].includes(category)) {
        structure['Wine'].push(item);
      } else if (['beer', 'beers'].includes(category)) {
        structure['Beer'].push(item);
      } else {
        structure['Other'].push(item);
      }
    });

    // Sort items within each group by ingredient name
    Object.keys(structure).forEach(key => {
      if (key === 'Spirits') {
        Object.keys(structure[key]).forEach(spiritType => {
          structure[key][spiritType].sort((a, b) => {
            const ingA = alcoholicIngredients.find(ing => ing.id === a.ingredient_id);
            const ingB = alcoholicIngredients.find(ing => ing.id === b.ingredient_id);
            return ingA?.name.localeCompare(ingB?.name || '') || 0;
          });
        });
      } else {
        structure[key].sort((a, b) => {
          const ingA = alcoholicIngredients.find(ing => ing.id === a.ingredient_id);
          const ingB = alcoholicIngredients.find(ing => ing.id === b.ingredient_id);
          return ingA?.name.localeCompare(ingB?.name || '') || 0;
        });
      }
    });

    return structure;
  }, [formData.items, alcoholicIngredients]);

  const groupedIngredientsForSelect = useMemo(() => {
    const groups = {};
    alcoholicIngredients.forEach(ing => {
      const spiritType = ing.spirit_type || ing.category || 'Other';
      if (!groups[spiritType]) {
        groups[spiritType] = [];
      }
      groups[spiritType].push(ing);
    });
    return groups;
  }, [alcoholicIngredients]);

  const calculateItemCost = (ingredient, quantity, unit) => {
    if (!ingredient) return 0;

    let bottlePrice = 0;
    let casePrice = 0;

    // Always prioritize purchase_price for single bottle cost
    if (ingredient.purchase_price) {
      bottlePrice = ingredient.purchase_price;
    }

    // Use case pricing if available
    if (ingredient.use_case_pricing && ingredient.case_price && ingredient.bottles_per_case) {
      casePrice = ingredient.case_price;
      // Only derive bottle price from case if purchase_price doesn't exist
      if (!bottlePrice) {
        bottlePrice = ingredient.case_price / ingredient.bottles_per_case;
      }
    } else if (bottlePrice && ingredient.bottles_per_case) {
      // Calculate case price from bottle price if case pricing not specified
      casePrice = bottlePrice * ingredient.bottles_per_case;
    }

    if (unit === 'case' && casePrice > 0) {
      return casePrice * quantity;
    } else if (unit === 'bottle') {
      return bottlePrice * quantity;
    }

    return 0;
  };

  const getTotalCost = () => {
    return formData.items.reduce((total, item) => {
      const ingredient = alcoholicIngredients.find(ing => ing.id === item.ingredient_id);
      return total + calculateItemCost(ingredient, item.quantity, item.unit);
    }, 0);
  };

  const handleAddProduct = (productData) => {
    setFormData({
      ...formData,
      items: [...formData.items, {
        temp_id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        ...productData
      }]
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
    // Adjust expandedComparisonIndex if the removed item was before it
    if (expandedComparisonIndex !== null) {
      if (expandedComparisonIndex === index) {
        setExpandedComparisonIndex(null);
      } else if (expandedComparisonIndex > index) {
        setExpandedComparisonIndex(expandedComparisonIndex - 1);
      }
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'ingredient_id') {
      const selectedIngredient = alcoholicIngredients.find(ing => ing.id === value);
      if (selectedIngredient) {
        newItems[index].ingredient_name = selectedIngredient.name;
      }
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const handleSelectProductFromComparison = (index, newIngredientId) => {
    handleItemChange(index, 'ingredient_id', newIngredientId);
    setExpandedComparisonIndex(null);
  };

  const handleParseConcept = async () => {
    if (!conceptDescription.trim()) {
      alert('Please describe your bar concept first.');
      return;
    }

    setIsParsing(true);
    try {
      const response = await base44.functions.invoke('parseBarConcept', {
        conceptDescription: conceptDescription.trim()
      });

      if (response.data.success) {
        setParsedConcept(response.data.parsed);
      } else {
        alert('Failed to parse concept. Please try again.');
      }
    } catch (error) {
      console.error('Error parsing concept:', error);
      alert('Failed to parse concept. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!parsedConcept) {
      alert('Please parse your concept first.');
      return;
    }

    setIsSuggestingAI(true);
    try {
      const response = await base44.functions.invoke('generateOpeningOrderSuggestions', {
        parsedIntent: parsedConcept,
        availableProducts: alcoholicIngredients.map(ing => ({
          name: ing.name,
          style: ing.style,
          substyle: ing.substyle,
          spirit_type: ing.spirit_type,
          region: ing.region,
          tier: ing.tier,
          supplier: ing.supplier,
          exclusive: ing.exclusive
        }))
      });

      if (response.data.success) {
        const suggestions = response.data.suggestions || [];
        const updatedItems = [...formData.items];
        
        suggestions.forEach(suggestion => {
          const matchedIngredient = alcoholicIngredients.find(
            ing => ing.name.toLowerCase() === suggestion.ingredient_name.toLowerCase()
          );
          
          if (!matchedIngredient) return;
          
          const existingItemIndex = updatedItems.findIndex(
            item => item.ingredient_id === matchedIngredient.id
          );
          
          if (existingItemIndex !== -1) {
            const existingItem = updatedItems[existingItemIndex];
            let suggestedQuantity = suggestion.quantity || 1;
            
            let existingBottles = existingItem.quantity;
            if (existingItem.unit === 'case' && matchedIngredient.bottles_per_case) {
              existingBottles = existingItem.quantity * matchedIngredient.bottles_per_case;
            }
            
            const combinedBottles = existingBottles + suggestedQuantity;
            
            if (matchedIngredient.bottles_per_case && combinedBottles % matchedIngredient.bottles_per_case === 0) {
              updatedItems[existingItemIndex] = {
                ...existingItem,
                quantity: combinedBottles / matchedIngredient.bottles_per_case,
                unit: 'case'
              };
            } else {
              updatedItems[existingItemIndex] = {
                ...existingItem,
                quantity: combinedBottles,
                unit: 'bottle'
              };
            }
          } else {
            let quantity = suggestion.quantity || 1;
            let unit = 'bottle';
            
            if (matchedIngredient.bottles_per_case) {
              if (quantity === matchedIngredient.bottles_per_case) {
                quantity = 1;
                unit = 'case';
              } else if (quantity > matchedIngredient.bottles_per_case && quantity % matchedIngredient.bottles_per_case === 0) {
                quantity = quantity / matchedIngredient.bottles_per_case;
                unit = 'case';
              }
            }
            
            updatedItems.push({
              temp_id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
              ingredient_id: matchedIngredient.id,
              ingredient_name: matchedIngredient.name,
              quantity: quantity,
              unit: unit
            });
          }
        });

        if (updatedItems.length > formData.items.length) {
          setFormData({ ...formData, items: updatedItems });
        } else {
          alert('No matching products found. Please try a different description.');
        }
      } else {
        alert('Failed to generate suggestions. Please try again.');
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      alert('Failed to generate suggestions. Please try again.');
    } finally {
      setIsSuggestingAI(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please provide a template name.');
      return;
    }
    
    if (formData.items.length === 0) {
      alert('Please add at least one product to the template.');
      return;
    }
    
    const hasInvalidItems = formData.items.some(item => !item.ingredient_id);
    if (hasInvalidItems) {
      alert('Please select an ingredient for all items.');
      return;
    }
    
    onSubmit(formData);
  };

  const renderItemRow = (item) => {
    // Find the original index of this item in the formData.items array
    const actualIndex = formData.items.indexOf(item);
    const ingredient = alcoholicIngredients.find(ing => ing.id === item.ingredient_id);
    const itemCost = calculateItemCost(ingredient, item.quantity, item.unit);
    
    return (
      <React.Fragment key={item.temp_id || item.id || actualIndex}>
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-4">
              <Label htmlFor={`ingredient-${actualIndex}`} className="sr-only">Product</Label>
              <Select
                value={item.ingredient_id}
                onValueChange={(value) => handleItemChange(actualIndex, 'ingredient_id', value)}
              >
                <SelectTrigger id={`ingredient-${actualIndex}`}>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedIngredientsForSelect).map(([spiritType, ings]) => (
                    <SelectGroup key={spiritType}>
                      <SelectLabel>{spiritType}</SelectLabel>
                      {ings.map(ing => (
                        <SelectItem key={ing.id} value={ing.id}>
                          {ing.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="md:col-span-2">
              <Label htmlFor={`quantity-${actualIndex}`} className="sr-only">Quantity</Label>
              <Input
                id={`quantity-${actualIndex}`}
                type="number"
                min="1"
                step="1"
                value={item.quantity}
                onChange={(e) => handleItemChange(actualIndex, 'quantity', parseFloat(e.target.value) || 1)}
              />
            </div>
            
            <div className="md:col-span-2">
              <Label htmlFor={`unit-${actualIndex}`} className="sr-only">Unit</Label>
              <Select
                value={item.unit}
                onValueChange={(value) => handleItemChange(actualIndex, 'unit', value)}
              >
                <SelectTrigger id={`unit-${actualIndex}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottle">Bottle</SelectItem>
                  {ingredient?.bottles_per_case && <SelectItem value="case">Case ({ingredient.bottles_per_case} btl)</SelectItem>}
                  <SelectItem value="liter">Liter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="md:col-span-2">
              <div className="h-10 flex items-center font-semibold text-green-700">
                ${itemCost.toFixed(2)}
              </div>
            </div>
            
            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setExpandedComparisonIndex(expandedComparisonIndex === actualIndex ? null : actualIndex)}
                className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                title="Compare similar products"
              >
                <Scale className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveItem(actualIndex)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        {expandedComparisonIndex === actualIndex && ingredient && (
          <div className="mt-2 pl-4 border-l-2 border-blue-200">
            <ProductComparison 
              currentIngredientId={ingredient.id} 
              allIngredients={alcoholicIngredients} 
              onClose={() => setExpandedComparisonIndex(null)}
              onSelectProduct={(newIngredientId) => handleSelectProductFromComparison(actualIndex, newIngredientId)}
            />
          </div>
        )}
      </React.Fragment>
    );
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Template Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Standard Bar Opening Package"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe what this template is for..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="account_id">Associate with Account (Optional)</Label>
          <Select
            value={formData.account_id}
            onValueChange={(value) => setFormData({ ...formData, account_id: value })}
          >
            <SelectTrigger id="account_id">
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None</SelectItem>
              {accounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Natural Language Bar Concept
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="conceptDescription" className="text-base font-semibold text-gray-800 mb-2 block">
              Describe your bar concept
            </Label>
            <p className="text-sm text-gray-600 mb-3">
              Example: "Irish whiskey bar with a focus on classics and neat pours" or "High-volume sports bar with simple vodka and tequila drinks"
            </p>
            <Textarea
              id="conceptDescription"
              value={conceptDescription}
              onChange={(e) => setConceptDescription(e.target.value)}
              placeholder="E.g., Small mezcal and tequila speakeasy with 10 signature cocktails, Hotel rooftop cocktail bar with spritzes and premium gin, Neighborhood Italian restaurant with Negroni & aperitivo focus..."
              rows={3}
              className="border-gray-300 focus:border-purple-500"
            />
          </div>

          <Button
            type="button"
            onClick={handleParseConcept}
            disabled={isParsing || !conceptDescription.trim()}
            variant="outline"
            className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing Concept...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Parse Concept
              </>
            )}
          </Button>

          {parsedConcept && (
            <div className="p-4 bg-white rounded-lg border border-purple-200 space-y-3">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-green-600">✓</span> Parsed Concept
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Venue Type:</span>
                  <p className="text-gray-600">{parsedConcept.venue_type}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Program Style:</span>
                  <p className="text-gray-600">{parsedConcept.program_style}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Primary Focus:</span>
                  <p className="text-gray-600">{parsedConcept.primary_spirit_focus.join(', ')}</p>
                </div>
                {parsedConcept.secondary_spirit_focus && parsedConcept.secondary_spirit_focus.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Secondary Focus:</span>
                    <p className="text-gray-600">{parsedConcept.secondary_spirit_focus.join(', ')}</p>
                  </div>
                )}
                {parsedConcept.approximate_menu_size && (
                  <div>
                    <span className="font-medium text-gray-700">Menu Size:</span>
                    <p className="text-gray-600">{parsedConcept.approximate_menu_size} cocktails</p>
                  </div>
                )}
                {parsedConcept.price_sensitivity && (
                  <div>
                    <span className="font-medium text-gray-700">Price Level:</span>
                    <p className="text-gray-600">{parsedConcept.price_sensitivity}</p>
                  </div>
                )}
              </div>
              {parsedConcept.special_focus && parsedConcept.special_focus.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">Special Focus:</span>
                  <p className="text-gray-600">{parsedConcept.special_focus.join(', ')}</p>
                </div>
              )}
            </div>
          )}
          
          <Button
            type="button"
            onClick={handleGenerateSuggestions}
            disabled={isSuggestingAI || !parsedConcept}
            className="bg-purple-600 hover:bg-purple-700 w-full"
          >
            {isSuggestingAI ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Product Suggestions...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Opening Order
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg">Products</Label>
          <Button type="button" onClick={() => setShowAddProductModal(true)} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>

        {formData.items.length === 0 ? (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="text-center py-8">
              <p className="text-gray-600">No products added yet. Use the "Add Product" button or AI suggestions to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Spirits Group */}
            {Object.keys(groupedProductsForDisplay.Spirits).length > 0 && (
              <Card className="border border-gray-200">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <CardTitle className="text-lg font-bold text-gray-900">Spirits</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {Object.entries(groupedProductsForDisplay.Spirits)
                    .sort(([typeA], [typeB]) => typeA.localeCompare(typeB))
                    .map(([spiritType, items]) => (
                      <div key={spiritType} className="pl-4 border-l-4 border-blue-300">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">{spiritType}</h4>
                        <div className="space-y-3">
                          {items.map(item => renderItemRow(item))}
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}

            {/* Other Categories */}
            {['Liqueurs', 'Vermouth', 'Wine', 'Beer', 'Other'].map(categoryName => {
              const categoryItems = groupedProductsForDisplay[categoryName];
              if (!categoryItems || categoryItems.length === 0) return null;

              return (
                <Card key={categoryName} className="border border-gray-200">
                  <CardHeader className="bg-gray-50">
                    <CardTitle className="text-base font-semibold text-gray-800">{categoryName}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {categoryItems.map(item => renderItemRow(item))}
                  </CardContent>
                </Card>
              );
            })}
            
            {formData.items.length > 0 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4 flex justify-between items-center">
                  <span className="font-semibold text-gray-800">Total Order Cost:</span>
                  <span className="text-2xl font-bold text-blue-700">${getTotalCost().toFixed(2)}</span>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          {template?.id ? 'Update Template' : 'Create Template'}
        </Button>
      </div>

      <AddProductSearchModal 
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onAddProduct={handleAddProduct}
        alcoholicIngredients={alcoholicIngredients}
      />
    </form>
  );
}