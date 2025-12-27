import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function IngredientSyncPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [result, setResult] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.csv')) {
      setSelectedFile(file);
      setResult(null);
      setPreviewResult(null);
      setError(null);
    } else {
      setError('Please select a valid CSV file');
      setSelectedFile(null);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file first');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setPreviewResult(null);
      setResult(null);

      // Upload CSV file
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const csvFileUrl = uploadResponse.file_url;

      setIsUploading(false);
      setIsPreviewing(true);

      // Invoke sync function in preview mode
      const syncResponse = await base44.functions.invoke('syncIngredientsFromCSV', {
        csvFileUrl,
        dryRun: true
      });

      if (syncResponse.data.success) {
        setPreviewResult(syncResponse.data);
      } else {
        setError(syncResponse.data.error || 'Preview failed');
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.message || 'An error occurred during preview');
    } finally {
      setIsUploading(false);
      setIsPreviewing(false);
    }
  };

  const handleSync = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file first');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setResult(null);

      // Upload CSV file
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const csvFileUrl = uploadResponse.file_url;

      setIsUploading(false);
      setIsSyncing(true);

      // Invoke sync function
      const syncResponse = await base44.functions.invoke('syncIngredientsFromCSV', {
        csvFileUrl
      });

      if (syncResponse.data.success) {
        setResult(syncResponse.data);
        setPreviewResult(null);
      } else {
        setError(syncResponse.data.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Sync error:', err);
      setError(err.message || 'An error occurred during sync');
    } finally {
      setIsUploading(false);
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ingredient Sync</h1>
          <p className="text-gray-600">Upload your merged CSV to sync ingredient prices and add size variants</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              This will update prices on existing ingredients and add new size variants without affecting other metadata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="csvFile">Select CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="mt-2"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handlePreview}
                disabled={!selectedFile || isUploading || isPreviewing}
                variant="outline"
                className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                {isPreviewing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Previewing...
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Preview Changes
                  </>
                )}
              </Button>
              <Button
                onClick={handleSync}
                disabled={!selectedFile || isUploading || isSyncing}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Sync Ingredients
                  </>
                )}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {previewResult && previewResult.success && (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <div className="font-semibold mb-3">Preview: Changes to be Applied</div>
                  
                  <div className="space-y-1 text-sm mb-4">
                    <div>• New ingredients to create: {previewResult.stats.ingredientsCreated}</div>
                    <div>• New variants to create: {previewResult.stats.variantsCreated}</div>
                    <div>• Variants to update: {previewResult.stats.variantsUpdated}</div>
                    <div>• Rows to skip: {previewResult.stats.skipped}</div>
                  </div>

                  {previewResult.preview && (
                    <div className="space-y-4 mt-4 pt-4 border-t border-blue-300">
                      {previewResult.preview.ingredientsToCreate.length > 0 && (
                        <div>
                          <div className="font-semibold mb-2">New Ingredients:</div>
                          <div className="ml-3 space-y-1 max-h-32 overflow-y-auto text-sm">
                            {previewResult.preview.ingredientsToCreate.map((ing, idx) => (
                              <div key={idx}>→ {ing.name} ({ing.category})</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {previewResult.preview.variantsToCreate.length > 0 && (
                        <div>
                          <div className="font-semibold mb-2">New Product Variants:</div>
                          <div className="ml-3 space-y-1 max-h-40 overflow-y-auto text-xs">
                            {previewResult.preview.variantsToCreate.map((v, idx) => (
                              <div key={idx} className="border-l-2 border-blue-400 pl-2 py-1">
                                <div className="font-medium">{v.ingredientName} ({v.size})</div>
                                <div className="ml-2">Bottle: ${v.purchasePrice} | Case: ${v.casePrice} ({v.bottlesPerCase} btl)</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {previewResult.preview.variantsToUpdate.length > 0 && (
                        <div>
                          <div className="font-semibold mb-2">Variants to Update:</div>
                          <div className="ml-3 space-y-2 max-h-60 overflow-y-auto text-xs">
                            {previewResult.preview.variantsToUpdate.map((v, idx) => (
                              <div key={idx} className="border-l-2 border-yellow-400 pl-2 py-1">
                                <div className="font-medium">{v.ingredientName} ({v.size})</div>
                                <div className="ml-2 space-y-0.5">
                                  {v.oldPurchasePrice !== v.newPurchasePrice && (
                                    <div>Bottle: ${v.oldPurchasePrice} → ${v.newPurchasePrice}</div>
                                  )}
                                  {v.oldCasePrice !== v.newCasePrice && (
                                    <div>Case: ${v.oldCasePrice} → ${v.newCasePrice}</div>
                                  )}
                                  {v.oldBottlesPerCase !== v.newBottlesPerCase && (
                                    <div>Btl/Case: {v.oldBottlesPerCase} → {v.newBottlesPerCase}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-blue-300 text-sm font-semibold">
                    Review the changes above, then click "Sync Ingredients" to apply them.
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result && result.success && !result.dryRun && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <div className="font-semibold mb-2">Sync completed successfully!</div>
                  <div className="space-y-1 text-sm">
                    <div>• New ingredients created: {result.stats.ingredientsCreated}</div>
                    <div>• New variants created: {result.stats.variantsCreated}</div>
                    <div>• Variants updated: {result.stats.variantsUpdated}</div>
                    <div>• Rows skipped: {result.stats.skipped}</div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">How it works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>• The sync process matches products by name and size (bottle_size_ml)</p>
            <p>• For existing size variants, only prices are updated (purchase_price, case_price, bottles_per_case)</p>
            <p>• New size variants are created as ProductVariant records linked to the main Ingredient</p>
            <p>• All existing metadata (category, style, tier, etc.) is preserved</p>
            <p>• No data is deleted - existing ingredients and variants remain untouched</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}