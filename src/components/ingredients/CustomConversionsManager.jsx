import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Calculator, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const weightUnits = ['g', 'kg', 'lb', 'oz'];
const volumeUnits = ['ml', 'L', 'fl oz', 'cup', 'qt', 'tbsp', 'tsp'];
const allUnits = [...weightUnits, ...volumeUnits, 'piece', 'dash'];

const commonConversions = {
  'Water': [
    { from_unit: 'lb', to_unit: 'ml', conversion_factor: 453.592, notes: 'Water density at room temperature' },
    { from_unit: 'kg', to_unit: 'ml', conversion_factor: 1000, notes: 'Water density at room temperature' },
    { from_unit: 'g', to_unit: 'ml', conversion_factor: 1, notes: 'Water density at room temperature' }
  ],
  'Sugar': [
    { from_unit: 'lb', to_unit: 'ml', conversion_factor: 213.37, notes: 'Granulated sugar density ~2.13 g/ml' },
    { from_unit: 'kg', to_unit: 'ml', conversion_factor: 469.48, notes: 'Granulated sugar density ~2.13 g/ml' },
    { from_unit: 'g', to_unit: 'ml', conversion_factor: 0.469, notes: 'Granulated sugar density ~2.13 g/ml' }
  ],
  'Honey': [
    { from_unit: 'lb', to_unit: 'ml', conversion_factor: 325.43, notes: 'Honey density ~1.4 g/ml' },
    { from_unit: 'kg', to_unit: 'ml', conversion_factor: 714.29, notes: 'Honey density ~1.4 g/ml' },
    { from_unit: 'g', to_unit: 'ml', conversion_factor: 0.714, notes: 'Honey density ~1.4 g/ml' }
  ],
  'Salt': [
    { from_unit: 'lb', to_unit: 'ml', conversion_factor: 208.19, notes: 'Table salt density ~2.18 g/ml' },
    { from_unit: 'kg', to_unit: 'ml', conversion_factor: 458.72, notes: 'Table salt density ~2.18 g/ml' },
    { from_unit: 'g', to_unit: 'ml', conversion_factor: 0.459, notes: 'Table salt density ~2.18 g/ml' }
  ]
};

export default function CustomConversionsManager({ 
  ingredient, 
  customConversions = [], 
  onConversionsChange 
}) {
  const [conversions, setConversions] = useState(customConversions);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addConversion = (conversion = null) => {
    const newConversion = conversion || {
      from_unit: '',
      to_unit: '',
      conversion_factor: 1,
      notes: ''
    };
    
    const newConversions = [...conversions, newConversion];
    setConversions(newConversions);
    onConversionsChange(newConversions);
  };

  const removeConversion = (index) => {
    const newConversions = conversions.filter((_, i) => i !== index);
    setConversions(newConversions);
    onConversionsChange(newConversions);
  };

  const updateConversion = (index, field, value) => {
    const newConversions = [...conversions];
    newConversions[index] = {
      ...newConversions[index],
      [field]: field === 'conversion_factor' ? parseFloat(value) || 0 : value
    };
    setConversions(newConversions);
    onConversionsChange(newConversions);
  };

  const getSuggestedConversions = () => {
    if (!ingredient?.name) return [];
    
    const ingredientName = ingredient.name.toLowerCase();
    
    // Check for exact matches first
    for (const [key, suggestions] of Object.entries(commonConversions)) {
      if (ingredientName.includes(key.toLowerCase())) {
        return suggestions;
      }
    }
    
    // Check for partial matches
    if (ingredientName.includes('syrup') || ingredientName.includes('honey')) {
      return commonConversions['Honey'];
    }
    if (ingredientName.includes('sugar') || ingredientName.includes('sweetener')) {
      return commonConversions['Sugar'];
    }
    if (ingredientName.includes('salt') || ingredientName.includes('saline')) {
      return commonConversions['Salt'];
    }
    
    return commonConversions['Water']; // Default fallback
  };

  const suggestedConversions = getSuggestedConversions();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-md font-semibold text-gray-800">Custom Conversions</h3>
          <p className="text-sm text-gray-600">Define weight-to-volume conversions for accurate costing</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSuggestions(!showSuggestions)}
          >
            <Info className="w-4 h-4 mr-2" />
            Suggestions
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addConversion()}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Conversion
          </Button>
        </div>
      </div>

      {showSuggestions && suggestedConversions.length > 0 && (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-blue-800">Suggested Conversions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {suggestedConversions.map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      1 {suggestion.from_unit} = {suggestion.conversion_factor} {suggestion.to_unit}
                    </div>
                    <div className="text-xs text-gray-500">{suggestion.notes}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addConversion(suggestion)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {conversions.map((conversion, index) => (
          <Card key={index} className="border-gray-200">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <Label htmlFor={`from-unit-${index}`} className="text-xs">From Unit</Label>
                  <Select
                    value={conversion.from_unit}
                    onValueChange={(value) => updateConversion(index, 'from_unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUnits.map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor={`to-unit-${index}`} className="text-xs">To Unit</Label>
                  <Select
                    value={conversion.to_unit}
                    onValueChange={(value) => updateConversion(index, 'to_unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUnits.map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor={`factor-${index}`} className="text-xs">Conversion Factor</Label>
                  <Input
                    id={`factor-${index}`}
                    type="number"
                    step="0.001"
                    value={conversion.conversion_factor}
                    onChange={(e) => updateConversion(index, 'conversion_factor', e.target.value)}
                    placeholder="1.0"
                  />
                </div>
                
                <div>
                  <Label htmlFor={`notes-${index}`} className="text-xs">Notes (optional)</Label>
                  <Input
                    id={`notes-${index}`}
                    value={conversion.notes}
                    onChange={(e) => updateConversion(index, 'notes', e.target.value)}
                    placeholder="e.g., density notes"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500 font-medium">
                    1 {conversion.from_unit} = {conversion.conversion_factor} {conversion.to_unit}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeConversion(index)}
                    className="h-8 w-8 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {conversions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No custom conversions defined</p>
          <p className="text-sm">Add conversions to enable weight-to-volume calculations</p>
        </div>
      )}
    </div>
  );
}