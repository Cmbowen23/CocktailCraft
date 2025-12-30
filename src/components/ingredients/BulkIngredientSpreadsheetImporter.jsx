import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Loader2, AlertTriangle, Download, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRight, Save } from "lucide-react";
import { supabase } from "@/lib/supabase"; 

// --- HELPER FUNCTIONS (Ported from Base44) ---
const normalizeName = (name) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ');

const calculateSimilarity = (str1, str2) => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  return 0;
};

// --- MAIN COMPONENT ---
export default function BulkIngredientSpreadsheetImporter({ onComplete, onCancel }) {
  const [step, setStep] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  
  // Data State
  const [allIngredients, setAllIngredients] = useState([]);
  const [allProductVariants, setAllProductVariants] = useState([]);
  const [parsedIngredients, setParsedIngredients] = useState([]); // The grouped data
  const [mergeDecisions, setMergeDecisions] = useState({});
  
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // 1. Fetch Existing Data on Mount (The "Base44 Way")
  useEffect(() => {
    const fetchAllData = async () => {
        setIsProcessing(true);
        setProgress('Loading current inventory...');
        
        try {
            // Fetch Ingredients
            let { data: ings } = await supabase.from('ingredients').select('*');
            setAllIngredients(ings || []);

            // Fetch Variants (Loop to get all 3000+)
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
            setError("Failed to load inventory.");
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
    };
    fetchAllData();
  }, []);

  // 2. File Handler
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const handleParseFile = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    
    try {
        const text = await selectedFile.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        
        setParsedHeaders(headers);

        // Simple CSV Parser
        const rows = [];
        for(let i=1; i<lines.length; i++) {
            // Regex to handle quoted commas "Like, This"
            const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            const row = {};
            headers.forEach((h, idx) => {
                let val = matches[idx] || '';
                val = val.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
                row[h] = val;
            });
            rows.push(row);
        }
        setParsedRows(rows);

        // Auto-Map
        const initialMap = {};
        const expected = ['name','category','supplier','sku_number','purchase_price','purchase_quantity','purchase_unit','case_price','bottles_per_case','exclusive','tier','abv','description'];
        
        expected.forEach(field => {
            const match = headers.find(h => h.includes(field) || field.includes(h));
            initialMap[field] = match || '';
        });
        setColumnMappings(initialMap);
        setStep('mapping');

    } catch (err) {
        setError("CSV Parse Error: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // 3. The "Heavy Lifting" Logic (Ported from Base44)
  const handleConfirmMappings = async () => {
    setIsProcessing(true);
    setProgress('Analyzing...');

    try {
        // Group by Name + Supplier
        const groups = {};
        parsedRows.forEach(row => {
            const mapRow = {};
            Object.entries(columnMappings).forEach(([key, col]) => {
                if (col && row[col]) mapRow[key] = row[col];
            });

            if (!mapRow.name) return;

            const key = `${mapRow.name.toLowerCase()}|${(mapRow.supplier||'').toLowerCase()}`;
            if (!groups[key]) {
                groups[key] = {
                    name: mapRow.name,
                    supplier: mapRow.supplier,
                    category: mapRow.category || 'Spirit',
                    // ... other ing fields
                    variants: []
                };
            }

            // Standardize Size
            let size_ml = parseFloat(mapRow.purchase_quantity) || 750;
            const unit = (mapRow.purchase_unit || 'ml').toLowerCase();
            if (unit === 'l') size_ml *= 1000;
            if (unit.includes('oz')) size_ml *= 29.57;

            groups[key].variants.push({
                sku_number: mapRow.sku_number,
                purchase_price: parseFloat(mapRow.purchase_price) || 0,
                case_price: parseFloat(mapRow.case_price) || 0,
                size_ml: size_ml,
                // ... other variant fields
            });
        });

        // Compare against DB (Client Side)
        const cleanedData = Object.values(groups).map(group => {
            // Find Ingredient Match
            const exactMatch = allIngredients.find(i => normalizeName(i.name) === normalizeName(group.name));
            
            const variantAnalysis = group.variants.map(v => {
                let existingVar = null;
                
                // Find Variant Match by SKU or Size
                if (exactMatch) {
                    const existingVars = allProductVariants.filter(ev => ev.ingredient_id === exactMatch.id);
                    if (v.sku_number) {
                        existingVar = existingVars.find(ev => normalizeName(ev.sku_number) === normalizeName(v.sku_number));
                    }
                    if (!existingVar) {
                        existingVar = existingVars.find(ev => Math.abs(ev.size_ml - v.size_ml) < 5);
                    }
                }

                // Diff Check
                const changes = [];
                let isNew = true;

                if (existingVar) {
                    isNew = false;
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

            return { ...group, exactMatch, variantAnalysis };
        });

        setParsedIngredients(cleanedData);
        setStep('confirm');

    } catch (err) {
        setError(err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // 4. Save (The Loop)
  const handleSaveIngredients = async () => {
    setIsProcessing(true);
    let count = 0;

    for (let i = 0; i < parsedIngredients.length; i++) {
        const group = parsedIngredients[i];
        
        try {
            // 1. Get/Create Ingredient ID
            let ingId = group.exactMatch?.id;
            if (!ingId) {
                const { data: newIng } = await supabase.from('ingredients')
                    .insert({ name: group.name, category: group.category, supplier: group.supplier })
                    .select().single();
                ingId = newIng.id;
            }

            // 2. Save Variants
            for (const v of group.variantAnalysis) {
                const payload = {
                    ingredient_id: ingId,
                    sku_number: v.sku_number,
                    purchase_price: v.purchase_price,
                    case_price: v.case_price,
                    size_ml: v.size_ml
                };

                if (v.isNew) {
                    await supabase.from('product_variants').insert(payload);
                } else if (v.changes.length > 0) {
                    await supabase.from('product_variants').update(payload).eq('id', v.existingId);
                }
            }
            
            count++;
            setProgress(`Saved ${count} / ${parsedIngredients.length} items...`);

        } catch (err) {
            console.error("Save failed for " + group.name, err);
        }
    }

    onComplete();
  };

  // --- RENDER ---
  if (step === 'upload') return (
    <Card className="shadow-lg">
        <CardHeader><CardTitle>Import Ingredients</CardTitle></CardHeader>
        <CardContent>
            {isProcessing ? (
                <div className="text-center py-10 text-blue-600"><Loader2 className="animate-spin w-8 h-8 mx-auto"/> {progress}</div>
            ) : (
                <div className="border-2 border-dashed p-10 text-center rounded-lg">
                    <Input type="file" accept=".csv" onChange={handleFileUpload} className="mb-4" />
                    <Button onClick={handleParseFile} disabled={!selectedFile} className="bg-emerald-600">Analyze File</Button>
                </div>
            )}
            {error && <div className="text-red-500 mt-4 text-sm">{error}</div>}
        </CardContent>
    </Card>
  );

  if (step === 'mapping') return (
    <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader><CardTitle>Map Columns</CardTitle></CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 gap-4 h-[400px] overflow-auto">
                {['name','supplier','category','sku_number','purchase_price','case_price','purchase_quantity'].map(field => (
                    <div key={field} className="flex justify-between items-center border p-2 rounded">
                        <Label className="capitalize">{field.replace('_',' ')}</Label>
                        <Select value={columnMappings[field]} onValueChange={v=>setColumnMappings({...columnMappings, [field]: v})}>
                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Col"/></SelectTrigger>
                            <SelectContent>
                                {parsedHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={()=>setStep('upload')}>Back</Button>
                <Button onClick={handleConfirmMappings} className="bg-emerald-600">{isProcessing ? <Loader2 className="animate-spin"/> : 'Next: Audit'}</Button>
            </div>
        </CardContent>
    </Card>
  );

  if (step === 'confirm') return (
    <Card className="max-w-6xl mx-auto shadow-lg">
        <CardHeader><CardTitle>Review & Import</CardTitle></CardHeader>
        <CardContent>
            <div className="h-[500px] overflow-auto border rounded bg-gray-50 p-4 space-y-2">
                {parsedIngredients.map((group, i) => (
                    <div key={i} className="bg-white border rounded p-3 shadow-sm">
                        <div className="flex justify-between font-bold text-gray-800">
                            <span>{group.name}</span>
                            <span className="text-xs font-normal text-gray-500">{group.exactMatch ? 'Existing' : 'New Ingredient'}</span>
                        </div>
                        {group.variantAnalysis.map((v, idx) => (
                            <div key={idx} className="flex justify-between text-sm mt-1 pl-4 border-l-2 border-gray-200">
                                <span>{v.size_ml}ml • {v.sku_number || 'No SKU'}</span>
                                {v.isNew ? (
                                    <span className="text-green-600 font-bold">+ New Variant</span>
                                ) : v.changes.length > 0 ? (
                                    <div className="flex gap-2">
                                        {v.changes.map((c, ci) => (
                                            <span key={ci} className="text-orange-600 bg-orange-50 px-1 rounded text-xs border border-orange-200">
                                                {c.field}: {c.oldValue} → {c.newValue}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-gray-400">No Change</span>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={()=>setStep('mapping')}>Back</Button>
                <Button onClick={handleSaveIngredients} className="bg-emerald-600 h-12 px-8 text-lg">
                    {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 w-5 h-5"/>}
                    {isProcessing ? progress : 'Import Now'}
                </Button>
            </div>
        </CardContent>
    </Card>
  );
}