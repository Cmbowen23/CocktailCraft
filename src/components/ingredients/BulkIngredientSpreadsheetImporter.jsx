import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight, Save } from "lucide-react";
import { supabase } from "@/lib/supabase"; 

// --- ROBUST PARSER (Fixes column shifting) ---
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

export default function BulkIngredientSpreadsheetImporter({ onComplete, onCancel }) {
  const [step, setStep] = useState('upload'); 
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Handle File
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

      // Auto-Mapping
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

  // 2. Computed "Clean" Data for Audit
  const processedData = useMemo(() => {
    return rawRows.map(row => {
      const newRow = {};
      Object.entries(mapping).forEach(([dbKey, csvHeader]) => {
        if (csvHeader) newRow[dbKey] = row[csvHeader];
      });
      return newRow;
    }).filter(r => r.name); // Filter out rows without a name
  }, [rawRows, mapping]);

  // 3. Batch Upload (Fixes Looping)
  const handleImport = async () => {
    setStep('processing');
    setProgress(0);
    setStatus('Initializing import...');

    try {
      const rows = processedData;
      const BATCH_SIZE = 100;
      const total = rows.length;
      let processed = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        setStatus(`Importing rows ${i + 1} to ${Math.min(i + BATCH_SIZE, total)}...`);
        
        const { data, error } = await supabase.functions.invoke('process-ingredient-import', {
          body: { rows: batch }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        processed += batch.length;
        setProgress(Math.round((processed / total) * 100));
      }

      setStatus('Finalizing...');
      setStep('complete');
      setTimeout(onComplete, 2000);

    } catch (err) {
      console.error(err);
      setStatus('Failed: ' + err.message);
      // Wait a moment so user can see the error
      setTimeout(() => setStep('audit'), 2000); 
    }
  };

  if (step === 'complete') return (
    <Card className="max-w-md mx-auto mt-10 bg-emerald-50 border-emerald-100 p-8 text-center shadow-sm">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-emerald-900">Import Complete</h3>
        <p className="text-emerald-700 mt-2">All {processedData.length} items have been processed.</p>
    </Card>
  );

  return (
    <Card className="max-w-5xl mx-auto mt-6 shadow-md border-gray-200">
      <CardHeader className="border-b bg-gray-50/50 pb-4">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600"/>
                <CardTitle className="text-lg">Bulk Importer</CardTitle>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span className={`px-2 py-1 rounded ${step === 'upload' ? 'bg-blue-100 text-blue-700' : ''}`}>1. Upload</span>
                <ArrowRight className="w-3 h-3"/>
                <span className={`px-2 py-1 rounded ${step === 'map' ? 'bg-blue-100 text-blue-700' : ''}`}>2. Map</span>
                <ArrowRight className="w-3 h-3"/>
                <span className={`px-2 py-1 rounded ${step === 'audit' ? 'bg-blue-100 text-blue-700' : ''}`}>3. Audit</span>
            </div>
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
             <Label htmlFor="file" className="cursor-pointer inline-flex flex-col items-center gap-4 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition w-full max-w-lg">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6"/>
                </div>
                <div className="text-center">
                    <span className="text-blue-600 font-semibold text-lg">Click to Upload CSV</span>
                    <p className="text-sm text-gray-500 mt-1">Universal Template Support</p>
                </div>
             </Label>
             <Input id="file" type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
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
                                        <Select 
                                            value={mapping[field.key] || 'skip'} 
                                            onValueChange={(val) => setMapping(prev => ({...prev, [field.key]: val === 'skip' ? null : val}))}
                                        >
                                            <SelectTrigger className={`h-8 text-sm ${isMapped ? "border-gray-200" : "border-red-200 bg-white"}`}>
                                                <SelectValue placeholder="-- Unmapped --" />
                                            </SelectTrigger>
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

        {/* STEP 3: AUDIT & CHANGES */}
        {step === 'audit' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-md flex-1 mr-4">
                    <h4 className="font-medium text-blue-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4"/> Ready to Import
                    </h4>
                    <p className="text-sm text-blue-700 mt-1">
                        Found <strong>{processedData.length}</strong> valid rows. <br/>
                        <span className="text-xs opacity-75">Rows without a Name have been automatically removed.</span>
                    </p>
                </div>
                <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700 px-8 h-16 text-lg shadow-lg">
                   <Save className="w-5 h-5 mr-2"/> Import {processedData.length} Items
                </Button>
            </div>

            <div className="border rounded-md overflow-hidden mb-6 h-[400px] overflow-auto relative">
                <Table>
                    <TableHeader className="bg-gray-100 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-[30%]">Name</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Cost</TableHead>
                            <TableHead>Size</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {processedData.length === 0 ? (
                             <TableRow><TableCell colSpan={5} className="text-center py-10 text-gray-400">No valid data found</TableCell></TableRow>
                        ) : (
                            processedData.map((row, i) => (
                                <TableRow key={i} className="hover:bg-gray-50">
                                    <TableCell className="font-medium">
                                        {row.name}
                                        {row.description && <div className="text-[10px] text-gray-400 truncate w-48">{row.description}</div>}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono text-gray-500">{row.sku_number || '-'}</TableCell>
                                    <TableCell className="text-sm">{row.supplier || '-'}</TableCell>
                                    <TableCell className="text-sm">{row.purchase_price ? `$${row.purchase_price}` : '-'}</TableCell>
                                    <TableCell className="text-sm text-gray-500">{row.variant_size || '750ml'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            
            <div className="flex justify-start">
               <Button variant="ghost" onClick={() => setStep('map')} className="text-gray-500">← Back to Mapping</Button>
            </div>
          </div>
        )}

        {/* LOADING */}
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