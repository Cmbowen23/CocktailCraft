import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileBarChart, Loader2, Download } from "lucide-react";
import { createPageUrl } from "@/utils";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function InventoryReportPage() {
  const [reports, setReports] = useState([]);
  const [startReportId, setStartReportId] = useState("");
  const [endReportId, setEndReportId] = useState("");
  const [comparisonData, setComparisonData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState([]);
  const [variants, setVariants] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportsData, ingredientsData, variantsData] = await Promise.all([
        base44.entities.InventoryReport.list("-created_at", 50),
        base44.entities.Ingredient.list(),
        base44.entities.ProductVariant.list()
      ]);

      setReports(reportsData || []);
      setIngredients(ingredientsData || []);
      setVariants(variantsData || []);

      // Default selection: select the two most recent reports if available
      if (reportsData && reportsData.length >= 2) {
        setEndReportId(reportsData[0].id); // Newest
        setStartReportId(reportsData[1].id); // Second newest
      }
    } catch (error) {
      console.error("Error loading report data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startReportId && endReportId) {
      generateComparison();
    }
  }, [startReportId, endReportId]);

  const generateComparison = async () => {
    try {
      // Fetch logs for both reports
      const [startLogs, endLogs] = await Promise.all([
        base44.entities.InventoryCountLog.filter({ report_id: startReportId }),
        base44.entities.InventoryCountLog.filter({ report_id: endReportId })
      ]);

      // Create a map of items
      const itemMap = {};

      // Process Start Logs (Starting Stock)
      startLogs.forEach(log => {
        if (!itemMap[log.inventory_item_id]) {
          itemMap[log.inventory_item_id] = { start: 0, end: 0, name: 'Unknown Item', size: '' };
        }
        itemMap[log.inventory_item_id].start = Number(log.counted_quantity);
        
        // Find Ingredient Name & Size (if possible, though we only have item_id)
        // We'd need to fetch inventory items to link back to ingredients if we want names here properly
        // Or we can rely on what we have if we fetch inventory items too. 
        // Let's assume we can fetch inventory items or just use what we have if we did a smarter join.
        // For now, let's just fetch the item details on the fly or pre-load inventory items.
      });

      // Process End Logs (Ending Stock)
      endLogs.forEach(log => {
        if (!itemMap[log.inventory_item_id]) {
          itemMap[log.inventory_item_id] = { start: 0, end: 0, name: 'Unknown Item', size: '' };
        }
        itemMap[log.inventory_item_id].end = Number(log.counted_quantity);
      });

      // We need InventoryItem details to get Ingredient ID -> Name
      // Ideally we should have fetched this in loadData. 
      // Let's do a quick fetch of all InventoryItems since we need them for mapping
      const inventoryItems = await base44.entities.InventoryItem.list();
      
      const comparison = Object.keys(itemMap).map(itemId => {
        const item = inventoryItems.find(i => i.id === itemId);
        const ingredient = item ? ingredients.find(i => i.id === item.ingredient_id) : null;
        const variant = item ? variants.find(v => v.id === item.product_variant_id) : null;
        
        return {
          id: itemId,
          name: ingredient ? ingredient.name : 'Unknown Item',
          size: variant ? `${variant.size_ml}ml` : '-',
          start: itemMap[itemId].start,
          end: itemMap[itemId].end,
          usage: itemMap[itemId].start - itemMap[itemId].end
        };
      });

      // Filter out items with no activity if desired, or keep all
      setComparisonData(comparison.sort((a, b) => a.name.localeCompare(b.name)));

    } catch (error) {
      console.error("Error generating comparison:", error);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("Inventory Depletion Report", 14, 20);
    
    doc.setFontSize(10);
    const startDate = reports.find(r => r.id === startReportId)?.created_date;
    const endDate = reports.find(r => r.id === endReportId)?.created_date;
    
    doc.text(`From: ${new Date(startDate).toLocaleString()}`, 14, 30);
    doc.text(`To: ${new Date(endDate).toLocaleString()}`, 14, 35);

    // Table
    const tableColumn = ["Item", "Size", "Start Qty", "End Qty", "Usage"];
    const tableRows = [];

    comparisonData.forEach(item => {
      if (item.usage !== 0) { // Only show items with movement
        const rowData = [
          item.name,
          item.size,
          item.start.toFixed(2),
          item.end.toFixed(2),
          item.usage.toFixed(2)
        ];
        tableRows.push(rowData);
      }
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 45,
    });

    doc.save("inventory_depletion.pdf");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Button variant="ghost" onClick={() => window.location.href = createPageUrl('Inventory')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Inventory
             </Button>
             <div>
                <h1 className="text-2xl font-bold text-gray-900">Depletion Report</h1>
                <p className="text-gray-600 text-sm">Compare inventory snapshots to calculate usage</p>
             </div>
          </div>
          <Button onClick={exportPDF} disabled={comparisonData.length === 0} variant="outline">
             <Download className="w-4 h-4 mr-2" />
             Export PDF
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Report Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6 items-end">
               <div className="flex-1 space-y-2 w-full">
                  <label className="text-sm font-medium">Start Snapshot (Older)</label>
                  <Select value={startReportId} onValueChange={setStartReportId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select starting point" />
                    </SelectTrigger>
                    <SelectContent>
                      {reports.map(report => (
                        <SelectItem key={report.id} value={report.id}>
                          {new Date(report.created_date).toLocaleString()} - {report.submitted_by}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
               </div>

               <div className="flex-1 space-y-2 w-full">
                  <label className="text-sm font-medium">End Snapshot (Newer)</label>
                  <Select value={endReportId} onValueChange={setEndReportId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ending point" />
                    </SelectTrigger>
                    <SelectContent>
                      {reports.map(report => (
                        <SelectItem key={report.id} value={report.id}>
                          {new Date(report.created_date).toLocaleString()} - {report.submitted_by}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
               </div>
            </div>
          </CardContent>
        </Card>

        <Card>
           <CardContent className="p-0">
              <Table>
                 <TableHeader>
                    <TableRow>
                       <TableHead>Item Name</TableHead>
                       <TableHead>Size</TableHead>
                       <TableHead className="text-right">Starting Count</TableHead>
                       <TableHead className="text-right">Ending Count</TableHead>
                       <TableHead className="text-right font-bold">Usage (Depletion)</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {comparisonData.length === 0 ? (
                       <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                             {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Select two snapshots to generate a report."}
                          </TableCell>
                       </TableRow>
                    ) : (
                       comparisonData.map((item) => (
                          <TableRow key={item.id} className={item.usage > 0 ? "bg-amber-50/30" : ""}>
                             <TableCell className="font-medium">{item.name}</TableCell>
                             <TableCell>{item.size}</TableCell>
                             <TableCell className="text-right text-gray-600">{item.start.toFixed(2)}</TableCell>
                             <TableCell className="text-right text-gray-600">{item.end.toFixed(2)}</TableCell>
                             <TableCell className={`text-right font-bold ${item.usage > 0 ? "text-amber-600" : "text-gray-400"}`}>
                                {item.usage > 0 ? `-${item.usage.toFixed(2)}` : (item.usage < 0 ? `+${Math.abs(item.usage).toFixed(2)}` : "-")}
                             </TableCell>
                          </TableRow>
                       ))
                    )}
                 </TableBody>
              </Table>
           </CardContent>
        </Card>
      </div>
    </div>
  );
}