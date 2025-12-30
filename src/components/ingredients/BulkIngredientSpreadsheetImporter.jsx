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

// --- PARSER ---
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

// --- CONFIG ---
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
  const [isFetchingDB, setIsFetchingDB] = useState(true);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch ALL Data (Paginated to bypass 1000 row limit)
  useEffect(() => {
    const fetchAllExisting = async () => {
      setIsFetchingDB(true);
      const allVariants = [];
      let from = 0;
      const step = 1000;
      let more = true;

      try {
        while (more) {
            const { data, error } = await supabase
                .from('product_variants')
                .select(`
                    sku_number, purchase_price, case_price, bottle_image_url, tier, exclusive, 
                    bottles_per_case, purchase_quantity, purchase_unit,
                    ingredient:ingredient_id ( name, supplier, category, spirit_type, style, substyle, flavor, region, description, abv )
                `)
                .range(from, from + step - 1);

            if (error) throw error;
            if (data.length > 0) {
                allVariants.push(...data);
                from += step;
                if (data.length < step) more = false; // End of list
            } else {
                more = false;
            }
        }

        const map = new Map();
        allVariants.forEach(v => {
           if(v.sku_number) {
               const flat = { ...v, ...(v.ingredient || {}) }; 
               delete flat.ingredient;
               map.set(normalizeSku(v.sku_number), flat);
           }
        });
        setExistingSkus(map);
      } catch (err) {
        console.error("DB Fetch Error:", err);
        setErrorMsg("Failed to load existing inventory. Duplicates may not be detected.");
      } finally {
        setIsFetchingDB(false);
      }
    };
    fetchAllExisting();
  }, []);

  // 2. Handle File
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

      // Auto-Map
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

  // 3. Transform & Diff
  const groupedData = useMemo(() => {
    const groups = {};

    rawRows.forEach(row => {
      const newRow = {};
      Object.entries(mapping).forEach(([dbKey, csvHeader]) => {
        if (csvHeader) newRow[dbKey] = row[csvHeader];
      });

      if (!newRow.name) return;
      const nameKey = newRow.name.toLowerCase().trim();
      
      if (!groups[nameKey]) {
        groups[nameKey] = {
          name: newRow.name,
          category: newRow.category,
          supplier: newRow.supplier,
          variants: []
        };
      }

      const rawSku = newRow.sku_number;
      const skuKey = normalizeSku(rawSku);
      
      let changeType = 'NEW'; 
      const changes = [];

      // Only check existing if we have SKUs loaded
      if (skuKey && existingSkus.size > 0 && existingSkus.has(skuKey)) {
        const existing = existingSkus.get(skuKey);
        changeType = 'SAME';

        const checkChange = (field, label, type = 'string') => {
            let newVal = newRow[field];
            let oldVal = existing[field];
            
            if (newVal === undefined || newVal === '') return;

            let isDifferent = false;

            if (type === 'currency' || type === 'number') {
                const n = parseNumber(newVal);
                const o = parseNumber(oldVal);
                if (isNaN(n)) return; 
                // Ignore tiny float differences
                if (Math.abs(n - (o || 0)) > 0.01) isDifferent = true;
            } else if (type === 'boolean') {
                const n = String(newVal).toLowerCase() === 'true';
                const o = Boolean(oldVal);
                if (n !== o) isDifferent = true;
            } else {
                if (String(newVal).trim() !== String(oldVal || '').trim()) isDifferent = true;
            }

            if (isDifferent) {
                changeType = 'UPDATE';
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
        checkChange('exclusive', 'Exclusive', 'boolean');
      }

      groups[nameKey].variants.push({ ...newRow, changeType, changes });
    });

    return Object.values(groups);
  }, [rawRows, mapping, existingSkus]);

  // 4. Batch Upload
  const handleImport = async () => {
    setStep('processing');
    setProgress(0);
    setStatus('Starting import...');

    try {
      const flatRows = [];
      groupedData.forEach(group => {
         group.variants.forEach(v => {
            flatRows.push({ ...v, name: group.name, category: group.category, supplier: group.supplier });
         });
      });

      const BATCH_SIZE = 100;
      const total = flatRows.length;
      let processed = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = flatRows.slice(i, i + BATCH_SIZE);
        setStatus(`Importing items ${i+1} - ${Math.min(i+BATCH_SIZE, total)}...`);
        
        const { data, error } = await supabase.functions.invoke('process-ingredient-import', {
          body: { rows: batch }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        processed += batch.length;
        setProgress(Math.round((processed / total) * 100));
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
        <p className="text-emerald-700 mt-2">Inventory updated successfully.</p>
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
                    <RefreshCw className="w-3 h-3 animate-spin"/> Loading Database...
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
        {errorMsg && (
            <div className="m-4 p-3 bg-red-50 text-red-700 rounded text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {errorMsg}
            </div>
        )}

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="text-center py-16 px-6">
             {isFetchingDB && (
                 <div className="mb-4 text-sm text-gray-500 flex justify-center items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin"/> Syncing existing inventory... please wait.
                 </div>
             )}
             <Label htmlFor="file" className={`cursor-pointer inline-flex flex-col items-center gap-4 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition w-full max-w-lg ${isFetchingDB ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6"/>
                </div>
                <div className="text-center">
                    <span className="text-blue-600 font-semibold text-lg">Click to Upload CSV</span>
                    <p className="text-sm text-gray-500 mt-1">Ready for 3,000+ Items</p>
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
               <Button onClick={() => setStep('audit')} className="bg-blue-600 hover:bg-blue-700 px-6">Next: Review Data</Button>
            </div>
          </div>
        )}

        {/* STEP 3: AUDIT */}
        {step === 'audit' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-md flex-1 mr-4">
                    <h4 className="font-medium text-blue-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Review & Import</h4>
                    <p className="text-sm text-blue-700 mt-1">Found <strong>{groupedData.length}</strong> items.</p>
                </div>
                <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700 px-8 h-16 text-lg shadow-lg">
                   <Save className="w-5 h-5 mr-2"/> Import Data
                </Button>
            </div>

            <div className="border rounded-md bg-white shadow-sm flex flex-col h-[500px]">
                <div className="flex-1 overflow-y-auto">
                    <Table>
                        <TableHeader className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[30%] pl-4">Ingredient / Size</TableHead>
                                <TableHead className="w-[15%]">SKU</TableHead>
                                <TableHead className="w-[10%]">Status</TableHead>
                                <TableHead className="w-[45%]">Updates Detected</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {groupedData.map((group, i) => (
                                <React.Fragment key={i}>
                                    <TableRow className="bg-gray-50 border-t border-gray-200">
                                        <TableCell className="font-bold text-gray-800 py-3 pl-4 flex items-center gap-2">
                                            <ChevronDown className="w-4 h-4 text-gray-400"/> {group.name}
                                            <Badge variant="outline" className="bg-white text-gray-500 font-normal ml-2">{group.category}</Badge>
                                        </TableCell>
                                        <TableCell colSpan={3} className="text-xs text-gray-400 text-right pr-6 italic">{group.variants.length} variant(s)</TableCell>
                                    </TableRow>

                                    {group.variants.map((v, idx) => (
                                        <TableRow key={`${i}-${idx}`} className="hover:bg-blue-50/50">
                                            <TableCell className="pl-12 text-sm text-gray-600 border-l-4 border-transparent hover:border-blue-400">
                                                {v.variant_size || '750ml'} <span className="text-gray-400 mx-2">•</span> {v.supplier || 'No Supplier'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-gray-500">{v.sku_number || '-'}</TableCell>
                                            <TableCell>
                                                {v.changeType === 'NEW' && <Badge className="bg-green-100 text-green-700 border-green-200">New</Badge>}
                                                {v.changeType === 'UPDATE' && <Badge className="bg-orange-100 text-orange-700 border-orange-200">Update</Badge>}
                                                {v.changeType === 'SAME' && <span className="text-xs text-gray-400">Unchanged</span>}
                                            </TableCell>
                                            <TableCell className="text-sm py-2">
                                                {v.changes.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                                                        {v.changes.map((c, cIdx) => (
                                                            <div key={cIdx} className="flex items-center gap-2 text-xs bg-white/50 p-1 rounded">
                                                                <span className="font-semibold text-gray-500 min-w-[60px]">{c.field}:</span>
                                                                {c.field === 'Image' ? (
                                                                     <div className="flex items-center gap-1 text-blue-600">
                                                                        <ImageIcon className="w-3 h-3"/> Image Updated
                                                                     </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 overflow-hidden">
                                                                        <span className="text-gray-400 line-through decoration-red-400 truncate max-w-[80px]">
                                                                            {c.type === 'currency' ? formatCurrency(c.old) : (c.old || 'Empty')}
                                                                        </span>
                                                                        <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0"/>
                                                                        <span className="text-green-600 font-bold bg-green-50 px-1 rounded truncate max-w-[80px]">
                                                                            {c.type === 'currency' ? formatCurrency(c.new) : c.new}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    // ALWAYS SHOW PRICE, even if no changes
                                                    <span className="text-gray-500">
                                                        {formatCurrency(v.purchase_price)}
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </React.Fragment>
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