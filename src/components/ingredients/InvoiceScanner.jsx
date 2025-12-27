import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function InvoiceScanner({ onComplete }) {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [proposals, setProposals] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleUploadAndProcess = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      // Step 1: Upload the file
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      if (!uploadResult.file_url) {
        throw new Error("Failed to upload file");
      }

      toast.success("File uploaded, processing invoice...");

      // Step 2: Process the invoice
      const response = await base44.functions.invoke('processInvoice', {
        file_url: uploadResult.file_url
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      if (response.data.needsAudit) {
        setProposals(response.data.proposals);
        toast.success(`Invoice extracted: ${response.data.summary.total} items found. Please review before applying.`);
      } else {
        setResults(response.data);
        toast.success(`Invoice processed: ${response.data.summary.updated} updated, ${response.data.summary.created} created`);
        
        if (onComplete) {
          onComplete(response.data);
        }
      }

    } catch (error) {
      console.error("Invoice processing error:", error);
      toast.error(error.message || "Failed to process invoice");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResults(null);
    setProposals(null);
  };

  const handleUpdateProposal = (index, field, value, type) => {
    setProposals(prev => {
      const updated = { ...prev };
      if (type === 'update') {
        updated.toUpdate[index][field] = value;
      } else if (type === 'create') {
        updated.toCreate[index][field] = value;
      }
      return updated;
    });
  };

  const handleRemoveProposal = (index, type) => {
    setProposals(prev => {
      const updated = { ...prev };
      if (type === 'update') {
        updated.toUpdate = updated.toUpdate.filter((_, i) => i !== index);
      } else if (type === 'create') {
        updated.toCreate = updated.toCreate.filter((_, i) => i !== index);
      }
      return updated;
    });
  };

  const handleApplyChanges = async () => {
    setIsApplying(true);
    try {
      const response = await base44.functions.invoke('applyInvoiceChanges', {
        toUpdate: proposals.toUpdate,
        toCreate: proposals.toCreate
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setResults(response.data);
      setProposals(null);
      toast.success(`Changes applied: ${response.data.summary.updated} updated, ${response.data.summary.created} created`);
      
      if (onComplete) {
        onComplete(response.data);
      }
    } catch (error) {
      console.error("Error applying changes:", error);
      toast.error(error.message || "Failed to apply changes");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Invoice Scanner
        </CardTitle>
        <CardDescription>
          Upload an invoice (image or PDF) to automatically update ingredient pricing or add new ingredients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!results && !proposals ? (
          <>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                id="invoice-upload"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={isProcessing}
              />
              <label 
                htmlFor="invoice-upload" 
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">
                    {file ? file.name : "Click to upload invoice"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Supports images (JPG, PNG) and PDF files
                  </p>
                </div>
              </label>
            </div>

            <Button
              onClick={handleUploadAndProcess}
              disabled={!file || isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing Invoice...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Process Invoice
                </>
              )}
            </Button>
          </>
        ) : proposals ? (
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <AlertDescription>
                <span className="font-semibold text-blue-800">Review Extracted Data</span>
                <div className="mt-2 text-sm text-blue-700">
                  Please review and edit the extracted information before applying changes.
                </div>
              </AlertDescription>
            </Alert>

            {proposals.toUpdate && proposals.toUpdate.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Updates to Existing Ingredients ({proposals.toUpdate.length})
                </h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {proposals.toUpdate.map((item, idx) => (
                    <Card key={idx} className="bg-green-50 border-green-200 p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Name</label>
                          <input
                            type="text"
                            value={item.proposed_name}
                            onChange={(e) => handleUpdateProposal(idx, 'proposed_name', e.target.value, 'update')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <p className="text-xs text-gray-500 mt-1">Current: {item.current_name}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Category</label>
                          <input
                            type="text"
                            value={item.proposed_category}
                            onChange={(e) => handleUpdateProposal(idx, 'proposed_category', e.target.value, 'update')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Cost per Unit</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.proposed_cost_per_unit}
                            onChange={(e) => handleUpdateProposal(idx, 'proposed_cost_per_unit', e.target.value, 'update')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <p className="text-xs text-gray-500 mt-1">Current: ${item.current_cost_per_unit || 0}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Unit</label>
                          <input
                            type="text"
                            value={item.proposed_unit}
                            onChange={(e) => handleUpdateProposal(idx, 'proposed_unit', e.target.value, 'update')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Supplier</label>
                          <input
                            type="text"
                            value={item.proposed_supplier || ''}
                            onChange={(e) => handleUpdateProposal(idx, 'proposed_supplier', e.target.value, 'update')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProposal(idx, 'update')}
                        className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Skip this item
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {proposals.toCreate && proposals.toCreate.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  New Ingredients to Create ({proposals.toCreate.length})
                </h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {proposals.toCreate.map((item, idx) => (
                    <Card key={idx} className="bg-blue-50 border-blue-200 p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Name*</label>
                          <input
                            type="text"
                            value={item.proposed_name}
                            onChange={(e) => handleUpdateProposal(idx, 'proposed_name', e.target.value, 'create')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Category*</label>
                          <input
                            type="text"
                            value={item.proposed_category}
                            onChange={(e) => handleUpdateProposal(idx, 'proposed_category', e.target.value, 'create')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            placeholder="e.g., spirit, liqueur, mixer"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Cost per Unit</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.proposed_cost_per_unit}
                            onChange={(e) => handleUpdateProposal(idx, 'proposed_cost_per_unit', e.target.value, 'create')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Unit</label>
                          <input
                            type="text"
                            value={item.proposed_unit}
                            onChange={(e) => handleUpdateProposal(idx, 'proposed_unit', e.target.value, 'create')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            placeholder="oz, ml, lb, etc."
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Supplier</label>
                          <input
                            type="text"
                            value={item.proposed_supplier || ''}
                            onChange={(e) => handleUpdateProposal(idx, 'proposed_supplier', e.target.value, 'create')}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProposal(idx, 'create')}
                        className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Skip this item
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {proposals.skipped && proposals.skipped.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-gray-400" />
                  Skipped Items ({proposals.skipped.length})
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {proposals.skipped.map((item, idx) => (
                    <div key={idx} className="text-sm bg-gray-50 p-2 rounded border border-gray-200">
                      <span className="text-gray-600">{item.item.ingredient_name || 'Unknown'}</span>
                      <span className="text-gray-400 ml-2 text-xs">({item.reason})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleReset}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApplyChanges}
                disabled={isApplying || ((!proposals.toUpdate || proposals.toUpdate.length === 0) && (!proposals.toCreate || proposals.toCreate.length === 0))}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Applying Changes...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Apply Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription>
                <span className="font-semibold text-green-800">
                  Invoice processed successfully!
                </span>
                <div className="mt-2 text-sm text-green-700">
                  {results.summary.updated} ingredient{results.summary.updated !== 1 ? 's' : ''} updated, {' '}
                  {results.summary.created} new ingredient{results.summary.created !== 1 ? 's' : ''} added
                </div>
              </AlertDescription>
            </Alert>

            {results.results.updated.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Updated Ingredients ({results.results.updated.length})
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {results.results.updated.map((item, idx) => (
                    <div key={idx} className="text-sm bg-green-50 p-2 rounded border border-green-200">
                      <span className="font-medium">{item.name}</span>
                      {item.changes.cost_per_unit && (
                        <span className="text-green-700 ml-2">
                          → ${item.changes.cost_per_unit.toFixed(2)}/{item.changes.unit || 'oz'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.results.created.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  New Ingredients ({results.results.created.length})
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {results.results.created.map((item, idx) => (
                    <div key={idx} className="text-sm bg-blue-50 p-2 rounded border border-blue-200">
                      <span className="font-medium">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.results.skipped.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-gray-400" />
                  Skipped Items ({results.results.skipped.length})
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {results.results.skipped.map((item, idx) => (
                    <div key={idx} className="text-sm bg-gray-50 p-2 rounded border border-gray-200">
                      <span className="text-gray-600">{item.item.ingredient_name || 'Unknown'}</span>
                      <span className="text-gray-400 ml-2 text-xs">({item.reason})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full"
            >
              Scan Another Invoice
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}