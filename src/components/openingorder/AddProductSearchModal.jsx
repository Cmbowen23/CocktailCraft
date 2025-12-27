import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Plus } from "lucide-react";
import _ from "lodash";

export default function AddProductSearchModal({ isOpen, onClose, onAddProduct, alcoholicIngredients }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("bottle");

  const debouncedSearch = React.useMemo(
    () => _.debounce(async (term) => {
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        const response = await base44.functions.invoke('searchProductsFast', {
          searchTerm: term,
          page: 1,
          pageSize: 20
        });
        
        if (response.data && response.data.success) {
          const filtered = response.data.data.filter(ing => 
            alcoholicIngredients.some(alcIng => alcIng.id === ing.id)
          );
          setSearchResults(filtered);
        }
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [alcoholicIngredients]
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  const handleAdd = () => {
    if (selectedIngredient) {
      onAddProduct({
        ingredient_id: selectedIngredient.id,
        ingredient_name: selectedIngredient.name,
        quantity: quantity,
        unit: unit
      });
      // Reset form
      setSearchTerm("");
      setSearchResults([]);
      setSelectedIngredient(null);
      setQuantity(1);
      setUnit("bottle");
      onClose();
    }
  };

  const handleSelectIngredient = (ingredient) => {
    setSelectedIngredient(ingredient);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="product-search">Search Products</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                id="product-search"
                placeholder="Search by name, style, region, or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
              {searchResults.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                    selectedIngredient?.id === ingredient.id ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => handleSelectIngredient(ingredient)}
                >
                  <div className="font-medium text-gray-900">{ingredient.name}</div>
                  <div className="text-sm text-gray-600">
                    {ingredient.spirit_type && <span className="mr-2">{ingredient.spirit_type}</span>}
                    {ingredient.style && <span className="mr-2">• {ingredient.style}</span>}
                    {ingredient.region && <span className="mr-2">• {ingredient.region}</span>}
                    {ingredient.tier && <span className="inline-block px-2 py-0.5 bg-gray-200 rounded text-xs ml-2">{ingredient.tier}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isSearching && searchTerm && searchResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No products found matching "{searchTerm}"
            </div>
          )}

          {selectedIngredient && (
            <div className="border-t pt-4 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">Selected Product</div>
                <div className="text-sm text-gray-700">{selectedIngredient.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                  />
                </div>

                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger id="unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottle">Bottle</SelectItem>
                      {selectedIngredient.bottles_per_case && (
                        <SelectItem value="case">Case ({selectedIngredient.bottles_per_case} btl)</SelectItem>
                      )}
                      <SelectItem value="liter">Liter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleAdd}
              disabled={!selectedIngredient}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}