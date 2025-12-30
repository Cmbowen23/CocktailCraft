import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight, Save, ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase"; 

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

const FIELD_CONFIG = [
  { key: 'name', label: 'Name', required: true, aliases: ['name', 'product name'] },
  { key: 'category', label: 'Category', aliases: ['category', 'type'] },
  { key: 'supplier', label: 'Supplier', aliases: ['supplier', 'vendor'] },
  { key: 'sku_number', label: 'SKU', aliases: ['sku', 'sku_number', 'id'] },
  { key: 'purchase_price', label: 'Price ($)', aliases: ['purchase_price', 'cost', 'unit cost'] },
  { key: 'case_price', label: 'Case Price ($)', aliases: ['case_price', 'case cost'] },
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

const formatCurrency = (val) => {
  const num = parseFloat(String(val).replace(/[^0-9.-]+/g,""));
  return isNaN(num) ? '-' : `$${num.toFixed(2)}`;
};

export default function BulkIngredientSpreadsheetImporter({ onComplete }) {
  const [step, setStep] = useState('upload'); 
  const [rawRows, setRawRows] = useState([]);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [reportData, setReportData] = useState([]); 
  const [stats, setStats] = useState({ new: 0, updated: 0, unchanged: 0 });
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. File Upload
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

      // Auto Map
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
    } catch (err) { setErrorMsg("Error parsing CSV: " + err.message); }
  };

  // 2. BATCHED Audit (The Fix for Scalability)
  const handleGenerateReport = async () => {
    setStep('processing');
    setProgress(0);
    setStatus('Analyzing changes...');
    
    const cleanRows = rawRows.map(row => {
        const newRow = {};
        Object.entries(mapping).forEach(([dbKey, csvHeader]) => {
            if (csvHeader) newRow[dbKey] = row[csvHeader];
        });
        return newRow;
    }).filter(r => r.name);

    try {
        const BATCH_SIZE = 250; // Small batch size prevents timeouts
        const total = cleanRows.length;
        let allReports = [];
        let accumulatedStats = { new: 0, updated: 0, unchanged: 0 };
        let processedCount = 0;

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = cleanRows.slice(i, i + BATCH_SIZE);
            setStatus(`Auditing items ${i+1} - ${Math.min(i+BATCH_SIZE, total)}...`);

            const { data, error } = await supabase.functions.invoke('process-ingredient-import', {
                body: { rows: batch, dry_run: true }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            allReports = [...allReports, ...data.report];
            accumulatedStats.new += data.stats.new;
            accumulatedStats.updated += data.stats.updated;
            accumulatedStats.unchanged += data.stats.unchanged;
            
            processedCount += batch.length;
            setProgress(Math.round((processedCount / total) * 100));
        }

        setReportData(allReports);
        setStats(accumulatedStats);
        setStep('audit');
    } catch (err) {
        console.error(err);
        setErrorMsg("Audit failed: " + err.message);
        setStep('map');
    }
  };

  // 3. BATCHED Import
  const handleImport = async () => {
    setStep('processing');
    setProgress(0);
    setStatus('Saving to database...');
    
    try {
        const rows = reportData; 
        const BATCH_SIZE = 200;
        let count = 0;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            setStatus(`Saving batch ${Math.floor(i/BATCH_SIZE)+1} of ${Math.ceil(rows.length/BATCH_SIZE)}...`);
            
            const { data, error } = await supabase.functions.invoke('process-ingredient-import', {
                body: { rows: batch, dry_run: false }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            
            count += batch.length;
            setProgress(Math.round((count / rows.length) * 100));
        }

        setStatus('Complete!');
        setStep('complete');
        setTimeout(onComplete, 2000);
    } catch (err) {
        setErrorMsg(err.message);
        setStep('audit');
    }
  };

  if (step === 'complete') return (
    <Card className="max-w-md mx-auto mt-10 bg-emerald-50 border-emerald-100 p-8 text-center shadow-sm">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-emerald-900">Import Successful</h3>
        <p className="text-emerald-700 mt-2">Your inventory has been updated.</p>
    </Card>
  );

  return (
    <Card className="max-w-6xl mx-auto mt-6 shadow-md border-gray-200">
      <CardHeader className="border-b bg-gray-50/50 pb-4">
        <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-blue-600"/> Scalable Importer</CardTitle>
            <div className="text-xs font-medium text-gray-500">Step: {step.toUpperCase()}</div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {errorMsg && <div className="m-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{errorMsg}</div>}

        {step === 'upload' && (
          <div className="text-center py-16 px-6">
             <Label htmlFor="file" className="cursor-pointer inline-flex flex-col items-center gap-4 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition w-full max-w-lg">
                <FileSpreadsheet className="w-12 h-12 text-blue-300"/>
                <span className="text-blue-600 font-semibold text-lg">Upload Spreadsheet</span>
             </Label>
             <Input id="file" type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
          </div>
        )}

        {step === 'map' && (
          <div className="h-[500px] flex flex-col">
            <div className="flex-1 overflow-auto p-4">
                <Table>
                    <TableHeader className="bg-gray-50 sticky top-0"><TableRow><TableHead>App Field</TableHead><TableHead></TableHead><TableHead>Your Column</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {FIELD_CONFIG.map(f => (
                            <TableRow key={f.key}>
                                <TableCell className="font-medium">{f.label}</TableCell>
                                <TableCell className="text-center"><ArrowRight className="w-4 h-4 text-gray-400 mx-auto"/></TableCell>
                                <TableCell>
                                    <Select value={mapping[f.key] || 'skip'} onValueChange={v => setMapping({...mapping, [f.key]: v==='skip'?null:v})}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="-- Ignore --"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="skip">-- Ignore --</SelectItem>
                                            {rawHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="border-t p-4 flex justify-end gap-2 bg-gray-50">
                <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                <Button onClick={handleGenerateReport} className="bg-blue-600">Next: Audit Changes</Button>
            </div>
          </div>
        )}

        {step === 'audit' && (
          <div className="p-6">
            <div className="flex gap-4 mb-6 items-center">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-md flex-1">
                    <h4 className="font-bold text-blue-900">Audit Complete</h4>
                    <div className="flex gap-6 mt-2 text-sm">
                        <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-200">{stats.new} New Items</span>
                        <span className="text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded border border-orange-200">{stats.updated} Updates</span>
                        <span className="text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">{stats.unchanged} Unchanged</span>
                    </div>
                </div>
                <Button onClick={handleImport} className="bg-emerald-600 h-14 text-lg px-8 shadow-md hover:bg-emerald-700">
                    <Save className="w-5 h-5 mr-2"/> Confirm Import
                </Button>
            </div>

            <div className="border rounded-md h-[500px] overflow-auto bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                            <TableHead className="w-[30%]">Item</TableHead>
                            <TableHead className="w-[15%]">SKU</TableHead>
                            <TableHead className="w-[10%]">Status</TableHead>
                            <TableHead className="w-[45%]">Changes Detected</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.map((row, i) => (
                            <TableRow key={i} className="hover:bg-gray-50">
                                <TableCell className="font-medium">
                                    <div className="text-gray-900">{row.name}</div>
                                    <div className="text-xs text-gray-500">{row.variant_size || '750ml'} • {row.supplier}</div>
                                </TableCell>
                                <TableCell className="text-xs font-mono text-gray-500">{row.sku_number}</TableCell>
                                <TableCell>
                                    {row.status === 'NEW' && <Badge className="bg-green-100 text-green-700 border-green-200 shadow-none">New</Badge>}
                                    {row.status === 'UPDATE' && <Badge className="bg-orange-100 text-orange-700 border-orange-200 shadow-none">Update</Badge>}
                                    {row.status === 'SAME' && <span className="text-gray-400 text-xs">Unchanged</span>}
                                </TableCell>
                                <TableCell>
                                    {row.changes?.length > 0 ? (
                                        <div className="space-y-1 py-1">
                                            {row.changes.map((c, idx) => (
                                                <div key={idx} className="flex items-center gap-2 text-xs bg-orange-50/50 p-1.5 rounded border border-orange-100">
                                                    <span className="font-bold text-gray-600 w-16">{c.field}:</span>
                                                    {c.field === 'Image' ? (
                                                        <span className="text-blue-600 flex items-center"><ImageIcon className="w-3 h-3 mr-1"/> URL Updated</span>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="line-through text-red-300 decoration-red-300">
                                                                {c.type==='currency' ? formatCurrency(c.old) : (c.old || 'Empty')}
                                                            </span>
                                                            <ArrowRight className="w-3 h-3 text-gray-400"/>
                                                            <span className="font-bold text-green-600">
                                                                {c.type==='currency' ? formatCurrency(c.new) : c.new}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-gray-300 text-xs">-</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          </div>
        )}

        {step === 'processing' && (
           <div className="text-center py-24">
               <Loader2 className="w-16 h-16 animate-spin mx-auto text-blue-600 mb-6"/>
               <div className="text-xl font-medium text-gray-900">{status}</div>
               {progress > 0 && (
                   <div className="w-64 h-2 bg-gray-200 rounded-full mx-auto mt-4 overflow-hidden">
                       <div className="h-full bg-blue-600 transition-all duration-300" style={{width: `${progress}%`}}></div>
                   </div>
               )}
               <p className="text-gray-500 mt-2">{progress}%</p>
           </div>
        )}
      </CardContent>
    </Card>
  );
}