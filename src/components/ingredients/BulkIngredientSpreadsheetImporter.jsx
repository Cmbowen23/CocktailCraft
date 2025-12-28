import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, AlertTriangle, Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const calculateSimilarity = (str1, str2) => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1;
  const shorter = s1.length < s2.length ? s1 : s2;
  const longer = s1.length >= s2.length ? s1 : s2;
  if (longer.startsWith(shorter)) return 0.95;
  if (longer.includes(shorter) && shorter.length >= 4) return 0.85;
  return 0;
};

// Normalize name for matching - handles case, extra spaces, common variations
const normalizeName = (name) => {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // collapse multiple spaces
};

export default function BulkIngredientSpreadsheetImporter({ onComplete, onCancel, allIngredients = [] }) {
  const [step, setStep] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedIngredients, setParsedIngredients] = useState([]);
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [mergeDecisions, setMergeDecisions] = useState({});
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [allProductVariants, setAllProductVariants] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
        setError('Please upload a CSV file.');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must contain headers and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index].replace(/^"|"$/g, '');
        });
        rows.push(row);
      }
    }

    return rows;
  };

  const handleParseFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError('');
    setProgress('Reading CSV file...');
    
    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setError('CSV file must contain headers and at least one data row');
        setIsProcessing(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase()).filter(h => h !== '');
      setParsedHeaders(headers);
      
      const rows = parseCSV(text);

      if (rows.length === 0) {
        setError('No valid data rows found in CSV');
        setIsProcessing(false);
        return;
      }

      setParsedRows(rows);
      
      const expectedFields = [
        'name',
        'category',
        'spirit_type',
        'substyle',
        'flavor',
        'region',
        'supplier',
        'sku_number',
        'exclusive',
        'tier',
        'purchase_price',
        'purchase_quantity',
        'purchase_unit',
        'use_case_pricing',
        'case_price',
        'bottles_per_case',
        'abv',
        'description'
      ];

      const initialMappings = {};
      expectedFields.forEach(field => {
        if (headers.includes(field)) {
          initialMappings[field] = field;
        } else {
          initialMappings[field] = '';
        }
      });
      setColumnMappings(initialMappings);
      
      setStep('mapping');
      setProgress('');
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setError(`Failed to parse CSV: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmMappings = async () => {
    setIsProcessing(true);
    setError('');
    setProgress('Loading existing product variants...');

    try {
      // Fetch all existing product variants to match by SKU
      let existingVariants;
      try {
        existingVariants = await base44.entities.ProductVariant.list("-created_at", 10000);
      } catch (variantError) {
        console.warn('Failed to fetch variants with ordering, trying without ordering:', variantError);
        // Fallback: try without ordering if the column name causes issues
        existingVariants = await base44.entities.ProductVariant.list(null, 10000);
      }
      setAllProductVariants(existingVariants || []);
      
      setProgress('Grouping ingredients by name...');
      const rows = parsedRows;
      
      // Group rows by ingredient name (case-insensitive) + supplier
      const ingredientGroups = {};
      
      rows.forEach(row => {
        const mappedRow = {};
        Object.entries(columnMappings).forEach(([field, csvColumn]) => {
          if (csvColumn && csvColumn !== '__unmapped__' && row[csvColumn] !== undefined) {
            mappedRow[field] = row[csvColumn];
          }
        });
        
        const name = mappedRow.name?.trim() || '';
        const supplier = mappedRow.supplier?.trim() || '';
        if (!name) return; // Skip rows without a name
        
        // Group by name + supplier to handle same product from different suppliers
        const groupKey = `${name.toLowerCase()}|${supplier.toLowerCase()}`;
        
        if (!ingredientGroups[groupKey]) {
          ingredientGroups[groupKey] = {
            name: name,
            category: mappedRow.category || 'other',
            spirit_type: mappedRow.spirit_type || null,
            substyle: mappedRow.substyle || null,
            flavor: mappedRow.flavor || null,
            region: mappedRow.region || null,
            supplier: supplier || null,
            exclusive: mappedRow.exclusive === 'TRUE' || mappedRow.exclusive === 'true' || mappedRow.exclusive === '1',
            tier: mappedRow.tier || null,
            ingredient_type: 'purchased',
            abv: parseFloat(mappedRow.abv) || 0,
            description: mappedRow.description || null,
            variants: []
          };
        }
        
        // Add this row as a variant
        const sizeQty = parseFloat(mappedRow.purchase_quantity) || 0;
        const sizeUnit = (mappedRow.purchase_unit || 'ml').toLowerCase();

        // Convert to ml for size_ml field
        let size_ml = sizeQty;
        if (sizeUnit === 'l') {
          size_ml = sizeQty * 1000;
        } else if (sizeUnit === 'oz' || sizeUnit === 'fl oz') {
          size_ml = sizeQty * 29.5735;
        } else if (sizeUnit === 'gal') {
          size_ml = sizeQty * 3785.41;
        }

        const variantData = {
          sku_number: mappedRow.sku_number || '',
          purchase_price: parseFloat(mappedRow.purchase_price) || 0,
          size_ml: size_ml,
          purchase_quantity: sizeQty,
          purchase_unit: sizeUnit,
          case_price: mappedRow.case_price ? parseFloat(mappedRow.case_price) : null,
          bottles_per_case: mappedRow.bottles_per_case ? parseFloat(mappedRow.bottles_per_case) : null
        };

        // Check for duplicate variants within this ingredient before adding
        const existingVariants = ingredientGroups[groupKey].variants;
        const normalizedSku = normalizeName(variantData.sku_number);

        // Check if variant already exists by SKU or size
        const isDuplicate = existingVariants.some(existing => {
          // Match by SKU if both have SKU
          if (normalizedSku && normalizeName(existing.sku_number) === normalizedSku) {
            return true;
          }
          // Match by size (within 1ml tolerance)
          if (variantData.size_ml > 0 && Math.abs(existing.size_ml - variantData.size_ml) < 1) {
            return true;
          }
          return false;
        });

        // Only add if not a duplicate
        if (!isDuplicate) {
          ingredientGroups[groupKey].variants.push(variantData);
        }
      });
      
      // Helper to compare fields and find changes
      const getFieldChanges = (newData, existingData, fieldsToCompare) => {
        const changes = [];
        for (const field of fieldsToCompare) {
          const newVal = newData[field];
          const existingVal = existingData[field];
          
          // Skip if new value is empty/null/undefined (unmapped field - leave untouched)
          const newEmpty = newVal === null || newVal === undefined || newVal === '';
          if (newEmpty) continue;
          
          // Skip if both values are the same
          if (String(newVal || '').toLowerCase().trim() === String(existingVal || '').toLowerCase().trim()) continue;
          
          changes.push({
            field,
            oldValue: existingVal,
            newValue: newVal
          });
        }
        return changes;
      };

      const ingredientFieldsToCompare = ['category', 'spirit_type', 'substyle', 'flavor', 'region', 'supplier', 'tier', 'abv', 'description', 'exclusive'];
      const variantFieldsToCompare = ['purchase_price', 'purchase_quantity', 'purchase_unit', 'case_price', 'bottles_per_case', 'sku_number'];

      // Convert groups to array and find exact matches
      const cleanedIngredients = Object.values(ingredientGroups).map(ingredientData => {
        const normalizedNewName = normalizeName(ingredientData.name);

        // First check for exact match by name (case-insensitive)
        let exactMatch = allIngredients.find(existing => 
          normalizeName(existing.name) === normalizedNewName
        );

        // If no name match, try to find by SKU from variants
        if (!exactMatch && ingredientData.variants.length > 0) {
          for (const variant of ingredientData.variants) {
            if (variant.sku_number) {
              const normalizedSku = normalizeName(variant.sku_number);
              const matchingVariant = existingVariants.find(ev => 
                normalizeName(ev.sku_number) === normalizedSku
              );
              if (matchingVariant && matchingVariant.ingredient_id) {
                exactMatch = allIngredients.find(ing => ing.id === matchingVariant.ingredient_id);
                if (exactMatch) break;
              }
            }
          }
        }

        // Calculate field-level changes for ingredient
        let ingredientChanges = [];
        if (exactMatch) {
          ingredientChanges = getFieldChanges(ingredientData, exactMatch, ingredientFieldsToCompare);
        }

        // Calculate variant-level changes
        const variantAnalysis = ingredientData.variants.map(variant => {
          const normalizedNewSku = normalizeName(variant.sku_number);
          
          // Find matching existing variant
          let matchingExistingVariant = null;
          if (exactMatch) {
            const existingVariantsForIng = existingVariants.filter(v => v.ingredient_id === exactMatch.id);
            
            if (normalizedNewSku) {
              matchingExistingVariant = existingVariantsForIng.find(ev => 
                normalizeName(ev.sku_number) === normalizedNewSku
              );
            }
            
            if (!matchingExistingVariant && variant.size_ml > 0) {
              matchingExistingVariant = existingVariantsForIng.find(ev => 
                Math.abs((parseFloat(ev.size_ml) || 0) - variant.size_ml) < 1
              );
            }
          }

          if (matchingExistingVariant) {
            const variantChanges = getFieldChanges(variant, matchingExistingVariant, variantFieldsToCompare);
            return {
              ...variant,
              isNew: false,
              existingVariantId: matchingExistingVariant.id,
              changes: variantChanges
            };
          } else {
            return {
              ...variant,
              isNew: true,
              existingVariantId: null,
              changes: []
            };
          }
        });

        // Then find fuzzy matches (excluding exact match)
        const fuzzyMatches = allIngredients
          .filter(existing => !exactMatch || existing.id !== exactMatch.id)
          .map(existing => ({
            ingredient: existing,
            similarity: calculateSimilarity(ingredientData.name, existing.name)
          }))
          .filter(match => match.similarity > 0.6 && match.similarity < 1)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5);

        return {
          ...ingredientData,
          exactMatch: exactMatch || null,
          fuzzyMatches,
          ingredientChanges,
          variantAnalysis
        };
      });
      
      if (cleanedIngredients.length === 0) {
        setError('No valid ingredients found with a name');
        setIsProcessing(false);
        return;
      }

      // Set merge decisions - default to exact match if found
      const initialDecisions = {};
      cleanedIngredients.forEach((ing, index) => {
        if (ing.exactMatch) {
          initialDecisions[index] = ing.exactMatch.id; // Default to merging with exact match
        } else if (ing.fuzzyMatches.length > 0) {
          initialDecisions[index] = 'new'; // Default to keeping as new for fuzzy matches
        }
        // If no match at all, leave undefined (will create new)
      });
      setMergeDecisions(initialDecisions);

      // Validate for within-batch duplicates
      const warnings = validateBatchForDuplicates(cleanedIngredients);
      setValidationWarnings(warnings);

      setParsedIngredients(cleanedIngredients);
      setStep('confirm');
    } catch (error) {
      console.error("Error processing ingredients:", error);

      let errorMessage = 'Failed to process ingredients. ';

      if (error.message && error.message.includes('product_variants')) {
        errorMessage += 'There was an issue accessing the product variants database. Please ensure the database is set up correctly.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'An unexpected error occurred. Please try again.';
      }

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Validate ingredients for potential duplicate issues within the batch
  const validateBatchForDuplicates = (ingredients) => {
    const warnings = [];
    const seenSkus = {};
    const seenIngredientNames = {};

    ingredients.forEach((ing, idx) => {
      const normalizedName = normalizeName(ing.name);

      // Check for duplicate ingredient names in batch
      if (seenIngredientNames[normalizedName]) {
        const firstIdx = seenIngredientNames[normalizedName];
        const firstIng = ingredients[firstIdx];

        // Only warn if suppliers differ (same name, same supplier is expected grouping)
        if (normalizeName(ing.supplier) !== normalizeName(firstIng.supplier)) {
          warnings.push({
            type: 'duplicate_name',
            severity: 'warning',
            message: `"${ing.name}" appears multiple times with different suppliers: "${firstIng.supplier}" and "${ing.supplier}". These will create separate ingredients.`,
            indices: [firstIdx, idx]
          });
        }
      } else {
        seenIngredientNames[normalizedName] = idx;
      }

      // Check for duplicate SKUs within the batch
      ing.variants.forEach((variant, vIdx) => {
        if (variant.sku_number) {
          const normalizedSku = normalizeName(variant.sku_number);
          if (seenSkus[normalizedSku]) {
            const existing = seenSkus[normalizedSku];
            if (existing.ingredientIdx !== idx) {
              warnings.push({
                type: 'duplicate_sku',
                severity: 'warning',
                message: `SKU "${variant.sku_number}" appears on multiple ingredients: "${ingredients[existing.ingredientIdx].name}" and "${ing.name}". This may indicate a data issue.`,
                indices: [existing.ingredientIdx, idx]
              });
            }
          } else {
            seenSkus[normalizedSku] = { ingredientIdx: idx, variantIdx: vIdx };
          }
        }
      });

      // Check for duplicate variants within the same ingredient
      const variantSizes = {};
      const variantSkus = {};
      ing.variants.forEach((variant, vIdx) => {
        // Check duplicate sizes
        if (variant.size_ml > 0) {
          if (variantSizes[variant.size_ml]) {
            warnings.push({
              type: 'duplicate_variant_size',
              severity: 'warning',
              message: `"${ing.name}" has multiple variants with the same size (${variant.size_ml}ml). Duplicates will be merged.`,
              indices: [idx]
            });
          } else {
            variantSizes[variant.size_ml] = true;
          }
        }

        // Check duplicate SKUs within same ingredient
        if (variant.sku_number) {
          const normalizedSku = normalizeName(variant.sku_number);
          if (variantSkus[normalizedSku]) {
            warnings.push({
              type: 'duplicate_variant_sku',
              severity: 'error',
              message: `"${ing.name}" has multiple variants with the same SKU "${variant.sku_number}". This will cause issues - please fix your CSV.`,
              indices: [idx]
            });
          } else {
            variantSkus[normalizedSku] = true;
          }
        }
      });
    });

    return warnings;
  };

  // *** OPTIMIZED SAVE: skip unchanged, only touch changed variants, recalc cost_per_unit only when needed
  const handleSaveIngredients = async () => {
    setIsProcessing(true);
    setError('');
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Local, mutable cache of variants so we don't refetch per ingredient
    let variantsCache = Array.isArray(allProductVariants) ? [...allProductVariants] : [];
    const smallDelayMs = 50; // gentle to API but not insanely slow

    for (let i = 0; i < parsedIngredients.length; i++) {
      const ingredientData = parsedIngredients[i];

      const {
        ingredientChanges = [],
        variantAnalysis = [],
        fuzzyMatches,
        variants,
        exactMatch,
        ...rawDataToSave
      } = ingredientData;

      // Only process variants that are NEW or actually have changes
      const variantsToProcess = (variantAnalysis || []).filter(
        (v) => v.isNew || (v.changes && v.changes.length > 0)
      );

      // If absolutely nothing changed, skip this ingredient completely
      if (ingredientChanges.length === 0 && variantsToProcess.length === 0) {
        skippedCount++;
        continue;
      }

      setProgress(
        `Saving ingredient ${i + 1} of ${parsedIngredients.length}: ${
          ingredientData.name || 'Unnamed'
        }`
      );

      try {
        let targetIngredientId = null;
        let existingIngredient = null;

        // Check merge decision - RESPECT USER'S EXPLICIT CHOICE
        const decision = mergeDecisions[i];
        if (decision === 'new') {
          // User explicitly chose "Create as new ingredient" - DO NOT merge
          targetIngredientId = null;
          existingIngredient = null;
        } else if (decision && decision !== 'new') {
          // User chose to merge with a specific ingredient
          targetIngredientId = decision;
          existingIngredient = allIngredients.find(ing => ing.id === decision);
        }
        // If decision is undefined/null, create new ingredient (no automatic matching during save)
        
        // Filter out empty/null values so we don't overwrite existing data with blanks
        const dataToSave = {};
        for (const [key, value] of Object.entries(rawDataToSave)) {
          if (value !== null && value !== undefined && value !== '') {
            dataToSave[key] = value;
          }
        }

        // 1) Create or update the ingredient itself (only if needed)
        if (targetIngredientId) {
          if (ingredientChanges.length > 0) {
            await base44.entities.Ingredient.update(targetIngredientId, dataToSave);
          }
        } else {
          // brand new ingredient
          const created = await base44.entities.Ingredient.create(dataToSave);
          targetIngredientId = created.id;
        }
        
        // 2) Variants — only touch ones that are new or changed
        let variantsForIng = variantsCache.filter(v => v.ingredient_id === targetIngredientId);

        for (const v of variantsToProcess) {
          const variantPayload = {
            ingredient_id: targetIngredientId,
            size_ml: v.size_ml,
            purchase_quantity: v.purchase_quantity,
            purchase_unit: v.purchase_unit,
            purchase_price: v.purchase_price,
            case_price: v.case_price,
            bottles_per_case: v.bottles_per_case,
            sku_number: v.sku_number,
          };

          if (v.isNew) {
            // create new variant
            const createdVariant = await base44.entities.ProductVariant.create(variantPayload);
            variantsCache.push(createdVariant);
            variantsForIng.push(createdVariant);
          } else if (v.existingVariantId) {
            // update existing variant
            await base44.entities.ProductVariant.update(v.existingVariantId, variantPayload);

            // update local caches
            variantsCache = variantsCache.map((existing) =>
              existing.id === v.existingVariantId
                ? { ...existing, ...variantPayload }
                : existing
            );
            variantsForIng = variantsForIng.map((existing) =>
              existing.id === v.existingVariantId
                ? { ...existing, ...variantPayload }
                : existing
            );
          }
        }

        // 3) Recalculate cost_per_unit ONLY if some variant actually changed
        if (variantsToProcess.length > 0) {
          let minCostPerUnit = Infinity;

          for (const variant of variantsForIng) {
            const vPrice = parseFloat(variant.purchase_price) || 0;
            const vCasePrice = parseFloat(variant.case_price) || 0;
            const vBottlesPerCase = parseFloat(variant.bottles_per_case) || 0;
            const vSizeMl = parseFloat(variant.size_ml) || 0;

            let pricePerBottle = vPrice;
            if (variant.use_case_pricing && vBottlesPerCase > 0 && vCasePrice > 0) {
              pricePerBottle = vCasePrice / vBottlesPerCase;
            } else if (variant.purchase_unit === 'case' && vBottlesPerCase > 0 && vPrice > 0) {
              pricePerBottle = vPrice / vBottlesPerCase;
            }
            
            if (vSizeMl > 0 && pricePerBottle > 0) {
              const costPerMl = pricePerBottle / vSizeMl;
              const costPerOz = costPerMl * 29.5735; // Convert ml to oz
              if (costPerOz < minCostPerUnit) {
                minCostPerUnit = costPerOz;
              }
            }
          }
          
          await base44.entities.Ingredient.update(targetIngredientId, { 
            cost_per_unit: minCostPerUnit === Infinity ? 0 : minCostPerUnit,
            unit: 'oz'
          });
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to save ingredient ${ingredientData.name}:`, error);
        errorCount++;
      }
      
      if (i < parsedIngredients.length - 1 && smallDelayMs > 0) {
        await delay(smallDelayMs);
      }
    }

    setProgress(
      `Import complete! Updated ${successCount} ingredients, skipped ${skippedCount} with no changes${
        errorCount > 0 ? `, with ${errorCount} failures` : ''
      }.`
    );
    
    setTimeout(() => {
      onComplete();
    }, 1500);

    setIsProcessing(false);
  };

  const downloadTemplate = () => {
    const templateData = `name,category,spirit_type,substyle,flavor,region,supplier,sku_number,exclusive,tier,purchase_price,purchase_quantity,purchase_unit,case_price,bottles_per_case,abv,description
Hendrick's Gin,spirit,Gin,,,Scotland,Hendrick's,HEN-750,TRUE,premium,35.99,750,ml,215.94,6,44,"Distinctive gin with cucumber and rose"
Hendrick's Gin,spirit,Gin,,,Scotland,Hendrick's,HEN-1L,TRUE,premium,45.99,1,L,275.94,6,44,"Distinctive gin with cucumber and rose"
Absolut Citron Vodka,spirit,Vodka,Flavored,Lemon,Sweden,Absolut,ABS-CIT-750,FALSE,call,22.99,750,ml,,,40,"Citrus flavored vodka"
Bacardi White Rum,spirit,Rum,,,Puerto Rico,Bacardi,BAC-750,FALSE,call,24.99,750,ml,,,40,"Classic white rum"
Simple Syrup,syrup,,,,,House Made,SYR-500,FALSE,,5.00,500,ml,,,0,"1:1 sugar to water ratio"`;
    
    const blob = new Blob([templateData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'ingredient_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (step === 'mapping') {
    const ingredientFields = [
      { key: 'name', label: 'Name', required: true },
      { key: 'category', label: 'Category', required: true },
      { key: 'spirit_type', label: 'Spirit Type', required: false },
      { key: 'substyle', label: 'Substyle', required: false },
      { key: 'flavor', label: 'Flavor', required: false },
      { key: 'region', label: 'Region', required: false },
      { key: 'supplier', label: 'Supplier', required: false },
      { key: 'sku_number', label: 'SKU Number', required: false },
      { key: 'exclusive', label: 'Exclusive', required: false },
      { key: 'tier', label: 'Tier', required: false },
      { key: 'purchase_price', label: 'Purchase Price', required: false },
      { key: 'purchase_quantity', label: 'Purchase Quantity', required: false },
      { key: 'purchase_unit', label: 'Purchase Unit', required: false },
      { key: 'case_price', label: 'Case Price', required: false },
      { key: 'bottles_per_case', label: 'Bottles Per Case', required: false },
      { key: 'abv', label: 'ABV', required: false },
      { key: 'description', label: 'Description', required: false },
    ];

    const requiredMapped = ingredientFields
      .filter(f => f.required)
      .every(f => columnMappings[f.key] && columnMappings[f.key] !== '');

    return (
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-emerald-900">Map CSV Columns to Ingredient Fields</CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Match your CSV columns to ingredient fields.</strong> The system detected {parsedHeaders.length} columns in your CSV.
                Rows with the same ingredient name AND supplier will be grouped into one ingredient with multiple size variants.
                <br /><br />
                <strong className="text-amber-700">⚠️ IMPORTANT:</strong> Make sure 'category' and 'tier' columns in your CSV are correctly spelled and mapped here.
              </p>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {ingredientFields.map(field => (
                <div key={field.key} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor={`map-${field.key}`} className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                  </div>
                  <div className="flex-1">
                    <Select
                      value={columnMappings[field.key] || ''}
                      onValueChange={(value) => setColumnMappings(prev => ({ ...prev, [field.key]: value }))}
                    >
                      <SelectTrigger id={`map-${field.key}`} className="w-full">
                        <SelectValue placeholder="Select CSV column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unmapped__">— Not Mapped —</SelectItem>
                        {parsedHeaders.map(header => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {!requiredMapped && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <p className="text-sm text-amber-800">
                  ⚠️ Please map all required fields (marked with *) before continuing.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back to Upload
              </Button>
              <Button 
                onClick={() => setStep('preview')}
                disabled={!requiredMapped}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Preview Mappings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'preview') {
    const previewRows = parsedRows.slice(0, 3).map(row => {
      const mappedRow = {};
      Object.entries(columnMappings).forEach(([field, csvColumn]) => {
        if (csvColumn && csvColumn !== '__unmapped__' && row[csvColumn] !== undefined) {
          mappedRow[field] = row[csvColumn];
        }
      });
      return mappedRow;
    });

    return (
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-emerald-900">Preview Mapped Data</CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            {progress && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="text-blue-700">{progress}</span>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Preview: First 3 CSV Rows
              </h4>
              <p className="text-sm text-blue-700 mb-3">Rows with matching names AND suppliers will be grouped into one ingredient with multiple variants:</p>
              <div className="space-y-3">
                {previewRows.map((row, idx) => (
                  <div key={idx} className="bg-white p-3 rounded border border-blue-300">
                    <div className="font-semibold text-gray-900 mb-2 text-sm">
                      {row.name || '(Unnamed)'} - {row.supplier || '(No Supplier)'} - SKU {row.sku_number}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Category:</span>
                        <span className="font-medium text-gray-900">{row.category || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tier:</span>
                        <span className="font-medium text-gray-900">{row.tier || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Spirit Type:</span>
                        <span className="font-medium text-gray-900">{row.spirit_type || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Flavor:</span>
                        <span className="font-medium text-gray-900">{row.flavor || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bottle Price:</span>
                        <span className="font-medium text-gray-900">${row.purchase_price || '0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Size:</span>
                        <span className="font-medium text-gray-900">{row.purchase_quantity} {row.purchase_unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back to Mappings
              </Button>
              <Button 
                onClick={handleConfirmMappings}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Continue to Duplicate Check'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'confirm') {
    return (
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-emerald-900">Confirm Ingredient Import</CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {progress && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-700">{progress}</span>
              </div>
            )}

            {validationWarnings && validationWarnings.length > 0 && (
              <div className="space-y-2">
                {validationWarnings.filter(w => w.severity === 'error').length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-800 mb-1">Critical Issues Detected</p>
                      <p className="text-sm text-red-700">Please fix these errors in your CSV before importing:</p>
                    </div>
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {validationWarnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 p-3 rounded-lg ${
                        warning.severity === 'error'
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-amber-50 border border-amber-200'
                      }`}
                    >
                      <AlertCircle
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          warning.severity === 'error' ? 'text-red-500' : 'text-amber-500'
                        }`}
                      />
                      <p className={`text-sm ${warning.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                        {warning.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-emerald-900 mb-4">
                Ready to import {parsedIngredients.length} unique ingredient{parsedIngredients.length !== 1 ? 's' : ''}
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto p-4 bg-emerald-50 rounded-lg">
                {parsedIngredients.map((ingredient, index) => {
                  const hasExactMatch = ingredient.exactMatch != null;
                  const hasFuzzyMatches = ingredient.fuzzyMatches && ingredient.fuzzyMatches.length > 0;
                  const currentDecision = mergeDecisions[index];
                  const willMerge = currentDecision && currentDecision !== 'new';

                  // Calculate summary for variants
                  const newVariantsCount = ingredient.variantAnalysis?.filter(v => v.isNew).length || 0;
                  const updatedVariantsCount = ingredient.variantAnalysis?.filter(v => !v.isNew && v.changes.length > 0).length || 0;
                  const unchangedVariantsCount = ingredient.variantAnalysis?.filter(v => !v.isNew && v.changes.length === 0).length || 0;

                  // Build summary text
                  const getSummaryText = () => {
                    if (!willMerge) return <span className="text-green-600 font-medium">New Ingredient</span>;
                    
                    const parts = [];
                    if (ingredient.ingredientChanges?.length > 0) {
                      parts.push(`Update ${ingredient.ingredientChanges.length} field${ingredient.ingredientChanges.length !== 1 ? 's' : ''}`);
                    }
                    if (newVariantsCount > 0) {
                      parts.push(`Add ${newVariantsCount} new variant${newVariantsCount !== 1 ? 's' : ''}`);
                    }
                    if (updatedVariantsCount > 0) {
                      parts.push(`Update ${updatedVariantsCount} variant${updatedVariantsCount !== 1 ? 's' : ''}`);
                    }
                    if (unchangedVariantsCount > 0 && parts.length === 0) {
                      parts.push(`${unchangedVariantsCount} variant${unchangedVariantsCount !== 1 ? 's' : ''} unchanged`);
                    }
                    
                    if (parts.length === 0) {
                      return <span className="text-gray-500 font-medium">No changes</span>;
                    }
                    
                    return <span className="text-blue-600 font-medium">{parts.join(' • ')}</span>;
                  };

                  return (
                    <div key={index} className={`p-3 rounded border ${hasExactMatch ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <span className="font-medium text-emerald-900">{ingredient.name}</span>
                          <div className="text-sm text-emerald-700">
                            {ingredient.category} • {ingredient.tier ? `${ingredient.tier} • ` : ''}{ingredient.supplier || 'No supplier'} • {ingredient.variants.length} size variant{ingredient.variants.length !== 1 ? 's' : ''}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            SKUs: {ingredient.variants.map(v => v.sku_number).filter(Boolean).join(', ') || 'None'}
                          </div>
                        </div>
                        <div className="text-sm">
                          {getSummaryText()}
                        </div>
                      </div>

                      {/* Show field-level changes for ingredient */}
                      {willMerge && ingredient.ingredientChanges?.length > 0 && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          <p className="font-medium text-yellow-800 mb-1">Ingredient field changes:</p>
                          <div className="space-y-1">
                            {ingredient.ingredientChanges.map((change, idx) => (
                              <div key={idx} className="flex gap-2">
                                <span className="text-gray-600 capitalize">{change.field.replace(/_/g, ' ')}:</span>
                                <span className="text-red-600 line-through">{change.oldValue || '(empty)'}</span>
                                <span className="text-gray-400">→</span>
                                <span className="text-green-700 font-medium">{change.newValue || '(empty)'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Show variant-level changes */}
                      {willMerge && ingredient.variantAnalysis?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {ingredient.variantAnalysis.map((variant, vIdx) => (
                            <div
                              key={vIdx}
                              className={`p-2 rounded text-xs ${
                                variant.isNew
                                  ? 'bg-green-50 border border-green-200'
                                  : variant.changes.length > 0
                                  ? 'bg-yellow-50 border border-yellow-200'
                                  : 'bg-gray-50 border border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">
                                  {variant.size_ml >= 1000
                                    ? `${(variant.size_ml / 1000).toFixed(2)}L`
                                    : `${variant.size_ml}ml`}
                                </span>
                                {variant.sku_number && (
                                  <span className="text-gray-500">SKU: {variant.sku_number}</span>
                                )}
                                {variant.isNew ? (
                                  <span className="text-green-700 font-medium ml-auto">+ New variant</span>
                                ) : variant.changes.length > 0 ? (
                                  <span className="text-yellow-700 font-medium ml-auto">Updating</span>
                                ) : (
                                  <span className="text-gray-500 ml-auto">No changes</span>
                                )}
                              </div>
                              {!variant.isNew && variant.changes.length > 0 && (
                                <div className="pl-2 space-y-0.5">
                                  {variant.changes.map((change, cIdx) => (
                                    <div key={cIdx} className="flex gap-2">
                                      <span className="text-gray-600 capitalize">{change.field.replace(/_/g, ' ')}:</span>
                                      <span className="text-red-600 line-through">{change.oldValue || '(empty)'}</span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-green-700 font-medium">{change.newValue || '(empty)'}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Show merge options if exact match or fuzzy matches exist */}
                      {(hasExactMatch || hasFuzzyMatches) && (
                        <div
                          className={`mt-2 p-2 rounded ${
                            hasExactMatch
                              ? 'bg-blue-100 border border-blue-300'
                              : 'bg-amber-50 border border-amber-200'
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <AlertCircle
                              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                hasExactMatch ? 'text-blue-600' : 'text-amber-600'
                              }`}
                            />
                            <div className="flex-1">
                              <p
                                className={`text-sm font-medium ${
                                  hasExactMatch ? 'text-blue-900' : 'text-amber-900'
                                }`}
                              >
                                {hasExactMatch ? 'Existing ingredient found' : 'Possible duplicate detected'}
                              </p>
                              <p
                                className={`text-xs ${
                                  hasExactMatch ? 'text-blue-700' : 'text-amber-700'
                                }`}
                              >
                                {hasExactMatch ? (
                                  <>
                                    "{ingredient.exactMatch.name}" already exists
                                    {ingredient.exactMatch.supplier && ingredient.supplier &&
                                     normalizeName(ingredient.exactMatch.supplier) !== normalizeName(ingredient.supplier) && (
                                      <span className="font-semibold text-amber-800">
                                        {' '}(Different suppliers: existing "{ingredient.exactMatch.supplier}" vs new "{ingredient.supplier}")
                                      </span>
                                    )}
                                    .
                                  </>
                                ) : (
                                  'This ingredient might already exist with a similar name:'
                                )}
                              </p>
                            </div>
                          </div>
                          <Select
                            value={currentDecision || (hasExactMatch ? ingredient.exactMatch.id : 'new')}
                            onValueChange={(value) =>
                              setMergeDecisions((prev) => ({ ...prev, [index]: value }))
                            }
                          >
                            <SelectTrigger className="w-full bg-white text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {hasExactMatch && (
                                <SelectItem value={ingredient.exactMatch.id}>
                                  ✓ Update "{ingredient.exactMatch.name}"
                                  {ingredient.exactMatch.supplier ? ` [${ingredient.exactMatch.supplier}]` : ''} (Exact Match)
                                </SelectItem>
                              )}
                              <SelectItem value="new">Create as new ingredient</SelectItem>
                              {ingredient.fuzzyMatches.map((match) => (
                                <SelectItem key={match.ingredient.id} value={match.ingredient.id}>
                                  Merge with "{match.ingredient.name}"
                                  {match.ingredient.supplier ? ` [${match.ingredient.supplier}]` : ''} (
                                  {Math.round(match.similarity * 100)}% match)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep('preview')}>
                Back to Headers
              </Button>
              <Button
                onClick={handleSaveIngredients}
                disabled={isProcessing || (validationWarnings && validationWarnings.some(w => w.severity === 'error'))}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import All Ingredients
                  </>
                )}
              </Button>
            </div>
            {validationWarnings && validationWarnings.some(w => w.severity === 'error') && (
              <div className="text-sm text-red-600 text-right">
                Cannot import with critical errors. Please fix your CSV and try again.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            <CardTitle className="text-emerald-900">Import Ingredients from CSV</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {progress && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="text-blue-700">{progress}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Upload CSV File</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileUpload}
                accept=".csv"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload a CSV file. Ensure 'category' and 'tier' columns are correctly named and
                mapped.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
              <span className="text-sm text-emerald-600">Start with this template</span>
            </div>
          </div>

          <div className="bg-emerald-50 p-4 rounded-lg">
            <h4 className="font-medium text-emerald-900 mb-2">Template Format:</h4>
            <div className="text-sm text-emerald-700 space-y-1">
              <p><strong>Required columns:</strong> name, category</p>
              <p>
                <strong>Optional columns:</strong> spirit_type, substyle, flavor, region, supplier,
                sku_number, exclusive (TRUE/FALSE), tier, purchase_price, purchase_quantity,
                purchase_unit, case_price, bottles_per_case, abv, description
              </p>
              <p className="mt-2 text-xs text-emerald-600">
                ⚠️ Multiple rows with the same name AND supplier will create ONE ingredient with
                multiple size variants. Make sure 'category' and 'tier' are spelled correctly in
                your CSV.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleParseFile}
              disabled={!selectedFile || isProcessing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
