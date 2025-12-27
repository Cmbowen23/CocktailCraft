import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Merge, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const calculateSimilarity = (str1, str2) => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const shorter = s1.length < s2.length ? s1 : s2;
  const longer = s1.length >= s2.length ? s1 : s2;
  
  if (longer.startsWith(shorter)) return 0.95;
  if (longer.includes(shorter) && shorter.length >= 4) return 0.85;
  
  const ignoreWords = ['aperitivo', 'apertivo', 'liqueur', 'bitters', 'syrup', 'rum', 'gin', 'vodka', 'whiskey', 'whisky', 'tequila', 'mezcal', 'brandy', 'cognac', 'amaro', 'vermouth'];
  
  const getTokens = (str) => str.split(/\s+/).filter(t => t.length > 2 && !ignoreWords.includes(t));
  const tokens1 = getTokens(s1);
  const tokens2 = getTokens(s2);
  
  const compare1 = tokens1.length > 0 ? tokens1.join(' ') : s1;
  const compare2 = tokens2.length > 0 ? tokens2.join(' ') : s2;
  
  if (compare1 === compare2) return 0.95;
  if (compare1.includes(compare2) || compare2.includes(compare1)) return 0.9;
  
  if (tokens1.length > 0 && tokens2.length > 0) {
    const matchingTokens = tokens1.filter(t1 => tokens2.some(t2 => t1 === t2));
    if (matchingTokens.length > 0) {
      const tokenScore = (matchingTokens.length * 2) / (tokens1.length + tokens2.length);
      if (tokenScore >= 0.5) return tokenScore * 0.9;
    }
  }
  
  return 0;
};

export default function FindDuplicatesModal({ isOpen, onClose, ingredients, onMergeSelected }) {
  const [selectedGroups, setSelectedGroups] = useState({});
  const [mergeDecisions, setMergeDecisions] = useState({});

  const duplicateGroups = React.useMemo(() => {
    const groups = [];
    const processed = new Set();

    ingredients.forEach((ingredient, index) => {
      if (processed.has(ingredient.id)) return;

      const duplicates = ingredients
        .filter((other, otherIndex) => otherIndex > index && !processed.has(other.id))
        .map(other => ({
          ingredient: other,
          similarity: calculateSimilarity(ingredient.name, other.name)
        }))
        .filter(match => match.similarity >= 0.6);

      if (duplicates.length > 0) {
        const group = [ingredient, ...duplicates.map(d => d.ingredient)];
        const similarities = duplicates.map(d => d.similarity);
        groups.push({ 
          primary: ingredient, 
          duplicates: duplicates.map(d => d.ingredient), 
          similarities,
          allIngredients: group
        });
        group.forEach(ing => processed.add(ing.id));
      }
    });

    return groups;
  }, [ingredients]);

  const handleGroupSelection = (groupIndex, checked) => {
    setSelectedGroups(prev => ({
      ...prev,
      [groupIndex]: checked
    }));
  };

  const handleMergeAll = () => {
    const groupsToMerge = [];
    Object.keys(selectedGroups).forEach(groupIndex => {
      if (selectedGroups[groupIndex]) {
        const group = duplicateGroups[groupIndex];
        const primaryId = mergeDecisions[groupIndex] || group.primary.id;
        groupsToMerge.push({ primaryId, group: group.allIngredients });
      }
    });
    onMergeSelected(groupsToMerge);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find Duplicate Ingredients</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {duplicateGroups.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">No duplicates found!</p>
              <p className="text-gray-500 text-sm">Your ingredient list looks clean.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-900">
                    <p className="font-medium">Found {duplicateGroups.length} potential duplicate group(s)</p>
                    <p className="text-amber-700">Select groups to merge and choose the primary ingredient for each.</p>
                  </div>
                </div>
              </div>

              {duplicateGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-start gap-3 mb-3">
                    <Checkbox
                      checked={selectedGroups[groupIndex] || false}
                      onCheckedChange={(checked) => handleGroupSelection(groupIndex, checked)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-2">Duplicate Group {groupIndex + 1}</div>
                      <Select 
                        value={mergeDecisions[groupIndex] || group.primary.id}
                        onValueChange={(value) => setMergeDecisions(prev => ({ ...prev, [groupIndex]: value }))}
                        disabled={!selectedGroups[groupIndex]}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose primary ingredient" />
                        </SelectTrigger>
                        <SelectContent>
                          {group.allIngredients.map((ing, idx) => (
                            <SelectItem key={ing.id} value={ing.id}>
                              {ing.name} - {ing.category} ({ing.supplier || 'No supplier'})
                              {idx > 0 && ` - ${Math.round(group.similarities[idx - 1] * 100)}% match`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="ml-8 space-y-2">
                    {group.allIngredients.map((ing, idx) => (
                      <div key={ing.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                        <div>
                          <div className="font-medium">{ing.name}</div>
                          <div className="text-sm text-gray-600">
                            {ing.category} • {ing.supplier || 'No supplier'} • ${ing.cost_per_unit?.toFixed(4) || 0}/{ing.unit}
                          </div>
                        </div>
                        {idx > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(group.similarities[idx - 1] * 100)}% match
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleMergeAll}
                  disabled={Object.values(selectedGroups).every(v => !v)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Merge className="w-4 h-4 mr-2" />
                  Merge Selected Groups
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}