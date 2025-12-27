import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Loader2, Download, Check, AlertTriangle } from "lucide-react";
import { InvokeLLM, UploadFile, ExtractDataFromUploadedFile } from "@/api/integrations";
import { Recipe } from "@/api/entities";

export default function BulkMenuImporter({ menuId, existingRecipes, onComplete, onCancel }) {
  const [importMethod, setImportMethod] = useState('text');
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
  };

  const handleParseText = async () => {
    if (!textInput.trim()) return;

    setIsProcessing(true);
    try {
      const response = await InvokeLLM({
        prompt: `Parse this menu text and extract structured cocktail recipe data. Pay special attention to categorizing cocktails accurately for bar operations and menu filtering.

Text to parse:
${textInput}

For each cocktail recipe, extract:
- name: The cocktail name
- description: Engaging description highlighting key flavors and characteristics
- category: Choose the MOST APPROPRIATE category from: "classic", "modern", "tropical", "sour", "spirit_forward", "dessert", "low_abv", "signature"
  * classic: Traditional cocktails (Martini, Manhattan, Old Fashioned, Negroni, etc.)
  * modern: Contemporary creations or modern twists on classics
  * tropical: Tiki, rum-based, tropical fruit flavors (Mai Tai, Piña Colada, etc.)
  * sour: Citrus-forward cocktails (Whiskey Sour, Margarita, Daiquiri, etc.)
  * spirit_forward: Boozy, minimal mixers (Sazerac, Boulevardier, Stirred cocktails)
  * dessert: Sweet, dessert-like cocktails (Mudslide, White Russian, etc.)
  * low_abv: Lower alcohol content cocktails (Aperitif cocktails, wine-based, etc.)
  * signature: House specialties or unique creations
- base_spirit: Primary spirit - choose from: "gin", "vodka", "rum", "whiskey", "tequila", "mezcal", "brandy", "liqueur", "apertif", "non-alcoholic", "split_base", "other"
- difficulty: "easy", "medium", or "hard" based on technique complexity
- ingredients: Array of ingredient objects with:
  * ingredient_name: Base ingredient name (e.g., "Lime" for lime juice)
  * prep_action: Preparation method if any (e.g., "juice" for lime juice)
  * amount: Numeric amount
  * unit: Measurement unit
  * notes: Any special notes
- instructions: Array of clear, step-by-step instructions
- garnish: Garnish description if any
- glassware: Recommended glassware
- menu_id: "${menuId}"

IMPORTANT CATEGORIZATION GUIDELINES:
- Prioritize the cocktail's PRIMARY characteristic
- Consider the dominant flavor profile and drinking occasion
- For classics with modern twists, choose "modern" if significantly different
- Consider ABV when determining between categories (low ABV vs spirit-forward)
- Tropical ingredients (coconut, pineapple, passion fruit) usually indicate "tropical"
- Citrus-heavy cocktails are typically "sour"
- Stirred, boozy cocktails are typically "spirit_forward"

Return ONLY a valid JSON object with a 'recipes' array.`,
        response_json_schema: {
          type: "object",
          properties: {
            recipes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  base_spirit: { type: "string" },
                  difficulty: { type: "string" },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ingredient_name: { type: "string" },
                        prep_action: { type: "string" },
                        amount: { type: "number" },
                        unit: { type: "string" },
                        notes: { type: "string" }
                      }
                    }
                  },
                  instructions: { type: "array", items: { type: "string" } },
                  garnish: { type: "string" },
                  glassware: { type: "string" },
                  menu_id: { type: "string" }
                }
              }
            }
          }
        }
      });

      setResults(response.recipes || []);
    } catch (error) {
      console.error("Error parsing recipes:", error);
      alert("Failed to parse recipes. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleParseFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const uploadResponse = await UploadFile({ file: selectedFile });
      
      const extractResponse = await ExtractDataFromUploadedFile({
        file_url: uploadResponse.file_url,
        json_schema: {
          type: "object",
          properties: {
            recipes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  base_spirit: { type: "string" },
                  difficulty: { type: "string" },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ingredient_name: { type: "string" },
                        prep_action: { type: "string" },
                        amount: { type: "number" },
                        unit: { type: "string" },
                        notes: { type: "string" }
                      }
                    }
                  },
                  instructions: { type: "array", items: { type: "string" } },
                  garnish: { type: "string" },
                  glassware: { type: "string" },
                  menu_id: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (extractResponse.status === 'success') {
        const recipes = (extractResponse.output.recipes || []).map(recipe => ({
          ...recipe,
          menu_id: menuId
        }));
        setResults(recipes);
      } else {
        console.error("Extraction failed:", extractResponse.details);
        alert("Failed to extract recipes from file. Please try again.");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Failed to process file. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveRecipes = async () => {
    if (!results || results.length === 0) return;

    setIsProcessing(true);
    try {
      for (const recipe of results) {
        const recipeToCreate = {
          ...recipe,
          menu_id: menuId,
          category: recipe.category || 'signature',
          difficulty: recipe.difficulty || 'medium',
          instructions: Array.isArray(recipe.instructions) && recipe.instructions.length > 0
            ? recipe.instructions
            : ['No instructions provided']
        };

        await Recipe.create(recipeToCreate);
      }
      onComplete();
    } catch (error) {
      console.error("Error saving recipes:", error);
      alert("Failed to save some recipes. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "name,description,category,base_spirit,difficulty,garnish,glassware,ingredient_1,amount_1,unit_1,ingredient_2,amount_2,unit_2,instructions\n" +
      "Classic Martini,A timeless gin cocktail with dry vermouth,classic,gin,medium,Lemon twist,Martini glass,Gin,2.5,oz,Dry Vermouth,0.5,oz,\"Stir with ice, strain into chilled glass\"\n" +
      "Tropical Storm,House signature with rum and tropical fruits,signature,rum,easy,Pineapple wedge,Hurricane glass,White Rum,2,oz,Pineapple Juice,4,oz,\"Shake with ice, serve over ice\"";
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'menu_recipe_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getCategoryColor = (category) => {
    const colors = {
      classic: 'bg-blue-100 text-blue-800 border-blue-200',
      modern: 'bg-purple-100 text-purple-800 border-purple-200',
      tropical: 'bg-orange-100 text-orange-800 border-orange-200',
      sour: 'bg-lime-100 text-lime-800 border-lime-200',
      spirit_forward: 'bg-amber-100 text-amber-800 border-amber-200',
      dessert: 'bg-pink-100 text-pink-800 border-pink-200',
      low_abv: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      signature: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-gray-900">Bulk Import Menu Recipes</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!results ? (
          <div className="space-y-6">
            <div className="flex gap-4 mb-6">
              <Button
                variant={importMethod === 'text' ? 'default' : 'outline'}
                onClick={() => setImportMethod('text')}
                className={importMethod === 'text' ? 'bg-blue-600' : ''}
              >
                Text Input
              </Button>
              <Button
                variant={importMethod === 'file' ? 'default' : 'outline'}
                onClick={() => setImportMethod('file')}
                className={importMethod === 'file' ? 'bg-blue-600' : ''}
              >
                Upload File
              </Button>
            </div>

            {importMethod === 'text' && (
              <div>
                <Label htmlFor="text">Menu or Recipe List</Label>
                <Textarea
                  id="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste your menu or recipe list here... Include cocktail names, ingredients, and any preparation notes."
                  className="h-64"
                />
              </div>
            )}

            {importMethod === 'file' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">Upload Menu File (CSV, PDF, TXT, or Image)</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.csv,.txt,.png,.jpg,.jpeg"
                    className="mt-2"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV Template
                  </Button>
                  <span className="text-sm text-blue-600">Use this template for CSV imports</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                onClick={importMethod === 'text' ? handleParseText : handleParseFile}
                disabled={(!textInput.trim() && importMethod === 'text') || (!selectedFile && importMethod === 'file') || isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Parse Recipes
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Found {results.length} Recipe{results.length !== 1 ? 's' : ''}
              </h3>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {results.map((recipe, index) => (
                  <div key={index} className="p-4 bg-neutral-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">{recipe.name}</h4>
                          <div className="flex gap-1">
                            {recipe.category && (
                              <Badge className={`text-xs border ${getCategoryColor(recipe.category)}`}>
                                {recipe.category.replace('_', ' ')}
                              </Badge>
                            )}
                            {recipe.difficulty && (
                              <Badge variant="outline" className="text-xs">
                                {recipe.difficulty}
                              </Badge>
                            )}
                            {recipe.base_spirit && (
                              <Badge variant="outline" className="text-xs">
                                {recipe.base_spirit}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {recipe.description && (
                          <p className="text-sm text-gray-600 mb-2">{recipe.description}</p>
                        )}

                        <div className="grid md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <h5 className="font-medium text-gray-800 mb-1">Ingredients</h5>
                            <ul className="text-gray-600 space-y-0.5">
                              {recipe.ingredients?.slice(0, 4).map((ing, idx) => (
                                <li key={idx}>
                                  {ing.amount} {ing.unit} {ing.ingredient_name}
                                  {ing.prep_action && `, ${ing.prep_action}`}
                                </li>
                              ))}
                              {recipe.ingredients?.length > 4 && (
                                <li className="text-gray-400">...and {recipe.ingredients.length - 4} more</li>
                              )}
                            </ul>
                          </div>

                          <div>
                            <h5 className="font-medium text-gray-800 mb-1">Details</h5>
                            <div className="text-gray-600 space-y-0.5">
                              {recipe.glassware && <div><strong>Glass:</strong> {recipe.glassware}</div>}
                              {recipe.garnish && <div><strong>Garnish:</strong> {recipe.garnish}</div>}
                              <div><strong>Instructions:</strong> {recipe.instructions?.length || 0} steps</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setResults(null)}>
                Back to Edit
              </Button>
              <Button 
                onClick={handleSaveRecipes}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import {results.length} Recipe{results.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}