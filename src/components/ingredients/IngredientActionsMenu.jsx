import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { 
  FileSpreadsheet, 
  Loader2, 
  Image as ImageIcon, 
  MoreHorizontal, 
  Upload, 
  Scan, 
  FlaskConical,
  Download,
  ChevronDown
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { alcoholicCategories } from "@/components/utils/categoryDefinitions";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function IngredientActionsMenu({ 
  onImportSpreadsheet, 
  onBulkImport, 
  onFindDuplicates,
  onBulkImageUpload
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingImages, setIsExportingImages] = useState(false);
  const [alcoholicOnly, setAlcoholicOnly] = useState(false);

  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      const [allIngredients, allVariants] = await Promise.all([
        base44.entities.Ingredient.list('name', 10000),
        base44.entities.ProductVariant.list(10000)
      ]);

      if (!allIngredients?.length) {
        alert('No ingredients found to export');
        return;
      }

      const ingredientsToExport = alcoholicOnly
        ? allIngredients.filter(ing => ing.category && alcoholicCategories.includes(ing.category.toLowerCase()))
        : allIngredients;

      if (!ingredientsToExport.length) {
        alert('No ingredients to export with current filters');
        return;
      }

      // Add bottle_image_url to headers
      const headers = [
        'name', 'variant_size', 'category', 'spirit_type', 'style', 'substyle', 'region', 'supplier', 'sku_number', 'exclusive', 'tier',
        'purchase_price', 'purchase_quantity', 'purchase_unit',
        'use_case_pricing', 'case_price', 'bottles_per_case',
        'abv', 'description', 'bottle_image_url'
      ];

      const csvRows = [headers.join(',')];
      
      ingredientsToExport.forEach(ingredient => {
        const ingredientVariants = allVariants.filter(v => v.ingredient_id === ingredient.id);

        // Helper to format row
        const createRow = (data) => {
          return headers.map(header => {
            let value = data[header];
            if (value === null || typeof value === 'undefined') return '';
            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',');
        };

        if (ingredientVariants.length > 0) {
          // Export one row per variant
          ingredientVariants.forEach(variant => {
            const rowData = {
              ...ingredient,
              // Override with variant specific data
              sku_number: variant.sku_number || ingredient.sku_number,
              purchase_price: variant.purchase_price,
              purchase_quantity: variant.purchase_quantity,
              purchase_unit: variant.purchase_unit,
              case_price: variant.case_price,
              bottles_per_case: variant.bottles_per_case,
              // Construct a helpful size label
              variant_size: `${variant.purchase_quantity}${variant.purchase_unit}`,
              // Ensure boolean flags are respected if they exist on variant (though schema puts them on ingredient)
              use_case_pricing: variant.case_price && variant.bottles_per_case ? true : ingredient.use_case_pricing
            };
            csvRows.push(createRow(rowData));
          });
        } else {
          // Export single row for ingredient
          csvRows.push(createRow(ingredient));
        }
      });

      downloadCSV(csvRows.join('\n'), `ingredients_export_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('Error during CSV export:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportImageTemplate = async () => {
    setIsExportingImages(true);
    try {
      const [allIngredients, allVariants] = await Promise.all([
        base44.entities.Ingredient.list('name', 10000),
        base44.entities.ProductVariant.list(10000)
      ]);

      if (!allIngredients?.length) {
        alert('No ingredients found');
        return;
      }

      const headers = ['Product Name', 'SKU', 'Bottle Image URL'];
      const rows = [];

      allVariants.forEach(variant => {
        if (variant.sku_number) {
          const parent = allIngredients.find(i => i.id === variant.ingredient_id);
          if (parent) {
             const name = `${parent.name} (${variant.size_ml}ml)`;
             rows.push([name, variant.sku_number, parent.bottle_image_url || '']);
          }
        }
      });

      allIngredients.forEach(ing => {
        if (ing.sku_number) {
          rows.push([ing.name, ing.sku_number, ing.bottle_image_url || '']);
        }
      });

      const csvRows = [headers.join(',')];
      rows.forEach(row => {
        const csvRow = row.map(val => {
          const s = String(val || '');
          return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
        });
        csvRows.push(csvRow.join(','));
      });

      downloadCSV(csvRows.join('\n'), `bottle_images_template_${new Date().toISOString().split('T')[0]}.csv`);
      
    } catch (error) {
      console.error('Error exporting image template:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExportingImages(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 bg-white">
          Actions
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Data Management</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to={createPageUrl("TestDistributorUpload")} className="w-full cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            Distributor Price Update
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onImportSpreadsheet} className="cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Import Spreadsheet
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onBulkImport} className="cursor-pointer">
          <Upload className="w-4 h-4 mr-2" />
          Bulk Import (Legacy)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onFindDuplicates} className="cursor-pointer">
          <Scan className="w-4 h-4 mr-2" />
          Find Duplicates
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onBulkImageUpload} className="cursor-pointer">
          <ImageIcon className="w-4 h-4 mr-2" />
          Bulk Upload Images
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Export</DropdownMenuLabel>
        
        <DropdownMenuCheckboxItem 
          checked={alcoholicOnly} 
          onCheckedChange={setAlcoholicOnly}
        >
          Export Alcoholic Only
        </DropdownMenuCheckboxItem>

        <DropdownMenuItem onClick={exportToCSV} disabled={isExporting} className="cursor-pointer">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export Full CSV
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={exportImageTemplate} disabled={isExportingImages} className="cursor-pointer">
          {isExportingImages ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
          Export Image Template
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}