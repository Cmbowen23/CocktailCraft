import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Package,
  Search,
  Filter,
  Plus,
  ArrowRight,
  History,
  AlertTriangle,
  Loader2,
  MapPin,
  PackagePlus,
  ClipboardList,
  Trash2
} from "lucide-react";
import CocktailLoader from "@/components/ui/CocktailLoader";
import AddInventoryItemModal from "@/components/inventory/AddInventoryItemModal";
import StockCountModal from "@/components/inventory/StockCountModal";
import InventoryItemHistoryModal from "@/components/inventory/InventoryItemHistoryModal";
import SingleItemCountModal from "@/components/inventory/SingleItemCountModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBottleSize } from "@/components/utils/formatBottleSize";

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [variants, setVariants] = useState([]);
  const [countHistory, setCountHistory] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [showSingleCountModal, setShowSingleCountModal] = useState(false);
  const [selectedCountItem, setSelectedCountItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      // Block on_premise users from accessing inventory
      if (user?.user_type === 'on_premise') {
        window.location.href = createPageUrl('Dashboard');
        return;
      }

      const [invData, locData, ingData, varData, historyData, recipesData] = await Promise.all([
        base44.entities.InventoryItem.list(),
        base44.entities.Location.list(),
        base44.entities.Ingredient.list(),
        base44.entities.ProductVariant.list(),
        base44.entities.InventoryReport.list("-created_date", 50),
        base44.entities.Recipe.list(),
      ]);
      
      setInventoryItems(invData || []);
      setLocations(locData || []);
      setIngredients(ingData || []);
      setVariants(varData || []);
      setCountHistory(historyData || []);
      setRecipes(recipesData || []);
    } catch (error) {
      console.error("Error loading inventory data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIngredientName = (item) => {
    if (item.is_batch_bottle) {
      const recipe = recipes.find(r => r.id === item.batch_recipe_id);
      console.log('[Inventory] Batch bottle:', {
        item_id: item.id,
        batch_recipe_id: item.batch_recipe_id,
        recipe_found: !!recipe,
        label: recipe?.batch_settings?.inventory_bottle?.label,
        recipe_name: recipe?.name
      });
      return recipe?.batch_settings?.inventory_bottle?.label || recipe?.name || "Batch Item";
    }
    return ingredients.find(i => i.id === item.ingredient_id)?.name || "Unknown";
  };
  const getIngredientImage = (item) => {
    if (item.is_batch_bottle) {
      return null;
    }
    return ingredients.find(i => i.id === item.ingredient_id)?.bottle_image_url;
  };
  const getVariantSize = (id) => {
    const v = variants.find(v => v.id === id);
    return formatBottleSize(v?.size_ml);
  };

  const calculateTotalStockValue = () => {
    let total = 0;
    inventoryItems.forEach(item => {
       // For batch bottles, use cost_at_last_count
       if (item.is_batch_bottle && item.cost_at_last_count !== undefined && item.cost_at_last_count !== null) {
           total += (parseFloat(item.current_stock) || 0) * item.cost_at_last_count;
       } else {
           const v = variants.find(v => v.id === item.product_variant_id);
           if (v) {
               let unitPrice = v.purchase_price || 0;
               // Prefer case price derived unit cost if available
               if (v.case_price > 0 && v.bottles_per_case > 0) {
                   unitPrice = v.case_price / v.bottles_per_case;
               }
               total += (parseFloat(item.current_stock) || 0) * unitPrice;
           }
       }
    });
    return total;
  };

  const handleUpdateReorderPoint = async (id, newValue) => {
      const val = parseFloat(newValue);
      if (isNaN(val)) return;
      
      // Optimistic update
      setInventoryItems(prev => prev.map(item => 
          item.id === id ? { ...item, reorder_point: val } : item
      ));

      try {
          await base44.entities.InventoryItem.update(id, { reorder_point: val });
      } catch (error) {
          console.error("Failed to update reorder point", error);
      }
  };

  const handleUpdateStock = async (id, newValue) => {
      const val = parseFloat(newValue);
      if (isNaN(val)) return;
      
      // Optimistic update
      setInventoryItems(prev => prev.map(item => 
          item.id === id ? { ...item, current_stock: val } : item
      ));

      try {
          await base44.entities.InventoryItem.update(id, { current_stock: val });
      } catch (error) {
          console.error("Failed to update stock", error);
      }
  };

  const handleSubmitCount = async () => {
    if (!window.confirm("Are you sure you want to submit the current inventory to history?")) {
      return;
    }

    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const logs = [];
      
      // Create Report
      const report = await base44.entities.InventoryReport.create({
        submitted_by: currentUser?.email || 'unknown',
        notes: 'Inventory Snapshot',
        total_items_counted: inventoryItems.length,
        total_value_snapshot: 0, 
      });

      // Create Logs for all items
      for (const item of inventoryItems) {
        logs.push(base44.entities.InventoryCountLog.create({
          inventory_item_id: item.id,
          report_id: report.id,
          counted_quantity: Number(item.current_stock),
          previous_quantity: Number(item.current_stock), // Snapshot matches current
          count_date: timestamp,
          counted_by: currentUser?.email || 'unknown',
          notes: 'Snapshot submission'
        }));
      }

      await Promise.all(logs);
      
      // Refresh history
      loadData();
      
      // Show success
      alert(`Successfully submitted inventory count to history.`);
    } catch (error) {
      console.error("Error submitting count:", error);
      alert("Failed to submit count to history.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item from inventory?")) return;
    try {
      await base44.entities.InventoryItem.delete(id);
      setInventoryItems(prev => prev.filter(i => i.id !== id));
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item.");
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm("WARNING: This will delete ALL items in your inventory. This action cannot be undone. Are you sure?")) return;

    setLoading(true);
    try {
      let deletedCount = 0;

      // Delete items one at a time with delay to avoid rate limits
      for (const item of inventoryItems) {
        try {
          await base44.entities.InventoryItem.delete(item.id);
          deletedCount++;
          console.log(`[Inventory] Deleted ${deletedCount}/${inventoryItems.length} items`);
          
          // Small delay between deletions to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 150));
        } catch (error) {
          const msg = (error && (error.message || error.toString())) || "";
          // Ignore 404s (already deleted)
          if (!msg.includes("404") && !msg.includes("not found")) {
            throw error;
          }
        }
      }

      setInventoryItems([]);
      alert(`Successfully deleted ${deletedCount} inventory items.`);
    } catch (error) {
      console.error("[Inventory] Failed to delete all items:", error);
      alert("Failed to delete all items.");
    } finally {
      setLoading(false);
    }
  };

  const openHistory = (item) => {
    setSelectedHistoryItem(item);
    setShowHistoryModal(true);
  };

  const openSingleCount = (item) => {
    setSelectedCountItem(item);
    setShowSingleCountModal(true);
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm("Are you sure you want to delete this inventory report? This action cannot be undone.")) return;

    try {
      // 1. Find logs associated with this report
      // We wrap in try-catch to not block report deletion if logs fetch fails (though unlikely)
      try {
          const logs = await base44.entities.InventoryCountLog.filter({ report_id: reportId });
          // 2. Delete logs
          if (logs && logs.length > 0) {
              await Promise.all(logs.map(log => base44.entities.InventoryCountLog.delete(log.id)));
          }
      } catch (logError) {
          console.warn("Could not cleanup logs:", logError);
      }
      
      // 3. Delete the report
      await base44.entities.InventoryReport.delete(reportId);
      
      // 4. Update UI
      setCountHistory(prev => prev.filter(r => r.id !== reportId));
    } catch (error) {
      console.error("Error deleting report:", error);
      alert("Failed to delete report.");
    }
  };

  const filteredItems = inventoryItems.filter(item => 
    getIngredientName(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-600">Track stock, locations, and reorder points</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
             <Button 
                variant="outline" 
                className="bg-white"
                onClick={() => window.location.href = createPageUrl('InventoryReport')}
             >
                <ClipboardList className="w-4 h-4 mr-2" />
                Inventory Report
             </Button>
             <Button 
                variant="outline" 
                className="bg-white"
                onClick={() => setShowAddModal(true)}
             >
                <PackagePlus className="w-4 h-4 mr-2" />
                Add to Inventory
             </Button>
             <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowCountModal(true)}
             >
                <ClipboardList className="w-4 h-4 mr-2" />
                New Count
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="bg-white border-l-4 border-blue-500 shadow-sm">
              <CardContent className="pt-6">
                 <div className="flex justify-between items-center">
                    <div>
                       <p className="text-sm font-medium text-gray-500">Total Items Tracked</p>
                       <h3 className="text-2xl font-bold text-gray-900">{inventoryItems.length}</h3>
                    </div>
                    <Package className="w-8 h-8 text-blue-100 text-blue-500" />
                 </div>
              </CardContent>
           </Card>
           
           <Card className="bg-white border-l-4 border-emerald-500 shadow-sm">
              <CardContent className="pt-6">
                 <div className="flex justify-between items-center">
                    <div>
                       <p className="text-sm font-medium text-gray-500">Stock Value</p>
                       <h3 className="text-2xl font-bold text-gray-900">${calculateTotalStockValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                    </div>
                    <History className="w-8 h-8 text-emerald-100 text-emerald-500" />
                 </div>
              </CardContent>
           </Card>

           <Card className="bg-white border-l-4 border-amber-500 shadow-sm">
              <CardContent className="pt-6">
                 <div className="flex justify-between items-center">
                    <div>
                       <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
                       <h3 className="text-2xl font-bold text-gray-900">0</h3>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-amber-100 text-amber-500" />
                 </div>
              </CardContent>
           </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-white border border-gray-200 p-1 flex flex-wrap h-auto">
            <TabsTrigger value="overview" className="flex-1 min-w-[100px]">Current Stock</TabsTrigger>
            <TabsTrigger value="locations" className="flex-1 min-w-[100px]">Locations</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 min-w-[100px]">Count History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
             <Card className="border border-gray-200 shadow-sm">
                <CardHeader>
                   <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <CardTitle>Current Inventory</CardTitle>
                      <div className="relative w-full sm:w-64">
                         <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                         <Input 
                            placeholder="Search items..." 
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                         />
                      </div>
                   </div>
                </CardHeader>
                <CardContent>
                   {loading ? (
                      <div className="flex justify-center py-8">
                         <CocktailLoader className="w-24 h-24 text-blue-600" />
                      </div>
                   ) : inventoryItems.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                         <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                         <p>No inventory items found.</p>
                         <p className="text-sm mt-1">Add items from the Menu or Recipes pages.</p>
                      </div>
                   ) : (
                      <div className="rounded-md border overflow-x-auto">
                         <div className="min-w-[800px]">
                         <Table>
                            <TableHeader>
                               <TableRow>
                                  <TableHead className="w-[60px]"></TableHead>
                                  <TableHead>Item Name</TableHead>
                                  <TableHead>Size</TableHead>
                                  <TableHead>Current Stock</TableHead>
                                  <TableHead>Reorder Point</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Last Counted</TableHead>
                                  <TableHead className="w-[50px]"></TableHead>
                               </TableRow>
                            </TableHeader>
                            <TableBody>
                               {filteredItems.map((item) => (
                                  <TableRow key={item.id}>
                                     <TableCell>
                                        <div className="relative w-12 h-16 flex items-center justify-center p-1">
                                          {(() => {
                                             const ingredient = ingredients.find(i => i.id === item.ingredient_id);
                                             const isBatch = item.is_batch_bottle || ingredient?.ingredient_type === 'sub_recipe';
                                             const hasImage = Boolean(getIngredientImage(item));
                                             const neckColors = item.batch_neck_colors || item.neck_colors || item.bottle_colors || [];

                                             console.log('[Inventory] Rendering item:', {
                                               item_id: item.id,
                                               is_batch_bottle: item.is_batch_bottle,
                                               isBatch,
                                               hasImage,
                                               neckColors
                                             });

                                             // Normal bottle with image: show ONLY image, no SVG
                                             if (!isBatch && hasImage) {
                                                return (
                                                   <div className="relative w-full h-full">
                                                      <img 
                                                         src={getIngredientImage(item)} 
                                                         alt={getIngredientName(item)}
                                                         className="w-full h-full object-contain"
                                                      />
                                                      {/* Color bands overlaid on image */}
                                                      {neckColors.length > 0 && (
                                                         <div className="absolute top-2 left-1/2 transform -translate-x-1/2 flex flex-col-reverse gap-[1px] w-6">
                                                            {neckColors.map((color, idx) => (
                                                               <div 
                                                                  key={idx} 
                                                                  className="w-full h-1 shadow-sm border border-black/10" 
                                                                  style={{ backgroundColor: color }} 
                                                               />
                                                            ))}
                                                         </div>
                                                      )}
                                                   </div>
                                                );
                                             }

                                             // Batch bottle OR no image: show SVG outline with neck colors
                                             return (
                                                <svg viewBox="0 0 100 310" className="h-full w-auto drop-shadow-sm filter" style={{ overflow: 'visible' }}>
                                                   <defs>
                                                      <clipPath id={`clip-${item.id}`}>
                                                         <path d="M 35 5 L 35 50 L 35 60 Q 35 70 30 75 Q 25 80 15 90 L 15 280 Q 15 295 25 295 L 75 295 Q 85 295 85 280 L 85 90 Q 75 80 70 75 Q 65 70 65 60 L 65 50 L 65 5 Z" />
                                                      </clipPath>
                                                   </defs>
                                                   <path 
                                                      d="M 35 5 L 35 50 L 35 60 Q 35 70 30 75 Q 25 80 15 90 L 15 280 Q 15 295 25 295 L 75 295 Q 85 295 85 280 L 85 90 Q 75 80 70 75 Q 65 70 65 60 L 65 50 L 65 5 Z" 
                                                      fill="#f1f5f9" 
                                                      stroke="#94a3b8" 
                                                      strokeWidth="2.5"
                                                   />
                                                   {/* Neck Colors */}
                                                   {neckColors.length > 0 && neckColors.map((color, idx) => (
                                                      <rect
                                                         key={idx}
                                                         x="34"
                                                         y={42 - (idx * 16)}
                                                         width="32"
                                                         height="14"
                                                         fill={color}
                                                         stroke="rgba(0,0,0,0.15)"
                                                         strokeWidth="1"
                                                         rx="1"
                                                      />
                                                   ))}
                                                </svg>
                                             );
                                          })()}
                                        </div>
                                     </TableCell>
                                     <TableCell className="font-medium">
                                        <div 
                                            className="cursor-pointer hover:text-blue-600 hover:underline flex items-center gap-1"
                                            onClick={() => openSingleCount(item)}
                                            title="Click to update count"
                                        >
                                            {getIngredientName(item)}
                                        </div>
                                     </TableCell>
                                     <TableCell>{getVariantSize(item.product_variant_id)}</TableCell>
                                     <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Input 
                                                type="number" 
                                                defaultValue={item.current_stock}
                                                onBlur={(e) => handleUpdateStock(item.id, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleUpdateStock(item.id, e.currentTarget.value);
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                                step="1"
                                                className="w-20 h-8"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-gray-400 hover:text-blue-600"
                                                onClick={() => openHistory(item)}
                                                title="View History"
                                            >
                                                <History className="w-4 h-4" />
                                            </Button>
                                        </div>
                                     </TableCell>
                                     <TableCell>
                                        <Input 
                                            type="number" 
                                            defaultValue={item.reorder_point} 
                                            onBlur={(e) => handleUpdateReorderPoint(item.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleUpdateReorderPoint(item.id, e.currentTarget.value);
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            step="1"
                                            className="w-20 h-8"
                                        />
                                     </TableCell>
                                     <TableCell>
                                        {item.current_stock <= item.reorder_point ? (
                                           <Badge variant="destructive" className="flex w-fit items-center gap-1">
                                              <AlertTriangle className="w-3 h-3" /> Low Stock
                                           </Badge>
                                        ) : (
                                           <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                                              OK
                                           </Badge>
                                        )}
                                     </TableCell>
                                     <TableCell className="text-gray-500 text-xs">
                                        {item.last_counted_date ? new Date(item.last_counted_date).toLocaleDateString() : 'Never'}
                                     </TableCell>
                                     <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDeleteItem(item.id)}
                                            title="Delete Item"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                     </TableCell>
                                  </TableRow>
                               ))}
                            </TableBody>
                         </Table>
                         </div>
                      </div>
                   )}
                   {inventoryItems.length > 0 && (
                        <div className="mt-6 flex justify-between items-center">
                            <Button 
                                variant="outline" 
                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={handleBulkDelete}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                            </Button>
                            
                            <Button 
                                onClick={handleSubmitCount} 
                                disabled={isSubmitting}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <History className="w-4 h-4 mr-2" />}
                                Submit Count
                            </Button>
                        </div>
                    )}
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="locations" className="mt-6">
             <Card>
                <CardHeader>
                   <CardTitle>Storage Locations</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="text-center py-12 text-gray-500">
                      <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No locations defined yet.</p>
                      <Button variant="outline" className="mt-4">Add Location</Button>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
             <Card>
                <CardHeader>
                   <CardTitle>Inventory Reports</CardTitle>
                </CardHeader>
                <CardContent>
                   {countHistory.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                         <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                         <p>No inventory reports found.</p>
                      </div>
                   ) : (
                      <div className="rounded-md border overflow-x-auto">
                         <div className="min-w-[600px]">
                         <Table>
                            <TableHeader>
                               <TableRow>
                                  <TableHead>Date Submitted</TableHead>
                                  <TableHead>Submitted By</TableHead>
                                  <TableHead>Items Counted</TableHead>
                                  <TableHead>Notes</TableHead>
                                  <TableHead className="w-[50px]"></TableHead>
                                  </TableRow>
                            </TableHeader>
                            <TableBody>
                               {countHistory.map((report) => (
                                 <TableRow key={report.id}>
                                    <TableCell className="font-medium">
                                       {new Date(report.created_date).toLocaleString()}
                                    </TableCell>
                                    <TableCell>{report.submitted_by}</TableCell>
                                    <TableCell>{report.total_items_counted}</TableCell>
                                    <TableCell className="text-gray-500 italic">{report.notes || '-'}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDeleteReport(report.id)}
                                            title="Delete Report"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                    </TableRow>
                               ))}
                            </TableBody>
                         </Table>
                         </div>
                      </div>
                   )}
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddInventoryItemModal 
         isOpen={showAddModal} 
         onClose={() => setShowAddModal(false)} 
         onSave={loadData}
         ingredients={ingredients}
         variants={variants}
         accountId={currentUser?.account_id}
         existingInventory={inventoryItems}
         recipes={recipes}
      />

      <StockCountModal
         isOpen={showCountModal}
         onClose={() => setShowCountModal(false)}
         onSave={loadData}
         inventoryItems={inventoryItems}
         ingredients={ingredients}
         variants={variants}
         currentUser={currentUser}
         recipes={recipes}
      />

      <InventoryItemHistoryModal 
         isOpen={showHistoryModal}
         onClose={() => setShowHistoryModal(false)}
         inventoryItem={selectedHistoryItem}
         ingredientName={selectedHistoryItem ? getIngredientName(selectedHistoryItem.ingredient_id) : ''}
      />

      <SingleItemCountModal
         isOpen={showSingleCountModal}
         onClose={() => setShowSingleCountModal(false)}
         onSave={loadData}
         inventoryItem={selectedCountItem}
         ingredientName={selectedCountItem ? getIngredientName(selectedCountItem) : ''}
         variant={selectedCountItem ? variants.find(v => v.id === selectedCountItem.product_variant_id) : null}
         ingredient={selectedCountItem ? ingredients.find(i => i.id === selectedCountItem.ingredient_id) : null}
      />
      </div>
  );
}