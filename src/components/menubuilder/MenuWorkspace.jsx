import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, GripVertical, X, Pencil, Check } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { formatCurrency, calculateRecipeCost } from "../utils/costCalculations";

export default function MenuWorkspace({ 
  sections, 
  onSectionsChange, 
  onAddSection, 
  onRemoveRecipe, 
  allRecipes, 
  allIngredients,
  showTags = true
}) {
  const [editingSectionId, setEditingSectionId] = React.useState(null);
  const [editingSectionName, setEditingSectionName] = React.useState("");

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === "section") {
      const newSections = Array.from(sections);
      const [movedSection] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, movedSection);
      onSectionsChange(newSections);
    } else if (type === "recipe") {
      const sourceSectionIndex = sections.findIndex(s => s.id === source.droppableId);
      const destSectionIndex = sections.findIndex(s => s.id === destination.droppableId);

      if (sourceSectionIndex === -1 || destSectionIndex === -1) return;

      const newSections = Array.from(sections);
      const sourceRecipes = Array.from(newSections[sourceSectionIndex].recipes);
      const [movedRecipe] = sourceRecipes.splice(source.index, 1);

      if (source.droppableId === destination.droppableId) {
        sourceRecipes.splice(destination.index, 0, movedRecipe);
        newSections[sourceSectionIndex] = {
          ...newSections[sourceSectionIndex],
          recipes: sourceRecipes
        };
      } else {
        const destRecipes = Array.from(newSections[destSectionIndex].recipes);
        destRecipes.splice(destination.index, 0, movedRecipe);
        newSections[sourceSectionIndex] = {
          ...newSections[sourceSectionIndex],
          recipes: sourceRecipes
        };
        newSections[destSectionIndex] = {
          ...newSections[destSectionIndex],
          recipes: destRecipes
        };
      }

      onSectionsChange(newSections);
    }
  };

  const handleRemoveSection = (sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (section && section.recipes.length > 0) {
      if (!window.confirm(`Remove "${section.name}" and all its recipes?`)) {
        return;
      }
    }
    onSectionsChange(sections.filter(s => s.id !== sectionId));
  };

  const handleStartEditSection = (section) => {
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
  };

  const handleSaveEditSection = () => {
    if (editingSectionName.trim()) {
      onSectionsChange(
        sections.map(s => 
          s.id === editingSectionId 
            ? { ...s, name: editingSectionName.trim() }
            : s
        )
      );
    }
    setEditingSectionId(null);
    setEditingSectionName("");
  };

  const totalRecipes = sections.reduce((sum, section) => sum + section.recipes.length, 0);

  return (
    <Card className="border border-gray-200 shadow-sm bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Menu Workspace
            {totalRecipes > 0 && (
              <Badge variant="secondary">{totalRecipes} recipes</Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sections" type="section">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4"
              >
                {sections.map((section, sectionIndex) => (
                  <Draggable
                    key={section.id}
                    draggableId={section.id}
                    index={sectionIndex}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 flex-1">
                            <div {...provided.dragHandleProps}>
                              <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />
                            </div>
                            {editingSectionId === section.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  value={editingSectionName}
                                  onChange={(e) => setEditingSectionName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEditSection();
                                    if (e.key === 'Escape') setEditingSectionId(null);
                                  }}
                                  className="h-8"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleSaveEditSection}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <h3 className="font-semibold text-gray-900">{section.name}</h3>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStartEditSection(section)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                          {sections.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveSection(section.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <Droppable droppableId={section.id} type="recipe">
                          {(provided) => (
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className="space-y-2 min-h-[50px]"
                            >
                              {section.recipes.map((recipeId, recipeIndex) => {
                                const recipe = allRecipes.find(r => r.id === recipeId);
                                if (!recipe) return null;

                                const { totalCost } = calculateRecipeCost(recipe, allIngredients);

                                return (
                                  <Draggable
                                    key={recipeId}
                                    draggableId={recipeId}
                                    index={recipeIndex}
                                  >
                                    {(provided) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className="bg-white rounded p-3 border border-gray-200 hover:border-blue-300 transition-colors"
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <div {...provided.dragHandleProps} className="mt-1">
                                              <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-medium text-gray-900 truncate">{recipe.name}</h4>
                                              <p className="text-sm text-gray-600">${formatCurrency(totalCost)} cost</p>
                                              {showTags && recipe.tags && recipe.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {recipe.tags.slice(0, 2).map((tag, idx) => (
                                                    <Badge key={idx} variant="secondary" className="text-xs">
                                                      {tag}
                                                    </Badge>
                                                  ))}
                                                  {recipe.tags.length > 2 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                      +{recipe.tags.length - 2}
                                                    </Badge>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onRemoveRecipe(section.id, recipeId)}
                                            className="text-red-500 hover:text-red-700 flex-shrink-0"
                                          >
                                            <X className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                              {section.recipes.length === 0 && (
                                <div className="text-center py-6 text-gray-400 text-sm">
                                  Drag recipes here or click recipes to add them
                                </div>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <Button
          onClick={onAddSection}
          variant="outline"
          className="w-full mt-4 border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Section
        </Button>
      </CardContent>
    </Card>
  );
}