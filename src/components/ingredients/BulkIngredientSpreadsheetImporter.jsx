import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight, Save, ChevronDown, ImageIcon, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase"; 

// --- ROBUST PARSER ---
const parseCSVLine = (text) => {
  const result = [];
  let curValue = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuote) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') { curValue += '"'; i++; } 
        else { inQuote = false; }
      } else { curValue += char; }
    } else {
      if (char === '"') { inQuote = true; } 
      else if (char === ',') { result.push(curValue.trim()); curValue = ''; } 
      else { curValue += char; }
    }
  }
  result.push(curValue.trim());
  return result;
};

// --- FIELD MAPPING CONFIG ---
const FIELD_CONFIG = [
  { key: 'name', label: 'Name', required: true, aliases: ['name', 'product name', 'item'] },
  { key: 'category', label: 'Category', aliases: ['category', 'type', 'group'] },
  { key: 'spirit_type', label: 'Spirit Type', aliases: ['spirit_type', 'spirit type', 'sub category'] },
  { key: 'supplier', label: 'Supplier', aliases: ['supplier', 'vendor'] },
  { key: 'sku_number', label: 'SKU', aliases: ['sku', 'sku_number', 'id'] },
  { key: 'purchase_price', label: 'Price ($)', aliases: ['purchase_price', 'cost', 'unit cost'] },
  { key: 'purchase_quantity', label: 'Pur. Qty', aliases: ['purchase_quantity', 'qty'] },
  { key: 'purchase_unit', label: 'Pur. Unit', aliases: ['purchase_unit', 'unit'] },
  { key: 'case_price', label: 'Case Price ($)', aliases: ['case_price', 'case cost'] },
  { key: 'bottles_per_case', label: 'Bt/Case', aliases: ['bottles_per_case', 'pack'] },
  { key: 'variant_size', label: 'Size', aliases: ['variant_size', 'size', 'volume'] },
  { key: 'style', label: 'Style', aliases: ['style'] },
  { key: 'substyle', label: 'Sub-Style', aliases: ['substyle'] },
  { key: 'flavor', label: 'Flavor', aliases: ['flavor'] },
  { key: 'region', label: 'Region', aliases: ['region'] },
  { key: 'description', label: 'Description', aliases: ['description', 'notes'] },
  { key: 'abv', label: 'ABV (%)', aliases: ['abv'] },
  { key: 'tier', label: 'Tier', aliases: ['tier'] },
  { key: 'exclusive', label: 'Exclusive?', aliases: ['exclusive'] },
  { key: 'bottle_image_url', label: 'Image URL', aliases: ['bottle_image_url', 'image'] },
];

const parseNumber = (val) => {
    if (!val) return NaN;
    // Remove '$' and ',' before parsing
    const clean = String(val).replace(/[^0-9.-]+/g, '');
    return parseFloat(clean);
};

const formatCurrency = (val) => {
  const num = parseNumber(val);
  return isNaN(num) ? '-' : `$${num.toFixed(2)}`;
};

const normalizeSku = (sku) => String(sku || '').trim().toLowerCase();

