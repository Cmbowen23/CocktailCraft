import React, { useState, useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, RefreshCw, Pencil, Check, X } from "lucide-react";

const DEFAULT_STEPS = [
    "Gather all ingredients for this batch.",
    "Use the calculator above to scale correctly.",
    "Label the batch with drink name and date."
];

export default function PrepChecklist({ task, recipe, onUpdate }) {
    const [steps, setSteps] = useState([]);
    const [completedIndices, setCompletedIndices] = useState([]);
    const [editingIndex, setEditingIndex] = useState(null);
    const [editingText, setEditingText] = useState("");

    useEffect(() => {
        if (task) {
            // If recipe has instructions, use those. Otherwise use task steps or defaults
            // Don't use recipe instructions for batch prep (those are cocktail-making instructions, not batching)
            let initialSteps = DEFAULT_STEPS;
            if (task.itemType !== 'batch' && recipe?.instructions && recipe.instructions.length > 0) {
                initialSteps = recipe.instructions;
            } else if (task.steps && task.steps.length > 0) {
                initialSteps = task.steps;
            }
            setSteps(initialSteps);
            setCompletedIndices(task.completedStepIndices || []);
        }
    }, [task, recipe]);

    const saveChanges = (newSteps, newCompleted) => {
        setSteps(newSteps);
        setCompletedIndices(newCompleted);
        onUpdate({
            ...task,
            steps: newSteps,
            completedStepIndices: newCompleted
        });
    };

    const toggleStep = (index) => {
        const isCompleted = completedIndices.includes(index);
        let newCompleted;
        if (isCompleted) {
            newCompleted = completedIndices.filter(i => i !== index);
        } else {
            newCompleted = [...completedIndices, index];
        }
        saveChanges(steps, newCompleted);
    };

    const resetChecklist = () => {
        saveChanges(steps, []);
    };

    const startEditing = (index) => {
        setEditingIndex(index);
        setEditingText(steps[index]);
    };

    const saveEditing = () => {
        const newSteps = [...steps];
        newSteps[editingIndex] = editingText;
        setEditingIndex(null);
        saveChanges(newSteps, completedIndices);
    };

    const cancelEditing = () => {
        setEditingIndex(null);
    };

    const deleteStep = (index) => {
        const newSteps = steps.filter((_, i) => i !== index);
        // Adjust completed indices
        const newCompleted = completedIndices
            .filter(i => i !== index)
            .map(i => i > index ? i - 1 : i);
        saveChanges(newSteps, newCompleted);
    };

    const addStep = () => {
        const newSteps = [...steps, "New step"];
        saveChanges(newSteps, completedIndices);
        startEditing(newSteps.length - 1);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Prep Steps</h3>
                <Button variant="ghost" size="sm" onClick={resetChecklist} className="text-xs text-gray-500 hover:text-gray-700">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Reset
                </Button>
            </div>

            <div className="space-y-2">
                {steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 group">
                        <Checkbox 
                            checked={completedIndices.includes(index)}
                            onCheckedChange={() => toggleStep(index)}
                            className="mt-0.5"
                        />
                        
                        <div className="flex-1 min-w-0">
                            {editingIndex === index ? (
                                <div className="flex items-center gap-2">
                                    <Input 
                                        value={editingText}
                                        onChange={(e) => setEditingText(e.target.value)}
                                        className="h-8 text-sm"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveEditing();
                                            if (e.key === 'Escape') cancelEditing();
                                        }}
                                    />
                                    <Button size="sm" variant="ghost" onClick={saveEditing} className="h-8 w-8 p-0 text-green-600">
                                        <Check className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0 text-gray-400">
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <span className={`text-sm ${completedIndices.includes(index) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                    {step}
                                </span>
                            )}
                        </div>

                        {editingIndex !== index && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" onClick={() => startEditing(index)} className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600">
                                    <Pencil className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteStep(index)} className="h-7 w-7 p-0 text-gray-400 hover:text-red-600">
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Button variant="outline" size="sm" onClick={addStep} className="w-full text-gray-500 hover:text-gray-700 border-dashed">
                <Plus className="w-3 h-3 mr-2" />
                Add Step
            </Button>
        </div>
    );
}