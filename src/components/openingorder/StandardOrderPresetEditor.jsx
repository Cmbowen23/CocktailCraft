import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Save, X, Loader2, Settings2, Star } from "lucide-react";

const SPIRIT_TYPES = [
  "vodka", "gin", "rum", "tequila", "mezcal", "bourbon", "whiskey", "rye", "scotch", "brandy", "cognac"
];

const CATEGORIES = [
  "spirit", "liqueur", "vermouth", "amaro", "bitters", "wine", "beer"
];

export default function StandardOrderPresetEditor({ open, onOpenChange, preset, onSave }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (preset) {
      setName(preset.name || "");
      setDescription(preset.description || "");
      setIsDefault(preset.is_default || false);
      setItems(preset.items || []);
    } else {
      setName("");
      setDescription("");
      setIsDefault(false);
      setItems([]);
    }
  }, [preset, open]);

  const addItem = () => {
    setItems([...items, { match_type: "spirit_type", match_value: "", quantity: 6, max_products: 2 }]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim() || items.length === 0) return;

    setIsSaving(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        is_default: isDefault,
        items: items.filter(item => item.match_value),
      };

      // If setting as default, unset other defaults first
      if (isDefault) {
        const allPresets = await base44.entities.StandardOrderPreset.list();
        for (const p of allPresets) {
          if (p.is_default && p.id !== preset?.id) {
            await base44.entities.StandardOrderPreset.update(p.id, { is_default: false });
          }
        }
      }

      if (preset?.id) {
        await base44.entities.StandardOrderPreset.update(preset.id, data);
      } else {
        await base44.entities.StandardOrderPreset.create(data);
      }

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving preset:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{preset ? "Edit" : "Create"} Standard Order Preset</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Default Bar Opening"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              <Label>Set as default preset</Label>
            </div>
          </div>

          <div>
            <Label htmlFor="preset-description">Description</Label>
            <Textarea
              id="preset-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this preset is for..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items to Add</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>

            {items.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm border rounded-md">
                No items yet. Click "Add Item" to start building your preset.
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
                  <Select
                    value={item.match_type}
                    onValueChange={(val) => updateItem(index, "match_type", val)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spirit_type">Spirit Type</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={item.match_value}
                    onValueChange={(val) => updateItem(index, "match_value", val)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(item.match_type === "spirit_type" ? SPIRIT_TYPES : CATEGORIES).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">Qty:</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                      className="w-16"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">Max:</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.max_products}
                      onChange={(e) => updateItem(index, "max_products", parseInt(e.target.value) || 1)}
                      className="w-16"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !name.trim() || items.length === 0}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Preset
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}