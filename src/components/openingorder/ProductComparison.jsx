import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Scale, Search, Check } from "lucide-react";
import { isAlcoholicIngredient } from "../utils/categoryDefinitions";
import { convertToOz } from "../utils/costCalculations";

const calculateCostPerOz = (ingredient, allIngredients = []) => {
    if (!ingredient || !isAlcoholicIngredient(ingredient)) return null;

    // Always prioritize purchase_price for single bottle cost
    let bottleCost = 0;
    if (ingredient.purchase_price) {
        bottleCost = ingredient.purchase_price;
    } else if (ingredient.use_case_pricing && ingredient.case_price && ingredient.bottles_per_case) {
        bottleCost = ingredient.case_price / ingredient.bottles_per_case;
    } else if (ingredient.cost_per_unit) {
        bottleCost = ingredient.cost_per_unit;
    }

    if (bottleCost === 0) return null;

    let volumeOz = 25.36; // Default fallback
    if (ingredient.purchase_quantity && ingredient.purchase_unit) {
        volumeOz = convertToOz(ingredient.purchase_quantity, ingredient.purchase_unit, ingredient.name, allIngredients) || 25.36;
    }
    
    return bottleCost / volumeOz;
};

const getHigherClassification = (ingredient) => {
    const category = ingredient.category?.toLowerCase() || '';
    if (['spirit', 'spirits'].includes(category)) return 'Spirits';
    if (['liqueur', 'liqueurs'].includes(category)) return 'Liqueurs';
    if (['vermouth', 'vermouths'].includes(category)) return 'Vermouth';
    if (['wine', 'wines'].includes(category)) return 'Wine';
    if (['beer', 'beers'].includes(category)) return 'Beer';
    return 'Other';
};

