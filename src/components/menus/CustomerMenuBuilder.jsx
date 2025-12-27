import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Menu } from "@/api/entities";
import { Recipe } from "@/api/entities";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Eye, X, Settings, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export default function CustomerMenuBuilder({ menu, recipes = [], onUpdate, onClose, account }) {
    const [settings, setSettings] = useState({
        title: '',
        subtitle: '',
        footer_text: '',
        show_descriptions: true,
        show_prices: false,
        use_unified_price: false,
        unified_price_amount: 0,
        text_alignment: 'left',
        recipe_order: [],
        excluded_recipes: [],
        custom_recipe_names: {},
        custom_descriptions: {},
    });

    const [orderedRecipes, setOrderedRecipes] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const isInitialMount = useRef(true);
    
    const storageKey = `menu-preview-settings-${menu?.id}`;

    useEffect(() => {
        if (menu?.customer_menu_settings) {
            const menuSettings = menu.customer_menu_settings;
            setSettings({
                title: menuSettings.title ?? (account?.name || ''),
                subtitle: menuSettings.subtitle ?? (menu?.name || ''),
                footer_text: menuSettings.footer_text || '',
                show_descriptions: menuSettings.show_descriptions !== false,
                show_prices: menuSettings.show_prices === true,
                use_unified_price: menuSettings.use_unified_price === true,
                unified_price_amount: menuSettings.unified_price_amount || 0,
                text_alignment: menuSettings.text_alignment || 'left',
                recipe_order: Array.isArray(menuSettings.recipe_order) ? menuSettings.recipe_order : [],
                excluded_recipes: Array.isArray(menuSettings.excluded_recipes) ? menuSettings.excluded_recipes : [],
                custom_recipe_names: menuSettings.custom_recipe_names || {},
                custom_descriptions: menuSettings.custom_descriptions || {},
            });
        } else {
            setSettings(prev => ({
                ...prev,
                title: account?.name || '',
                subtitle: menu?.name || '',
                recipe_order: recipes.map(r => r.id),
                footer_text: '',
            }));
        }

        return () => {
            if (menu?.id) {
                localStorage.removeItem(storageKey);
            }
        };
    }, [menu, recipes, account]);

    // Live-update local storage for the preview window
    useEffect(() => {
        if (menu?.id) {
            localStorage.setItem(storageKey, JSON.stringify(settings));
        }
    }, [settings, storageKey, menu?.id]);

    // Auto-save settings to database with a debounce
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (!menu?.id) return;

        const handler = setTimeout(() => {
            const saveSettings = async () => {
                setIsSaving(true);
                try {
                    await Menu.update(menu.id, {
                        ...menu,
                        customer_menu_settings: settings
                    });
                } catch (error) {
                    console.error("Error auto-saving customer menu settings:", error);
                } finally {
                    setIsSaving(false);
                }
            };
            saveSettings();
        }, 1000);

        return () => {
            clearTimeout(handler);
        };
    }, [settings, menu]);

    useEffect(() => {
        const excludedSet = new Set(settings.excluded_recipes);
        const visibleRecipes = recipes.filter(recipe => !excludedSet.has(recipe.id));
        
        const ordered = [...visibleRecipes].sort((a, b) => {
            const indexA = settings.recipe_order.indexOf(a.id);
            const indexB = settings.recipe_order.indexOf(b.id);
            
            if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
        
        setOrderedRecipes(ordered);
    }, [recipes, settings.recipe_order, settings.excluded_recipes]);

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleRecipeToggle = (recipeId, isExcluded) => {
        setSettings(prev => ({
            ...prev,
            excluded_recipes: isExcluded 
                ? [...prev.excluded_recipes, recipeId]
                : prev.excluded_recipes.filter(id => id !== recipeId)
        }));
    };

    const handleCustomNameChange = (recipeId, customName) => {
        setSettings(prev => ({
            ...prev,
            custom_recipe_names: {
                ...prev.custom_recipe_names,
                [recipeId]: customName
            }
        }));
    };

    const handleCustomDescriptionChange = (recipeId, customDescription) => {
        setSettings(prev => ({
            ...prev,
            custom_descriptions: {
                ...prev.custom_descriptions,
                [recipeId]: customDescription
            }
        }));
    };

    const onDragEnd = (result) => {
        if (!result.destination) return;

        const newOrder = Array.from(orderedRecipes);
        const [reorderedItem] = newOrder.splice(result.source.index, 1);
        newOrder.splice(result.destination.index, 0, reorderedItem);

        const newRecipeOrder = newOrder.map(recipe => recipe.id);
        setSettings(prev => ({ ...prev, recipe_order: newRecipeOrder }));
    };

    const moveRecipeUp = (index) => {
        if (index === 0) return;
        const newOrder = [...orderedRecipes];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        const newRecipeOrder = newOrder.map(recipe => recipe.id);
        setSettings(prev => ({ ...prev, recipe_order: newRecipeOrder }));
    };

    const moveRecipeDown = (index) => {
        if (index === orderedRecipes.length - 1) return;
        const newOrder = [...orderedRecipes];
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        const newRecipeOrder = newOrder.map(recipe => recipe.id);
        setSettings(prev => ({ ...prev, recipe_order: newRecipeOrder }));
    };

    return (
        <Card className="border-0 shadow-none bg-transparent">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Settings className="w-6 h-6 text-emerald-600" />
                        <CardTitle className="text-emerald-900">Customer Menu Builder</CardTitle>
                        {isSaving && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
                    </div>
                    <div className="flex items-center gap-2">
                        <Link to={createPageUrl(`CustomerMenuPreview?id=${menu?.id}`)} target="_blank">
                            <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                            </Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* General Settings */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-emerald-900">General Settings</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <Label htmlFor="title">Menu Title</Label>
                            <Input
                                id="title"
                                value={settings.title}
                                onChange={(e) => handleSettingChange('title', e.target.value)}
                                placeholder="Main Title (e.g., Account Name)"
                            />
                        </div>
                        <div>
                            <Label htmlFor="subtitle">Subtitle</Label>
                            <Input
                                id="subtitle"
                                value={settings.subtitle}
                                onChange={(e) => handleSettingChange('subtitle', e.target.value)}
                                placeholder="Subtitle (e.g., Menu Name)"
                            />
                        </div>
                        <div>
                            <Label htmlFor="footer_text">Footer Text</Label>
                            <Textarea
                                id="footer_text"
                                value={settings.footer_text}
                                onChange={(e) => handleSettingChange('footer_text', e.target.value)}
                                placeholder="Contact information, hours, or any other footer text"
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                {/* Display Options */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-emerald-900">Display Options</h3>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="show_descriptions"
                            checked={settings.show_descriptions}
                            onCheckedChange={(checked) => handleSettingChange('show_descriptions', checked)}
                        />
                        <Label htmlFor="show_descriptions">Show recipe descriptions</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="show_prices"
                            checked={settings.show_prices}
                            onCheckedChange={(checked) => handleSettingChange('show_prices', checked)}
                        />
                        <Label htmlFor="show_prices">Show prices</Label>
                    </div>
                    {settings.show_prices && (
                        <div className="ml-6 space-y-3">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="use_unified_price"
                                    checked={settings.use_unified_price}
                                    onCheckedChange={(checked) => handleSettingChange('use_unified_price', checked)}
                                />
                                <Label htmlFor="use_unified_price">Unified Pricing</Label>
                            </div>
                            {settings.use_unified_price && (
                                <div className="ml-6">
                                    <Label htmlFor="unified_price_amount">Price for all items ($)</Label>
                                    <Input
                                        id="unified_price_amount"
                                        type="number"
                                        step="0.01"
                                        value={settings.unified_price_amount}
                                        onChange={(e) => handleSettingChange('unified_price_amount', parseFloat(e.target.value) || 0)}
                                        className="w-32"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    <div>
                        <Label>Text Alignment</Label>
                        <div className="flex gap-2 mt-1">
                            <Button
                                variant={settings.text_alignment === 'left' ? 'default' : 'outline'}
                                onClick={() => handleSettingChange('text_alignment', 'left')}
                                className={settings.text_alignment === 'left' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                            >
                                Left
                            </Button>
                            <Button
                                variant={settings.text_alignment === 'center' ? 'default' : 'outline'}
                                onClick={() => handleSettingChange('text_alignment', 'center')}
                                className={settings.text_alignment === 'center' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                            >
                                Center
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Recipe Management */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-emerald-900">Recipe Order & Visibility</h3>
                    <p className="text-sm text-gray-600">Drag to reorder on desktop, use arrows on mobile. Uncheck to hide from customer menu</p>
                    
                    {/* Desktop: Drag and Drop */}
                    <div className="hidden md:block">
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="recipes">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                        {orderedRecipes.map((recipe, index) => (
                                            <Draggable key={recipe.id} draggableId={recipe.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={`p-4 bg-white border rounded-lg ${
                                                            snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div {...provided.dragHandleProps}>
                                                                <GripVertical className="w-4 h-4 text-gray-400" />
                                                            </div>
                                                            <Checkbox
                                                                checked={!settings.excluded_recipes.includes(recipe.id)}
                                                                onCheckedChange={(checked) => handleRecipeToggle(recipe.id, !checked)}
                                                            />
                                                            <div className="flex-1 space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium">{recipe.name}</span>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {recipe.category}
                                                                    </Badge>
                                                                </div>
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    <Input
                                                                        placeholder="Custom name (optional)"
                                                                        value={settings.custom_recipe_names[recipe.id] || ''}
                                                                        onChange={(e) => handleCustomNameChange(recipe.id, e.target.value)}
                                                                        className="text-sm"
                                                                    />
                                                                    <Textarea
                                                                        placeholder="Custom description (optional)"
                                                                        value={settings.custom_descriptions[recipe.id] || ''}
                                                                        onChange={(e) => handleCustomDescriptionChange(recipe.id, e.target.value)}
                                                                        className="text-sm"
                                                                        rows={2}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>

                    {/* Mobile: Arrow Controls */}
                    <div className="md:hidden space-y-2">
                        {orderedRecipes.map((recipe, index) => (
                            <div key={recipe.id} className="p-4 bg-white border rounded-lg shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => moveRecipeUp(index)}
                                            disabled={index === 0}
                                            className="h-6 w-6 p-0"
                                        >
                                            ↑
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => moveRecipeDown(index)}
                                            disabled={index === orderedRecipes.length - 1}
                                            className="h-6 w-6 p-0"
                                        >
                                            ↓
                                        </Button>
                                    </div>
                                    <Checkbox
                                        checked={!settings.excluded_recipes.includes(recipe.id)}
                                        onCheckedChange={(checked) => handleRecipeToggle(recipe.id, !checked)}
                                    />
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{recipe.name}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {recipe.category}
                                            </Badge>
                                        </div>
                                        <div className="space-y-2">
                                            <Input
                                                placeholder="Custom name (optional)"
                                                value={settings.custom_recipe_names[recipe.id] || ''}
                                                onChange={(e) => handleCustomNameChange(recipe.id, e.target.value)}
                                                className="text-sm"
                                            />
                                            <Textarea
                                                placeholder="Custom description (optional)"
                                                value={settings.custom_descriptions[recipe.id] || ''}
                                                onChange={(e) => handleCustomDescriptionChange(recipe.id, e.target.value)}
                                                className="text-sm"
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}