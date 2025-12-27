import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Settings2, Star, Edit, Trash2, MoreVertical, Loader2, ShoppingBasket } from "lucide-react";
import StandardOrderPresetEditor from "./StandardOrderPresetEditor";

export default function StandardOrderPresetManager({ onApplyPreset, alcoholicIngredients = [] }) {
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.StandardOrderPreset.list();
      setPresets(data || []);
    } catch (error) {
      console.error("Error loading presets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const handleEdit = (preset) => {
    setEditingPreset(preset);
    setShowEditor(true);
  };

  const handleCreate = () => {
    setEditingPreset(null);
    setShowEditor(true);
  };

  const handleDelete = async (preset) => {
    if (!confirm(`Delete preset "${preset.name}"?`)) return;
    try {
      await base44.entities.StandardOrderPreset.delete(preset.id);
      loadPresets();
    } catch (error) {
      console.error("Error deleting preset:", error);
    }
  };

  const handleApply = (preset) => {
    if (!onApplyPreset || !preset.items) return;

    const newItems = [];
    const existingIds = new Set();

    preset.items.forEach(({ match_type, match_value, quantity, max_products }) => {
      const matches = alcoholicIngredients.filter((ing) => {
        if (match_type === "spirit_type") {
          const spiritType = (ing.spirit_type || "").toLowerCase();
          return spiritType.includes(match_value.toLowerCase());
        } else {
          const category = (ing.category || "").toLowerCase();
          return category.includes(match_value.toLowerCase());
        }
      });

      // Sort by tier (well first for basics)
      const sorted = matches.sort((a, b) => {
        const tierOrder = { well: 0, call: 1, premium: 2, top_shelf: 3 };
        const aTier = tierOrder[(a.tier || "").toLowerCase()] ?? 1;
        const bTier = tierOrder[(b.tier || "").toLowerCase()] ?? 1;
        return aTier - bTier;
      });

      sorted.slice(0, max_products || 2).forEach((ing) => {
        if (!existingIds.has(ing.id)) {
          existingIds.add(ing.id);
          newItems.push({
            temp_id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            ingredient_id: ing.id,
            ingredient_name: ing.name,
            quantity: quantity || 6,
            unit: "bottle",
          });
        }
      });
    });

    onApplyPreset(newItems);
  };

  const defaultPreset = presets.find((p) => p.is_default);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {defaultPreset ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleApply(defaultPreset)}
            className="flex items-center gap-2"
          >
            <ShoppingBasket className="w-4 h-4" />
            Add Standard Order
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreate}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Standard Order
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings2 className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {isLoading ? (
              <div className="p-2 text-center text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              </div>
            ) : presets.length === 0 ? (
              <div className="p-2 text-center text-sm text-gray-500">
                No presets yet
              </div>
            ) : (
              presets.map((preset) => (
                <div key={preset.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50">
                  <button
                    className="flex-1 text-left text-sm flex items-center gap-2"
                    onClick={() => handleApply(preset)}
                  >
                    {preset.is_default && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                    {preset.name}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(preset)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDelete(preset)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            <div className="border-t mt-1 pt-1">
              <DropdownMenuItem onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Create New Preset
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <StandardOrderPresetEditor
        open={showEditor}
        onOpenChange={setShowEditor}
        preset={editingPreset}
        onSave={loadPresets}
      />
    </div>
  );
}