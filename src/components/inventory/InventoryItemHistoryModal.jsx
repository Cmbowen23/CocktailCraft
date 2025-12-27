import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

export default function InventoryItemHistoryModal({ isOpen, onClose, inventoryItem, ingredientName }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && inventoryItem) {
      loadHistory();
    }
  }, [isOpen, inventoryItem]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      // Fetch logs for this item
      // Note: filter might allow sorting, but usually list returns sorted or we sort manually
      const itemLogs = await base44.entities.InventoryCountLog.filter({
        inventory_item_id: inventoryItem.id
      });
      
      // Sort by date descending
      itemLogs.sort((a, b) => new Date(b.count_date) - new Date(a.count_date));
      setLogs(itemLogs);
    } catch (error) {
      console.error("Error loading item history:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateUsage = (currentLog, nextLog) => {
    if (!nextLog) return null; // No previous record to compare with
    // If we have a previous quantity in the log, we could use that, 
    // but calculating difference between consecutive logs is safer if snapshots are taken.
    // However, the requirement is "estimated depletions based on inventory counts".
    // 12.6 count = 1.5, 12.12 count = 0.5 => Usage = 1.0.
    // This implies Usage = Count(Old) - Count(New).
    
    // Using consecutive logs sorted descending:
    // Index i is newer (e.g. 12.12), Index i+1 is older (e.g. 12.6).
    // Usage = Log[i+1].counted_quantity - Log[i].counted_quantity.
    
    const usage = nextLog.counted_quantity - currentLog.counted_quantity;
    return usage;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Count History: {ingredientName}</DialogTitle>
          <DialogDescription>
             Historical counts and estimated usage (depletion).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No history recorded for this item.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Counted By</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Est. Usage</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log, index) => {
                // Determine usage by comparing with the *older* record (next in list because sorted desc)
                const olderLog = logs[index + 1];
                const usage = olderLog ? calculateUsage(log, olderLog) : null;
                
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.count_date).toLocaleDateString()} {new Date(log.count_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </TableCell>
                    <TableCell>{log.counted_by}</TableCell>
                    <TableCell className="text-right font-medium">
                      {log.counted_quantity}
                    </TableCell>
                    <TableCell className="text-right">
                       {usage !== null ? (
                           <span className={usage > 0 ? "text-amber-600" : "text-green-600"}>
                               {usage > 0 ? `-${usage.toFixed(2)}` : `+${Math.abs(usage).toFixed(2)}`}
                           </span>
                       ) : (
                           <span className="text-gray-400">-</span>
                       )}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm italic">
                      {log.notes}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}