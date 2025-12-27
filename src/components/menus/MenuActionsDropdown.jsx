import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Share2,
  ShoppingCart,
  CheckSquare,
  Upload,
  Eye,
  Image,
  BarChart3,
  DollarSign,
  ChevronDown,
  PackagePlus,
  Loader2,
  FileText,
  Wand2
} from "lucide-react";
import AddMenuToTrainingDocModal from './AddMenuToTrainingDocModal';
import { InventoryService } from "@/components/inventory/InventoryService";
import { toast } from "sonner";
import ResolveInventoryVariantsModal from "@/components/inventory/ResolveInventoryVariantsModal";

export default function MenuActionsDropdown({
  menu,
  account,
  filteredRecipes,
  isInternalUser,
  saveScrollPosition,
  setShowChecklist,
  setShowImporter,
  setShowCustomerMenuBuilder,
  setShowShareModal,
  handleExportMenuPdf,
  handleCreatePresentation,
  handleCreateOpeningOrder,
}) {
  const [isAddingToInventory, setIsAddingToInventory] = React.useState(false);
  const [showAddMenuToTrainingDocModal, setShowAddMenuToTrainingDocModal] = React.useState(false);
  const [showResolveVariantsModal, setShowResolveVariantsModal] = React.useState(false);

  const handleAddToInventory = () => {
    if (!account) return;
    setShowResolveVariantsModal(true);
  };

  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Actions <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Order & Inventory</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleAddToInventory} disabled={!account || isAddingToInventory}>
          {isAddingToInventory ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PackagePlus className="mr-2 h-4 w-4" />
          )}
          Add to Inventory
        </DropdownMenuItem>
        {isInternalUser && (
          <DropdownMenuItem onClick={handleCreateOpeningOrder} disabled={!account}>
            <ShoppingCart className="mr-2 h-4 w-4" /> Create Order
          </DropdownMenuItem>
        )}
        {filteredRecipes.length > 0 && (
          <DropdownMenuItem onClick={() => { saveScrollPosition(); setShowChecklist(true); }}>
            <CheckSquare className="mr-2 h-4 w-4" /> Ingredient Checklist
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Menu Management</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => { saveScrollPosition(); setShowImporter(true); }}>
          <Upload className="mr-2 h-4 w-4" /> Import Recipes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { saveScrollPosition(); setShowCustomerMenuBuilder(true); }}>
          <Eye className="mr-2 h-4 w-4" /> Customer Menu
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            saveScrollPosition();
            window.location.href = createPageUrl(`AiMenuDesigner?id=${menu.id}`);
          }}
        >
          <Wand2 className="mr-2 h-4 w-4" /> AI Menu Designer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportMenuPdf}>
          <Share2 className="mr-2 h-4 w-4" /> Export Menu PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCreatePresentation} disabled={!menu || !account || filteredRecipes.length === 0}>
          <Image className="mr-2 h-4 w-4" /> Create Presentation
        </DropdownMenuItem>
        {isInternalUser && (
          <DropdownMenuItem onClick={() => setShowShareModal(true)}>
            <Share2 className="mr-2 h-4 w-4" /> Share Menu
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Documentation</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setShowAddMenuToTrainingDocModal(true)} disabled={!filteredRecipes.length}>
            <FileText className="mr-2 h-4 w-4" /> Create Training Doc
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Reports & Specs</DropdownMenuLabel>
        <Link to={createPageUrl(`MenuReport?id=${menu?.id}`)} target="_blank" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <BarChart3 className="mr-2 h-4 w-4" /> Report
          </DropdownMenuItem>
        </Link>
        <Link to={createPageUrl(`BuyerSpecs?id=${menu?.id}&target=buyer`)} target="_blank" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <DollarSign className="mr-2 h-4 w-4" /> Menu Specs
          </DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
      <AddMenuToTrainingDocModal
        isOpen={showAddMenuToTrainingDocModal}
        onClose={() => setShowAddMenuToTrainingDocModal(false)}
        menu={menu}
        recipes={filteredRecipes}
      />

      {showResolveVariantsModal && (
        <ResolveInventoryVariantsModal
          isOpen={showResolveVariantsModal}
          onClose={() => setShowResolveVariantsModal(false)}
          menuId={menu.id}
          accountId={account.id}
          onComplete={() => {
             // Optional: trigger refresh of inventory if needed or just show success
          }}
        />
      )}
    </>
  );
}