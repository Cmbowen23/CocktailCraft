import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function ProductComparisonView({ selectedProducts, allIngredients, onRemoveProduct, onClose }) {
    // Calculate cost per oz for each product
    const productsWithCost = useMemo(() => {
        return selectedProducts.map(productId => {
            const ingredient = allIngredients.find(ing => ing.id === productId);
            if (!ingredient) return null;

            let bottleCost = 0;
            if (ingredient.use_case_pricing && ingredient.case_price && ingredient.bottles_per_case) {
                bottleCost = ingredient.case_price / ingredient.bottles_per_case;
            } else if (ingredient.cost_per_unit && ingredient.unit) {
                bottleCost = ingredient.cost_per_unit;
            }

            // Assuming standard 750ml bottle = 25.36 oz
            const costPerOz = bottleCost / 25.36;

            return {
                id: ingredient.id,
                name: ingredient.name,
                category: ingredient.category,
                spirit_type: ingredient.spirit_type,
                style: ingredient.style,
                supplier: ingredient.supplier,
                abv: ingredient.abv,
                cost_per_unit: ingredient.cost_per_unit,
                cost_per_oz: costPerOz,
                bottles_per_case: ingredient.bottles_per_case,
                use_case_pricing: ingredient.use_case_pricing,
                case_price: ingredient.case_price,
            };
        }).filter(Boolean);
    }, [selectedProducts, allIngredients]);

    // Group by category
    const groupedByCategory = useMemo(() => {
        const groups = {};
        
        productsWithCost.forEach(product => {
            const category = product.category || 'Uncategorized';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(product);
        });

        // Sort products within each group by cost per oz
        Object.keys(groups).forEach(category => {
            groups[category].sort((a, b) => a.cost_per_oz - b.cost_per_oz);
        });

        return groups;
    }, [productsWithCost]);

    // Group by style
    const groupedByStyle = useMemo(() => {
        const groups = {};
        
        productsWithCost.forEach(product => {
            const style = product.style || 'Unknown Style';
            if (!groups[style]) {
                groups[style] = [];
            }
            groups[style].push(product);
        });

        Object.keys(groups).forEach(style => {
            groups[style].sort((a, b) => a.cost_per_oz - b.cost_per_oz);
        });

        return groups;
    }, [productsWithCost]);

    const [viewMode, setViewMode] = React.useState('category'); // 'category' or 'style'

    const currentGroups = viewMode === 'category' ? groupedByCategory : groupedByStyle;
    const groupNames = Object.keys(currentGroups).sort();

    if (productsWithCost.length === 0) {
        return (
            <Card className="border border-gray-200 shadow-sm bg-white">
                <CardContent className="text-center py-8">
                    <p className="text-gray-500">No products selected for comparison</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    <Button
                        variant={viewMode === 'category' ? 'default' : 'outline'}
                        onClick={() => setViewMode('category')}
                        size="sm"
                    >
                        By Category
                    </Button>
                    <Button
                        variant={viewMode === 'style' ? 'default' : 'outline'}
                        onClick={() => setViewMode('style')}
                        size="sm"
                    >
                        By Style
                    </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    <X className="w-4 h-4 mr-2" />
                    Close Comparison
                </Button>
            </div>

            <div className="space-y-6">
                {groupNames.map(groupName => (
                    <Card key={groupName} className="border border-gray-200 shadow-sm bg-white">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg text-gray-900 capitalize">{groupName}</CardTitle>
                                <Badge variant="outline" className="text-blue-700">
                                    {currentGroups[groupName].length} product{currentGroups[groupName].length !== 1 ? 's' : ''}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-2 font-medium text-gray-700">Product</th>
                                            <th className="text-left py-2 font-medium text-gray-700">Supplier</th>
                                            <th className="text-center py-2 font-medium text-gray-700">ABV</th>
                                            <th className="text-right py-2 font-medium text-gray-700">Bottle Cost</th>
                                            <th className="text-right py-2 font-medium text-gray-700">Cost/oz</th>
                                            <th className="text-center py-2 font-medium text-gray-700">Case Size</th>
                                            <th className="text-center py-2 font-medium text-gray-700"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentGroups[groupName].map((product) => (
                                            <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3">
                                                    <div>
                                                        <div className="font-medium text-gray-900">{product.name}</div>
                                                        {product.spirit_type && (
                                                            <div className="text-sm text-gray-600">{product.spirit_type}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 text-gray-600">{product.supplier || '-'}</td>
                                                <td className="py-3 text-center text-gray-700">{product.abv || 0}%</td>
                                                <td className="py-3 text-right font-medium">${product.cost_per_unit?.toFixed(2) || '0.00'}</td>
                                                <td className="py-3 text-right font-bold text-blue-700">${product.cost_per_oz?.toFixed(2) || '0.00'}</td>
                                                <td className="py-3 text-center text-gray-600">
                                                    {product.bottles_per_case || '-'}
                                                </td>
                                                <td className="py-3 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onRemoveProduct(product.id)}
                                                        className="text-red-500 hover:text-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}