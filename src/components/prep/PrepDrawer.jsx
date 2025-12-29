import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FlaskConical, Scale, PackagePlus, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import PrepBatchCalculator from "@/components/prep/PrepBatchCalculator";
import PrepChecklist from "@/components/prep/PrepChecklist";
import CocktailLoader from "@/components/ui/CocktailLoader";

export default function PrepDrawer({ task, onClose, onUpdateTask }) {
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [allIngredients, setAllIngredients] = useState([]);

    // Inventory State
    const [addToInventory, setAddToInventory] = useState(false);
    const [bottleLabel, setBottleLabel] = useState("");
    const [bottleColors, setBottleColors] = useState([]);
    const [isSavingInventory, setIsSavingInventory] = useState(false);

    const TAPE_COLORS = [
        { name: 'Red', value: '#ef4444' }, { name: 'Blue', value: '#3b82f6' }, { name: 'Green', value: '#22c55e' },
        { name: 'Yellow', value: '#eab308' }, { name: 'Orange', value: '#f97316' }, { name: 'Purple', value: '#a855f7' },
        { name: 'White', value: '#ffffff', border: true }, { name: 'Black', value: '#000000' },
    ];

    useEffect(() => {
        if (task && task.itemId) {
            loadRecipeDetails(task.itemId);
            setAddToInventory(false);
            setBottleLabel("");
            setBottleColors([]);
        }
    }, [task?.id, task?.itemId]);

    useEffect(() => {
        if (recipe) {
            const settings = recipe.batch_settings || {};
            const inv = settings.inventory_bottle || {};
            const enabled = inv.enabled ?? settings.track_batch_inventory ?? false;
            const label = inv.label ?? settings.default_bottle_label ?? `${recipe.name} Batch`;
            const colors = inv.colors ?? settings.default_bottle_colors ?? [];
            setAddToInventory(Boolean(enabled));
            setBottleLabel(label);
            setBottleColors(colors);
        }
    }, [recipe]);

    const toggleColor = (colorValue) => {
        if (bottleColors.includes(colorValue)) {
            setBottleColors(bottleColors.filter(c => c !== colorValue));
        } else {
            if (bottleColors.length < 3) {
                setBottleColors([...bottleColors, colorValue]);
            } else {
                toast.error("Maximum 3 colors allowed");
            }
        }
    };

    const handleSaveToInventory = async () => {
        if (!recipe) return;
        setIsSavingInventory(true);
        try {
            const user = await base44.auth.me();
            if (!user.account_id) {
                toast.error("No account linked. Cannot save inventory.");
                return;
            }

            const currentSettings = recipe.batch_settings || {};
            const inv = currentSettings.inventory_bottle || {};
            
            const newInventoryBottle = {
                ...inv,
                enabled: true,
                size_ml: inv.size_ml ?? 750,
                label: bottleLabel || null,
                colors: bottleColors || []
            };
            
            const newSettings = {
                ...currentSettings,
                inventory_bottle: newInventoryBottle,
                track_batch_inventory: newInventoryBottle.enabled,
                default_bottle_label: newInventoryBottle.label,
                default_bottle_colors: newInventoryBottle.colors
            };

            const updatedRecipe = await base44.entities.Recipe.update(recipe.id, {
                batch_settings: newSettings
            });

            const ingredientForBatch = allIngredients.find(i => i.sub_recipe_id === recipe.id);
            if (ingredientForBatch) {
                const inventoryItems = await base44.entities.InventoryItem.filter({
                    ingredient_id: ingredientForBatch.id,
                    account_id: user.account_id
                });
                
                const quantityToAdd = Number(task.quantity) || 1;
                
                if (inventoryItems && inventoryItems.length > 0) {
                    const inventoryItem = inventoryItems[0];
                    const newStock = (Number(inventoryItem.current_stock) || 0) + quantityToAdd;
                    
                    await base44.entities.InventoryItem.update(inventoryItem.id, {
                        current_stock: newStock
                    });
                    
                    toast.success(`Added ${quantityToAdd}x to inventory`);
                } else {
                    // Create new inventory item with the batch quantity
                    const variants = await base44.entities.ProductVariant.filter({ ingredient_id: ingredientForBatch.id });
                    const variant = variants?.[0];
                    
                    if (variant) {
                        await base44.entities.InventoryItem.create({
                            product_variant_id: variant.id,
                            ingredient_id: ingredientForBatch.id,
                            account_id: user.account_id,
                            current_stock: quantityToAdd,
                            reorder_point: 0,
                            unit: 'bottle',
                            location_id: null,
                            is_batch_bottle: true,
                            batch_recipe_id: recipe.id,
                            batch_neck_colors: bottleColors
                        });
                        
                        toast.success(`Created inventory item with ${quantityToAdd}x bottles`);
                    } else {
                        toast.error("No product variant found for this batch");
                    }
                }
            }
            
            setAddToInventory(false);
            setRecipe(updatedRecipe);

        } catch (error) {
            console.error("Inventory save error:", error);
            toast.error("Failed to save to inventory.");
        } finally {
            setIsSavingInventory(false);
        }
    };

    const loadRecipeDetails = async (recipeId) => {
        setLoading(true);
        try {
            const [recipeData, ingredientsData] = await Promise.all([
                base44.entities.Recipe.get(recipeId),
                base44.entities.Ingredient.list()
            ]);
            setRecipe(recipeData);
            setAllIngredients(ingredientsData || []);
        } catch (error) {
            console.error("Error loading recipe details:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChecklistUpdate = (updatedTask) => {
        if (onUpdateTask) {
            onUpdateTask(updatedTask);
        }
    };

    if (!task) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                onClick={onClose}
            />
            <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${task.itemType === 'batch' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                            {task.itemType === 'batch' ? <FlaskConical className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 text-lg leading-none">{task.name}</h2>
                            <p className="text-xs text-gray-500 mt-1">
                                {task.itemType === 'batch' ? 'Batch Prep' : 'Sub-Recipe Prep'} • Quantity: {task.quantity}x
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <CocktailLoader className="w-12 h-12 text-blue-600" />
                        </div>
                    ) : recipe ? (
                        <>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-900 border-b pb-2">Calculator</h3>
                                <PrepBatchCalculator
                                    // FIX: Pass the full recipe object so calculator sees the saved settings
                                    recipe={recipe}
                                    allIngredients={allIngredients}
                                    initialMultiplier={task.quantity}
                                />
                            </div>

                            <div className="border-t pt-6">
                                <PrepChecklist 
                                    task={task}
                                    recipe={recipe}
                                    onUpdate={handleChecklistUpdate}
                                />
                            </div>

                            {/* Inventory Section - Show for both batches and sub-recipes */}
                            {(task.itemType === 'batch' || task.itemType === 'sub-recipe') && (
                            <div className="border-t pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-gray-900">Inventory Tracking</h3>
                                    <div className="flex items-center gap-2">
                                        <Switch 
                                            checked={addToInventory} 
                                            onCheckedChange={setAddToInventory} 
                                        />
                                        <Label>Track in Inventory</Label>
                                    </div>
                                </div>

                                {addToInventory && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200"
                                    >
                                        <div className="space-y-2">
                                            <Label>Bottle Label</Label>
                                            <Input 
                                                value={bottleLabel}
                                                onChange={(e) => setBottleLabel(e.target.value)}
                                                placeholder="e.g. Batch Date or Name"
                                                maxLength={20}
                                                className="bg-white"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Neck Tape Colors (Max 3)</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {TAPE_COLORS.map((color) => (
                                                <button
                                                    key={color.name}
                                                    type="button"
                                                    onClick={() => toggleColor(color.value)}
                                                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                                                    bottleColors.includes(color.value) 
                                                        ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' 
                                                        : 'hover:scale-105'
                                                    }`}
                                                    style={{ 
                                                        backgroundColor: color.value,
                                                        borderColor: color.border ? '#e5e7eb' : 'transparent' 
                                                    }}
                                                    title={color.name}
                                                />
                                                ))}
                                            </div>
                                            <div className="flex items-center mt-2 p-3 bg-gray-100/50 rounded-lg border border-gray-200">
                                                <div className="flex-1">
                                                    <span className="text-xs text-gray-500 block mb-1">Preview:</span>
                                                    {bottleColors.length === 0 ? (
                                                        <span className="text-xs text-gray-400 italic">No colors selected</span>
                                                    ) : (
                                                        <div className="relative w-8 h-12 bg-gray-200 rounded border border-gray-300 mx-auto">
                                                            {/* Vertical Stack Preview on Bottle Neck - Reversed so first is bottom */}
                                                            <div className="absolute top-1 left-1/2 transform -translate-x-1/2 flex flex-col-reverse gap-[2px] w-5">
                                                                {bottleColors.map((c, i) => (
                                                                    <div 
                                                                        key={i} 
                                                                        className="w-full h-1.5 shadow-sm border border-black/10" 
                                                                        style={{ backgroundColor: c }} 
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-end">
                                                     {bottleColors.length > 0 && (
                                                        <button 
                                                            onClick={() => setBottleColors([])}
                                                            className="text-xs text-red-500 hover:underline"
                                                        >
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <Button 
                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                            onClick={handleSaveToInventory}
                                            disabled={isSavingInventory}
                                        >
                                            {isSavingInventory ? <CocktailLoader className="w-4 h-4 mr-2" /> : <PackagePlus className="w-4 h-4 mr-2" />}
                                            Add Batch to Inventory
                                        </Button>
                                    </motion.div>
                                )}
                            </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            Recipe not found.
                        </div>
                    )}
                </div>

                {/* Complete Task Button - Fixed at bottom */}
                {recipe && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                        {task.status === 'done' ? (
                            <div className="w-full py-3 px-4 bg-green-100 text-green-700 font-semibold rounded-lg flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                Task Completed
                            </div>
                        ) : (
                            <Button 
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                                onClick={async () => {
                                    if (onUpdateTask) {
                                        await onUpdateTask({ ...task, status: 'done' });
                                    }
                                    onClose();
                                    toast.success(`Completed: ${task.name}`);
                                }}
                            >
                                Complete Task
                            </Button>
                        )}
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}