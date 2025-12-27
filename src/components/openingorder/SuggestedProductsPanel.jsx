import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SuggestedProductsPanel({ suggestedProductIds, onAddProduct, currentItems }) {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [units, setUnits] = useState({});

  useEffect(() => {
    loadSuggestedProducts();
  }, [suggestedProductIds]);

  const loadSuggestedProducts = async () => {
    if (!suggestedProductIds || suggestedProductIds.length === 0) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('searchOpeningOrderProducts', {
        showSuggestedOnly: true,
        suggestedProductIds,
        page: 1,
        pageSize: 100
      });

      if (response.data?.success) {
        setProducts(response.data.data || []);
        
        // Initialize quantities and units
        const initialQuantities = {};
        const initialUnits = {};
        response.data.data.forEach(product => {
          initialQuantities[product.id] = 1;
          initialUnits[product.id] = 'bottle';
        });
        setQuantities(initialQuantities);
        setUnits(initialUnits);
      }
    } catch (error) {
      console.error('Error loading suggested products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = (product) => {
    const quantity = quantities[product.id] || 1;
    const unit = units[product.id] || 'bottle';
    onAddProduct({
      ingredient_id: product.id,
      ingredient_name: product.name,
      quantity,
      unit
    });
  };

  const isInCart = (productId) => {
    return currentItems.some(item => item.ingredient_id === productId);
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Suggested for this concept
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Suggested for this concept
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">No AI suggestions yet. Generate suggestions using the concept builder above.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          Suggested for this concept ({products.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
        {products.map(product => (
          <div key={product.id} className="border border-purple-100 rounded-lg p-3 bg-white hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{product.name}</div>
                <div className="text-sm text-gray-600 space-x-2">
                  {product.spirit_type && <span>{product.spirit_type}</span>}
                  {product.style && <span>• {product.style}</span>}
                  {product.substyle && <span>• {product.substyle}</span>}
                </div>
                <div className="text-xs text-gray-500 mt-1 space-x-2">
                  {product.supplier && <span>{product.supplier}</span>}
                  {product.tier && (
                    <Badge variant="outline" className="text-xs">{product.tier}</Badge>
                  )}
                  {product.exclusive && (
                    <Badge className="bg-purple-100 text-purple-800 text-xs">Exclusive</Badge>
                  )}
                </div>
                {product.purchase_price && (
                  <div className="text-sm font-semibold text-green-700 mt-1">
                    ${product.purchase_price.toFixed(2)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isInCart(product.id) ? (
                  <>
                    <Input
                      type="number"
                      min="1"
                      value={quantities[product.id] || 1}
                      onChange={(e) => setQuantities({ ...quantities, [product.id]: parseInt(e.target.value) || 1 })}
                      className="w-16 h-8 text-sm"
                    />
                    <Select
                      value={units[product.id] || 'bottle'}
                      onValueChange={(value) => setUnits({ ...units, [product.id]: value })}
                    >
                      <SelectTrigger className="w-20 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottle">Bottle</SelectItem>
                        {product.bottles_per_case && (
                          <SelectItem value="case">Case</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => handleAdd(product)}
                      className="bg-purple-600 hover:bg-purple-700 h-8"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <div className="text-green-600 text-sm font-medium px-2">✓ In cart</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}