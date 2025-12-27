import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink, Users, PackagePlus, Loader2 } from "lucide-react";
import { InventoryService } from "@/components/inventory/InventoryService";
import { toast } from "sonner";
import React, { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const statusColors = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  tasting: "bg-blue-100 text-blue-800 border-blue-300",
  active: "bg-green-100 text-green-800 border-green-300",
};

export default function MenuCard({ menu, sharedUsers = [] }) {
  const [isAddingToInventory, setIsAddingToInventory] = useState(false);

  if (!menu) return null;

  const handleAddToInventory = async (e) => {
    e.preventDefault(); // Prevent link navigation if inside a link
    e.stopPropagation();

    if (!menu.account_id) {
      toast.error("Menu has no account linked.");
      return;
    }

    setIsAddingToInventory(true);
    try {
      const count = await InventoryService.addMenuToInventory(menu.id, menu.account_id);
      if (count > 0) {
        toast.success(`Added ${count} new items to inventory`);
      } else {
        toast.info("All items already in inventory");
      }
    } catch (error) {
      toast.error("Failed to add menu items to inventory");
    } finally {
      setIsAddingToInventory(false);
    }
  };

  return (
    <Card className="flex flex-col h-full bg-white/70 backdrop-blur-sm shadow-lg border-0 transition-all duration-300 hover:shadow-xl">
      <CardHeader>
        <div className="flex justify-between items-start">
          <Link to={createPageUrl(`MenuDetails?id=${menu.id}`)}>
            <CardTitle className="text-emerald-900 hover:text-emerald-700 transition-colors">{menu.name}</CardTitle>
          </Link>
          <div className="flex items-center gap-2">
            {sharedUsers.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-md border border-blue-200 cursor-help">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">{sharedUsers.length}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold text-xs mb-2">Shared with:</p>
                      {sharedUsers.map((user, idx) => (
                        <div key={idx} className="text-xs">
                          • {user.full_name || user.email}
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Badge className={`${statusColors[menu.status] || statusColors.draft} capitalize border`}>
              {menu.status}
            </Badge>
          </div>
        </div>
        <CardDescription className="pt-2">{menu.description || 'No description available.'}</CardDescription>
      </CardHeader>
      <div className="flex-grow" />
      <CardFooter className="flex justify-between items-center bg-gray-50/50 p-4 border-t">
        <div className="flex gap-2">
          <Link to={createPageUrl(`CustomerMenuPreview?id=${menu.id}`)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <ExternalLink className="w-4 h-4 mr-2" />
              Preview
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={handleAddToInventory}
            disabled={isAddingToInventory}
          >
            {isAddingToInventory ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PackagePlus className="w-4 h-4 mr-2" />
            )}
            Inventory
          </Button>
        </div>
        <Link to={createPageUrl(`MenuDetails?id=${menu.id}`)} className="flex items-center text-sm font-semibold text-emerald-600 hover:text-emerald-800 transition-colors">
          View Details
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
      </CardFooter>
    </Card>
  );
}