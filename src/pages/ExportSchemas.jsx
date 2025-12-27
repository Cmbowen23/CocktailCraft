import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Database, CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ExportSchemasPage() {
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
      toast.error('Admin access required for schema export');
      return;
    }

    setIsExporting(true);
    setExportComplete(false);

    try {
      toast.info('Fetching schemas...');

      const response = await base44.functions.invoke('exportSchemas');

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const schemas = response.data;

      // Create download link
      const dataStr = JSON.stringify(schemas, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `entity_schemas_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportComplete(true);
      toast.success('Schemas exported successfully!');

    } catch (error) {
      console.error('Export error:', error);
      toast.error(error.message || 'Failed to export schemas');
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
              <AlertDescription>
                <span className="font-semibold text-red-800">Access Denied</span>
                <p className="text-sm text-red-700 mt-2">
                  Only administrators can export entity schemas.
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
          <h1 className="text-3xl font-bold text-gray-900">Export Entity Schemas</h1>
          <p className="text-gray-600 mt-1">
            Download the JSON schema definitions for all entities
          </p>
        </div>

        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Schema Export
            </CardTitle>
            <CardDescription>
              Export the structure and field definitions for all entity types in your database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {exportComplete && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription>
                  <span className="font-semibold text-green-800">Export Complete!</span>
                  <p className="text-sm text-green-700 mt-1">
                    Your schema file has been downloaded. Check your downloads folder.
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
                    Exporting Schemas...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Export All Schemas
                  </>
                )}
              </Button>
            </div>

            <div className="pt-4 border-t text-xs text-gray-500">
              <p>
                <strong>Note:</strong> This export contains only the schema definitions (field types, properties, and structure), not the actual data records.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}