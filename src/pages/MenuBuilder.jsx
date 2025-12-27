import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { 
  LayoutTemplate, Search, Plus, Trash2, Save, GripVertical, 
  Loader2, Image as ImageIcon, List, FileText, ArrowRight
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";

// --- FIXED IMPORTS ---
import { base44 } from "@/api/base44Client"; 
import { calculateRecipeCost, formatCurrency } from "../components/utils/costCalculations";

const COCKTAIL_CATEGORIES = ['cocktail', 'classic', 'modern', 'signature', 'tiki', 'tropical', 'apertif', 'digestif', 'batched'];
const IGNORED_CATEGORIES = ['syrup', 'juice', 'infusion', 'garnish', 'puree', 'cordial'];

// --- Components ---

// 1. LEFT SIDE CARD (Source Library)
const SourceRecipeCard = ({ recipe, cost, index, mode }) => (
  <Draggable draggableId={recipe.uniqueId || recipe.id} index={index}>
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        className={`group relative bg-white border rounded-lg overflow-hidden transition-all cursor-grab active:cursor-grabbing mb-3 ${snapshot.isDragging ? 'ring-2 ring-blue-500 rotate-2 z-50 shadow-2xl' : 'border-gray-200 shadow-sm hover:shadow-md'}`}
      >
        {mode === 'gallery' ? (
            // Gallery Mode
            <>
                <div className="h-32 bg-gray-100 relative overflow-hidden">
                    {recipe.image_url ? (
                        <img src={recipe.image_url} alt={recipe.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                            <ImageIcon className="w-8 h-8" />
                        </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm font-medium">
                        ${formatCurrency(cost)}
                    </div>
                </div>
                <div className="p-3">
                    <h4 className="font-bold text-gray-800 truncate text-sm mb-1">{recipe.name}</h4>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-gray-100 text-gray-600">
                        {recipe.base_spirit || 'Cocktail'}
                    </Badge>
                </div>
            </>
        ) : (
            // Specs Mode
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-900 text-base">{recipe.name}</h4>
                    <span className="text-xs font-mono text-green-700 font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                        ${formatCurrency(cost)}
                    </span>
                </div>
                <div className="space-y-1 my-3">
                    {recipe.ingredients?.map((ing, i) => (
                        <div key={i} className="flex justify-between text-sm border-b border-gray-50 last:border-0 pb-1">
                            <span className="text-gray-700 font-medium truncate pr-2">{ing.ingredient_name}</span>
                            <span className="text-gray-500 font-mono text-xs whitespace-nowrap">{ing.amount} {ing.unit}</span>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{recipe.glassware || 'Glassware N/A'}</span>
                    <Badge variant="outline" className="text-[10px] h-5 font-normal text-gray-500 border-gray-200">
                        {recipe.base_spirit || 'Spirit'}
                    </Badge>
                </div>
            </div>
        )}
      </div>
    )}
  </Draggable>
);

// 2. RIGHT SIDE ITEM (Menu View)
const MenuItemCard = ({ recipe, index, sectionId, onRemove, cost }) => (
  <Draggable draggableId={`${sectionId}-${recipe.uniqueId || recipe.id}`} index={index}>
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        className={`flex group relative p-4 bg-white border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${snapshot.isDragging ? 'shadow-lg rounded-lg border border-blue-200 z-50' : ''}`}
      >
        <div {...provided.dragHandleProps} className="mr-3 mt-1 text-gray-300 cursor-grab hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 space-y-1">
            <div className="flex justify-between items-baseline">
                <h4 className="font-bold text-gray-900 text-lg tracking-wide uppercase font-sans">{recipe.name}</h4>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono text-green-600 bg-green-50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        ${formatCurrency(cost)}
                    </span>
                    <span className="font-bold text-gray-900">${recipe.menu_price || Math.ceil(cost * 5)}</span>
                </div>
            </div>
            <p className="text-sm text-gray-500 font-medium leading-snug font-sans">
                {recipe.ingredients?.map(i => i.ingredient_name).join(', ')}
            </p>
        </div>
        <button 
            onClick={() => onRemove(index)}
            className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
            <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )}
  </Draggable>
);

export default function MenuBuilder() {
  const [isLoading, setIsLoading] = useState(true);
  
  // Data
  const [allRecipes, setAllRecipes] = useState([]); 
  const [visibleRecipes, setVisibleRecipes] = useState([]); 
  const [allIngredients, setAllIngredients] = useState([]);

  // UI State
  const [viewMode, setViewMode] = useState("specs");
  const [menuName, setMenuName] = useState("New Menu");
  const [sections, setSections] = useState([ { id: 'sec-1', name: '', recipes: [] } ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // --- Initialization ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // USE BASE44 CLIENT
        const [ings, recs] = await Promise.all([
            base44.entities.Ingredient.list().catch(() => []),
            base44.entities.Recipe.list().catch(() => [])
        ]);
        setAllIngredients(ings);
        
        const cocktailRecipes = recs.filter(r => {
            const cat = r.category?.toLowerCase() || '';
            const isIgnored = IGNORED_CATEGORIES.includes(cat);
            const isBatched = r.is_batched === true;
            if (isBatched) return true;
            if (isIgnored) return false;
            return true; 
        }).map(r => ({
            ...r,
            uniqueId: r.id,
            _cost: calculateRecipeCost(r, ings).totalCost
        }));
        
        cocktailRecipes.sort((a,b) => a.name.localeCompare(b.name));

        setAllRecipes(cocktailRecipes);
        setVisibleRecipes(cocktailRecipes);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // --- Filtering ---
  useEffect(() => {
    const lowerQ = searchQuery.toLowerCase();
    const filtered = allRecipes.filter(r => {
        const matchesName = r.name.toLowerCase().includes(lowerQ);
        const matchesSpirit = r.base_spirit?.toLowerCase().includes(lowerQ);
        const matchesTag = r.tags?.some(t => t.toLowerCase().includes(lowerQ));
        const matchesDesc = r.description?.toLowerCase().includes(lowerQ);
        return matchesName || matchesSpirit || matchesTag || matchesDesc;
    });
    setVisibleRecipes(filtered);
  }, [searchQuery, allRecipes]);

  // --- Menu Calculations ---
  const menuStats = useMemo(() => {
    const flatRecipes = sections.flatMap(s => s.recipes);
    const count = flatRecipes.length;
    if (count === 0) return { count: 0, avgCost: 0, revenue: 0 };
    const totalCost = flatRecipes.reduce((sum, r) => sum + (r._cost || 0), 0);
    const avgCost = totalCost / count;
    return { count, avgCost, revenue: (avgCost / 0.20) * count * 20 };
  }, [sections]);

  // --- Drag & Drop ---
  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const isSourceLibrary = source.droppableId === 'library';
    if (!destination.droppableId) return;

    const destSecIdx = sections.findIndex(s => s.id === destination.droppableId);
    if (destSecIdx === -1) return; 

    const newSections = [...sections];

    if (isSourceLibrary) {
        const recipeToAdd = visibleRecipes[source.index];
        const newMenuItem = { ...recipeToAdd, uniqueId: `${recipeToAdd.id}-${Date.now()}` }; 
        newSections[destSecIdx].recipes.splice(destination.index, 0, newMenuItem);
        toast.success(`Added ${recipeToAdd.name}`);
    } else {
        const sourceSecIdx = sections.findIndex(s => s.id === source.droppableId);
        const [movedItem] = newSections[sourceSecIdx].recipes.splice(source.index, 1);
        newSections[destSecIdx].recipes.splice(destination.index, 0, movedItem);
    }
    setSections(newSections);
  };

  const handleAddSection = () => {
    setSections([...sections, { id: `sec-${Date.now()}`, name: "", recipes: [] }]);
  };

  const handleRemoveRecipe = (sectionIdx, recipeIdx) => {
    const newSections = [...sections];
    newSections[sectionIdx].recipes.splice(recipeIdx, 1);
    setSections(newSections);
  };

  const handleSaveMenu = async () => {
    try {
        await base44.entities.Menu.create({
            name: menuName,
            is_active: false,
            sections: sections.map(s => ({
                name: s.name || "Untitled Section",
                recipe_ids: s.recipes.map(r => r.id)
            }))
        });
        toast.success("Menu saved successfully!");
        setIsSaveModalOpen(false);
    } catch(e) { toast.error("Failed to save menu"); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm shrink-0 h-16 z-20">
        <div className="flex items-center gap-4">
            <div className="bg-gray-900 p-2 rounded text-white"><LayoutTemplate className="w-5 h-5"/></div>
            <Input 
                value={menuName} onChange={e => setMenuName(e.target.value)} 
                className="font-bold text-xl border-none shadow-none px-0 bg-transparent w-64 focus-visible:ring-0 font-sans" 
            />
        </div>
        <div className="flex items-center gap-8">
            <div className="flex gap-6 text-right">
                <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Items</p>
                    <p className="text-xl font-bold text-gray-900 leading-none">{menuStats.count}</p>
                </div>
                <div className="w-px h-8 bg-gray-100"></div>
                <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Avg Cost</p>
                    <p className="text-xl font-bold text-green-600 leading-none">${formatCurrency(menuStats.avgCost)}</p>
                </div>
            </div>
            <Button onClick={() => setIsSaveModalOpen(true)} className="bg-gray-900 hover:bg-black font-sans"><Save className="w-4 h-4 mr-2"/> Save</Button>
        </div>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex overflow-hidden">
            <div className="w-5/12 min-w-[420px] max-w-[500px] border-r border-gray-200 bg-white flex flex-col z-10 shadow-xl">
                <div className="p-4 border-b space-y-3 bg-gray-50/50">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder='Filter recipes (e.g. "Spicy", "Gin")'
                                className="pl-9 bg-white border-gray-200 font-sans"
                            />
                        </div>
                        <div className="flex bg-gray-100 p-1 rounded-md shrink-0">
                            <button onClick={() => setViewMode('gallery')} className={`p-2 rounded-sm transition-all ${viewMode === 'gallery' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><ImageIcon className="w-4 h-4" /></button>
                            <button onClick={() => setViewMode('specs')} className={`p-2 rounded-sm transition-all ${viewMode === 'specs' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><List className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400 px-1 font-sans">
                        <span>{visibleRecipes.length} Cocktails Available</span>
                    </div>
                </div>

                <div className="flex-1 bg-gray-100/50 p-4 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400"/></div>
                    ) : (
                        <Droppable droppableId="library" isDropDisabled={true}>
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className={`grid gap-3 ${viewMode === 'gallery' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {visibleRecipes.map((recipe, idx) => (
                                        <SourceRecipeCard key={recipe.uniqueId} recipe={recipe} cost={recipe._cost} index={idx} mode={viewMode} />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    )}
                </div>
            </div>

            <div className="flex-1 bg-white overflow-y-auto p-8 md:px-12 lg:px-20">
                <div className="max-w-4xl mx-auto space-y-8 min-h-[500px]">
                    <div className="text-center pb-6 border-b border-gray-100">
                        <h2 className="font-sans text-4xl font-bold text-gray-900 tracking-tight uppercase">{menuName}</h2>
                        <p className="text-gray-400 mt-2 text-sm font-medium tracking-wide font-sans">SEASONAL COCKTAIL MENU</p>
                    </div>

                    <div className="space-y-8">
                        {sections.map((section, idx) => (
                            <div key={section.id} className="space-y-3">
                                <div className="flex items-center justify-between group border-b-2 border-gray-900 pb-2">
                                    <Input 
                                        value={section.name} 
                                        onChange={(e) => {
                                            const newSecs = [...sections];
                                            newSecs[idx].name = e.target.value;
                                            setSections(newSecs);
                                        }}
                                        className="font-bold text-xl text-gray-900 border-none px-0 h-auto w-full max-w-md focus-visible:ring-0 bg-transparent uppercase tracking-wider placeholder:text-gray-300 font-sans"
                                        placeholder="SECTION NAME (Optional)"
                                    />
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" onClick={() => {
                                            if (sections.length > 1) setSections(sections.filter(s => s.id !== section.id));
                                            else toast.error("Menu needs at least one section");
                                        }} className="text-gray-300 hover:text-red-500 h-8 w-8"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                </div>

                                <Droppable droppableId={section.id}>
                                    {(provided, snapshot) => (
                                        <div ref={provided.innerRef} {...provided.droppableProps} className={`min-h-[150px] transition-all rounded-lg ${snapshot.isDraggingOver ? 'bg-blue-50/50 ring-2 ring-blue-100' : ''} ${section.recipes.length === 0 ? 'border-2 border-dashed border-gray-100' : ''}`}>
                                            {section.recipes.length === 0 && (
                                                <div className="h-full flex items-center justify-center py-10 text-gray-300 text-sm font-medium font-sans">Drag cocktails here</div>
                                            )}
                                            {section.recipes.map((recipe, rIdx) => (
                                                <MenuItemCard key={`${section.id}-${recipe.uniqueId}`} recipe={recipe} sectionId={section.id} index={rIdx} cost={recipe._cost} onRemove={(i) => handleRemoveRecipe(idx, i)} />
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        ))}
                        <Button variant="outline" onClick={() => handleAddSection()} className="w-full py-6 border-dashed border-2 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 mt-8 font-sans"><Plus className="w-5 h-5 mr-2" /> Add Menu Section</Button>
                    </div>
                </div>
            </div>
        </div>
      </DragDropContext>

      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Save Menu</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
                <div><Label>Menu Name</Label><Input value={menuName} onChange={(e) => setMenuName(e.target.value)} /></div>
                <div className="text-sm text-gray-500 font-sans">Includes {menuStats.count} items across {sections.length} sections.</div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsSaveModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveMenu} className="bg-gray-900 hover:bg-black font-sans">Save Menu</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}