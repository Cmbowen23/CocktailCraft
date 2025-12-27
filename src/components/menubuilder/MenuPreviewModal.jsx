import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import CustomerMenuDisplay from "../menus/CustomerMenuDisplay";

export default function MenuPreviewModal({ sections, allRecipes, allIngredients, season, barType, onClose }) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>
        
        <div className="overflow-y-auto max-h-[90vh]">
          <CustomerMenuDisplay
            sections={sections}
            allRecipes={allRecipes}
            allIngredients={allIngredients}
            season={season}
            barType={barType}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}