import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, AlertTriangle, Download, FileSpreadsheet, AlertCircle, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// SWAP: Use Supabase instead of Base44
import { supabase } from "@/lib/supabase";

// --- ORIGINAL HELPER LOGIC ---
const calculateSimilarity = (str1, str2) => {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();
  if (s1 === s2) return 1;
  const shorter = s1.length < s2.length ? s1 : s2;
  const longer = s1.length >= s2.length ? s1 : s2;
  if (longer.startsWith(shorter)) return 0.95;
  if (longer.includes(shorter) && shorter.length >= 4) return 0.85;
  return 0;
};

// Normalize name for matching
const normalizeName = (name) => {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
};

export default function BulkIngredientSpreadsheetImporter({ onComplete, onCancel }) {
  const [step, setStep] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Data State
  const [parsedIngredients, setParsedIngredients] = useState([]);
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [mergeDecisions, setMergeDecisions] = useState({});
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  
  // Inventory State (Fetched from Supabase)
  const [allIngredients, setAllIngredients] = useState([]);
  const [allProductVariants, setAllProductVariants] = useState([]);

  // 1. FETCH DATA (Replaces Base44 List)
  useEffect(() => {
    const fetchInventory = async () => {
        try {
            // Fetch Ingredients
            const { data: ings } = await supabase.from('ingredients').select('*');
            setAllIngredients(ings || []);

            // Fetch Variants (Loop to handle 3,000+ items limit)
            let allVars = [];
            let from = 0;
            const size = 1000;
            let more = true;
            while(more) {
                const { data } = await supabase.from('product_variants').select('*').range(from, from + size - 1);
                if (data && data.length > 0) {
                    allVars = [...allVars, ...data];
                    from += size;
                    if (data.length < size) more = false;
                } else {
                    more = false;
                }
            }
            setAllProductVariants(allVars);
        } catch (err) {
            console.error("Inventory Load Error:", err);
        }
    };
    fetchInventory();
  }, []);

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
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV file must contain headers and data');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        // Robust regex for CSV parsing (handles commas inside quotes)
        const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        if (matches.length === 0) continue;

        const row = {};
        headers.forEach((header, index) => {
            let val = matches[index] || '';
            val = val.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
            row[header] = val;
        });
        rows.push(row);
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
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must contain headers and at least one data row');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g,'')).filter(h => h !== '');
      setParsedHeaders(headers);
      const rows = parseCSV(text);

      if (rows.length === 0) {
        throw new Error('No valid data rows found in CSV');
      }

      setParsedRows(rows);
      
      const expectedFields = [
        'name', 'category', 'spirit_type', 'substyle', 'flavor', 'region', 'supplier', 'sku_number', 'exclusive', 'tier',
        'purchase_price', 'purchase_quantity', 'purchase_unit', 'case_price', 'bottles_per_case', 'abv', 'description', 'bottle_image_url'
      ];

      const initialMappings = {};
      expectedFields.forEach(field => {
        // Fuzzy match header names
        const match = headers.find(h => h === field || h.includes(field));
        initialMappings[field] = match || '';
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
    setProgress('Analyzing...'); // Using local state instead of re-fetching
    
    try {
      const existingVariants = allProductVariants; // Already fetched
      const rows = parsedRows;
      
      // Group rows by ingredient name + supplier
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
        if (!name) return;
        
        const groupKey = `${name.toLowerCase()}|${supplier.toLowerCase()}`;
        
        if (!ingredientGroups[groupKey]) {
          ingredientGroups[groupKey] = {
            name: name,
            category: mappedRow.category || 'Spirit',
            spirit_type: mappedRow.spirit_type || null,
            substyle: mappedRow.substyle || null,
            flavor: mappedRow.flavor || null,
            region: mappedRow.region || null,
            supplier: supplier || null,
            exclusive: String(mappedRow.exclusive).toLowerCase() === 'true',
            tier: mappedRow.tier || null,
            abv: parseFloat(mappedRow.abv) || 0,
            description: mappedRow.description || null,
            variants: []
          };
        }
        
        // Handle Size Logic
        const sizeQty = parseFloat(mappedRow.purchase_quantity) || 0;
        const sizeUnit = (mappedRow.purchase_unit || 'ml').toLowerCase();
        let size_ml = sizeQty;
        if (sizeUnit === 'l') size_ml = sizeQty * 1000;
        else if (sizeUnit.includes('oz')) size_ml = sizeQty * 29.5735;
        else if (sizeUnit.includes('gal')) size_ml = sizeQty * 3785.41;
        
        const variantData = {
          sku_number: mappedRow.sku_number || '',
          purchase_price: parseFloat(mappedRow.purchase_price) || 0,
          size_ml: size_ml || 750, // Default to 750 if calc fails
          purchase_quantity: sizeQty,
          purchase_unit: sizeUnit,
          case_price: mappedRow.case_price ? parseFloat(mappedRow.case_price) : null,
          bottles_per_case: mappedRow.bottles_per_case ? parseFloat(mappedRow.bottles_per_case) : null,
          bottle_image_url: mappedRow.bottle_image_url
        };
        
        ingredientGroups[groupKey].variants.push(variantData);
      });

      // Helper to compare fields
      const getFieldChanges = (newData, existingData, fieldsToCompare) => {
        const changes = [];
        for (const field of fieldsToCompare) {
          const newVal = newData[field];
          const existingVal = existingData[field];
          // Skip if new is empty
          if (newVal === null || newVal === undefined || newVal === '') continue;
          // Skip if same
          if (String(newVal).toLowerCase().trim() === String(existingVal || '').toLowerCase().trim()) continue;
          
          changes.push({ field, oldValue: existingVal, newValue: newVal });
        }
        return changes;
      };

      const ingredientFieldsToCompare = ['category', 'spirit_type', 'substyle', 'flavor', 'region', 'supplier', 'tier', 'abv', 'description', 'exclusive'];
      const variantFieldsToCompare = ['purchase_price', 'purchase_quantity', 'purchase_unit', 'case_price', 'bottles_per_case', 'sku_number', 'bottle_image_url'];

      // MATCHING LOGIC
      const cleanedIngredients = Object.values(ingredientGroups).map(ingredientData => {
        const normalizedNewName = normalizeName(ingredientData.name);

        // 1. Exact Match by Name
        let exactMatch = allIngredients.find(existing => normalizeName(existing.name) === normalizedNewName);

        // 2. Fallback: Match by SKU
        if (!exactMatch && ingredientData.variants.length > 0) {
          for (const variant of ingredientData.variants) {
            if (variant.sku_number) {
              const normalizedSku = normalizeName(variant.sku_number);
              const matchingVariant = existingVariants.find(ev => normalizeName(ev.sku_number) === normalizedSku);
              if (matchingVariant && matchingVariant.ingredient_id) {
                exactMatch = allIngredients.find(ing => ing.id === matchingVariant.ingredient_id);
                if (exactMatch) break;
              }
            }
          }
        }

        let ingredientChanges = [];
        if (exactMatch) {
          ingredientChanges = getFieldChanges(ingredientData, exactMatch, ingredientFieldsToCompare);
        }

        const variantAnalysis = ingredientData.variants.map(variant => {
          const normalizedNewSku = normalizeName(variant.sku_number);
          let matchingExistingVariant = null;
          
          if (exactMatch) {
            const existingVariantsForIng = existingVariants.filter(v => v.ingredient_id === exactMatch.id);
            if (normalizedNewSku) {
              matchingExistingVariant = existingVariantsForIng.find(ev => normalizeName(ev.sku_number) === normalizedNewSku);
            }
            // Fallback: Match by Size if no SKU
            if (!matchingExistingVariant && variant.size_ml > 0) {
              matchingExistingVariant = existingVariantsForIng.find(ev => Math.abs((parseFloat(ev.size_ml) || 0) - variant.size_ml) < 5);
            }
          }

          if (matchingExistingVariant) {
            const variantChanges = getFieldChanges(variant, matchingExistingVariant, variantFieldsToCompare);
            return { ...variant, isNew: false, existingVariantId: matchingExistingVariant.id, changes: variantChanges };
          } else {
            return { ...variant, isNew: true, existingVariantId: null, changes: [] };
          }
        });

        // Fuzzy Matches
        const fuzzyMatches = allIngredients
          .filter(existing => !exactMatch || existing.id !== exactMatch.id)
          .map(existing => ({ ingredient: existing, similarity: calculateSimilarity(ingredientData.name, existing.name) }))
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

      // Initial Decisions
      const initialDecisions = {};
      cleanedIngredients.forEach((ing, index) => {
        if (ing.exactMatch) initialDecisions[index] = ing.exactMatch.id;
        else if (ing.fuzzyMatches.length > 0) initialDecisions[index] = 'new';
      });
      setMergeDecisions(initialDecisions);

      setParsedIngredients(cleanedIngredients);
      setStep('confirm');
    } catch (error) {
      console.error("Error processing:", error);
      setError(`Failed to process ingredients: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // --- SAVE LOGIC (SWAPPED TO SUPABASE) ---
  const handleSaveIngredients = async () => {
    setIsProcessing(true);
    setError('');
    
    let successCount = 0;
    let skippedCount = 0;
    const smallDelayMs = 20;

    for (let i = 0; i < parsedIngredients.length; i++) {
      const ingredientData = parsedIngredients[i];
      const { ingredientChanges = [], variantAnalysis = [], variants, exactMatch, ...rawDataToSave } = ingredientData;
      
      const variantsToProcess = (variantAnalysis || []).filter(v => v.isNew || (v.changes && v.changes.length > 0));

      if (ingredientChanges.length === 0 && variantsToProcess.length === 0 && mergeDecisions[i] !== 'new') {
        skippedCount++;
        continue;
      }

      setProgress(`Saving ingredient ${i + 1} of ${parsedIngredients.length}: ${ingredientData.name}`);

      try {
        let targetIngredientId = null;
        const decision = mergeDecisions[i];

        if (decision && decision !== 'new') {
          targetIngredientId = decision;
        }

        // Clean Payload
        const dataToSave = {};
        for (const [key, value] of Object.entries(rawDataToSave)) {
          if (value !== null && value !== undefined && value !== '') dataToSave[key] = value;
        }
        delete dataToSave.fuzzyMatches; // cleanup

        // 1. Upsert Ingredient
        if (targetIngredientId) {
          if (ingredientChanges.length > 0) {
            // SUPABASE UPDATE
            await supabase.from('ingredients').update(dataToSave).eq('id', targetIngredientId);
          }
        } else {
          // SUPABASE CREATE
          const { data: newIng } = await supabase.from('ingredients').insert(dataToSave).select().single();
          targetIngredientId = newIng.id;
        }
        
        // 2. Upsert Variants
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
            bottle_image_url: v.bottle_image_url
          };

          if (v.isNew) {
            // SUPABASE INSERT
            await supabase.from('product_variants').insert(variantPayload);
          } else if (v.existingVariantId) {
            // SUPABASE UPDATE
            await supabase.from('product_variants').update(variantPayload).eq('id', v.existingVariantId);
          }
        }

        successCount++;
        await delay(smallDelayMs); 

      } catch (error) {
        console.error(`Failed to save ${ingredientData.name}:`, error);
      }
    }

    setProgress(`Import complete! Updated ${successCount}, Skipped ${skippedCount}.`);
    setTimeout(() => onComplete(), 1500);
    setIsProcessing(false);
  };

  const downloadTemplate = () => {
    const templateData = `name,category,spirit_type,substyle,flavor,region,supplier,sku_number,exclusive,tier,purchase_price,purchase_quantity,purchase_unit,use_case_pricing,case_price,bottles_per_case,abv,description,bottle_image_url\nHendrick's Gin,spirit,Gin,,,Scotland,Hendrick's,HEN-750,TRUE,premium,35.99,750,ml,FALSE,215.94,6,44,"Distinctive gin with cucumber",`;
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

  // --- RENDER (Original UI) ---
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
      { key: 'bottle_image_url', label: 'Image URL', required: false },
    ];
    const requiredMapped = ingredientFields.filter(f => f.required).every(f => columnMappings[f.key] && columnMappings[f.key] !== '');
    
    return (
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-emerald-900">Map CSV Columns</CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm text-blue-700"><strong>Match your columns.</strong> {parsedHeaders.length} columns detected.</p>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {ingredientFields.map(field => (
                <div key={field.key} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
                  </div>
                  <div className="flex-1">
                    <Select value={columnMappings[field] || ''} onValueChange={(value) => setColumnMappings(prev => ({ ...prev, [field.key]: value }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select column..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unmapped__">— Not Mapped —</SelectItem>
                        {parsedHeaders.map(header => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={() => setStep('preview')} disabled={!requiredMapped} className="bg-emerald-600 hover:bg-emerald-700">Preview Mappings</Button>
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
        if (csvColumn && csvColumn !== '__unmapped__' && row[csvColumn] !== undefined) mappedRow[field] = row[csvColumn];
      });
      return mappedRow;
    });
    return (
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-emerald-900">Preview Mapped Data</CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2"><AlertCircle className="w-5 h-5" />Preview: First 3 Rows</h4>
              <div className="space-y-3">
                {previewRows.map((row, idx) => (
                  <div key={idx} className="bg-white p-3 rounded border border-blue-300">
                    <div className="font-semibold text-gray-900 mb-2 text-sm">{row.name || '(Unnamed)'} - {row.supplier}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-gray-600">Category:</span><span className="font-medium">{row.category}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Price:</span><span className="font-medium">${row.purchase_price}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Size:</span><span className="font-medium">{row.purchase_quantity} {row.purchase_unit}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
              <Button onClick={handleConfirmMappings} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
                {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Processing...</> : 'Continue to Duplicate Check'}
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
            <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {progress && <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg"><span className="text-green-700">{progress}</span></div>}
            
            <div>
              <h3 className="text-lg font-semibold text-emerald-900 mb-4">Ready to import {parsedIngredients.length} unique ingredients</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto p-4 bg-emerald-50 rounded-lg">
                {parsedIngredients.map((ingredient, index) => {
                  const hasExactMatch = ingredient.exactMatch != null;
                  const hasFuzzyMatches = ingredient.fuzzyMatches && ingredient.fuzzyMatches.length > 0;
                  const currentDecision = mergeDecisions[index];
                  const willMerge = currentDecision && currentDecision !== 'new';
                  
                  // Summary Logic
                  const newVariantsCount = ingredient.variantAnalysis?.filter(v => v.isNew).length || 0;
                  const updatedVariantsCount = ingredient.variantAnalysis?.filter(v => !v.isNew && v.changes.length > 0).length || 0;
                  const unchangedVariantsCount = ingredient.variantAnalysis?.filter(v => !v.isNew && v.changes.length === 0).length || 0;
                  
                  const getSummaryText = () => {
                    if (!willMerge) return <span className="text-green-600 font-medium">New Ingredient</span>;
                    const parts = [];
                    if (ingredient.ingredientChanges?.length > 0) parts.push(`Update ${ingredient.ingredientChanges.length} fields`);
                    if (newVariantsCount > 0) parts.push(`Add ${newVariantsCount} variants`);
                    if (updatedVariantsCount > 0) parts.push(`Update ${updatedVariantsCount} variants`);
                    if (unchangedVariantsCount > 0 && parts.length === 0) parts.push(`${unchangedVariantsCount} unchanged`);
                    if (parts.length === 0) return <span className="text-gray-500 font-medium">No changes</span>;
                    return <span className="text-blue-600 font-medium">{parts.join(' • ')}</span>;
                  };

                  return (
                    <div key={index} className={`p-3 rounded border ${hasExactMatch ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <span className="font-medium text-emerald-900">{ingredient.name}</span>
                          <div className="text-sm text-emerald-700">{ingredient.category} • {ingredient.supplier || 'No supplier'}</div>
                        </div>
                        <div className="text-sm">{getSummaryText()}</div>
                      </div>

                      {/* Ingredient Changes */}
                      {willMerge && ingredient.ingredientChanges?.length > 0 && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          <p className="font-medium text-yellow-800 mb-1">Ingredient changes:</p>
                          <div className="space-y-1">
                            {ingredient.ingredientChanges.map((change, idx) => (
                              <div key={idx} className="flex gap-2">
                                <span className="text-gray-600 capitalize">{change.field}:</span>
                                <span className="text-red-600 line-through">{change.oldValue || '(empty)'}</span>
                                <span className="text-gray-400">→</span>
                                <span className="text-green-700 font-medium">{change.newValue || '(empty)'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Variant Changes */}
                      {willMerge && ingredient.variantAnalysis?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {ingredient.variantAnalysis.map((variant, vIdx) => (
                            <div key={vIdx} className={`p-2 rounded text-xs ${variant.isNew ? 'bg-green-50' : variant.changes.length > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{variant.size_ml}ml</span>
                                {variant.sku_number && <span className="text-gray-500">SKU: {variant.sku_number}</span>}
                                {variant.isNew ? <span className="text-green-700 font-medium ml-auto">+ New</span> : 
                                 variant.changes.length > 0 ? <span className="text-yellow-700 font-medium ml-auto">Updating</span> : 
                                 <span className="text-gray-500 ml-auto">No changes</span>}
                              </div>
                              {!variant.isNew && variant.changes.map((change, cIdx) => (
                                <div key={cIdx} className="pl-2 flex gap-2 text-gray-600">
                                    <span>{change.field}:</span>
                                    <span className="text-red-600 line-through">{change.oldValue}</span>→<span className="text-green-700">{change.newValue}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Merge Selector */}
                      {(hasExactMatch || hasFuzzyMatches) && (
                        <div className={`mt-2 p-2 rounded ${hasExactMatch ? 'bg-blue-100' : 'bg-amber-50'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className={`w-4 h-4 ${hasExactMatch?'text-blue-600':'text-amber-600'}`}/>
                            <span className="text-sm font-medium">{hasExactMatch ? 'Exact Match Found' : 'Similar Found'}</span>
                          </div>
                          <Select value={currentDecision || (hasExactMatch ? ingredient.exactMatch.id : 'new')} onValueChange={(v) => setMergeDecisions(prev => ({ ...prev, [index]: v }))}>
                            <SelectTrigger className="w-full bg-white text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {hasExactMatch && <SelectItem value={ingredient.exactMatch.id}>Update "{ingredient.exactMatch.name}"</SelectItem>}
                              <SelectItem value="new">Create New</SelectItem>
                              {ingredient.fuzzyMatches.map(m => <SelectItem key={m.ingredient.id} value={m.ingredient.id}>Merge with "{m.ingredient.name}"</SelectItem>)}
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
              <Button variant="outline" onClick={() => setStep('preview')}>Back</Button>
              <Button onClick={handleSaveIngredients} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
                {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Importing...</> : <><Save className="w-4 h-4 mr-2"/> Import All</>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /><CardTitle className="text-emerald-900">Import Ingredients</CardTitle></div>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {error && <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"><AlertTriangle className="w-5 h-5"/>{error}</div>}
          {progress && <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700"><Loader2 className="w-5 h-5 animate-spin"/>{progress}</div>}
          
          <div className="space-y-4">
            <div>
              <Label>Upload CSV File</Label>
              <Input type="file" onChange={handleFileUpload} accept=".csv" className="mt-2" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onComplete}><Download className="w-4 h-4 mr-2"/> Download Template</Button>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={handleParseFile} disabled={!selectedFile || isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
              {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Processing...</> : <><Upload className="w-4 h-4 mr-2"/> Import CSV</>}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}