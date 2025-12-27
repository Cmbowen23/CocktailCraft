import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { createPageUrl } from '@/utils';
import { convertToMl } from '@/components/utils/costCalculations';
import { calculateBatchMetrics } from '@/components/utils/batchCalculations';

// Helper to determine default batch setting
const shouldBatchByDefault = (ingredientName, category) => {
    const citrus = ['lemon', 'lime', 'orange', 'grapefruit'];
    const lowerName = ingredientName.toLowerCase();
    if (citrus.some(c => lowerName.includes(c))) return false;
    const serviceCategories = ['juice', 'citrus', 'garnish', 'ice'];
    if (serviceCategories.includes(category?.toLowerCase())) return false;
    return true;
};

export default function AddMenuToTrainingDocModal({ isOpen, onClose, menu, recipes }) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [allIngredients, setAllIngredients] = useState([]);
    const [documentTitle, setDocumentTitle] = useState(`${menu?.name || 'Menu'} Training & Prep`);
    
    // Selection State
    const [selectedRecipes, setSelectedRecipes] = useState({});
    const [selectedSubRecipes, setSelectedSubRecipes] = useState({});
    const [foundSubRecipes, setFoundSubRecipes] = useState([]); // [{id, name, ...}]
    
    // Options
    const [includeBatchRecipes, setIncludeBatchRecipes] = useState(false);
    const [includeInstructions, setIncludeInstructions] = useState(true);
    const [includeDescriptions, setIncludeDescriptions] = useState(true);
    const [docCreationMode, setDocCreationMode] = useState('single'); // 'single' | 'split'

    useEffect(() => {
        if (isOpen) {
            loadData();
            setDocumentTitle(`${menu?.name || 'Menu'} Training & Prep`);
            // Reset selections
            setSelectedRecipes({});
            setSelectedSubRecipes({});
            setIncludeBatchRecipes(false);
            setIncludeInstructions(true);
            setIncludeDescriptions(true);
            setDocCreationMode('single');
        }
    }, [isOpen, menu]);

    const loadData = async () => {
        setLoading(true);
        try {
            const ings = await base44.entities.Ingredient.list();
            setAllIngredients(ings);
            
            // Identify all sub-recipes
            const allRecs = await base44.entities.Recipe.list();
            const subRecs = allRecs.filter(r => 
                r.category === 'sub_recipe' || 
                r.category === 'sub-recipe' || 
                r.category === 'infusion' || 
                r.category === 'syrup' || 
                r.category === 'cordial'
            );
            
            setFoundSubRecipes(subRecs);

        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    // Dynamically find relevant sub-recipes based on selected main recipes
    const relevantSubRecipes = React.useMemo(() => {
        if (!foundSubRecipes.length) return [];
        const selectedRecipeIds = Object.keys(selectedRecipes).filter(k => selectedRecipes[k]);
        const activeRecipes = recipes.filter(r => selectedRecipeIds.includes(r.id));
        
        const relevantIds = new Set();
        activeRecipes.forEach(r => {
            (r.ingredients || []).forEach(ing => {
                // Match ingredient name to sub-recipe name
                const match = foundSubRecipes.find(sr => sr.name.toLowerCase() === ing.ingredient_name.toLowerCase());
                if (match) relevantIds.add(match.id);
            });
        });
        
        return foundSubRecipes.filter(sr => relevantIds.has(sr.id));
    }, [selectedRecipes, foundSubRecipes, recipes]);

    const handleRecipeSelect = (recipeId, isSelected) => {
        setSelectedRecipes(prev => ({ ...prev, [recipeId]: isSelected }));
    };

    const handleSelectAllRecipes = (checked) => {
        const newSelection = {};
        recipes.forEach(r => newSelection[r.id] = checked);
        setSelectedRecipes(newSelection);
    };

    const handleSubRecipeSelect = (subId, isSelected) => {
        setSelectedSubRecipes(prev => ({ ...prev, [subId]: isSelected }));
    };

    const handleSelectAllSubRecipes = (checked) => {
        const newSelection = {};
        relevantSubRecipes.forEach(r => newSelection[r.id] = checked);
        setSelectedSubRecipes(newSelection);
    };

    // Generate HTML content based on flags
    const generateHtmlContent = ({ 
        title, 
        doRecipes = true, 
        doSubRecipes = true, 
        doBatches = true 
    }) => {
        let html = `<h1>${title}</h1>`;

        // 1. Recipes
        if (doRecipes) {
            const selectedRecipeIds = Object.keys(selectedRecipes).filter(k => selectedRecipes[k]);
            if (selectedRecipeIds.length > 0) {
                if (doSubRecipes || doBatches) {
                    html += `<h2>Cocktail Recipes</h2>`;
                }
                selectedRecipeIds.forEach(rId => {
                    const r = recipes.find(x => x.id === rId);
                    if (r) {
                        html += `<h3 style="font-weight: 800; font-size: 1.5em; margin-bottom: 0.5em;">${r.name}</h3>`;
                        
                        if (includeDescriptions && r.description) {
                            html += `<p><em>${r.description}</em></p>`;
                        }
                        
                        html += `<h4>Ingredients</h4><ul>`;
                        (r.ingredients || []).forEach(ing => {
                            html += `<li>${ing.amount} ${ing.unit} ${ing.ingredient_name} ${ing.notes ? `(${ing.notes})` : ''}</li>`;
                        });
                        html += `</ul>`;

                        if (includeInstructions && r.instructions && r.instructions.length > 0) {
                            html += `<h4>Instructions</h4><ol>`;
                            r.instructions.forEach(step => html += `<li>${step}</li>`);
                            html += `</ol>`;
                        }
                        if (r.glassware) html += `<p><strong>Glassware:</strong> ${r.glassware}</p>`;
                        if (r.garnish) html += `<p><strong>Garnish:</strong> ${r.garnish}</p>`;
                        html += `<hr/>`;
                    }
                });
            }
        }

        // 2. Sub Recipes
        if (doSubRecipes) {
            const selectedSubIds = Object.keys(selectedSubRecipes).filter(k => selectedSubRecipes[k]);
            if (selectedSubIds.length > 0) {
                // Larger font and bolded header for distinction
                html += `<h2 style="font-size: 2.2em; font-weight: 900; margin-top: 1em; border-bottom: 2px solid #ccc;">Sub-Recipes & Prep</h2>`;
                
                selectedSubIds.forEach(sId => {
                    const sr = foundSubRecipes.find(x => x.id === sId);
                    if (sr) {
                        html += `<h3 style="font-weight: 800; font-size: 1.5em; margin-bottom: 0.5em;">${sr.name}</h3>`;
                        if (sr.yield_amount) html += `<p><strong>Yield:</strong> ${sr.yield_amount} ${sr.yield_unit}</p>`;
                        
                        html += `<h4>Ingredients</h4><ul>`;
                        (sr.ingredients || []).forEach(ing => {
                            html += `<li>${ing.amount} ${ing.unit} ${ing.ingredient_name}</li>`;
                        });
                        html += `</ul>`;

                        if (includeInstructions && sr.instructions && sr.instructions.length > 0) {
                            html += `<h4>Instructions</h4><ol>`;
                            sr.instructions.forEach(step => html += `<li>${step}</li>`);
                            html += `</ol>`;
                        }
                        html += `<hr/>`;
                    }
                });
            }
        }

        // 3. Batch Recipes (Only if toggled)
        if (doBatches && includeBatchRecipes) {
            const batchableRecipes = recipes.filter(r => 
                selectedRecipes[r.id] && 
                r.batch_settings && 
                Object.keys(r.batch_settings).length > 0
            );

            if (batchableRecipes.length > 0) {
                // If we didn't output the big header yet (e.g. no subrecipes selected), add it here
                const selectedSubIds = Object.keys(selectedSubRecipes).filter(k => selectedSubRecipes[k]);
                if (selectedSubIds.length === 0) {
                    html += `<h2 style="font-size: 2.2em; font-weight: 900; margin-top: 1em; border-bottom: 2px solid #ccc;">Sub-Recipes & Prep</h2>`;
                } else {
                     html += `<h2 style="font-size: 1.8em; font-weight: 800; margin-top: 1em;">Batch Recipes</h2>`;
                }

                batchableRecipes.forEach(r => {
                    html += `<h3 style="font-weight: 800; font-size: 1.4em;">Batch: ${r.name}</h3>`;
                    
                    // Calculate standard batch
                    const ingredientOverrides = {};
                    const originalBatchAmountsMlPerServing = new Map();

                    (r.ingredients || []).forEach(ing => {
                        if (r.batch_settings?.ingredient_overrides?.[ing.ingredient_name]) {
                            ingredientOverrides[ing.ingredient_name] = r.batch_settings.ingredient_overrides[ing.ingredient_name];
                        } else {
                            const matchedIng = allIngredients.find(i => i.name.toLowerCase() === ing.ingredient_name.toLowerCase());
                            ingredientOverrides[ing.ingredient_name] = shouldBatchByDefault(ing.ingredient_name, matchedIng?.category) ? 'batch' : 'service';
                        }
                        const amountMl = convertToMl(ing.amount, ing.unit, ing.ingredient_name, allIngredients);
                        originalBatchAmountsMlPerServing.set(ing.ingredient_name, amountMl);
                    });

                    const finalContainerType = r.batch_settings?.container_type || '1L Bottle';
                    const finalContainerCount = r.batch_settings?.container_count || 1;

                    const metrics = calculateBatchMetrics({
                        recipe: r,
                        allIngredients,
                        ingredientOverrides,
                        containerType: finalContainerType,
                        containerCount: finalContainerCount,
                        isContainerCustom: r.batch_settings?.is_container_custom || false,
                        scaleFactor: r.batch_settings?.scale_factor || 1,
                        includeDilution: r.batch_settings?.include_dilution || false,
                        dilutionPercentage: r.batch_settings?.dilution_percentage || 25,
                        constrainToTotalVolume: r.batch_settings?.constrain_to_total_volume ?? true,
                        originalBatchAmountsMlPerServing
                    });

                    html += `<p><strong>Standard Batch:</strong> ${finalContainerCount} x ${finalContainerType} (Approx ${Math.round(metrics.totalVolumeMl)}ml)</p>`;
                    
                    const scaleFactor = metrics.scaleFactor;
                    
                    html += `<h4>Batch Ingredients</h4><ul>`;
                    originalBatchAmountsMlPerServing.forEach((ml, name) => {
                        if (ingredientOverrides[name] === 'batch') {
                            const scaledMl = ml * scaleFactor;
                            html += `<li>${Math.round(scaledMl)} ml ${name}</li>`;
                        }
                    });
                    if (metrics.dilutionWaterMl > 0) {
                        html += `<li>${Math.round(metrics.dilutionWaterMl)} ml Water (Dilution)</li>`;
                    }
                    html += `</ul>`;
                    
                    if (r.batch_settings?.batch_instructions) {
                        html += `<h4>Batch Instructions</h4><p>${r.batch_settings.batch_instructions}</p>`;
                    } else {
                        html += `<p>Combine all ingredients.</p>`;
                    }
                    html += `<hr/>`;
                });
            }
        }

        return html;
    };

    const handleCreate = () => {
        setSubmitting(true);
        try {
            const createDoc = async (title, contentStr, type) => {
                return await base44.entities.TrainingDocument.create({
                    title: title,
                    account_id: menu.account_id,
                    menu_id: menu.id,
                    tags: ['generated', type],
                    html_content: contentStr,
                    content: [] // Legacy field empty
                });
            };

            const runCreation = async () => {
                if (docCreationMode === 'single') {
                    const html = generateHtmlContent({ 
                        title: documentTitle,
                        doRecipes: true,
                        doSubRecipes: true,
                        doBatches: true
                    });
                    const newDoc = await createDoc(documentTitle, html, 'single');
                    window.location.href = createPageUrl(`TrainingDocEditor?id=${newDoc.id}`);
                } else {
                    // Split mode
                    // 1. Cocktails Doc
                    const cocktailHtml = generateHtmlContent({ 
                        title: `${documentTitle} - Cocktails`,
                        doRecipes: true,
                        doSubRecipes: false,
                        doBatches: false
                    });
                    
                    // 2. Prep Doc
                    const prepHtml = generateHtmlContent({ 
                        title: `${documentTitle} - Prep`,
                        doRecipes: false,
                        doSubRecipes: true,
                        doBatches: true
                    });

                    await Promise.all([
                        createDoc(`${documentTitle} - Cocktails`, cocktailHtml, 'cocktails'),
                        createDoc(`${documentTitle} - Prep`, prepHtml, 'prep')
                    ]);

                    // Redirect to TrainingDocs list since we created multiple
                    toast.success("Created separate documents for Cocktails and Prep.");
                    setTimeout(() => {
                         window.location.href = createPageUrl(`TrainingDocs`);
                    }, 1000);
                }
            };

            runCreation();

        } catch (error) {
            console.error("Error creating doc", error);
            toast.error("Failed to create document");
            setSubmitting(false);
        }
    };

    const sortedRecipes = [...recipes].sort((a, b) => a.name.localeCompare(b.name));
    const selectedCount = Object.keys(selectedRecipes).filter(k => selectedRecipes[k]).length;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add to Training & Prep</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div>
                        <Label>Document Title Base</Label>
                        <Input value={documentTitle} onChange={e => setDocumentTitle(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                         <Label>Creation Mode</Label>
                         <RadioGroup value={docCreationMode} onValueChange={setDocCreationMode} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="single" id="mode-single" />
                                <Label htmlFor="mode-single">Single Document</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="split" id="mode-split" />
                                <Label htmlFor="mode-split">Separate Docs (Cocktails / Prep)</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Recipes Selection */}
                    <div className="border rounded-md p-4">
                        <div className="flex justify-between items-center mb-2">
                            <Label className="font-bold">Select Recipes</Label>
                            <Button variant="ghost" size="sm" onClick={() => handleSelectAllRecipes(true)} className="text-xs h-6">Select All</Button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-2">
                            {sortedRecipes.map(r => (
                                <div key={r.id} className="flex items-center gap-2">
                                    <Checkbox 
                                        checked={!!selectedRecipes[r.id]} 
                                        onCheckedChange={(c) => handleRecipeSelect(r.id, c)}
                                    />
                                    <span className="text-sm">{r.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sub-Recipes Selection (Dynamic) */}
                    {relevantSubRecipes.length > 0 && (
                        <div className="border rounded-md p-4">
                            <div className="flex justify-between items-center mb-2">
                                <Label className="font-bold">Select Sub-Recipes</Label>
                                <Button variant="ghost" size="sm" onClick={() => handleSelectAllSubRecipes(true)} className="text-xs h-6">Select All</Button>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-2">
                                {relevantSubRecipes.map(sr => (
                                    <div key={sr.id} className="flex items-center gap-2">
                                        <Checkbox 
                                            checked={!!selectedSubRecipes[sr.id]} 
                                            onCheckedChange={(c) => handleSubRecipeSelect(sr.id, c)}
                                        />
                                        <span className="text-sm">{sr.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Options */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                             <Label className="font-semibold text-xs uppercase text-gray-500">Content Options</Label>
                             <div className="flex items-center gap-2">
                                <Checkbox 
                                    id="inc-desc" 
                                    checked={includeDescriptions} 
                                    onCheckedChange={setIncludeDescriptions} 
                                />
                                <Label htmlFor="inc-desc">Include Descriptions</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox 
                                    id="inc-instr" 
                                    checked={includeInstructions} 
                                    onCheckedChange={setIncludeInstructions} 
                                />
                                <Label htmlFor="inc-instr">Include Instructions</Label>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Label className="font-semibold text-xs uppercase text-gray-500">Batching</Label>
                            <div className="flex items-center gap-2">
                                <Checkbox 
                                    id="inc-batch" 
                                    checked={includeBatchRecipes} 
                                    onCheckedChange={setIncludeBatchRecipes} 
                                />
                                <Label htmlFor="inc-batch">Include Batch Recipes</Label>
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={submitting || selectedCount === 0} className="bg-blue-600 hover:bg-blue-700">
                        {submitting ? <LoadingSpinner className="h-4 w-4 text-white" /> : 'Create Document(s)'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}