export default function ProductComparison({ currentIngredientId, allIngredients, onClose, onSelectProduct }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [manuallyAdded, setManuallyAdded] = useState([]);

    const currentIngredient = useMemo(() => 
        allIngredients.find(ing => ing.id === currentIngredientId),
        [currentIngredientId, allIngredients]
    );

    const currentCostPerOz = useMemo(() => 
        calculateCostPerOz(currentIngredient, allIngredients),
        [currentIngredient, allIngredients]
    );

    const similarProducts = useMemo(() => {
        if (!currentIngredient || currentCostPerOz === null) return [];

        // Helper to check if an ingredient is flavored
        const isFlavored = (ingredient) => 
            ingredient.style?.toLowerCase().includes('flavored') || 
            ingredient.substyle?.toLowerCase().includes('flavored');

        const currentIsFlavored = isFlavored(currentIngredient);

        return allIngredients.filter(ing => {
            if (ing.id === currentIngredientId || !isAlcoholicIngredient(ing)) {
                return false;
            }

            // Exclude flavored products if current is not flavored (and vice versa)
            if (currentIsFlavored !== isFlavored(ing)) {
                return false;
            }

            // Must match spirit_type (e.g., Whiskey, Gin, Vodka)
            if (currentIngredient.spirit_type && ing.spirit_type !== currentIngredient.spirit_type) {
                return false;
            }

            // If no spirit_type, must match category
            if (!currentIngredient.spirit_type && ing.category !== currentIngredient.category) {
                return false;
            }

            // For non-flavored products, strictly match style
            if (!currentIsFlavored && currentIngredient.style) {
                const styleMatch = ing.style && 
                                  currentIngredient.style.toLowerCase() === ing.style.toLowerCase();
                if (!styleMatch) {
                    return false;
                }
            }

            const ingCostPerOz = calculateCostPerOz(ing, allIngredients);
            if (ingCostPerOz === null) return false;

            const lowerBound = currentCostPerOz * 0.8;
            const upperBound = currentCostPerOz * 1.2;
            return ingCostPerOz >= lowerBound && ingCostPerOz <= upperBound;
        })
        .map(ing => ({
            id: ing.id,
            name: ing.name,
            supplier: ing.supplier,
            abv: ing.abv,
            cost_per_unit: ing.cost_per_unit,
            cost_per_oz: calculateCostPerOz(ing, allIngredients),
            bottles_per_case: ing.bottles_per_case,
            spirit_type: ing.spirit_type,
            category: ing.category,
            style: ing.style,
            substyle: ing.substyle,
            styleMatch: currentIngredient.style && ing.style && 
                       currentIngredient.style.toLowerCase() === ing.style.toLowerCase(),
            substyleMatch: currentIngredient.substyle && ing.substyle && 
                          currentIngredient.substyle.toLowerCase() === ing.substyle.toLowerCase(),
        }))
        .sort((a, b) => {
            // Prioritize style/substyle matches, then by price
            if (a.styleMatch && !b.styleMatch) return -1;
            if (!a.styleMatch && b.styleMatch) return 1;
            if (a.substyleMatch && !b.substyleMatch) return -1;
            if (!a.substyleMatch && b.substyleMatch) return 1;
            return a.cost_per_oz - b.cost_per_oz;
        })
        .slice(0, 5);
    }, [currentIngredient, currentIngredientId, allIngredients, currentCostPerOz]);

    const searchResults = useMemo(() => {
        if (!currentIngredient || searchTerm.length < 3) return [];

        // Helper to check if an ingredient is flavored
        const isFlavored = (ingredient) => 
            ingredient.style?.toLowerCase().includes('flavored') || 
            ingredient.substyle?.toLowerCase().includes('flavored');

        const currentIsFlavored = isFlavored(currentIngredient);

        const searchLower = searchTerm.toLowerCase();
        return allIngredients.filter(ing => {
            if (ing.id === currentIngredientId || !isAlcoholicIngredient(ing)) {
                return false;
            }

            // Exclude flavored products if current is not flavored (and vice versa)
            if (currentIsFlavored !== isFlavored(ing)) {
                return false;
            }

            // Must match spirit_type first
            if (currentIngredient.spirit_type && ing.spirit_type !== currentIngredient.spirit_type) {
                return false;
            }

            // If no spirit_type, must match category
            if (!currentIngredient.spirit_type && ing.category !== currentIngredient.category) {
                return false;
            }

            // For non-flavored products, prefer matching style in search
            if (!currentIsFlavored && currentIngredient.style && ing.style) {
                const styleMatch = currentIngredient.style.toLowerCase() === ing.style.toLowerCase();
                if (!styleMatch) {
                    return false;
                }
            }

            return ing.name.toLowerCase().includes(searchLower) ||
                   ing.supplier?.toLowerCase().includes(searchLower) ||
                   ing.style?.toLowerCase().includes(searchLower);
        })
        .slice(0, 10)
        .map(ing => ({
            id: ing.id,
            name: ing.name,
            supplier: ing.supplier,
            abv: ing.abv,
            cost_per_unit: ing.cost_per_unit,
            cost_per_oz: calculateCostPerOz(ing, allIngredients),
            bottles_per_case: ing.bottles_per_case,
            spirit_type: ing.spirit_type,
            category: ing.category,
            style: ing.style,
            substyle: ing.substyle,
        }));
    }, [currentIngredient, searchTerm, allIngredients, currentIngredientId]);

    const allComparisonProducts = useMemo(() => {
        const combined = [...similarProducts];
        manuallyAdded.forEach(addedId => {
            if (!combined.find(p => p.id === addedId)) {
                const ing = allIngredients.find(i => i.id === addedId);
                if (ing) {
                    combined.push({
                        id: ing.id,
                        name: ing.name,
                        supplier: ing.supplier,
                        abv: ing.abv,
                        cost_per_unit: ing.cost_per_unit,
                        cost_per_oz: calculateCostPerOz(ing, allIngredients),
                        bottles_per_case: ing.bottles_per_case,
                        spirit_type: ing.spirit_type,
                        category: ing.category,
                    });
                }
            }
        });
        return combined.sort((a, b) => a.cost_per_oz - b.cost_per_oz);
    }, [similarProducts, manuallyAdded, allIngredients]);

    const groupedProducts = useMemo(() => {
        const groups = {};
        allComparisonProducts.forEach(product => {
            const higherClass = getHigherClassification(product);
            if (!groups[higherClass]) {
                groups[higherClass] = {};
            }

            if (higherClass === 'Spirits' && product.spirit_type) {
                const spiritType = product.spirit_type;
                if (!groups[higherClass][spiritType]) {
                    groups[higherClass][spiritType] = [];
                }
                groups[higherClass][spiritType].push(product);
            } else {
                if (!groups[higherClass]['_default']) {
                    groups[higherClass]['_default'] = [];
                }
                groups[higherClass]['_default'].push(product);
            }
        });
        return groups;
    }, [allComparisonProducts]);

    const handleAddToComparison = (productId) => {
        if (!manuallyAdded.includes(productId)) {
            setManuallyAdded([...manuallyAdded, productId]);
        }
        setSearchTerm('');
    };

    const handleRemoveFromComparison = (productId) => {
        setManuallyAdded(manuallyAdded.filter(id => id !== productId));
    };

    if (!currentIngredient) {
        return (
            <Card className="border border-gray-200 shadow-sm bg-white">
                <CardContent className="text-center py-4">
                    <p className="text-gray-500">Product details not available.</p>
                </CardContent>
            </Card>
        );
    }

    const ProductRow = ({ product, isManual = false }) => (
        <div className="bg-white rounded-md p-3 shadow-sm border border-gray-100 hover:border-blue-200 transition-colors">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-900">{product.name}</div>
                        {product.styleMatch && (
                            <Badge className="text-xs bg-green-100 text-green-800">Same Style</Badge>
                        )}
                    </div>
                    <div className="text-sm text-gray-700">
                        {product.supplier || 'N/A'}
                        {product.style && ` • ${product.style}`}
                        {product.substyle && ` • ${product.substyle}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        ${product.cost_per_unit?.toFixed(2) || '0.00'}/bottle | 
                        ${product.cost_per_oz?.toFixed(2) || '0.00'}/oz
                        {product.abv && ` | ${product.abv}% ABV`}
                    </div>
                </div>
                <div className="flex gap-1">
                    {onSelectProduct && (
                        <Button
                            size="sm"
                            onClick={() => onSelectProduct(product.id)}
                            className="bg-blue-600 hover:bg-blue-700 h-8"
                        >
                            <Check className="w-3 h-3 mr-1" />
                            Select
                        </Button>
                    )}
                    {isManual && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFromComparison(product.id)}
                            className="text-red-500 hover:text-red-600 h-8"
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <Card className="border border-blue-200 bg-blue-50/50 shadow-sm">
            <CardHeader className="py-3 px-4 flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-blue-600" />
                    Comparing {currentIngredient.spirit_type || currentIngredient.category}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={onClose} className="text-blue-600 hover:bg-blue-100 hover:text-blue-800">
                    <X className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                <div className="bg-gradient-to-r from-blue-100 to-blue-50 rounded-md p-3 shadow-sm border-2 border-blue-300">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-blue-600 text-white border-blue-600">Current</Badge>
                        <div className="font-semibold text-base text-blue-900">{currentIngredient.name}</div>
                    </div>
                    <div className="text-sm text-gray-700">{currentIngredient.supplier || 'N/A'}</div>
                    <div className="text-xs text-gray-600 mt-1">
                        ${currentIngredient.cost_per_unit?.toFixed(2) || '0.00'}/bottle | 
                        ${currentCostPerOz?.toFixed(2) || '0.00'}/oz
                        {currentIngredient.abv && ` | ${currentIngredient.abv}% ABV`}
                    </div>
                </div>

                <div className="pt-2 border-t border-blue-100">
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search similar products (min 3 chars)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {searchResults.length > 0 && (
                        <div className="mb-3 p-2 bg-white rounded border border-gray-200 max-h-48 overflow-y-auto">
                            <p className="text-xs font-medium text-gray-600 mb-2">Search Results:</p>
                            {searchResults.map(product => (
                                <div key={product.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">{product.name}</div>
                                        <div className="text-xs text-gray-600">${product.cost_per_oz?.toFixed(2)}/oz</div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAddToComparison(product.id)}
                                        className="h-7 text-xs"
                                    >
                                        Add
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {Object.keys(groupedProducts).length > 0 ? (
                        Object.entries(groupedProducts).map(([higherClass, subGroups]) => (
                            <div key={higherClass} className="mb-4">
                                <h4 className="text-sm font-semibold text-blue-700 mb-2">{higherClass}</h4>
                                {higherClass === 'Spirits' ? (
                                    Object.entries(subGroups).map(([spiritType, products]) => (
                                        <div key={spiritType} className="mb-3 pl-2 border-l-2 border-blue-200">
                                            <h5 className="text-xs font-medium text-gray-700 mb-1.5">{spiritType}</h5>
                                            <div className="space-y-2">
                                                {products.map(product => (
                                                    <ProductRow
                                                        key={product.id}
                                                        product={product}
                                                        isManual={manuallyAdded.includes(product.id)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="space-y-2">
                                        {subGroups['_default']?.map(product => (
                                            <ProductRow
                                                key={product.id}
                                                product={product}
                                                isManual={manuallyAdded.includes(product.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-sm text-gray-600 text-center py-2">
                            No similar products found within +/- 20% price range.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}