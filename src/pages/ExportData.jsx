import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Database, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ExportDataPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (err) {
        console.error('Failed to load user:', err);
      }
    };
    loadUser();
  }, []);

  const handleExport = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('Admin access required for data export');
      return;
    }

    setIsExporting(true);
    setExportComplete(false);

    try {
      toast.info('Starting export... This may take a moment.');

      const response = await base44.functions.invoke('exportAllData');

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      // Create download link
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `app_backup_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportComplete(true);
      toast.success('Data exported successfully!');

    } catch (error) {
      console.error('Export error:', error);
      toast.error(error.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertDescription>
                <span className="font-semibold text-red-800">Access Denied</span>
                <p className="text-sm text-red-700 mt-2">
                  Only administrators can export application data.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Export All Data</h1>
          <p className="text-gray-600 mt-1">
            Download a complete backup of your application database
          </p>
        </div>

        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Database Backup
            </CardTitle>
            <CardDescription>
              Export all records from every table including Recipes, Ingredients, Menus, Inventory, and all other data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <AlertDescription>
                <span className="font-semibold text-blue-800">What's included:</span>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>All recipes and sub-recipes</li>
                  <li>Complete ingredient database</li>
                  <li>Menus and menu customizations</li>
                  <li>Inventory items and count logs</li>
                  <li>Accounts, tastings, and tasks</li>
                  <li>Training documents and prep sessions</li>
                  <li>All image URLs and metadata</li>
                  <li>User settings and preferences</li>
                </ul>
              </AlertDescription>
            </Alert>

            {exportComplete && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription>
                  <span className="font-semibold text-green-800">Export Complete!</span>
                  <p className="text-sm text-green-700 mt-1">
                    Your backup file has been downloaded. Check your downloads folder.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-4">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Exporting Data...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Export All Data
                  </>
                )}
              </Button>
            </div>

            <div className="pt-4 border-t text-xs text-gray-500">
              <p>
                <strong>Note:</strong> This export creates a JSON file containing all your application data.
                Keep this file secure as it contains sensitive business information.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}