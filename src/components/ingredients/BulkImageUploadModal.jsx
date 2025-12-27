import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileText, CheckCircle2, AlertCircle, Download, Play, SkipForward } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function BulkImageUploadModal({ isOpen, onClose, onComplete, allIngredients = [] }) {
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [progress, setProgress] = useState(0);
    const navigate = useNavigate();

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setAnalysis(null);
            setProgress(0);
            analyzeFile(e.target.files[0]);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.name.toLowerCase().endsWith('.csv')) {
                setFile(droppedFile);
                setError(null);
                setAnalysis(null);
                setProgress(0);
                analyzeFile(droppedFile);
            } else {
                setError("Please upload a valid CSV file.");
            }
        }
    };

    const parseCSV = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const lines = text.split('\n');
                const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                
                const skuIndex = headers.findIndex(h => h.includes('sku'));
                const urlIndex = headers.findIndex(h => h.includes('image') || h.includes('url'));
                
                if (skuIndex === -1 || urlIndex === -1) {
                    reject(new Error('CSV must contain "SKU" and "Bottle Image URL" columns'));
                    return;
                }
                
                const data = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    const row = [];
                    let currentCell = '';
                    let inQuotes = false;
                    for (let charIndex = 0; charIndex < line.length; charIndex++) {
                        const char = line[charIndex];
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            row.push(currentCell.trim().replace(/^"|"$/g, ''));
                            currentCell = '';
                        } else {
                            currentCell += char;
                        }
                    }
                    row.push(currentCell.trim().replace(/^"|"$/g, ''));
                    
                    if (row[skuIndex] && row[urlIndex]) {
                        data.push({ sku: row[skuIndex], url: row[urlIndex] });
                    }
                }
                resolve(data);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    };

    const analyzeFile = async (fileToAnalyze) => {
        setIsLoading(true);
        try {
            const csvData = await parseCSV(fileToAnalyze);
            
            // Map SKUs to Ingredients
            const skuMap = new Map();
            allIngredients.forEach(ing => {
                if (ing.sku_number) skuMap.set(ing.sku_number.toLowerCase(), ing);
                if (ing.all_sku_numbers) {
                    ing.all_sku_numbers.forEach(sku => {
                        if (sku) skuMap.set(sku.toLowerCase(), ing);
                    });
                }
                // Also check variants directly if available
                if (ing.variants) {
                    ing.variants.forEach(v => {
                        if (v.sku_number) skuMap.set(v.sku_number.toLowerCase(), ing);
                    });
                }
            });

            const toUpdate = [];
            const skipped = [];
            const notFound = [];

            csvData.forEach(row => {
                const skuLower = row.sku.toLowerCase();
                const ing = skuMap.get(skuLower);
                
                if (ing) {
                    if (ing.bottle_image_url) {
                        skipped.push({ sku: row.sku, url: row.url, status: 'skipped', message: 'Image already exists' });
                    } else {
                        toUpdate.push({ id: ing.id, url: row.url, sku: row.sku });
                    }
                } else {
                    notFound.push({ sku: row.sku, url: row.url, status: 'not_found', message: 'SKU not found in system' });
                }
            });

            // Deduplicate updates by ID
            const uniqueUpdates = Array.from(new Map(toUpdate.map(item => [item.id, item])).values());

            setAnalysis({
                totalRows: csvData.length,
                toUpdate: uniqueUpdates,
                skipped: skipped,
                notFound: notFound
            });

        } catch (err) {
            console.error("Analysis error:", err);
            setError(err.message || "Failed to analyze file");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async () => {
        if (!analysis || analysis.toUpdate.length === 0) return;

        setIsLoading(true);
        setError(null);
        setProgress(0);

        try {
            const updates = analysis.toUpdate;
            const batchSize = 10;
            let processed = 0;
            const results = [];

            for (let i = 0; i < updates.length; i += batchSize) {
                const batch = updates.slice(i, i + batchSize);
                
                const response = await base44.functions.invoke('batchUpdateImages', { 
                    updates: batch 
                });
                
                if (response.data.success) {
                    results.push(...response.data.results);
                }
                
                processed += batch.length;
                setProgress(Math.round((processed / updates.length) * 100));
            }

            onClose();
            // Map backend results back to SKUs
            const mappedResults = results.map(r => {
                const originalItem = updates.find(u => u.id === r.id);
                return {
                    sku: originalItem ? originalItem.sku : 'Unknown',
                    status: r.status,
                    message: r.message || 'Updated successfully',
                    url: originalItem ? originalItem.url : ''
                };
            });

            const finalResults = [
                ...mappedResults,
                ...analysis.skipped,
                ...analysis.notFound
            ];

            navigate(createPageUrl('ImageUploadAudit'), { 
                state: { 
                    results: finalResults,
                    summary: {
                        total: analysis.totalRows,
                        updated: mappedResults.filter(r => r.status === 'success').length,
                        errors: mappedResults.filter(r => r.status === 'error').length,
                        notFound: analysis.notFound.length,
                        skipped: analysis.skipped.length
                    }
                } 
            });
            if (onComplete) onComplete();

        } catch (err) {
            console.error("Upload error:", err);
            setError(err.message || "Failed to process updates");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const headers = ['Product Name', 'SKU', 'Bottle Image URL'];
        const rows = [headers.join(',')];

        allIngredients.forEach(ing => {
            // Add row for main ingredient SKU
            if (ing.sku_number) {
                const name = (ing.name || '').replace(/"/g, '""');
                const sku = (ing.sku_number || '').replace(/"/g, '""');
                const url = (ing.bottle_image_url || '').replace(/"/g, '""');
                rows.push(`"${name}","${sku}","${url}"`);
            }
            
            // Add rows for variant SKUs
            if (ing.all_sku_numbers && ing.all_sku_numbers.length > 0) {
                ing.all_sku_numbers.forEach(variantSku => {
                    const name = `${ing.name} (Variant)`.replace(/"/g, '""');
                    const sku = (variantSku || '').replace(/"/g, '""');
                    const url = (ing.bottle_image_url || '').replace(/"/g, '""');
                    rows.push(`"${name}","${sku}","${url}"`);
                });
            }
        });

        if (rows.length === 1) {
            rows.push('"Example Gin","SKU-123","https://example.com/image.jpg"');
        }

        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bottle_images_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleClose = () => {
        setFile(null);
        setError(null);
        setAnalysis(null);
        setProgress(0);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Bulk Upload Bottle Images</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file with "SKU" and "Bottle Image URL" columns.
                        Existing images will be skipped.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!analysis && !isLoading && (
                        <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                <Download className="w-4 h-4 mr-2" />
                                Download Template
                            </Button>
                        </div>
                    )}

                    {!analysis && !isLoading && (
                        <div 
                            className={`
                                relative border-2 border-dashed rounded-lg p-8 text-center transition-colors h-48 flex flex-col items-center justify-center
                                ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
                            `}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <input 
                                id="picture"
                                type="file" 
                                accept=".csv" 
                                onChange={handleFileChange} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            
                            <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                                <Upload className="w-10 h-10 text-gray-400" />
                                <p className="font-medium text-gray-700">
                                    Drag & Drop CSV File
                                </p>
                                <p className="text-xs text-gray-500">
                                    or click to browse
                                </p>
                            </div>
                        </div>
                    )}

                    {(isLoading && !analysis) && (
                        <div className="text-center py-8">
                            <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 mb-4" />
                            <p className="text-gray-600">Analyzing file...</p>
                        </div>
                    )}

                    {analysis && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Total Rows:</span>
                                    <span className="font-medium">{analysis.totalRows}</span>
                                </div>
                                <div className="flex justify-between items-center text-green-600">
                                    <span className="flex items-center gap-2"><Play className="w-4 h-4" /> To Update:</span>
                                    <span className="font-bold">{analysis.toUpdate.length}</span>
                                </div>
                                <div className="flex justify-between items-center text-amber-600">
                                    <span className="flex items-center gap-2"><SkipForward className="w-4 h-4" /> Skipped (Has Image):</span>
                                    <span className="font-medium">{analysis.skipped.length}</span>
                                </div>
                                <div className="flex justify-between items-center text-red-600">
                                    <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Not Found:</span>
                                    <span className="font-medium">{analysis.notFound.length}</span>
                                </div>
                            </div>

                            {isLoading && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Processing...</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div 
                                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="text-sm text-red-600 flex items-center gap-2 bg-red-50 p-3 rounded-md">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    {analysis && !isLoading && (
                        <Button onClick={handleUpload} disabled={analysis.toUpdate.length === 0}>
                            Start Update ({analysis.toUpdate.length})
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}