import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash2, Package, FlaskConical, ArrowUpDown, Settings2, Calculator, Eye } from "lucide-react";
import PourCostCalculatorModal from "./PourCostCalculatorModal";
import { formatCurrency } from "../utils/costCalculations";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function IngredientList({ ingredients = [], onEdit, onDelete, selectedIds = [], onSelectionChange, isSalesRep = false }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [hoveredImage, setHoveredImage] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Calculator state
  const [calculatorIngredient, setCalculatorIngredient] = useState(null);
  const [showCalculator, setShowCalculator] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaultColumns = {
      name: true,
      category: true,
      spiritTypeStyle: true,
      substyle: true,
      flavor: true,
      sku: true,
      exclusive: true,
      supplier: true,
      costPerUnit: true,
      bottleCost: true,
      caseCost: true,
      bottleImage: true,
    };
    try {
      const saved = localStorage.getItem('ingredientListColumns');
      if (saved) {
        return { ...defaultColumns, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Failed to parse column preferences:", e);
      localStorage.removeItem('ingredientListColumns');
    }
    return defaultColumns;
  });

  const activeColumns = visibleColumns;

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleOpenCalculator = (e, ingredient) => {
    e.stopPropagation();
    setCalculatorIngredient(ingredient);
    setShowCalculator(true);
  };

  const sortedIngredients = React.useMemo(() => {
    if (!sortConfig.key) return ingredients;

    return [...ingredients].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'cost_per_unit' || sortConfig.key === 'purchase_price' || sortConfig.key === 'case_price') {
        aVal = parseFloat(a[sortConfig.key]) || 0;
        bVal = parseFloat(b[sortConfig.key]) || 0;
      }

      if (sortConfig.key === 'exclusive') {
        aVal = a.exclusive === true ? 1 : a.exclusive === false ? 0 : -1;
        bVal = b.exclusive === true ? 1 : b.exclusive === false ? 0 : -1;
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [ingredients, sortConfig]);
  
  const SortableHeader = ({ label, sortKey }) => (
    <button
      onClick={() => handleSort(sortKey)}
      className="flex items-center gap-1 hover:text-gray-900 transition-colors whitespace-nowrap"
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  const toggleColumn = (column) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [column]: !prev[column] };
      localStorage.setItem('ingredientListColumns', JSON.stringify(updated));
      return updated;
    });
  };

  const getGridColumns = React.useCallback(() => {
    // Fixed pixel widths to ensure consistent layout
    const cols = ['60px']; // index
    if (activeColumns.bottleImage) cols.push('80px');
    if (activeColumns.name) cols.push('200px');
    if (activeColumns.category) cols.push('120px');
    if (activeColumns.spiritTypeStyle) cols.push('140px');
    if (activeColumns.substyle) cols.push('140px');
    if (activeColumns.flavor) cols.push('140px');
    if (activeColumns.sku) cols.push('110px');
    if (activeColumns.exclusive) cols.push('110px');
    if (activeColumns.supplier) cols.push('200px');
    if (activeColumns.costPerUnit) cols.push('140px');
    if (activeColumns.bottleCost) cols.push('110px');
    if (activeColumns.caseCost) cols.push('140px');
    cols.push('120px'); // Actions
    return cols.join(' ');
  }, [activeColumns]);

  if (!ingredients.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>No ingredients found</p>
      </div>
    );
  }

  const formatSupplierInfo = (ingredient) => {
    return ingredient.supplier || '-';
  };

  return (
    <div className="space-y-3 relative w-full">
      {/* Custom Scrollbar Styles - Makes it slim and elegant */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
      `}</style>

      {hoveredImage && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{ 
            left: `${mousePosition.x}px`, 
            top: `${mousePosition.y}px`,
          }}
        >
          <div className="bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-2">
            <img 
              src={hoveredImage} 
              alt="Magnified view"
              className="w-64 h-64 object-contain"
              loading="lazy" 
              decoding="async"
            />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-sm font-medium text-gray-700">
          Total: {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="w-4 h-4 mr-2" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={visibleColumns.name} onCheckedChange={() => toggleColumn('name')}>Name</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.category} onCheckedChange={() => toggleColumn('category')}>Category</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.spiritTypeStyle} onCheckedChange={() => toggleColumn('spiritTypeStyle')}>Spirit Type</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.substyle} onCheckedChange={() => toggleColumn('substyle')}>Substyle</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.flavor} onCheckedChange={() => toggleColumn('flavor')}>Flavor</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.sku} onCheckedChange={() => toggleColumn('sku')}>SKU</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.exclusive} onCheckedChange={() => toggleColumn('exclusive')}>Exclusive</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.supplier} onCheckedChange={() => toggleColumn('supplier')}>Supplier</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.costPerUnit} onCheckedChange={() => toggleColumn('costPerUnit')}>Cost per Unit</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.bottleCost} onCheckedChange={() => toggleColumn('bottleCost')}>Bottle Cost</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.caseCost} onCheckedChange={() => toggleColumn('caseCost')}>Case Cost</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.bottleImage} onCheckedChange={() => toggleColumn('bottleImage')}>Bottle Image</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* FINAL SCROLL CONTAINER
          - Red border removed, replaced with gray.
          - 'custom-scrollbar' class applied for sleek look.
          - maxWidth: '85vw' keeps the straitjacket behavior that fixed the bug.
      */}
      <div 
        className="rounded-md border border-gray-200 bg-white shadow-sm custom-scrollbar"
        style={{ 
          maxWidth: '85vw',
          width: '100%',
          overflowX: 'auto', 
          WebkitOverflowScrolling: 'touch',
          display: 'block'
        }}
      >
        
        {/* AUTO-FIT CONTENT
            - minWidth: 'max-content' forces the div to be exactly as wide as the columns need.
            - This prevents the giant empty space of the 2500px version.
        */}
        <div style={{ minWidth: 'max-content', display: 'block' }}>
          
          <div className="grid gap-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border-b px-4" style={{ gridTemplateColumns: getGridColumns() }}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">#</span>
                {!isSalesRep && (
                  <Checkbox
                    checked={selectedIds.length === ingredients.length && ingredients.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onSelectionChange(ingredients.map(ing => ing.id));
                      } else {
                        onSelectionChange([]);
                      }
                    }}
                  />
                )}
              </div>
              {activeColumns.bottleImage && <div><SortableHeader label="Image" sortKey="bottle_image_url" /></div>}
              {activeColumns.name && <div><SortableHeader label="Name" sortKey="name" /></div>}
              {activeColumns.category && <div><SortableHeader label="Category" sortKey="category" /></div>}
              {activeColumns.spiritTypeStyle && <div><SortableHeader label="Spirit Type" sortKey="spirit_type" /></div>}
              {activeColumns.substyle && <div><SortableHeader label="Substyle" sortKey="substyle" /></div>}
              {activeColumns.flavor && <div><SortableHeader label="Flavor" sortKey="flavor" /></div>}
              {activeColumns.sku && <div><SortableHeader label="SKU" sortKey="sku_number" /></div>}
              {activeColumns.exclusive && <div><SortableHeader label="Exclusive" sortKey="exclusive" /></div>}
              {activeColumns.supplier && <div><SortableHeader label="Supplier" sortKey="supplier" /></div>}
              {activeColumns.costPerUnit && <div><SortableHeader label="Cost / Unit" sortKey="cost_per_unit" /></div>}
              {activeColumns.bottleCost && <div><SortableHeader label="Bottle Cost" sortKey="purchase_price" /></div>}
              {activeColumns.caseCost && <div><SortableHeader label="Case Cost" sortKey="case_price" /></div>}
              <div>Actions</div>
          </div>
        
          <div className="divide-y divide-gray-100">
            {sortedIngredients.map((ingredient, index) => (
              <div 
                key={ingredient.id} 
                className="grid gap-4 items-center p-4 hover:bg-gray-50 transition-colors" 
                style={{ gridTemplateColumns: getGridColumns() }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono w-4">{index + 1}</span>
                  {!isSalesRep && (
                    <Checkbox
                      checked={selectedIds.includes(ingredient.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onSelectionChange([...selectedIds, ingredient.id]);
                        } else {
                          onSelectionChange(selectedIds.filter(id => id !== ingredient.id));
                        }
                      }}
                    />
                  )}
                </div>
                {activeColumns.bottleImage && (
                  <div
                    className="flex items-center justify-center h-10 w-10 relative"
                    onMouseEnter={(e) => {
                      if (!ingredient.bottle_image_url) return;
                      setHoveredImage(ingredient.bottle_image_url);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMousePosition({ x: rect.right + 10, y: rect.top });
                    }}
                    onMouseLeave={() => setHoveredImage(null)}
                  >
                    {ingredient.bottle_image_url ? (
                      <img 
                        src={ingredient.bottle_image_url} 
                        alt={ingredient.name}
                        loading="lazy"
                        className="h-full w-full object-contain rounded cursor-pointer"
                      />
                    ) : (
                      ingredient.ingredient_type === 'sub_recipe' ? (
                        <FlaskConical className="w-5 h-5 text-blue-400" />
                      ) : (
                        <Package className="w-5 h-5 text-emerald-400" />
                      )
                    )}
                  </div>
                )}
                {activeColumns.name && (
                  <div className="min-w-0">
                    <div 
                      className="font-medium text-gray-900 truncate cursor-pointer hover:text-blue-600" 
                      onClick={() => onEdit(ingredient)}
                      title={ingredient.name}
                    >
                      {ingredient.name}
                    </div>
                    {ingredient.abv > 0 && (
                      <div className="text-xs text-gray-500">{ingredient.abv}% ABV</div>
                    )}
                  </div>
                )}

                {activeColumns.category && (
                  <div><Badge variant="secondary" className="text-xs font-normal bg-gray-100 text-gray-700 hover:bg-gray-200">{ingredient.category || 'other'}</Badge></div>
                )}

                {activeColumns.spiritTypeStyle && (
                  <div className="text-sm text-gray-600 truncate" title={ingredient.spirit_type}>{ingredient.spirit_type || '-'}</div>
                )}

                {activeColumns.substyle && (
                  <div className="text-sm text-gray-600 truncate" title={ingredient.substyle}>{ingredient.substyle || '-'}</div>
                )}

                {activeColumns.flavor && (
                  <div className="text-sm text-gray-600 truncate" title={ingredient.flavor}>{ingredient.flavor || '-'}</div>
                )}

                {activeColumns.sku && (
                  <div className="text-sm text-gray-600 font-mono truncate">{ingredient.sku_number || '-'}</div>
                )}

                {activeColumns.exclusive && (
                  <div>
                    {ingredient.exclusive ? <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">Exclusive</Badge> : 
                     ingredient.exclusive === false ? <span className="text-xs text-gray-400">Non-Exclusive</span> : null}
                  </div>
                )}

                {activeColumns.supplier && (
                  <div className="text-sm text-gray-600 truncate" title={formatSupplierInfo(ingredient)}>
                    {formatSupplierInfo(ingredient)}
                    {ingredient.ingredient_type === 'sub_recipe' && <Badge className="ml-2 text-[10px] h-4 px-1 bg-blue-50 text-blue-600 border-blue-100">House</Badge>}
                  </div>
                )}
                
                {activeColumns.costPerUnit && (
                  <div className="text-sm text-gray-600">
                    ${formatCurrency(ingredient.cost_per_unit || 0)} <span className="text-gray-400 text-xs">/oz</span>
                  </div>
                )}

                {activeColumns.bottleCost && (
                  <div className="text-sm text-gray-600">
                    {ingredient.frontlineVariant?.purchase_price > 0 ? `$${formatCurrency(ingredient.frontlineVariant.purchase_price)}` : '-'}
                  </div>
                )}

                {activeColumns.caseCost && (
                  <div className="text-sm text-gray-600">
                    {ingredient.frontlineVariant?.case_price > 0 ? `$${formatCurrency(ingredient.frontlineVariant.case_price)}` : '-'}
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={(e) => handleOpenCalculator(e, ingredient)} title="Calculator">
                    <Calculator className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900" onClick={() => onEdit(ingredient)} title={isSalesRep ? "View" : "Edit"}>
                    {isSalesRep ? <Eye className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                  </Button>
                  {!isSalesRep && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => onDelete(ingredient.id)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    
      <PourCostCalculatorModal
        isOpen={showCalculator}
        onClose={() => {
          setShowCalculator(false);
          setCalculatorIngredient(null);
        }}
        ingredient={calculatorIngredient}
      />
    </div>
  );
}