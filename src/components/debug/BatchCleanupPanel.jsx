import React, { useState } from "react";
import { clearDebugBatchSettings } from "@/components/utils/batchDebugCleanup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function BatchCleanupPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleClick = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const clearedCount = await clearDebugBatchSettings();
      setResult(`Cleared debug batch_settings from ${clearedCount} recipes.`);
    } catch (err) {
      console.error("[BatchCleanup] Error:", err);
      setError("Error clearing debug batch settings. See console.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <Trash2 className="w-5 h-5" />
          Batch Debug Cleanup
        </CardTitle>
        <CardDescription>
          Clear any Recipe.batch_settings that still contain the BATCH_TEST debug data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleClick} 
          disabled={running}
          variant="outline"
          className="border-amber-600 text-amber-700 hover:bg-amber-100"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Cleaning…
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Debug Batch Settings
            </>
          )}
        </Button>
        
        {result && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-900">
            <CheckCircle2 className="w-5 h-5" />
            <p>{result}</p>
          </div>
        )}
        
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-900">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}