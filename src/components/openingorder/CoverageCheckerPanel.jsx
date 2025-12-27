import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, XCircle, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { evaluateCoverage } from "./coverageModelConfig";
import { Progress } from "@/components/ui/progress";

export default function CoverageCheckerPanel({ orderItems, allIngredients, onAddProduct }) {
  const [showMissing, setShowMissing] = useState(false);
  const [showPartial, setShowPartial] = useState(false);
  
  const coverageResults = useMemo(() => {
    return evaluateCoverage(orderItems, allIngredients);
  }, [orderItems, allIngredients]);

  const groupedResults = useMemo(() => {
    const missing = coverageResults.filter(r => r.status === 'missing' && !r.optional);
    const partial = coverageResults.filter(r => r.status === 'partial');
    const complete = coverageResults.filter(r => r.status === 'complete');
    const optional = coverageResults.filter(r => r.optional);
    
    return { missing, partial, complete, optional };
  }, [coverageResults]);

  const stats = useMemo(() => {
    const total = coverageResults.filter(r => !r.optional).length;
    const complete = coverageResults.filter(r => r.status === 'complete' && !r.optional).length;
    const partial = coverageResults.filter(r => r.status === 'partial' && !r.optional).length;
    const missing = coverageResults.filter(r => r.status === 'missing' && !r.optional).length;
    const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;
    
    return { total, complete, partial, missing, percentage };
  }, [coverageResults]);

  return (
    <Card className="border border-gray-200">
      <CardHeader className="bg-gray-50">
        <CardTitle className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-5 h-5 text-gray-600" />
          <span className="text-base">Bar Coverage</span>
        </CardTitle>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">{stats.percentage}% Complete</span>
            <div className="flex items-center gap-3">
              <span className="text-green-600 font-medium">{stats.complete} ✓</span>
              {stats.partial > 0 && <span className="text-yellow-600 font-medium">{stats.partial} ⚠</span>}
              {stats.missing > 0 && <span className="text-red-600 font-medium">{stats.missing} ✗</span>}
            </div>
          </div>
          <Progress value={stats.percentage} className="h-3" />
        </div>
      </CardHeader>
      
      {(groupedResults.missing.length > 0 || groupedResults.partial.length > 0) && (
        <CardContent className="p-4 space-y-4">
          {/* Missing Items */}
          {groupedResults.missing.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowMissing(!showMissing)}
                className="w-full flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="font-semibold text-red-700 text-sm">Missing Products ({groupedResults.missing.length})</span>
                </div>
                {showMissing ? <ChevronUp className="w-4 h-4 text-red-600" /> : <ChevronDown className="w-4 h-4 text-red-600" />}
              </button>
              
              {showMissing && (
                <div className="space-y-2 pl-4">
                  {groupedResults.missing.map(item => (
                    <div key={item.id} className="border border-red-200 rounded-lg p-3 bg-red-50">
                      <div className="font-medium text-gray-900 mb-2">{item.label}</div>
                      {item.suggestions.length > 0 ? (
                        <div className="space-y-1">
                          {item.suggestions.slice(0, 3).map(suggestion => (
                            <div key={suggestion.id} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:border-blue-300 transition-colors">
                              <div className="grid grid-cols-12 gap-2 flex-1 items-center">
                                <div className="col-span-6 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{suggestion.name}</div>
                                </div>
                                <div className="col-span-3 min-w-0">
                                  <div className="text-xs text-gray-600 truncate">{suggestion.style || suggestion.spirit_type}</div>
                                </div>
                                <div className="col-span-3 min-w-0">
                                  <div className="text-xs text-gray-500 truncate">{suggestion.supplier}</div>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => onAddProduct({
                                  ingredient_id: suggestion.id,
                                  ingredient_name: suggestion.name,
                                  quantity: 1,
                                  unit: 'bottle'
                                })}
                                className="bg-blue-600 hover:bg-blue-700 h-8 px-2 shrink-0"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">No products available for this category</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Partial Items */}
          {groupedResults.partial.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowPartial(!showPartial)}
                className="w-full flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="font-semibold text-yellow-700 text-sm">Needs More Variety ({groupedResults.partial.length})</span>
                </div>
                {showPartial ? <ChevronUp className="w-4 h-4 text-yellow-600" /> : <ChevronDown className="w-4 h-4 text-yellow-600" />}
              </button>
              
              {showPartial && (
                <div className="space-y-2 pl-4">
                  {groupedResults.partial.map(item => (
                    <div key={item.id} className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-900">{item.label}</div>
                        <div className="text-sm text-gray-600">
                          {item.currentQuantity} of {item.minQuantity}
                        </div>
                      </div>
                      {item.suggestions.length > 0 && (
                        <div className="space-y-1">
                          {item.suggestions.slice(0, 2).map(suggestion => (
                            <div key={suggestion.id} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:border-blue-300 transition-colors">
                              <div className="grid grid-cols-12 gap-2 flex-1 items-center">
                                <div className="col-span-6 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{suggestion.name}</div>
                                </div>
                                <div className="col-span-3 min-w-0">
                                  <div className="text-xs text-gray-600 truncate">{suggestion.style || suggestion.spirit_type}</div>
                                </div>
                                <div className="col-span-3 min-w-0">
                                  <div className="text-xs text-gray-500 truncate">{suggestion.supplier}</div>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => onAddProduct({
                                  ingredient_id: suggestion.id,
                                  ingredient_name: suggestion.name,
                                  quantity: 1,
                                  unit: 'bottle'
                                })}
                                className="bg-blue-600 hover:bg-blue-700 h-8 px-2 shrink-0"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}