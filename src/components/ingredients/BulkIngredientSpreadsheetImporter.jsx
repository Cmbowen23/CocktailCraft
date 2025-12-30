import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase"; 

// THE COMPLETE UNIVERSAL TEMPLATE MAPPING
const REQUIRED_FIELDS = [
  // Basics
  { key: 'name', label: 'Ingredient Name', required: true },
  { key: 'category', label: 'Category', required: false },
  { key: 'spirit_type', label: 'Spirit Type', required: false },
  { key: 'supplier', label: 'Supplier', required: false },
  
  // Details
  { key: 'style', label: 'Style', required: false },
  { key: 'substyle', label: 'Sub-Style', required: false },
  { key: 'flavor', label: 'Flavor Profile', required: false },
  { key: 'region', label: 'Region', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'abv', label: 'ABV %', required: false },
  
  // Pricing & SKU
  { key: 'sku_number', label: 'SKU / ID', required: false },
  { key: 'purchase_price', label: 'Purchase Price ($)', required: false },
  { key: 'purchase_quantity', label: 'Purchase Quantity', required: false },
  { key: 'purchase_unit', label: 'Purchase Unit (e.g. bottle)', required: false },
  
  // Case Pricing
  { key: 'case_price', label: 'Case Price ($)', required: false },
  { key: 'bottles_per_case', label: 'Bottles Per Case', required: false },
  
  // Variant Specs
  { key: 'variant_size', label: 'Bottle Size (e.g. 750ml)', required: false },
  { key: 'tier', label: 'Tier', required: false },
  { key: 'exclusive', label: 'Exclusive (True/False)', required: false },
  { key: 'bottle_image_url', label: 'Image URL', required: false }
];

export default function BulkIngredientSpreadsheetImporter({ onComplete, onCancel }) {
  const [step, setStep] = useState('upload'); 
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [status, setStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Parse CSV locally
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      // Extract headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      setRawHeaders(headers);

      // Parse Data
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
          const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
          const matches = lines[i].match(regex) || lines[i].split(',');
          const values = matches.map(m => m ? m.replace(/^"|"$/g, '').replace(/""/g, '"').trim() : '');
          
          const rowObj = {};
          headers.forEach((h, idx) => rowObj[h] = values[idx] || '');
          if (rowObj[headers[0]]) { // Only add if first column (Name) has data
             rows.push(rowObj);
          }
      }
      
      setRawRows(rows);

      // Smart Auto-Map
      const initialMap = {};
      REQUIRED_FIELDS.forEach(field => {
        // Try exact match first
        let match = headers.find(h => h.toLowerCase() === field.key.toLowerCase());
        
        // If no exact match, try fuzzy match
        if (!match) {
            match = headers.find(h => 
                h.toLowerCase().includes(field.label.toLowerCase()) || 
                h.toLowerCase().replace(/_/g,'') === field.key.replace(/_/g,'')
            );
        }
        if (match) initialMap[field.key] = match;
      });
      setMapping(initialMap);
      setStep('map');
      setErrorMsg('');
    } catch (err) {
      setErrorMsg("Failed to parse CSV: " + err.message);
    }
  };

  // 2. Prepare Data
  const getProcessedData = () => {
    return rawRows.map(row => {
      const newRow = {};
      Object.entries(mapping).forEach(([dbKey, csvHeader]) => {
        if (csvHeader) newRow[dbKey] = row[csvHeader];
      });
      return newRow;
    }).filter(r => r.name);
  };

  // 3. Send to Backend
  const handleFinalImport = async () => {
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
      setStatus('Error: ' + err.message);
      setStep('audit'); 
    }
  };

  if (step === 'complete') return (
    <Card className="max-w-md mx-auto mt-10 bg-emerald-50 border-emerald-100 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-emerald-900">Success!</h3>
        <p className="text-emerald-700">All data imported successfully.</p>
    </Card>
  );

  return (
    <Card className="max-w-5xl mx-auto mt-6 shadow-lg">
      <CardHeader className="border-b pb-4">
        <div className="flex justify-between items-center">
            <CardTitle>Universal Ingredient Importer</CardTitle>
            <div className="flex gap-4 text-sm font-medium text-gray-500">
                <span className={step === 'upload' ? "text-blue-600" : ""}>1. Upload</span>
                <span className={step === 'map' ? "text-blue-600" : ""}>2. Map Columns</span>
                <span className={step === 'audit' ? "text-blue-600" : ""}>3. Review</span>
            </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {errorMsg}
            </div>
        )}

        {step === 'upload' && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg bg-gray-50">
             <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600"/>
             </div>
             <Label htmlFor="file" className="cursor-pointer bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 font-medium">
                Select CSV File
             </Label>
             <Input id="file" type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
             <p className="text-sm text-gray-500 mt-4">Supports standard Export Template</p>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {REQUIRED_FIELDS.map((field) => (
                <div key={field.key} className="p-3 border rounded bg-white shadow-sm">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-sm text-gray-700">{field.label}</span>
                    {field.required && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">Required</span>}
                  </div>
                  <Select value={mapping[field.key] || ''} onValueChange={(val) => setMapping(prev => ({...prev, [field.key]: val}))}>
                    <SelectTrigger className="w-full text-xs h-8">
                        <SelectValue placeholder="-- Skip --" />
                    </SelectTrigger>
                    <SelectContent>
                      {rawHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
               <Button variant="ghost" onClick={() => setStep('upload')}>Back</Button>
               <Button onClick={() => setStep('audit')} className="bg-blue-600">Next: Review Data</Button>
            </div>
          </div>
        )}

        {step === 'audit' && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4"/> 
                Previewing first 5 rows. {getProcessedData().length} total items found.
            </div>

            <div className="border rounded overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Spirit Type</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Case Price</TableHead>
                            <TableHead>Size</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {getProcessedData().slice(0, 5).map((row, i) => (
                            <TableRow key={i}>
                                <TableCell className="font-medium">{row.name}</TableCell>
                                <TableCell>{row.category}</TableCell>
                                <TableCell>{row.spirit_type}</TableCell>
                                <TableCell>{row.supplier}</TableCell>
                                <TableCell>${row.purchase_price}</TableCell>
                                <TableCell>${row.case_price}</TableCell>
                                <TableCell>{row.variant_size || '750ml'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="flex justify-end gap-3 pt-4">
               <Button variant="ghost" onClick={() => setStep('map')}>Back</Button>
               <Button onClick={handleFinalImport} className="bg-emerald-600 hover:bg-emerald-700 px-8">
                  Start Full Import
               </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
           <div className="text-center py-20">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6"/>
              <h3 className="text-xl font-medium text-gray-900 mb-2">Importing Ingredients...</h3>
              <p className="text-gray-500">{status}</p>
           </div>
        )}
      </CardContent>
    </Card>
  );
}