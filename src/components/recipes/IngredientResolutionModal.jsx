import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Check, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import IngredientForm from "../ingredients/IngredientForm";
import { saveIngredientWithPrepActions } from "../ingredients/ingredientManagementService";

// Simple Levenshtein distance for similarity calculation
const levenshteinDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

const getSimilarity = (s1, s2) => {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - levenshteinDistance(longer, shorter)) / parseFloat(longerLength);
};

export default function IngredientResolutionModal({
    ingredientName, // The raw text from the parser
    allIngredients,
    onResolve, // Callback with the resolved ingredient name
    onClose,
    customCategories = [],
    onCategoryAdded
}) {
    const [view, setView] = useState('match'); // 'match' | 'create' | 'search'
    const [matches, setMatches] = useState([]);
    const [searchOpen, setSearchOpen] = useState(false);
    
    // For creation mode
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (ingredientName && allIngredients) {
            const normalizedTarget = ingredientName.toLowerCase().trim();
            
            const calculatedMatches = allIngredients.map(ing => {
                const normalizedIng = ing.name.toLowerCase().trim();
                
                // Boost score for exact substring matches
                let similarity = getSimilarity(normalizedTarget, normalizedIng);
                if (normalizedIng.includes(normalizedTarget) || normalizedTarget.includes(normalizedIng)) {
                    similarity = Math.max(similarity, 0.7); // Minimum 70% if substring
                    if (normalizedIng === normalizedTarget) similarity = 1.0;
                }
                
                return {
                    ...ing,
                    similarity: similarity,
                    percentage: Math.round(similarity * 100)
                };
            })
            .filter(m => m.percentage > 40) // Only show decent matches
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5); // Top 5

            setMatches(calculatedMatches);
        }
    }, [ingredientName, allIngredients]);

    const handleSelectMatch = (match) => {
        onResolve(match.name);
    };

    const handleCreateSubmit = async (formData) => {
        setIsSaving(true);
        try {
            const savedIngredient = await saveIngredientWithPrepActions(formData);
            onResolve(savedIngredient.name);
        } catch (error) {
            console.error("Error creating ingredient:", error);
            // Optionally show error
        } finally {
            setIsSaving(false);
        }
    };

    const handleSearchSelect = (name) => {
        onResolve(name);
        setSearchOpen(false);
    };

    // Default content for creation form
    const defaultNewIngredient = { 
        name: ingredientName, 
        category: 'other', 
        unit: 'oz', 
        ingredient_type: 'purchased' 
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Resolve Ingredient: {ingredientName}</DialogTitle>
                    <DialogDescription>
                        Map "{ingredientName}" to an existing ingredient or create a new one.
                    </DialogDescription>
                </DialogHeader>

                {view === 'match' && (
                    <div className="space-y-4 mt-2">
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Possible matches:</h4>
                            <ScrollArea className="h-[200px] w-full rounded-md border border-gray-200 bg-gray-50 p-2">
                                {matches.length > 0 ? (
                                    <div className="space-y-2">
                                        {matches.map((match) => (
                                            <button
                                                key={match.id}
                                                onClick={() => handleSelectMatch(match)}
                                                className="w-full flex items-center justify-between p-3 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all group"
                                            >
                                                <div className="flex flex-col items-start">
                                                    <span className="font-medium text-gray-900">{match.name}</span>
                                                    {match.category && <span className="text-xs text-gray-500 capitalize">{match.category.replace('_', ' ')}</span>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className={cn(
                                                        match.percentage > 80 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                                    )}>
                                                        {match.percentage}% match
                                                    </Badge>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
                                        <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-sm">No similar ingredients found.</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button 
                                onClick={() => setView('create')} 
                                className="flex-1 bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300"
                                variant="outline"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Create New
                            </Button>
                            
                            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        className="flex-1 justify-between"
                                        role="combobox"
                                    >
                                        <span className="flex items-center">
                                            <Search className="w-4 h-4 mr-2" />
                                            Search existing...
                                        </span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="end">
                                    <Command>
                                        <CommandInput placeholder="Search ingredients..." />
                                        <CommandList>
                                            <CommandEmpty>No ingredient found.</CommandEmpty>
                                            <CommandGroup>
                                                {allIngredients.map((ing) => (
                                                    <CommandItem
                                                        key={ing.id}
                                                        value={ing.name}
                                                        onSelect={(currentValue) => handleSearchSelect(ing.name)}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                ing.name === ingredientName ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {ing.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                )}

                {view === 'create' && (
                    <div className="mt-0">
                        <div className="mb-4">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setView('match')}
                                className="pl-0 text-gray-500 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-4 h-4 mr-1" /> Back to matches
                            </Button>
                        </div>
                        <IngredientForm
                            ingredient={defaultNewIngredient}
                            allIngredients={allIngredients}
                            customCategories={customCategories}
                            onCategoryAdded={onCategoryAdded}
                            onSubmit={handleCreateSubmit}
                            onCancel={() => setView('match')}
                            isSaving={isSaving}
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}