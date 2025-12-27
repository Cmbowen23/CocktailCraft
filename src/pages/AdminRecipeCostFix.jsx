import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { AlertCircle, CheckCircle, Loader2, Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminRecipeCostFix() {
  const [issues, setIssues] = useState([]);
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [fixResults, setFixResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const runAudit = async () => {
    setIsAuditing(true);
    setFixResults(null);
    try {
      const response = await base44.functions.invoke('auditRecipeCosts', {});
      const data = response.data;
      
      setIssues(data.issues || []);
      setAuditResults({
        total_issues: data.total_issues,
        recipes_scanned: data.recipes_scanned
      });
      setSelectedIssues([]);
    } catch (error) {
      console.error("Audit failed:", error);
      alert("Failed to run audit: " + error.message);
    } finally {
      setIsAuditing(false);
    }
  };

  const applyFixes = async () => {
    if (selectedIssues.length === 0) {
      alert("Please select at least one issue to fix");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to fix ${selectedIssues.length} ingredient mapping(s) across ${new Set(selectedIssues.map(idx => issues[idx].recipe_id)).size} recipe(s)?`
    );

    if (!confirmed) return;

    setIsFixing(true);
    try {
      const fixesToApply = selectedIssues.map(idx => issues[idx]);
      
      const response = await base44.functions.invoke('bulkFixRecipeCosts', {
        fixes: fixesToApply
      });
      
      setFixResults(response.data);
      
      // Refresh audit after fixes
      await runAudit();
    } catch (error) {
      console.error("Fix failed:", error);
      alert("Failed to apply fixes: " + error.message);
    } finally {
      setIsFixing(false);
    }
  };

  const toggleIssue = (index) => {
    if (selectedIssues.includes(index)) {
      setSelectedIssues(selectedIssues.filter(i => i !== index));
    } else {
      setSelectedIssues([...selectedIssues, index]);
    }
  };

  const selectAll = () => {
    if (selectedIssues.length === filteredIssues.length) {
      setSelectedIssues([]);
    } else {
      const allIndices = filteredIssues.map((_, idx) => 
        issues.findIndex(issue => issue === filteredIssues[idx])
      );
      setSelectedIssues(allIndices);
    }
  };

  const selectAllCitrus = () => {
    const citrusIndices = issues
      .map((issue, idx) => {
        const name = issue.current.ingredient_name.toLowerCase();
        if (name.includes('lemon') || name.includes('lime')) {
          return idx;
        }
        return -1;
      })
      .filter(idx => idx !== -1);
    
    setSelectedIssues(citrusIndices);
  };

  const filteredIssues = issues.filter(issue => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      issue.recipe_name.toLowerCase().includes(term) ||
      issue.current.ingredient_name.toLowerCase().includes(term) ||
      issue.proposed.ingredient_name.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Recipe Cost Fix Tool</h1>
          <p className="text-gray-600 mt-1">
            Audit and fix ingredient mapping issues that cause incorrect recipe costs
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 1: Run Audit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button 
                onClick={runAudit} 
                disabled={isAuditing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isAuditing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning Recipes...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Scan All Recipes
                  </>
                )}
              </Button>

              {auditResults && (
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="outline" className="text-blue-600 border-blue-200">
                    {auditResults.recipes_scanned} recipes scanned
                  </Badge>
                  <Badge variant={auditResults.total_issues > 0 ? "destructive" : "default"}>
                    {auditResults.total_issues} issues found
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {fixResults && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900">Fixes Applied Successfully</p>
                  <p className="text-sm text-green-700 mt-1">
                    Updated {fixResults.recipes_updated} recipe(s) with {fixResults.total_fixes} fix(es)
                    {fixResults.recipes_failed > 0 && ` • ${fixResults.recipes_failed} failed`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {issues.length > 0 && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Step 2: Review & Fix Issues</CardTitle>
                  <div className="flex items-center gap-3">
                    <Input
                      placeholder="Search recipes or ingredients..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                    <Button 
                      onClick={selectAll}
                      variant="outline"
                      size="sm"
                    >
                      {selectedIssues.length === filteredIssues.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button 
                      onClick={selectAllCitrus}
                      variant="outline"
                      size="sm"
                      className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    >
                      Select All Lemon/Lime
                    </Button>
                    <Button
                      onClick={applyFixes}
                      disabled={isFixing || selectedIssues.length === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isFixing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          Apply {selectedIssues.length} Fix{selectedIssues.length !== 1 ? 'es' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredIssues.map((issue, idx) => {
                    const originalIndex = issues.findIndex(i => i === issue);
                    const isSelected = selectedIssues.includes(originalIndex);
                    
                    return (
                      <div
                        key={originalIndex}
                        className={`border rounded-lg p-4 transition-colors ${
                          isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleIssue(originalIndex)}
                            className="mt-1"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">{issue.recipe_name}</h3>
                              <Badge variant="outline" className="text-xs">
                                {issue.current.amount} {issue.current.unit}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                              <div className="bg-red-50 border border-red-200 rounded p-3">
                                <div className="text-xs text-red-600 font-semibold mb-1">CURRENT</div>
                                <div className="font-medium text-gray-900">{issue.current.ingredient_name}</div>
                                {issue.current.prep_action && (
                                  <div className="text-sm text-gray-600 mt-1">Prep: {issue.current.prep_action}</div>
                                )}
                                <div className="text-xs text-red-600 mt-2">
                                  {!issue.current.ingredient_id && "⚠️ Missing ingredient ID"}
                                </div>
                              </div>
                              
                              <ArrowRight className="w-5 h-5 text-gray-400" />
                              
                              <div className="bg-green-50 border border-green-200 rounded p-3">
                                <div className="text-xs text-green-600 font-semibold mb-1">PROPOSED FIX</div>
                                <div className="font-medium text-gray-900">{issue.proposed.ingredient_name}</div>
                                {issue.proposed.prep_action && (
                                  <div className="text-sm text-gray-600 mt-1">Prep: {issue.proposed.prep_action}</div>
                                )}
                                <div className="text-xs text-green-600 mt-2">
                                  ✓ Cost: ${(issue.proposed.matched_ingredient_cost || 0).toFixed(2)}/unit
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!isAuditing && issues.length === 0 && auditResults && (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                All Clear!
              </h3>
              <p className="text-gray-600">
                No ingredient mapping issues found in your recipes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}