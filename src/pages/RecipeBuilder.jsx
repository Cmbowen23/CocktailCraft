import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { base44 } from "@/api/base44Client";

import {
  Sparkles,
  RefreshCw,
  Save,
  Wand2,
  Filter,
  ChevronDown,
  Trash2,
  FlaskConical,
  CheckCircle2,
  History,
  Check,
  X,
  Search,
  Lightbulb
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { ingredientCategories } from "../components/utils/categoryDefinitions";
import RecipeForm from "../components/recipes/RecipeForm";

const flavorProfiles = [
  "Bright & Herbaceous", "Smoky & Sweet", "Spicy & Tropical", "Earthy & Complex",
  "Floral & Delicate", "Bold & Bitter", "Creamy & Rich", "Tart & Refreshing",
  "Umami-driven", "Fruit-forward", "Spirit-forward", "Low-ABV & Session"
];

const occasions = [
  "High-end Cocktail Lounge", "Casual Neighborhood Bar", "Rooftop Summer Menu",
  "Winter Warming Menu", "Competition Showcase", "Corporate Event",
  "Wedding Reception", "Wine Bar Cocktails", "Brunch Cocktails", "Late Night Menu"
];

const baseSpirits = [
  "Gin", "Vodka", "Whiskey", "Rum", "Tequila", "Mezcal", "Brandy",
  "Liqueur-based", "Low-ABV", "Non-alcoholic", "Mixed Base", "Any"
];

const alcoholicCategories = ["spirit", "liqueur", "vermouth", "wine", "beer"];

const isAlcoholicIngredient = (ingredient) => {
  if (!ingredient) return false;
  const hasAbv = typeof ingredient.abv === "number" && ingredient.abv > 0;
  const hasAlcoholicCategory = ingredient.category && alcoholicCategories.includes(ingredient.category.toLowerCase());
  return hasAbv || hasAlcoholicCategory;
};

// --- OPTIMIZED MULTI-SELECT COMPONENT ---
// This handles large lists by only rendering top matches and debouncing input
const OptimizedMultiSelect = ({ options, selected, onChange, placeholder }) => {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce the search input to prevent UI freezing on every keystroke
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Filter options based on debounced term + Limit to 50 items for performance
    const filteredOptions = useMemo(() => {
        if (!debouncedSearch) return options.slice(0, 50);
        return options
            .filter(opt => opt.label.toLowerCase().includes(debouncedSearch.toLowerCase()))
            .slice(0, 50);
    }, [options, debouncedSearch]);

    const handleSelect = (value) => {
        if (selected.includes(value)) {
            onChange(selected.filter(s => s !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const handleRemove = (value, e) => {
        e.stopPropagation();
        onChange(selected.filter(s => s !== value));
    };

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-auto min-h-[40px] py-2 bg-white border-gray-300">
                        {selected.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                                {selected.length > 3 ? (
                                    <>
                                        <Badge variant="secondary" className="mr-1 mb-1">{selected.length} Selected</Badge>
                                        <span className="text-xs text-muted-foreground self-center">(Click to view)</span>
                                    </>
                                ) : (
                                    selected.map(val => (
                                        <Badge key={val} variant="secondary" className="mr-1 mb-1 bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                                            {val}
                                            <span 
                                                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer" 
                                                onClick={(e) => handleRemove(val, e)}
                                            >
                                                <X className="h-3 w-3 text-blue-600 hover:text-red-500" />
                                            </span>
                                        </Badge>
                                    ))
                                )}
                            </div>
                        ) : (
                            <span className="text-muted-foreground font-normal">{placeholder}</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <Command shouldFilter={false}> {/* We handle filtering manually for performance */}
                        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input 
                                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <CommandList>
                            <CommandEmpty>No matches found.</CommandEmpty>
                            <CommandGroup>
                                {filteredOptions.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        onSelect={() => handleSelect(option.value)}
                                    >
                                        <Check className={`mr-2 h-4 w-4 ${selected.includes(option.value) ? "opacity-100" : "opacity-0"}`} />
                                        {option.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};

// Individual Card Component for the Feed
const ConceptCard = ({ concept, onDevelop, onRemove, onSave, allIngredients }) => {
    const [isDeveloping, setIsDeveloping] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    const handleDevelopClick = async () => {
        setIsDeveloping(true);
        await onDevelop(concept);
        setIsDeveloping(false);
    };

    if (concept.status === 'developed' || isEditing) {
        return (
            <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="col-span-1 md:col-span-2 lg:col-span-1">
                <Card className="h-full border-blue-200 bg-blue-50/20 shadow-md">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-lg text-blue-900">{concept.recipeData?.name || concept.concept_name}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => onRemove(concept.id)}><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500"/></Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isEditing ? (
                            <RecipeForm 
                                recipe={concept.recipeData} 
                                allIngredients={allIngredients}
                                onSubmit={(data) => { onSave(concept.id, data); setIsEditing(false); }}
                                onCancel={() => setIsEditing(false)}
                            />
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 italic">{concept.recipeData.description}</p>
                                <div className="flex flex-wrap gap-2">
                                    {concept.recipeData.ingredients.map((ing, i) => (
                                        <Badge key={i} variant="outline" className="bg-white">{ing.amount} {ing.unit} {ing.ingredient_name}</Badge>
                                    ))}
                                </div>
                                <div className="text-sm bg-white p-3 rounded border">
                                    <span className="font-semibold text-gray-700">Instructions:</span>
                                    <ol className="list-decimal pl-4 mt-1 space-y-1">
                                        {concept.recipeData.instructions.map((step, i) => <li key={i}>{step}</li>)}
                                    </ol>
                                </div>
                                <Button onClick={() => onSave(concept.id, concept.recipeData)} className="w-full bg-green-600 hover:bg-green-700">
                                    <Save className="w-4 h-4 mr-2" /> Save to Library
                                </Button>
                                <Button variant="ghost" onClick={() => setIsEditing(true)} className="w-full text-blue-600">
                                    Edit before Saving
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    return (
        <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
            <Card className="h-full hover:shadow-md transition-shadow border-gray-200">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <Badge variant="secondary" className="mb-2">{concept.base_spirit || 'Cocktail'}</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemove(concept.id)}><X className="w-3 h-3 text-gray-400"/></Button>
                    </div>
                    <CardTitle className="text-lg">{concept.concept_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-3">
                    {concept.description && <p className="text-xs text-gray-500 italic mb-2">{concept.description}</p>}
                    <div className="space-y-1">
                        {(concept.ingredient_specs || concept.key_ingredients_ideas || []).map((spec, i) => (
                            <div key={i} className="text-sm text-gray-700 flex items-center gap-2">
                                <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                {spec}
                            </div>
                        ))}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button 
                        onClick={handleDevelopClick} 
                        disabled={isDeveloping} 
                        className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                    >
                        {isDeveloping ? <LoadingSpinner className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        Develop Recipe
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    );
};

export default function RecipeBuilder() {
  const [items, setItems] = useState([]); // Unified feed of concepts/recipes
  const [isGenerating, setIsGenerating] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  
  // Input State
  const [mode, setMode] = useState("cocktail"); // 'cocktail' | 'sub-recipe'
  const [promptInput, setPromptInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [numIdeas, setNumIdeas] = useState(4);
  
  // Filters
  const [flavorProfile, setFlavorProfile] = useState("");
  const [baseSpirit, setBaseSpirit] = useState("");
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [selectedAlcoholicIngredients, setSelectedAlcoholicIngredients] = useState([]);
  
  // Computed Lists for dropdowns
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [availableAlcoholicIngredients, setAvailableAlcoholicIngredients] = useState([]);
  const [allAlcoholicIngredients, setAllAlcoholicIngredients] = useState([]);
  
  const [useInventoryOnly, setUseInventoryOnly] = useState(false);
  const [useIngredientListOnly, setUseIngredientListOnly] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  // Filter Ingredients based on Supplier and Inventory
  useEffect(() => {
    let filteredIngredients = allAlcoholicIngredients;
    
    // First filter by inventory if enabled
    if (useInventoryOnly) {
      const inventoryIngredientIds = new Set(inventoryItems.map(item => item.ingredient_id));
      filteredIngredients = ingredients
        .filter(ing => isAlcoholicIngredient(ing) && inventoryIngredientIds.has(ing.id))
        .map(ing => ({ value: ing.name, label: ing.name }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    
    // Then filter by supplier if any selected
    if (selectedSuppliers.length > 0) {
      const supplierSet = new Set(selectedSuppliers);
      const sourceList = useInventoryOnly ? 
        ingredients.filter(ing => new Set(inventoryItems.map(item => item.ingredient_id)).has(ing.id)) : 
        ingredients;
      
      filteredIngredients = sourceList
        .filter(ing => isAlcoholicIngredient(ing) && ing.supplier && supplierSet.has(ing.supplier))
        .map(ing => ({ value: ing.name, label: ing.name }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    
    setAvailableAlcoholicIngredients(filteredIngredients);
  }, [selectedSuppliers, ingredients, useInventoryOnly, inventoryItems, allAlcoholicIngredients]);
  
  // Filter suppliers based on inventory if enabled
  const displayedSuppliers = useMemo(() => {
    if (!useInventoryOnly) return availableSuppliers;
    
    const inventoryIngredientIds = new Set(inventoryItems.map(item => item.ingredient_id));
    const inventorySuppliers = new Set(
      ingredients
        .filter(ing => inventoryIngredientIds.has(ing.id))
        .map(ing => ing.supplier)
        .filter(Boolean)
    );
    
    return availableSuppliers.filter(s => inventorySuppliers.has(s.value));
  }, [useInventoryOnly, availableSuppliers, inventoryItems, ingredients]);

  const loadData = async () => {
    const [ings, inv] = await Promise.all([
      base44.entities.Ingredient.list().catch(() => []),
      base44.entities.InventoryItem.list().catch(() => [])
    ]);
    setIngredients(ings);
    setInventoryItems(inv);
    
    // Suppliers
    const suppliers = new Set(ings.map(i => i.supplier).filter(Boolean));
    setAvailableSuppliers(Array.from(suppliers).sort().map(s => ({ value: s, label: s })));

    // Alcohol
    const alcoholicIngs = ings
        .filter(ing => isAlcoholicIngredient(ing))
        .map(ing => ({ value: ing.name, label: ing.name }))
        .sort((a, b) => a.label.localeCompare(b.label));
    setAllAlcoholicIngredients(alcoholicIngs);
    setAvailableAlcoholicIngredients(alcoholicIngs);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
        if (mode === 'cocktail') {
            const params = [];
            if (flavorProfile) params.push(`Flavor: ${flavorProfile}`);
            if (baseSpirit) params.push(`Base: ${baseSpirit}`);
            if (promptInput) params.push(`Idea: ${promptInput}`);
            if (useInventoryOnly) params.push("Constraint: Use ONLY existing inventory.");
            if (useIngredientListOnly) params.push("Constraint: Use ONLY ingredients from the ingredient database, no substitutions.");
            if (selectedSuppliers.length > 0) params.push(`Suppliers: ${selectedSuppliers.join(', ')}`);
            if (selectedAlcoholicIngredients.length > 0) params.push(`Use Ingredients: ${selectedAlcoholicIngredients.join(', ')}`);
            
            const prompt = `Generate ${numIdeas} creative cocktail concepts based on: ${params.join(', ')}. For each concept, provide SPECIFIC ingredient specifications with amounts and units (e.g., "2 oz Gin", "0.75 oz Lemon Juice"). Return JSON: concepts array [{concept_name, description, ingredient_specs[] (array of strings like "2 oz Gin"), base_spirit}].`;
            
            const response = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        concepts: { type: "array", items: { type: "object", properties: { concept_name: { type: "string" }, description: { type: "string" }, ingredient_specs: { type: "array", items: { type: "string" } }, base_spirit: { type: "string" } }, required: ["concept_name", "ingredient_specs"] } }
                    },
                    required: ["concepts"]
                }
            });

            if (response?.concepts) {
                const newItems = response.concepts.map(c => ({
                    ...c,
                    id: Date.now() + Math.random(),
                    type: 'concept',
                    status: 'draft',
                    timestamp: new Date()
                }));
                setItems(prev => [...newItems, ...prev]); 
            }
        } else {
            const prompt = `Create a sub-recipe for: "${promptInput}". Return JSON: name, category, ingredients array (ingredient_name, amount, unit), instructions array, yield_amount, yield_unit.`;
            const response = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        category: { type: "string" },
                        ingredients: { type: "array", items: { type: "object", properties: { ingredient_name: { type: "string" }, amount: { type: "number" }, unit: { type: "string" } } } },
                        instructions: { type: "array", items: { type: "string" } },
                        yield_amount: { type: "number" },
                        yield_unit: { type: "string" }
                    },
                    required: ["name", "ingredients", "instructions"]
                }
            });
            
            if (response) {
                const newItem = {
                    id: Date.now(),
                    type: 'sub-recipe',
                    status: 'developed',
                    recipeData: response,
                    concept_name: response.name,
                    timestamp: new Date()
                };
                setItems(prev => [newItem, ...prev]);
            }
        }
    } catch (e) {
        console.error(e);
        alert("Generation failed. Please try again.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDevelopRecipe = async (concept) => {
    try {
        const specs = concept.ingredient_specs || concept.key_ingredients_ideas || [];
        const prompt = `Develop a full professional recipe for "${concept.concept_name}": ${concept.description}. Ingredient specs: ${specs.join(', ')}. Return JSON: name, description, category, base_spirit, ingredients array (ingredient_name, amount, unit), instructions array, garnish, glassware.`;
        const response = await base44.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string" },
                    base_spirit: { type: "string" },
                    ingredients: { type: "array", items: { type: "object", properties: { ingredient_name: { type: "string" }, amount: { type: "number" }, unit: { type: "string" } } } },
                    instructions: { type: "array", items: { type: "string" } },
                    garnish: { type: "string" },
                    glassware: { type: "string" }
                },
                required: ["name", "ingredients", "instructions"]
            }
        });

        if (response) {
            setItems(prev => prev.map(item => 
                item.id === concept.id 
                ? { ...item, status: 'developed', recipeData: response } 
                : item
            ));
        }
    } catch (e) {
        alert("Failed to develop recipe.");
    }
  };

  const handleSaveRecipe = async (id, data) => {
    try {
        const newRecipe = await base44.entities.Recipe.create({
            ...data,
            cost_per_serving: 0, 
            difficulty: 'medium'
        });
        
        if (mode === 'sub-recipe') {
             await base44.entities.Ingredient.create({
                name: data.name,
                category: data.category || 'other',
                ingredient_type: 'sub_recipe',
                sub_recipe_id: newRecipe.id,
                unit: data.yield_unit || 'ml',
                cost_per_unit: 0,
                supplier: 'House-Made'
            });
        }

        setItems(prev => prev.filter(i => i.id !== id)); 
        alert("Recipe saved to Library!");
    } catch (e) {
        console.error(e);
        alert("Save failed");
    }
  };

  const handleRemove = (id) => setItems(prev => prev.filter(i => i.id !== id));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
                <Wand2 className="w-8 h-8 text-blue-600" />
                Recipe Architect
            </h1>
            <p className="text-gray-500">Describe your idea, generate concepts, and refine them into recipes.</p>
        </div>

        {/* COMPOSER PANEL */}
        <Card className="border-blue-100 shadow-md overflow-visible">
            <CardHeader className="pb-3">
                <Tabs value={mode} onValueChange={setMode} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="cocktail">Cocktails</TabsTrigger>
                        <TabsTrigger value="sub-recipe">Sub-Recipes</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <Textarea 
                            placeholder={mode === 'cocktail' ? "e.g., 'A spicy tequila drink for summer using mango'..." : "e.g., 'Spiced Pear Cordial'..."}
                            value={promptInput}
                            onChange={(e) => setPromptInput(e.target.value)}
                            className="h-24 resize-none text-base"
                        />
                    </div>
                    <div className="flex flex-col gap-2 justify-end">
                        {mode === 'cocktail' && (
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                <Label className="text-xs text-gray-600 whitespace-nowrap">Ideas:</Label>
                                <Input 
                                    type="number" 
                                    min="1" 
                                    max="10" 
                                    value={numIdeas} 
                                    onChange={(e) => setNumIdeas(parseInt(e.target.value) || 4)}
                                    className="w-16 h-7 text-center text-sm"
                                />
                            </div>
                        )}
                        <Button 
                            onClick={handleGenerate} 
                            disabled={isGenerating || (!promptInput && mode === 'sub-recipe')} 
                            className="h-20 w-32 bg-blue-600 hover:bg-blue-700 shadow-sm"
                        >
                            {isGenerating ? <LoadingSpinner className="w-6 h-6" /> : (
                                <div className="flex flex-col items-center">
                                    <Sparkles className="w-6 h-6 mb-1" />
                                    <span>Create</span>
                                </div>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Filters (Cocktail Only) */}
                {mode === 'cocktail' && (
                    <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                        <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                                <Select value={baseSpirit} onValueChange={setBaseSpirit}>
                                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Spirit" /></SelectTrigger>
                                    <SelectContent>{baseSpirits.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={flavorProfile} onValueChange={setFlavorProfile}>
                                    <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Flavor" /></SelectTrigger>
                                    <SelectContent>{flavorProfiles.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                                    <Filter className="w-3 h-3 mr-1" /> Advanced Filters {showAdvanced ? <ChevronDown className="w-3 h-3 ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent className="pt-4 space-y-4">
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                                <div>
                                    <Label className="text-xs mb-1.5 block">Limit Suppliers</Label>
                                    {/* Using new OptimizedMultiSelect for Performance */}
                                    <OptimizedMultiSelect 
                                        options={displayedSuppliers} 
                                        selected={selectedSuppliers} 
                                        onChange={setSelectedSuppliers} 
                                        placeholder="Select suppliers..." 
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs mb-1.5 block">Required Ingredients</Label>
                                    {/* Using new OptimizedMultiSelect for Performance */}
                                    <OptimizedMultiSelect 
                                        options={availableAlcoholicIngredients} 
                                        selected={selectedAlcoholicIngredients} 
                                        onChange={setSelectedAlcoholicIngredients} 
                                        placeholder="Select specific bottles..." 
                                    />
                                </div>
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-center gap-2">
                                        <Switch id="inv-only" checked={useInventoryOnly} onCheckedChange={setUseInventoryOnly} />
                                        <Label htmlFor="inv-only" className="text-sm cursor-pointer">Restrict to Current Inventory Only</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch id="ing-only" checked={useIngredientListOnly} onCheckedChange={setUseIngredientListOnly} />
                                        <Label htmlFor="ing-only" className="text-sm cursor-pointer">Restrict to Ingredient List Only</Label>
                                    </div>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </CardContent>
        </Card>

        {/* FEED SECTION */}
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <History className="w-4 h-4 text-gray-400" />
                    Generated Ideas
                </h2>
                {items.length > 0 && <Button variant="ghost" size="sm" onClick={() => setItems([])} className="text-red-400 hover:text-red-600">Clear All</Button>}
            </div>

            {items.length === 0 ? (
                <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                    <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Your generated concepts and recipes will appear here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AnimatePresence>
                        {items.map(item => (
                            <ConceptCard 
                                key={item.id} 
                                concept={item} 
                                onDevelop={handleDevelopRecipe}
                                onRemove={handleRemove}
                                onSave={handleSaveRecipe}
                                allIngredients={ingredients}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}