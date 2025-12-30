import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase"; 

// --- ROBUST PARSER ENGINE ---
// This prevents "Column Shifting" by handling empty fields (,,) correctly
const parseCSVLine = (text) => {
  const result = [];
  let curValue = '';
  let inQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (inQuote) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          curValue += '"'; // Handle escaped quote
          i++;
        } else {
          inQuote = false;
        }
      } else {
        curValue += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === ',') {
        result.push(curValue.trim());
        curValue = '';
      } else {
        curValue += char;
      }
    }
  }
  result.push(curValue.trim());
  return result;
};

// --- CONFIG ---
const FIELD_CONFIG = [
  { key: 'name', label: 'Name', required: true, aliases: ['name', 'product name'] },
  { key: 'category', label: 'Category', aliases: ['category', 'type'] },
  { key: 'spirit_type', label: 'Spirit Type', aliases: ['spirit_type', 'spirit type'] },
  { key: 'supplier', label: 'Supplier', aliases: ['supplier', 'vendor'] },
  { key: 'sku_number', label: 'SKU', aliases: ['sku', 'sku_number', 'id'] },
  
  { key: 'purchase_price', label: 'Purchase Price ($)', aliases: ['purchase_price', 'cost', 'unit cost'] },
  { key: 'purchase_quantity', label: 'Purchase Qty', aliases: ['purchase_quantity', 'qty'] },
  { key: 'purchase_unit', label: 'Purchase Unit', aliases: ['purchase_unit', 'unit'] },
  { key: 'case_price', label: 'Case Price ($)', aliases: ['case_price', 'case cost'] },
  { key: 'bottles_per_case', label: 'Bottles/Case', aliases: ['bottles_per_case', 'pack'] },

  { key: 'variant_size', label: 'Size', aliases: ['variant_size', 'size', 'volume'] },
  { key: 'style', label: 'Style', aliases: ['style'] },
  { key: 'substyle', label: 'Sub-Style', aliases: ['substyle'] },
  { key: 'flavor', label: 'Flavor', aliases: ['flavor'] },
  { key: 'region', label: 'Region', aliases: ['region'] },
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
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Handle File & Auto-Map
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      // Parse Headers using Robust Engine
      const headers = parseCSVLine(lines[0]);
      setRawHeaders(headers);

      // Parse Rows using Robust Engine
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          
          // Map values to header names
          const rowObj = {};
          headers.forEach((h, idx) => {
              // Ensure we don't access undefined if row is shorter than header
              rowObj[h] = values[idx] || '';
          });
          
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

  const getProcessedData = () => {
    return rawRows.map(row => {
      const newRow = {};
      Object.entries(mapping).forEach(([dbKey, csvHeader]) => {
        if (csvHeader) newRow[dbKey] = row[csvHeader];
      });
      return newRow;
    }).filter(r => r.name);
  };

  const handleImport = async () => {
    setStep('processing');
    setStatus('Sending data to server...');

    try {
      const cleanRows = getProcessedData();
      const { data, error } = await supabase.functions.invoke('process-ingredient-import', {
        body: { rows: cleanRows }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStep('complete');
      setTimeout(onComplete, 2500);
    } catch (err) {
      console.error(err);
      setStatus('Failed: ' + err.message);
      setStep('audit'); 
    }
  };

  if (step === 'complete') return (
    <Card className="max-w-md mx-auto mt-10 bg-emerald-50 border-emerald-100 p-8 text-center shadow-sm">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-emerald-900">Import Complete</h3>
    </Card>
  );

  return (
    <Card className="max-w-4xl mx-auto mt-6 shadow-md border-gray-200">
      <CardHeader className="border-b bg-gray-50/50 pb-4">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600"/>
                <CardTitle className="text-lg">CSV Importer (v2.1)</CardTitle>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span className={`px-2 py-1 rounded ${step === 'upload' ? 'bg-blue-100 text-blue-700' : ''}`}>1. Upload</span>
                <ArrowRight className="w-3 h-3"/>
                <span className={`px-2 py-1 rounded ${step === 'map' ? 'bg-blue-100 text-blue-700' : ''}`}>2. Map</span>
                <ArrowRight className="w-3 h-3"/>
                <span className={`px-2 py-1 rounded ${step === 'audit' ? 'bg-blue-100 text-blue-700' : ''}`}>3. Review</span>
            </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {errorMsg && (
            <div className="m-4 p-3 bg-red-50 text-red-700 rounded text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {errorMsg}
            </div>
        )}

        {step === 'upload' && (
          <div className="text-center py-16 px-6">
             <Label htmlFor="file" className="cursor-pointer inline-flex flex-col items-center gap-4 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition w-full max-w-lg">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6"/>
                </div>
                <div className="text-center">
                    <span className="text-blue-600 font-semibold text-lg">Click to Upload CSV</span>
                    <p className="text-sm text-gray-500 mt-1">Robust Parser Active</p>
                </div>
             </Label>
             <Input id="file" type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
          </div>
        )}

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
                                    <TableCell className="text-center text-gray-400">
                                        <ArrowRight className="w-4 h-4 mx-auto"/>
                                    </TableCell>
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
                                                {rawHeaders.map((h, i) => (
                                                    <SelectItem key={`${h}-${i}`} value={h}>{h}</SelectItem>
                                                ))}
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
               <Button onClick={() => setStep('audit')} className="bg-blue-600 hover:bg-blue-700 px-6">
                  Next: Review Data
               </Button>
            </div>
          </div>
        )}

        {step === 'audit' && (
          <div className="p-6">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-md mb-6">
                <h4 className="font-medium text-blue-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4"/> Data Audit
                </h4>
                <p className="text-xs text-blue-700 mt-1">
                    Check the columns below. If "Supplier" looks like a Price, go back and fix the map.
                </p>
            </div>

            <div className="border rounded-md overflow-hidden mb-6">
                <Table>
                    <TableHeader className="bg-gray-50">
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Cost</TableHead>
                            <TableHead>Case Cost</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {getProcessedData().slice(0, 5).map((row, i) => (
                            <TableRow key={i}>
                                <TableCell className="font-medium">{row.name}</TableCell>
                                <TableCell className="text-xs font-mono">{row.sku_number || '-'}</TableCell>
                                <TableCell>{row.supplier || '-'}</TableCell>
                                <TableCell>{row.purchase_price ? `$${row.purchase_price}` : '-'}</TableCell>
                                <TableCell>{row.case_price ? `$${row.case_price}` : '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex justify-end gap-3">
               <Button variant="outline" onClick={() => setStep('map')}>Fix Mapping</Button>
               <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700 px-8">
                  Import Now
               </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
           <div className="text-center py-24">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-6"/>
              <h3 className="text-lg font-medium text-gray-900">Importing Data...</h3>
              <p className="text-gray-500 mt-1">{status}</p>
           </div>
        )}
      </CardContent>
    </Card>
  );
}