export default function BulkIngredientSpreadsheetImporter({ onComplete, onCancel }) {
  const [step, setStep] = useState('upload'); 
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [existingSkus, setExistingSkus] = useState(new Map()); 
  const [isFetchingDB, setIsFetchingDB] = useState(false);
  const [dbLoadError, setDbLoadError] = useState(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch Existing Data (Looping for Scalability >1000 items)
  useEffect(() => {
    const fetchAllExisting = async () => {
      setIsFetchingDB(true);
      const allVariants = [];
      let from = 0;
      const CHUNK = 1000;
      let keepFetching = true;

      try {
        while (keepFetching) {
            // Fetch batch
            const { data, error } = await supabase
                .from('product_variants')
                .select(`
                    sku_number, purchase_price, case_price, bottle_image_url, tier, exclusive, 
                    bottles_per_case, purchase_quantity, purchase_unit,
                    ingredient:ingredient_id ( name, supplier, category, spirit_type )
                `)
                .range(from, from + CHUNK - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allVariants.push(...data);
                from += CHUNK;
                // If we got less than CHUNK, we reached the end
                if (data.length < CHUNK) keepFetching = false;
            } else {
                keepFetching = false;
            }
        }

        // Map for fast lookup
        const map = new Map();
        allVariants.forEach(v => {
           if(v.sku_number) {
               // Merge ingredient fields flat for comparison
               const flat = { ...v, ...(v.ingredient || {}) }; 
               delete flat.ingredient;
               map.set(normalizeSku(v.sku_number), flat);
           }
        });
        setExistingSkus(map);

      } catch (err) {
        console.error("DB Load Error:", err);
        setDbLoadError("Could not load inventory history. Duplicates may not be detected.");
      } finally {
        setIsFetchingDB(false);
      }
    };
    fetchAllExisting();
  }, []);

  // 2. Handle File Parsing
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      const headers = parseCSVLine(lines[0]);
      setRawHeaders(headers);

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const rowObj = {};
          headers.forEach((h, idx) => rowObj[h] = values[idx] || '');
          if (Object.values(rowObj).some(v => v)) rows.push(rowObj);
      }
      setRawRows(rows);

      // Smart Mapping
      const newMap = {};
      FIELD_CONFIG.forEach(field => {
        let match = headers.find(h => h === field.key);
        if (!match) match = headers.find(h => field.aliases.includes(h.toLowerCase()));
        if (!match && !['purchase_price', 'case_price'].includes(field.key)) {
             match = headers.find(h => h.toLowerCase().includes(field.label.toLowerCase()));
        }
        if (match) newMap[field.key] = match;
      });
      setMapping(newMap);
      setStep('map');
      setErrorMsg('');
    } catch (err) {
      setErrorMsg("Error parsing file: " + err.message);
    }
  };

  // 3. Compare & Diff
  const processedData = useMemo(() => {
    return rawRows.map(row => {
      const newRow = {};
      Object.entries(mapping).forEach(([dbKey, csvHeader]) => {
        if (csvHeader) newRow[dbKey] = row[csvHeader];
      });

      if (!newRow.name) return null;

      const rawSku = newRow.sku_number;
      const skuKey = normalizeSku(rawSku);
      
      let status = 'NEW'; 
      const changes = [];

      // Check if this SKU exists in our map
      if (skuKey && existingSkus.has(skuKey)) {
        const existing = existingSkus.get(skuKey);
        status = 'SAME';

        // Comparator
        const checkChange = (field, label, type = 'string') => {
            let newVal = newRow[field];
            let oldVal = existing[field];
            
            if (newVal === undefined || newVal === '') return; // Don't wipe fields with blank CSV

            let isDifferent = false;

            if (type === 'currency' || type === 'number') {
                const n = parseNumber(newVal);
                const o = parseNumber(oldVal);
                if (isNaN(n)) return; 
                // Diff check: Ignore floating point dust
                if (Math.abs(n - (o || 0)) > 0.01) isDifferent = true;
            } else if (type === 'boolean') {
                const n = String(newVal).toLowerCase() === 'true';
                const o = Boolean(oldVal);
                if (n !== o) isDifferent = true;
            } else {
                if (String(newVal).trim() !== String(oldVal || '').trim()) isDifferent = true;
            }

            if (isDifferent) {
                status = 'UPDATE';
                changes.push({
                    field: label,
                    old: oldVal,
                    new: newVal,
                    type
                });
            }
        };

        checkChange('purchase_price', 'Price', 'currency');
        checkChange('case_price', 'Case Price', 'currency');
        checkChange('supplier', 'Supplier');
        checkChange('category', 'Category');
        checkChange('bottle_image_url', 'Image');
        checkChange('tier', 'Tier');
        checkChange('bottles_per_case', 'Bt/Case', 'number');
      }

      return { ...newRow, status, changes };
    }).filter(Boolean); // Remove nulls
  }, [rawRows, mapping, existingSkus]);

  // 4. Batch Upload (100 items per request)
  const handleImport = async () => {
    setStep('processing');
    setProgress(0);
    setStatus('Processing...');

    try {
      const BATCH_SIZE = 100;
      const total = processedData.length;
      let count = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = processedData.slice(i, i + BATCH_SIZE);
        setStatus(`Saving items ${i+1} to ${Math.min(i+BATCH_SIZE, total)}...`);
        
        const { data, error } = await supabase.functions.invoke('process-ingredient-import', {
          body: { rows: batch }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        count += batch.length;
        setProgress(Math.round((count / total) * 100));
      }

      setStatus('Complete!');
      setStep('complete');
      setTimeout(onComplete, 2000);

    } catch (err) {
      console.error(err);
      setStatus('Failed: ' + err.message);
      setTimeout(() => setStep('audit'), 2000); 
    }
  };

  if (step === 'complete') return (
    <Card className="max-w-md mx-auto mt-10 bg-emerald-50 border-emerald-100 p-8 text-center shadow-sm">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-emerald-900">Import Complete</h3>
        <p className="text-emerald-700 mt-2">Inventory has been successfully updated.</p>
    </Card>
  );

  return (
    <Card className="max-w-7xl mx-auto mt-6 shadow-md border-gray-200">
      <CardHeader className="border-b bg-gray-50/50 pb-4">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600"/>
                <CardTitle className="text-lg">Bulk Importer</CardTitle>
            </div>
            {isFetchingDB ? (
                <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-3 py-1 rounded-full animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin"/> Syncing Inventory...
                </div>
            ) : (
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                    <span className={`px-2 py-1 rounded ${step === 'upload' ? 'bg-blue-100 text-blue-700' : ''}`}>1. Upload</span>
                    <ArrowRight className="w-3 h-3"/>
                    <span className={`px-2 py-1 rounded ${step === 'map' ? 'bg-blue-100 text-blue-700' : ''}`}>2. Map</span>
                    <ArrowRight className="w-3 h-3"/>
                    <span className={`px-2 py-1 rounded ${step === 'audit' ? 'bg-blue-100 text-blue-700' : ''}`}>3. Audit</span>
                </div>
            )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {(errorMsg || dbLoadError) && (
            <div className="m-4 p-3 bg-red-50 text-red-700 rounded text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {errorMsg || dbLoadError}
            </div>
        )}

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="text-center py-16 px-6">
             <Label htmlFor="file" className={`cursor-pointer inline-flex flex-col items-center gap-4 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition w-full max-w-lg ${isFetchingDB ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6"/>
                </div>
                <div className="text-center">
                    <span className="text-blue-600 font-semibold text-lg">Click to Upload CSV</span>
                    <p className="text-sm text-gray-500 mt-1">Universal Template Support</p>
                </div>
             </Label>
             <Input id="file" type="file" accept=".csv" className="hidden" onChange={handleFileSelect} disabled={isFetchingDB} />
          </div>
        )}

        {/* STEP 2: MAPPING */}
        {step === 'map' && (
          <div className="flex flex-col h-[600px]">
            <div className="flex-1 overflow-auto p-4">
                <Table>
                    <TableHeader className="bg-gray-50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-[40%]">App Field</TableHead>
                            <TableHead className="w-[10%]"></TableHead>
                            <TableHead className="w-[50%]">Your Column</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {FIELD_CONFIG.map((field) => {
                            const isMapped = !!mapping[field.key];
                            return (
                                <TableRow key={field.key} className={isMapped ? "bg-white" : "bg-red-50/30"}>
                                    <TableCell className="font-medium text-gray-700 py-3">
                                        {field.label}
                                        {field.required && <span className="ml-2 text-[10px] text-red-500 font-bold">*</span>}
                                    </TableCell>
                                    <TableCell className="text-center text-gray-400"><ArrowRight className="w-4 h-4 mx-auto"/></TableCell>
                                    <TableCell>
                                        <Select value={mapping[field.key] || 'skip'} onValueChange={(val) => setMapping(prev => ({...prev, [field.key]: val === 'skip' ? null : val}))}>
                                            <SelectTrigger className={`h-8 text-sm ${isMapped ? "border-gray-200" : "border-red-200 bg-white"}`}><SelectValue placeholder="-- Unmapped --" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="skip" className="text-gray-400 italic">-- Ignore --</SelectItem>
                                                {rawHeaders.map((h, i) => <SelectItem key={`${h}-${i}`} value={h}>{h}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <div className="border-t p-4 bg-gray-50 flex justify-end gap-3">
               <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
               <Button onClick={() => setStep('audit')} className="bg-blue-600 hover:bg-blue-700 px-6">Next: Audit</Button>
            </div>
          </div>
        )}

        {/* STEP 3: AUDIT */}
        {step === 'audit' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-md flex-1 mr-4">
                    <h4 className="font-medium text-blue-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Review & Import</h4>
                    <p className="text-sm text-blue-700 mt-1">Found <strong>{processedData.length}</strong> items to process.</p>
                </div>
                <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700 px-8 h-16 text-lg shadow-lg">
                   <Save className="w-5 h-5 mr-2"/> Import {processedData.length} Items
                </Button>
            </div>

            <div className="border rounded-md bg-white shadow-sm flex flex-col h-[500px]">
                <div className="flex-1 overflow-y-auto">
                    <Table>
                        <TableHeader className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[30%]">Ingredient</TableHead>
                                <TableHead className="w-[15%]">SKU</TableHead>
                                <TableHead className="w-[10%]">Status</TableHead>
                                <TableHead className="w-[45%]">Updates</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {processedData.map((row, i) => (
                                <TableRow key={i} className="hover:bg-gray-50">
                                    <TableCell className="font-medium">
                                        <div className="font-bold text-gray-800">{row.name}</div>
                                        <div className="text-xs text-gray-500">{row.variant_size || '750ml'} • {row.supplier}</div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-gray-500">{row.sku_number || '-'}</TableCell>
                                    <TableCell>
                                        {row.status === 'NEW' && <Badge className="bg-green-100 text-green-700 border-green-200 shadow-none">New</Badge>}
                                        {row.status === 'UPDATE' && <Badge className="bg-amber-100 text-amber-700 border-amber-200 shadow-none">Update</Badge>}
                                        {row.status === 'SAME' && <span className="text-xs text-gray-400">Unchanged</span>}
                                    </TableCell>
                                    <TableCell className="text-sm py-2">
                                        {row.changes.length > 0 ? (
                                            <div className="space-y-1">
                                                {row.changes.map((c, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 text-xs bg-amber-50/50 p-1.5 rounded border border-amber-100/50">
                                                        <span className="font-semibold text-gray-500 min-w-[70px]">{c.field}:</span>
                                                        
                                                        {c.field === 'Image' ? (
                                                            <div className="flex items-center gap-1 text-blue-600">
                                                                <ImageIcon className="w-3 h-3"/> Image URL Updated
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-400 line-through decoration-red-300">
                                                                    {c.type === 'currency' ? formatCurrency(c.old) : (c.old || 'Empty')}
                                                                </span>
                                                                <ArrowRight className="w-3 h-3 text-gray-400"/>
                                                                <span className="font-bold text-emerald-600">
                                                                    {c.type === 'currency' ? formatCurrency(c.new) : c.new}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs">No changes detected</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
            
            <div className="flex justify-start mt-4">
               <Button variant="ghost" onClick={() => setStep('map')} className="text-gray-500">← Back to Mapping</Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
           <div className="text-center py-24 px-10">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6"/>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">{status}</h3>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 max-w-md mx-auto">
                 <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-gray-500">{progress}% Complete</p>
           </div>
        )}
      </CardContent>
    </Card>
  );
}