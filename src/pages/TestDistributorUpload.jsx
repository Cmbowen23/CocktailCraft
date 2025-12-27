import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle, ArrowLeft, Save, Filter } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function TestDistributorUpload() {
  const [file, setFile] = useState(null);
  const [caseFile, setCaseFile] = useState(null);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [summary, setSummary] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [caseDragActive, setCaseDragActive] = useState(false);
  const [showChangesOnly, setShowChangesOnly] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
      setResults([]);
      setSummary(null);
    }
  };

  const handleCaseFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setCaseFile(e.target.files[0]);
      setError("");
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

  const handleCaseDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setCaseDragActive(true);
    } else if (e.type === "dragleave") {
      setCaseDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const name = droppedFile.name.toLowerCase();
      if (name.endsWith('.csv') || name.endsWith('.xls') || name.endsWith('.xlsx')) {
        setFile(droppedFile);
        setError("");
        setResults([]);
        setSummary(null);
      } else {
        setError("Please upload a CSV or Excel file.");
      }
    }
  };

  const handleCaseDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCaseDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const name = droppedFile.name.toLowerCase();
      if (name.endsWith('.csv') || name.endsWith('.xls') || name.endsWith('.xlsx')) {
        setCaseFile(droppedFile);
        setError("");
      } else {
        setError("Please upload a CSV or Excel file.");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    setError("");

    try {
      // Step 1: Upload Primary File
      const primaryUpload = base44.integrations.Core.UploadFile({ file });
      
      // Step 2: Upload Case File (if exists)
      const secondaryUpload = caseFile 
        ? base44.integrations.Core.UploadFile({ file: caseFile })
        : Promise.resolve({});

      const [uploadRes, caseUploadRes] = await Promise.all([primaryUpload, secondaryUpload]);
      
      if (!uploadRes || !uploadRes.file_url) throw new Error("Primary file upload failed");
      if (caseFile && (!caseUploadRes || !caseUploadRes.file_url)) throw new Error("Case file upload failed");

      // Step 3: Invoke Function with URLs
      const res = await base44.functions.invoke('parseDistributorPricing', { 
        primary_file_url: uploadRes.file_url,
        secondary_file_url: caseUploadRes ? caseUploadRes.file_url : null
      });
      
      if (res.data && res.data.results) {
          setResults(res.data.results);
          
          // Calculate summary
          const found = res.data.results.filter(r => r.match_status === 'Found').length;
          const changed = res.data.results.filter(r => r.changes && r.changes.length > 0).length;
          setSummary({ total: res.data.results.length, found, changed });
      } else {
          throw new Error("Invalid response from parser");
      }

    } catch (err) {
      console.error("Parse error object:", err);
      
      let msg = err.message || "Failed to parse file";
      
      // Robust error extraction for Axios/SDK errors
      if (err.response) {
        const data = err.response.data;
        if (data) {
            if (typeof data === 'string') {
                msg = data;
            } else if (typeof data === 'object') {
                if (data.error) {
                    msg = data.error;
                } else if (data.details) {
                    msg = data.details;
                } else {
                    try {
                        msg = JSON.stringify(data);
                    } catch (e) {
                        msg = "Unknown error format from server";
                    }
                }

                if (data.detectedHeaders && Array.isArray(data.detectedHeaders)) {
                    msg += `\n\nDetected Headers: [${data.detectedHeaders.join(', ')}]`;
                }
                
                if (data.debugRows && Array.isArray(data.debugRows)) {
                    msg += `\n\nFirst few rows seen by parser:\n${data.debugRows.map(r => JSON.stringify(r)).join('\n')}`;
                }
            }
        }
      }
      
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyUpdates = async () => {
    if (results.length === 0) return;
    
    // Filter only items with changes or new prices
    const updatesToApply = results
        .filter(r => r.match_status === 'Found' && (r.changes.length > 0 || r.parsed_price > 0 || r.parsed_case_price > 0))
        .map(r => ({
            sku: r.sku,
            price: r.parsed_price,
            case_price: r.parsed_case_price,
            pack: r.parsed_pack
        }));

    if (updatesToApply.length === 0) {
        setError("No updates found to apply.");
        return;
    }

    if (!window.confirm(`Are you sure you want to update pricing for ${updatesToApply.length} items?`)) {
        return;
    }

    setIsUpdating(true);
    setError("");
    setSuccessMessage("");

    try {
        const res = await base44.functions.invoke('applyDistributorPricing', { updates: updatesToApply });
        if (res.data.success) {
            setSuccessMessage(`Successfully updated ${res.data.updatedCount} items!`);
            if (res.data.errors && res.data.errors.length > 0) {
                setError(`Updated ${res.data.updatedCount} items, but ${res.data.errors.length} failed.`);
            }
        } else {
            setError(res.data.error || "Failed to apply updates.");
        }
    } catch (err) {
        console.error("Update error:", err);
        setError(err.message || "Failed to apply updates.");
    } finally {
        setIsUpdating(false);
    }
  };

  const filteredResults = showChangesOnly 
    ? results.filter(r => r.changes && r.changes.length > 0)
    : results;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
            <Link to={createPageUrl("Ingredients")}>
                <Button variant="ghost" size="icon">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
            </Link>
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Distributor Price Update</h1>
                <p className="text-gray-600">Upload your distributor's raw pricing files to update your inventory costs</p>
            </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Single Bottle Pricing</CardTitle>
                </CardHeader>
                <CardContent>
                    <div 
                        className={`
                            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors h-48 flex flex-col items-center justify-center
                            ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
                            ${file ? 'bg-green-50 border-green-500' : ''}
                        `}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input 
                            type="file" 
                            accept=".csv, .xls, .xlsx" 
                            onChange={handleFileChange} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        
                        <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                            {file ? (
                                <>
                                    <FileText className="w-10 h-10 text-green-600" />
                                    <p className="font-medium text-green-700 line-clamp-1">{file.name}</p>
                                    <p className="text-xs text-green-600">Bottle Price List</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-gray-400" />
                                    <p className="font-medium text-gray-700">
                                        Upload Bottle Pricing
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Distributor bottle prices
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Single Case Pricing (Optional)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div 
                        className={`
                            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors h-48 flex flex-col items-center justify-center
                            ${caseDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
                            ${caseFile ? 'bg-purple-50 border-purple-500' : ''}
                        `}
                        onDragEnter={handleCaseDrag}
                        onDragLeave={handleCaseDrag}
                        onDragOver={handleCaseDrag}
                        onDrop={handleCaseDrop}
                    >
                        <input 
                            type="file" 
                            accept=".csv, .xls, .xlsx" 
                            onChange={handleCaseFileChange} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        
                        <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                            {caseFile ? (
                                <>
                                    <FileText className="w-10 h-10 text-purple-600" />
                                    <p className="font-medium text-purple-700 line-clamp-1">{caseFile.name}</p>
                                    <p className="text-xs text-purple-600">Case Price List</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-gray-400" />
                                    <p className="font-medium text-gray-700">
                                        Upload Case Pricing
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Optional case deals / updates
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Button 
            onClick={handleUpload} 
            disabled={!file || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
        >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Upload className="w-5 h-5 mr-2" />}
            {caseFile ? 'Merge & Parse Two Files' : 'Parse Single File'}
        </Button>
        
        {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
        )}

        <Dialog open={!!successMessage} onOpenChange={(open) => !open && setSuccessMessage("")}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-green-600 text-xl">
                        <CheckCircle2 className="w-6 h-6" />
                        Update Complete
                    </DialogTitle>
                    <DialogDescription className="text-base text-gray-700 pt-2">
                        {successMessage}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="sm:justify-center">
                    <Button onClick={() => setSuccessMessage("")} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {summary && (
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{summary.total}</div>
                        <div className="text-sm text-gray-500">Total Rows Parsed</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">{summary.found}</div>
                        <div className="text-sm text-gray-500">SKUs Matched</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-blue-600">{summary.changed}</div>
                        <div className="text-sm text-gray-500">Price/Pack Changes Detected</div>
                    </CardContent>
                </Card>
            </div>
        )}

        {results.length > 0 && (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Parsing Results</CardTitle>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <Switch 
                                id="show-changes" 
                                checked={showChangesOnly}
                                onCheckedChange={setShowChangesOnly}
                            />
                            <Label htmlFor="show-changes">Show Changes Only</Label>
                        </div>
                        <Button 
                            onClick={handleApplyUpdates} 
                            disabled={isUpdating || results.length === 0}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Update Pricing
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Parsed Size/Pack</TableHead>
                                    <TableHead>Bottle Price</TableHead>
                                    <TableHead>Case Price</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Changes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                            No results match your filter.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredResults.map((row, i) => (
                                        <TableRow key={i} className={row.changes && row.changes.length > 0 ? "bg-blue-50" : ""}>
                                            <TableCell className="font-mono">{row.sku}</TableCell>
                                            <TableCell>{row.description}</TableCell>
                                            <TableCell>
                                                <div className="text-xs">
                                                    <div>Size: {row.parsed_size}</div>
                                                    <div>Pack: {row.parsed_pack}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>${row.parsed_price ? row.parsed_price.toFixed(2) : '—'}</TableCell>
                                            <TableCell>${row.parsed_case_price ? row.parsed_case_price.toFixed(2) : '—'}</TableCell>
                                            <TableCell>
                                                {row.match_status === 'Found' ? 
                                                    <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Found</span> : 
                                                    <span className="text-gray-400">Not Found</span>
                                                }
                                            </TableCell>
                                            <TableCell>
                                                {row.changes && row.changes.map((c, idx) => (
                                                    <div key={idx} className="text-xs font-bold text-blue-700">{c}</div>
                                                ))}
                                                {row.sources && row.sources.length > 1 && (
                                                    <div className="text-[10px] text-purple-600 mt-1">Merged from 2 files</div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}