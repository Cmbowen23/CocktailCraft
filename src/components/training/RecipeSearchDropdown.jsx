import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, GripVertical, Plus } from 'lucide-react';
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { base44 } from '@/api/base44Client';
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateRecipeHtml } from './recipeHtmlGenerator';
import { ingredientCategories } from '../utils/categoryDefinitions';

export default function RecipeSearchDropdown({ onInsert }) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && recipes.length === 0) {
            loadRecipes();
        }
    }, [open]);

    const loadRecipes = async () => {
        setLoading(true);
        try {
            const [user, menus, allRecipes] = await Promise.all([
                base44.auth.me(),
                base44.entities.Menu.list(),
                base44.entities.Recipe.list("-created_at")
            ]);

            const userAccountMenuIds = new Set();
            if (user?.account_id) {
                (menus || []).forEach(m => {
                    if (m.account_id === user.account_id) userAccountMenuIds.add(m.id);
                });
            }

            const filtered = (allRecipes || []).filter(r => {
                // 1. Access Control
                let hasAccess = false;
                if (user?.role === 'admin') {
                    hasAccess = true;
                } else {
                    const isCreator = r.created_by === user?.email;
                    const isShared = r.menu_id && userAccountMenuIds.has(r.menu_id);
                    hasAccess = isCreator || isShared;
                }

                if (!hasAccess) return false;

                // 2. Sub-Recipe / Batch Filter
                // Filter to only show sub-recipes (ingredients/prep items)
                const isSubRecipe = ingredientCategories.includes(r.category) || 
                                    (r.batch_settings && Object.keys(r.batch_settings).length > 0);
                
                return isSubRecipe;
            });

            setRecipes(filtered);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (e, recipe) => {
        const html = generateRecipeHtml(recipe);
        e.dataTransfer.setData('text/html', html);
        e.dataTransfer.setData('text/plain', recipe.name);
        // Visual feedback
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleInsertClick = (recipe) => {
        const html = generateRecipeHtml(recipe);
        onInsert(html);
        setOpen(false);
    };

    const filteredRecipes = recipes.filter(r => 
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="outline"
                    className="w-full justify-start text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                    <Search className="w-4 h-4 mr-2" />
                    Search Recipes to Insert...
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start" side="right">
                <div className="p-2 border-b">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
                        <Input
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-8 text-sm"
                            autoFocus
                        />
                    </div>
                </div>
                <ScrollArea className="h-[300px]">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <LoadingSpinner className="h-8 w-8 text-blue-600" />
                        </div>
                    ) : filteredRecipes.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">
                            No recipes found
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredRecipes.map(recipe => (
                                <div 
                                    key={recipe.id} 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, recipe)}
                                    className="group flex items-center justify-between p-2 hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <GripVertical className="h-3 w-3 text-gray-300" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-medium truncate">{recipe.name}</span>
                                            <span className="text-[10px] text-gray-500 capitalize">{recipe.category?.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleInsertClick(recipe)}
                                        title="Click to insert"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 bg-gray-50 text-[10px] text-gray-400 text-center border-t">
                    Drag and drop into editor or click + to insert
                </div>
            </PopoverContent>
        </Popover>
    );
}