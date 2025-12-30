import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// FIX: Added Save, CheckCircle2, ArrowRight to imports
import { Upload, X, Loader2, AlertTriangle, Download, FileSpreadsheet, AlertCircle, Save, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase"; 

// --- HELPER LOGIC (From Base44 Code) ---
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

const normalizeName = (name) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ');

export default function BulkIngredientSpreadsheetImporter({ onComplete, onCancel }) {
  const [step, setStep] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Parsing State
  const [parsedRows, setParsedRows] = useState([]);
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  
  // Logic State
  const [allIngredients, setAllIngredients] = useState([]);
  const [allProductVariants, setAllProductVariants] = useState([]);
  const [parsedIngredients, setParsedIngredients] = useState([]);
  const [mergeDecisions, setMergeDecisions] = useState({});
  
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // 1. LOAD INVENTORY (Client-Side for matching)
  useEffect(() => {
    const fetchInventory = async () => {
        setIsProcessing(true);
        try {
            // Fetch Ingredients
            const { data: ings } = await supabase.from('ingredients').select('*');
            setAllIngredients(ings || []);

            // Fetch Variants (Loop for >1000 items)
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
            console.error(err);
            setError("Failed to load inventory for matching.");
        } finally {
            setIsProcessing(false);
        }
    };
    fetchInventory();
  }, []);

  // 2. PARSE CSV
  const handleParseFile = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setError('');
    
    try {
        const text = await selectedFile.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) throw new Error('CSV must have headers and data');

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        setParsedHeaders(headers);

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            // Robust regex split for quoted CSVs
            const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            if (matches.length === 0) continue;
            
            const row = {};
            headers.forEach((h, idx) => {
                let val = matches[idx] || '';
                val = val.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
                row[h] = val;
            });
            rows.push(row);
        }
        setParsedRows(rows);

        // Auto-Map Fields
        const initialMappings = {};
        const expectedFields = [
            'name', 'category', 'spirit_type', 'substyle', 'flavor', 'region', 'supplier', 
            'sku_number', 'exclusive', 'tier', 'purchase_price', 'purchase_quantity', 
            'purchase_unit', 'case_price', 'bottles_per_case', 'abv', 'description'
        ];
        
        expectedFields.forEach(field => {
            const match = headers.find(h => h === field || h.includes(field));
            initialMappings[field] = match || '';
        });
        setColumnMappings(initialMappings);
        setStep('mapping');

    } catch (err) {
        setError("Parse Error: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // 3. ANALYZE & GROUP (The Base44 Logic)
  const handleConfirmMappings = async () => {
    setIsProcessing(true);
    setProgress('Analyzing...');

    try {
        const ingredientGroups = {};

        // Group rows
        parsedRows.forEach(row => {
            const mapRow = {};
            Object.entries(columnMappings).forEach(([field, col]) => {
                if(col && col !== '__unmapped__') mapRow[field] = row[col];
            });

            const name = mapRow.name?.trim();
            if (!name) return;

            const supplier = mapRow.supplier?.trim() || '';
            const key = `${name.toLowerCase()}|${supplier.toLowerCase()}`;

            if (!ingredientGroups[key]) {
                ingredientGroups[key] = {
                    name, supplier,
                    category: mapRow.category || 'Spirit',
                    spirit_type: mapRow.spirit_type,
                    substyle: mapRow.substyle,
                    flavor: mapRow.flavor,
                    region: mapRow.region,
                    tier: mapRow.tier,
                    exclusive: String(mapRow.exclusive).toLowerCase() === 'true',
                    abv: parseFloat(mapRow.abv) || 0,
                    description: mapRow.description,
                    variants: []
                };
            }

            // Size Logic
            let qty = parseFloat(mapRow.purchase_quantity) || 0;
            let unit = (mapRow.purchase_unit || 'ml').toLowerCase();
            let size_ml = qty;
            if (unit === 'l') size_ml = qty * 1000;
            if (unit.includes('oz')) size_ml = qty * 29.57;

            ingredientGroups[key].variants.push({
                sku_number: mapRow.sku_number,
                purchase_price: parseFloat(mapRow.purchase_price) || 0,
                case_price: parseFloat(mapRow.case_price) || 0,
                bottles_per_case: parseFloat(mapRow.bottles_per_case) || 1,
                size_ml: size_ml || 750,
                purchase_quantity: qty,
                purchase_unit: unit
            });
        });

        // Match against DB
        const cleanedIngredients = Object.values(ingredientGroups).map(ing => {
            const normName = normalizeName(ing.name);
            let exactMatch = allIngredients.find(i => normalizeName(i.name) === normName);

            // Calculate Ingredient Changes
            const ingChanges = [];
            if (exactMatch) {
                ['category','tier','spirit_type','supplier'].forEach(f => {
                    const newVal = ing[f];
                    const oldVal = exactMatch[f];
                    if (newVal && String(newVal).trim() !== String(oldVal||'').trim()) {
                        ingChanges.push({ field: f, oldValue: oldVal, newValue: newVal });
                    }
                });
            }

            // Analyze Variants
            const variantAnalysis = ing.variants.map(v => {
                let existingVar = null;
                if (exactMatch) {
                    const existingVars = allProductVariants.filter(ev => ev.ingredient_id === exactMatch.id);
                    if (v.sku_number) {
                        existingVar = existingVars.find(ev => normalizeName(ev.sku_number) === normalizeName(v.sku_number));
                    }
                    if (!existingVar && v.size_ml > 0) {
                        existingVar = existingVars.find(ev => Math.abs(ev.size_ml - v.size_ml) < 5);
                    }
                }

                const changes = [];
                let isNew = !existingVar;

                if (existingVar) {
                    const check = (field, newVal, oldVal) => {
                        if (newVal !== undefined && Math.abs(parseFloat(newVal) - parseFloat(oldVal || 0)) > 0.01) {
                            changes.push({ field, oldValue: oldVal, newValue: newVal });
                        }
                    };
                    check('purchase_price', v.purchase_price, existingVar.purchase_price);
                    check('case_price', v.case_price, existingVar.case_price);
                }

                return { ...v, isNew, existingId: existingVar?.id, changes };
            });

            // Fuzzy Matches
            const fuzzyMatches = !exactMatch ? allIngredients.map(ex => ({
                ingredient: ex,
                similarity: calculateSimilarity(ing.name, ex.name)
            })).filter(m => m.similarity > 0.6).sort((a,b) => b.similarity - a.similarity).slice(0,3) : [];

            return { ...ing, exactMatch, fuzzyMatches, ingredientChanges: ingChanges, variantAnalysis };
        });

        // Set Default Decisions
        const initialDecisions = {};
        cleanedIngredients.forEach((ing, i) => {
            if (ing.exactMatch) initialDecisions[i] = ing.exactMatch.id;
            else if (ing.fuzzyMatches.length > 0) initialDecisions[i] = 'new'; 
        });
        setMergeDecisions(initialDecisions);
        setParsedIngredients(cleanedIngredients);
        setStep('confirm');

    } catch (err) {
        setError(err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // 4. SAVE (Optimized Loop)
  const handleSaveIngredients = async () => {
    setIsProcessing(true);
    let count = 0;

    for (let i=0; i<parsedIngredients.length; i++) {
        const ingData = parsedIngredients[i];
        const decision = mergeDecisions[i];
        let targetId = decision && decision !== 'new' ? decision : null;

        try {
            // 1. Create/Update Ingredient
            const ingPayload = {
                name: ingData.name, category: ingData.category, supplier: ingData.supplier,
                spirit_type: ingData.spirit_type, substyle: ingData.substyle,
                flavor: ingData.flavor, region: ingData.region, abv: ingData.abv,
                description: ingData.description, tier: ingData.tier,
                exclusive: ingData.exclusive
            };

            // Remove empty fields
            Object.keys(ingPayload).forEach(k => !ingPayload[k] && delete ingPayload[k]);

            if (targetId) {
                if (ingData.ingredientChanges.length > 0) {
                    await supabase.from('ingredients').update(ingPayload).eq('id', targetId);
                }
            } else {
                const { data: newIng } = await supabase.from('ingredients').insert(ingPayload).select().single();
                targetId = newIng.id;
            }

            // 2. Process Variants
            for (const v of ingData.variantAnalysis) {
                const varPayload = {
                    ingredient_id: targetId,
                    sku_number: v.sku_number,
                    purchase_price: v.purchase_price,
                    case_price: v.case_price,
                    bottles_per_case: v.bottles_per_case,
                    size_ml: v.size_ml,
                    purchase_quantity: v.purchase_quantity,
                    purchase_unit: v.purchase_unit
                };

                if (v.isNew) {
                    await supabase.from('product_variants').insert(varPayload);
                } else if (v.changes.length > 0) {
                    await supabase.from('product_variants').update(varPayload).eq('id', v.existingId);
                }
            }
            count++;
            setProgress(`Saving ${count} / ${parsedIngredients.length}...`);

        } catch (err) {
            console.error("Save Failed:", err);
        }
    }
    
    onComplete();
  };

  // --- RENDER (Matching the Clean UI) ---
  if (step === 'upload') return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                <CardTitle className="text-emerald-900">Import Ingredients</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4"/></Button>
        </div>
      </CardHeader>
      <CardContent>
        {isProcessing ? (
            <div className="flex flex-col items-center py-10 text-blue-600">
                <Loader2 className="w-8 h-8 animate-spin mb-2"/>
                <span>{progress || 'Processing...'}</span>
            </div>
        ) : (
            <div className="space-y-6">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition">
                    <Input type="file" accept=".csv" onChange={(e) => setSelectedFile(e.target.files[0])} className="hidden" id="file-upload"/>
                    <Label htmlFor="file-upload" className="cursor-pointer block">
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2"/>
                        <span className="text-blue-600 font-medium">Click to upload CSV</span>
                    </Label>
                    {selectedFile && <div className="mt-2 text-sm text-emerald-600 font-medium">{selectedFile.name}</div>}
                </div>
                
                {error && <div className="bg-red-50 text-red-700 p-3 rounded text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{error}</div>}

                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleParseFile} disabled={!selectedFile} className="bg-emerald-600 hover:bg-emerald-700">Continue</Button>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );

  if (step === 'mapping') return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-emerald-900">Map CSV Columns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800">
                Match your CSV columns below. Rows with the same <strong>Name</strong> and <strong>Supplier</strong> will be grouped.
            </div>
            
            <div className="grid grid-cols-2 gap-4 max-h-[500px] overflow-y-auto p-2">
                {Object.keys(columnMappings).map(field => (
                    <div key={field} className="flex flex-col gap-1">
                        <Label className="text-xs font-medium uppercase text-gray-500">{field.replace('_',' ')}</Label>
                        <Select value={columnMappings[field]} onValueChange={v => setColumnMappings({...columnMappings, [field]: v})}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Select Column"/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__unmapped__">-- Ignore --</SelectItem>
                                {parsedHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                <Button onClick={handleConfirmMappings} className="bg-emerald-600 hover:bg-emerald-700">
                    {isProcessing ? <Loader2 className="animate-spin"/> : 'Analyze Data'}
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );

  // STEP 3: CONFIRMATION (The Clean UI you liked)
  if (step === 'confirm') return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm max-w-5xl mx-auto">
      <CardHeader>
        <CardTitle className="text-emerald-900">Review & Import</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            <div className="max-h-[500px] overflow-y-auto space-y-2 p-2 bg-gray-50/50 rounded-lg">
                {parsedIngredients.map((ing, i) => {
                    const hasExact = !!ing.exactMatch;
                    const hasFuzzy = ing.fuzzyMatches.length > 0;
                    
                    return (
                        <div key={i} className={`p-3 rounded border ${hasExact ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                            {/* Header */}
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="font-bold text-emerald-900 block">{ing.name}</span>
                                    <span className="text-xs text-gray-500">
                                        {ing.category} • {ing.supplier || 'No Supplier'} • {ing.variants.length} Variants
                                    </span>
                                </div>
                                
                                {/* Match Logic */}
                                <div className="w-64">
                                    {(hasExact || hasFuzzy) && (
                                        <Select 
                                            value={mergeDecisions[i] || 'new'} 
                                            onValueChange={v => setMergeDecisions({...mergeDecisions, [i]: v})}
                                        >
                                            <SelectTrigger className="h-8 text-xs bg-white">
                                                <SelectValue/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {hasExact && <SelectItem value={ing.exactMatch.id}>✓ Merge w/ Existing</SelectItem>}
                                                <SelectItem value="new">Create New</SelectItem>
                                                {ing.fuzzyMatches.map(m => (
                                                    <SelectItem key={m.ingredient.id} value={m.ingredient.id}>Merge w/ "{m.ingredient.name}"</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {!hasExact && !hasFuzzy && <span className="text-xs text-green-600 font-medium px-2">New Ingredient</span>}
                                </div>
                            </div>

                            {/* Ingredient Updates */}
                            {ing.ingredientChanges.length > 0 && mergeDecisions[i] !== 'new' && (
                                <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                    <span className="font-bold text-yellow-800">Field Updates: </span>
                                    {ing.ingredientChanges.map((c, idx) => (
                                        <span key={idx} className="mr-3">
                                            {c.field}: <span className="line-through text-red-400">{c.oldValue||'--'}</span> → <span className="text-green-600 font-bold">{c.newValue}</span>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Variant Updates */}
                            <div className="space-y-1">
                                {ing.variantAnalysis.map((v, idx) => (
                                    <div key={idx} className={`text-xs p-2 rounded flex justify-between items-center ${v.isNew ? 'bg-green-50 border border-green-100' : 'bg-gray-50'}`}>
                                        <span className="font-medium text-gray-700">
                                            {v.size_ml}ml • {v.sku_number || 'No SKU'}
                                        </span>
                                        
                                        {v.isNew ? (
                                            <span className="text-green-700 font-bold">+ New Variant</span>
                                        ) : v.changes.length > 0 ? (
                                            <div className="flex gap-3">
                                                {v.changes.map((c, ci) => (
                                                    <div key={ci} className="bg-white px-1 rounded border">
                                                        <span className="text-gray-500 mr-1">{c.field}:</span>
                                                        <span className="line-through text-red-300">{c.oldValue}</span>
                                                        <span className="text-gray-400 mx-1">→</span>
                                                        <span className="text-green-600 font-bold">{c.newValue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">Unchanged</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
                <Button onClick={handleSaveIngredients} className="bg-emerald-600 hover:bg-emerald-700 h-12 px-8">
                    {isProcessing ? <><Loader2 className="animate-spin mr-2"/> {progress}</> : <><Save className="mr-2 w-4 h-4"/> Import All</>}
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}