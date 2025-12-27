import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function TextFileParser({ onComplete, onCancel }) {
  const [textInput, setTextInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessText = async () => {
    if (!textInput.trim()) return;

    setIsProcessing(true);
    try {
      // Call the backend function to parse ONLY (entities not created yet)
      const response = await base44.functions.invoke('parseRecipeDocument', { 
        text: textInput,
        menu_id: new URLSearchParams(window.location.search).get('menuId')
      });

      const result = response.data;

      if (result && result.recipes && result.recipes.length > 0) {
        if (onComplete) onComplete(result.recipes);
      } else {
        throw new Error("No recipes found in the text. Please check the format and try again.");
      }

    } catch (error) {
      console.error("Error processing recipes:", error);
      alert("Failed to process recipes. Please try again. " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-gray-900">Create Recipes from Text</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <label htmlFor="recipe-text" className="block text-sm font-medium text-gray-700 mb-2">
              Recipe Text
            </label>
            <Textarea
              id="recipe-text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste your recipe text here... Can be from books, websites, or any text format. Include ingredients, instructions, and any other details."
              className="h-64"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleProcessText}
              disabled={!textInput.trim() || isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing Recipes...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Create Recipes
                </>
              )}
            </Button>
          </div>
          
          {/* Help Text */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
             <p className="font-medium mb-1">Tip:</p>
             <p>You can paste a full document containing multiple recipes or a recipe with its sub-recipes (like syrups). The system will automatically detect and create all recipes found.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}