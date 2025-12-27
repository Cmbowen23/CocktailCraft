import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2, Download } from "lucide-react";
import { InvokeLLM, UploadFile, ExtractDataFromUploadedFile } from "@/api/integrations";
import { Account } from "@/api/entities";

export default function BulkAccountImporter({ onComplete, onCancel }) {
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
        prompt: `Parse this text containing business/client information and extract account data.
        
        Text to parse:
        ${textInput}
        
        Extract each account with the following information:
        - name: business/account name (required)
        - description: description or notes about the business
        - type: one of (restaurant, bar, hotel, catering, event_venue, other) - choose the most appropriate (required)
        - account_code: account code or ID if available
        - sales_rep_name: sales representative name if available
        - address: street address if available
        - city: city if available
        - state: state/province if available
        - zip: ZIP or postal code if available
        - phone: phone number if available
        - notes: additional notes if available
        
        Return ALL valid accounts you can identify.`,
        response_json_schema: {
          type: "object",
          properties: {
            accounts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  type: { type: "string" },
                  account_code: { type: "string" },
                  sales_rep_name: { type: "string" },
                  address: { type: "string" },
                  city: { type: "string" },
                  state: { type: "string" },
                  zip: { type: "string" },
                  phone: { type: "string" },
                  notes: { type: "string" }
                }
              }
            }
          }
        }
      });

      setResults(response.accounts);
    } catch (error) {
      console.error("Error parsing accounts:", error);
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
            accounts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  type: { type: "string" },
                  account_code: { type: "string" },
                  sales_rep_name: { type: "string" },
                  address: { type: "string" },
                  city: { type: "string" },
                  state: { type: "string" },
                  zip: { type: "string" },
                  phone: { type: "string" },
                  notes: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (extractResponse.status === 'success') {
        setResults(extractResponse.output.accounts || []);
      } else {
        console.error("Extraction failed:", extractResponse.details);
      }
    } catch (error) {
      console.error("Error processing file:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAccounts = async () => {
    if (!results || results.length === 0) return;

    setIsProcessing(true);
    try {
      for (const account of results) {
        await Account.create(account);
      }
      onComplete();
    } catch (error) {
      console.error("Error saving accounts:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "name,description,type,account_code,sales_rep_name,address,city,state,zip,phone,notes\n" +
      "The Golden Leaf Restaurant,Upscale dining establishment specializing in contemporary cuisine,restaurant,ACC001,John Smith,123 Main St,New York,NY,10001,555-1234,VIP client\n" +
      "Midnight Lounge,Cocktail bar with craft drinks and live music,bar,ACC002,Jane Doe,456 Oak Ave,Los Angeles,CA,90001,555-5678,New account\n" +
      "Grand Plaza Hotel,Luxury hotel with multiple dining venues,hotel,ACC003,Bob Johnson,789 Pine Rd,Chicago,IL,60601,555-9012,Preferred partner";
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'account_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-emerald-600" />
            <CardTitle className="text-emerald-900">Bulk Import Accounts</CardTitle>
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
                className={importMethod === 'text' ? 'bg-emerald-600' : ''}
              >
                Text Input
              </Button>
              <Button
                variant={importMethod === 'file' ? 'default' : 'outline'}
                onClick={() => setImportMethod('file')}
                className={importMethod === 'file' ? 'bg-emerald-600' : ''}
              >
                Upload File
              </Button>
            </div>

            {importMethod === 'text' && (
              <div>
                <Label htmlFor="text">Account Information</Label>
                <Textarea
                  id="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste your client/account information here... Can be from CRM exports, contact lists, or any text format."
                  className="h-64"
                />
              </div>
            )}

            {importMethod === 'file' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">Upload File (CSV, PDF, TXT, or Image)</Label>
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
                  <span className="text-sm text-emerald-600">Use this template for CSV imports</span>
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
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Parse Accounts
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-emerald-900 mb-4">
                Found {results.length} Account{results.length !== 1 ? 's' : ''}
              </h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {results.map((account, index) => (
                  <div key={index} className="p-4 bg-emerald-50 rounded-lg">
                    <h4 className="font-semibold text-emerald-900">{account.name}</h4>
                    {account.description && <p className="text-sm text-emerald-700 mt-1">{account.description}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded">
                        {account.type}
                      </span>
                      {account.account_code && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Code: {account.account_code}</span>}
                      {account.sales_rep_name && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Rep: {account.sales_rep_name}</span>}
                    </div>
                    {(account.address || account.city || account.phone) && (
                      <div className="text-xs text-emerald-600 mt-2 space-y-1">
                        {account.address && <div>{account.address}{account.city ? `, ${account.city}` : ''}{account.state ? `, ${account.state}` : ''} {account.zip || ''}</div>}
                        {account.phone && <div>Phone: {account.phone}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setResults(null)}>
                Back to Edit
              </Button>
              <Button 
                onClick={handleSaveAccounts}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import All Accounts
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