import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { base44 } from '@/api/base44Client';
import { calculateBatchMetrics } from '../utils/batchCalculations';
import { convertToMl } from '../utils/costCalculations';

const containerOptions = [
    "750ml Bottle", "1L Bottle", "375ml Bottle", "1.75L Handle", "5 Gallon Bucket", "3 Gallon Cambro", "2 Gallon Cambro", "1 Gallon Cambro"
];

// Helper to check if ingredient should be batched by default
const shouldBatchByDefault = (ingredientName, category) => {
    const citrus = ['lemon', 'lime', 'orange', 'grapefruit'];
    const lowerName = ingredientName.toLowerCase();
    
    if (citrus.some(c => lowerName.includes(c))) return false;
    
    // Simple rule: spirits, liqueurs, syrups, vermouths usually pre-batch
    // Juices, carbonated, perishables usually service
    const serviceCategories = ['juice', 'citrus', 'garnish', 'ice'];
    if (serviceCategories.includes(category?.toLowerCase())) return false;
    
    return true;
};

export default function InsertBatchBlockModal({ isOpen, onClose, recipes, allIngredients, onInsert }) {
    const [selectedRecipeId, setSelectedRecipeId] = useState("");
    const [containerType, setContainerType] = useState("1L Bottle");
    const [containerCount, setContainerCount] = useState(1);
    const [titleOverride, setTitleOverride] = useState("");

    const handleInsert = () => {
        if (!selectedRecipeId) return;

        const recipe = recipes.find(r => r.id === selectedRecipeId);
        if (!recipe) return;

        // Calculate standard metrics for snapshot
        // We need to establish which ingredients are batched to get accurate servings/volume
        const ingredientOverrides = {};
        const originalBatchAmountsMlPerServing = new Map();

        recipe.ingredients.forEach(ing => {
            // Check if recipe has saved settings
            if (recipe.batch_settings?.ingredient_overrides?.[ing.ingredient_name]) {
                ingredientOverrides[ing.ingredient_name] = recipe.batch_settings.ingredient_overrides[ing.ingredient_name];
            } else {
                // Default logic
                const matchedIng = allIngredients.find(i => i.name.toLowerCase() === ing.ingredient_name.toLowerCase());
                ingredientOverrides[ing.ingredient_name] = shouldBatchByDefault(ing.ingredient_name, matchedIng?.category) ? 'batch' : 'service';
            }

            const amountMl = convertToMl(ing.amount, ing.unit, ing.ingredient_name, allIngredients);
            originalBatchAmountsMlPerServing.set(ing.ingredient_name, amountMl);
        });

        // Use saved container settings if available, otherwise form defaults
        const finalContainerType = recipe.batch_settings?.container_type || containerType;
        const finalContainerCount = recipe.batch_settings?.container_count || containerCount;
        
        // Calculate
        const metrics = calculateBatchMetrics({
            recipe,
            allIngredients,
            ingredientOverrides,
            containerType: finalContainerType,
            containerCount: finalContainerCount,
            isContainerCustom: recipe.batch_settings?.is_container_custom || false,
            scaleFactor: recipe.batch_settings?.scale_factor || 1,
            includeDilution: recipe.batch_settings?.include_dilution || false,
            dilutionPercentage: recipe.batch_settings?.dilution_percentage || 25,
            constrainToTotalVolume: recipe.batch_settings?.constrain_to_total_volume ?? true,
            originalBatchAmountsMlPerServing
        });

        onInsert({
            type: 'batch',
            recipeId: selectedRecipeId,
            title: titleOverride || `Batch Prep: ${recipe.name}`,
            containerType: finalContainerType,
            containerCount: finalContainerCount,
            standardVolumeMl: metrics.totalVolumeMl,
            standardServings: metrics.totalServings
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Insert Batch Prep Block</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label>Select Recipe</Label>
                        <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Search recipes..." />
                            </SelectTrigger>
                            <SelectContent>
                                {recipes.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {!selectedRecipeId && (
                        <p className="text-sm text-gray-500">Select a recipe to continue</p>
                    )}

                    {selectedRecipeId && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Default Container</Label>
                                    <Select value={containerType} onValueChange={setContainerType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {containerOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Count</Label>
                                    <Input 
                                        type="number" 
                                        min="1" 
                                        value={containerCount} 
                                        onChange={e => setContainerCount(Math.max(1, parseInt(e.target.value) || 1))} 
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Section Title (Optional)</Label>
                                <Input 
                                    placeholder="e.g. House Margarita Batch" 
                                    value={titleOverride}
                                    onChange={e => setTitleOverride(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleInsert} disabled={!selectedRecipeId}>Insert Block</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}