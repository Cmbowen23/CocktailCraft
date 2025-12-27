// components/ingredients/BulkIngredientImporter.js
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  X,
  Loader2,
  Download,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  InvokeLLM,
  UploadFile,
  ExtractDataFromUploadedFile,
} from "@/api/integrations";
import { Ingredient } from "@/api/entities";

function normalizeCase(name) {
  if (!name || typeof name !== "string") return name;

  // Detect "Title Case" (likely already normalized)
  const words = name.split(/\s+/);
  const titleCaseCount = words.filter((w) =>
    /^[A-Z][a-z]+$/.test(w)
  ).length;
  const allCapsCount = words.filter((w) =>
    /^[A-Z]+$/.test(w)
  ).length;

  if (titleCaseCount >= words.length / 2 && allCapsCount === 0) {
    return name;
  }

  const isAllCaps = !/[a-z]/.test(name) && /[A-Z]/.test(name);
  const isAllLowerCase = !/[A-Z]/.test(name) && /[a-z]/.test(name);

  if (isAllCaps || isAllLowerCase) {
    return name
      .toLowerCase()
      .replace(/(?:^|\s|-)\S/g, (a) => a.toUpperCase());
  }

  return name;
}

// ---------- CSV parsing (fast path) ----------
// Designed for files like: Product, SKU, Bottle Price
const parseCsvContentToIngredients = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) return [];

  const rawHeaders = lines[0].split(",").map((h) => h.trim());
  const headersNorm = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[\s_\-]/g, "")
  );

  const idxNorm = (candidates) => {
    for (const cand of candidates) {
      const norm = cand.toLowerCase().replace(/[\s_\-]/g, "");
      const i = headersNorm.indexOf(norm);
      if (i !== -1) return i;
    }
    return -1;
  };

  const idxName = idxNorm(["name", "product", "productname"]);
  const idxSku = idxNorm(["sku", "skunumber", "itemnumber", "item"]);
  const idxPrice = idxNorm([
    "costperunit",
    "purchaseprice",
    "bottleprice",
    "price",
  ]);
  const idxUnit = idxNorm(["unit", "uom", "measure"]);

  const result = [];

  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split(",").map((c) => c.trim());
    if (!cols.length || !cols[0]) continue;

    const name = idxName >= 0 ? cols[idxName] : cols[0];

    let sku_number = null;
    if (idxSku >= 0 && cols[idxSku]) {
      sku_number = cols[idxSku];
    }

    let cost_per_unit = null;
    if (idxPrice >= 0 && cols[idxPrice]) {
      const parsed = parseFloat(cols[idxPrice].replace(/[^0-9.\-]/g, ""));
      if (!isNaN(parsed)) cost_per_unit = parsed;
    }

    let unit = null;
    if (idxUnit >= 0 && cols[idxUnit]) {
      unit = cols[idxUnit];
    }

    result.push({
      name: normalizeCase(name),
      sku_number,
      cost_per_unit,
      unit: unit || undefined,
    });
  }

  return result;
};

// ---------- helpers for matching & diffs ----------

const findExistingIngredient = (imported, existingIngredients) => {
  const existing = Array.isArray(existingIngredients)
    ? existingIngredients
    : [];

  // 1) SKU match
  if (imported.sku_number) {
    const bySku = existing.find(
      (ing) =>
        String(ing.sku_number || "").trim() ===
        String(imported.sku_number).trim()
    );

    if (bySku) return bySku;
  }

  // 2) Normalized name + unit
  if (imported.name) {
    const nameLower = imported.name.toLowerCase();
    const unitLower = (imported.unit || "").toLowerCase();

    const byNameAndUnit = existing.find((ing) => {
      const ingName = (ing.name || "").toLowerCase();
      const ingUnit = (ing.unit || "").toLowerCase();
      return ingName === nameLower && ingUnit === unitLower;
    });

    if (byNameAndUnit) return byNameAndUnit;
  }

  return undefined;
};

// only price + missing SKU
const getChangedFields = (imported, existing) => {
  const changed = {};

  if (typeof imported.cost_per_unit === "number" && imported.cost_per_unit > 0) {
    const newPrice = imported.cost_per_unit;
    const currentPrice =
      typeof existing.cost_per_unit === "number"
        ? existing.cost_per_unit
        : null;

    if (currentPrice === null || Number(currentPrice) !== Number(newPrice)) {
      changed.cost_per_unit = newPrice;
    }
  }

  if (
    imported.sku_number &&
    !existing.sku_number &&
    String(imported.sku_number).trim().length > 0
  ) {
    changed.sku_number = imported.sku_number;
  }

  return changed;
};

const buildAuditSummary = (parsedIngredients, existingIngredients) => {
  const existing = Array.isArray(existingIngredients)
    ? existingIngredients
    : [];

  let newCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  const priceChanges = [];

  for (const imp of parsedIngredients) {
    const existingMatch = findExistingIngredient(imp, existing);

    if (!existingMatch) {
      newCount += 1;
      continue;
    }

    const changedFields = getChangedFields(imp, existingMatch);

    if (Object.keys(changedFields).length === 0) {
      unchangedCount += 1;
    } else {
      updateCount += 1;

      if (typeof changedFields.cost_per_unit === "number") {
        const oldPrice =
          typeof existingMatch.cost_per_unit === "number"
            ? existingMatch.cost_per_unit
            : null;
        const newPrice = changedFields.cost_per_unit;

        priceChanges.push({
          name: existingMatch.name || imp.name,
          sku_number: imp.sku_number || existingMatch.sku_number || null,
          oldPrice,
          newPrice,
        });
      }
    }
  }

  // detect duplicates in imported CSV by SKU
  const skuGroups = parsedIngredients.reduce((acc, imp) => {
    const sku = String(imp.sku_number || "").trim();
    if (!sku) return acc;
    if (!acc[sku]) acc[sku] = [];
    acc[sku].push(imp.name);
    return acc;
  }, {});

  const duplicateSkusInImport = Object.entries(skuGroups)
    .filter(([, names]) => names.length > 1)
    .map(([sku_number, names]) => ({ sku_number, names }));

  // duplicates in existing DB by SKU
  const existingSkuGroups = existing.reduce((acc, ing) => {
    const sku = String(ing.sku_number || "").trim();
    if (!sku) return acc;
    if (!acc[sku]) acc[sku] = [];
    acc[sku].push(ing.name);
    return acc;
  }, {});

  const duplicateSkusInExisting = Object.entries(existingSkuGroups)
    .filter(([, names]) => names.length > 1)
    .map(([sku_number, names]) => ({ sku_number, names }));

  return {
    total: parsedIngredients.length,
    newCount,
    updateCount,
    unchangedCount,
    priceChanges,
    duplicateSkusInImport,
    duplicateSkusInExisting,
  };
};

export default function BulkIngredientImporter({
  existingIngredients = [],
  onComplete,
}) {
  const [mode, setMode] = useState("csv"); // "csv" | "text"
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedIngredients, setParsedIngredients] = useState(null);
  const [auditSummary, setAuditSummary] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setTextInput("");
      setParsedIngredients(null);
      setAuditSummary(null);
      setError("");
    }
  };

  const handleParseCsv = async () => {
    if (!selectedFile) {
      setError("Please select a CSV file first.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setProgress("Reading CSV file...");

    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result;
          setProgress("Parsing CSV...");
          const processedIngredients = parseCsvContentToIngredients(text);
          setParsedIngredients(processedIngredients);

          const summary = buildAuditSummary(
            processedIngredients,
            existingIngredients
          );
          setAuditSummary(summary);
        } catch (parseError) {
          console.error("Error parsing CSV:", parseError);
          setError("Failed to parse CSV file. Please check its format.");
        } finally {
          setIsProcessing(false);
          setProgress("");
        }
      };
      reader.onerror = () => {
        setError("Error reading file. Please try again.");
        setIsProcessing(false);
        setProgress("");
      };
      reader.readAsText(selectedFile);
    } catch (error) {
      console.error("Error handling CSV file:", error);
      setError("Unexpected error while reading CSV file.");
      setIsProcessing(false);
      setProgress("");
    }
  };

  const handleParseTextWithLLM = async () => {
    if (!textInput.trim()) {
      setError("Please paste some text to parse.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setProgress("Sending text to LLM to extract ingredients...");

    try {
      const response = await InvokeLLM({
        prompt: `Parse this text and extract all ingredients with their details.

Text to parse:
${textInput}

For each ingredient, extract:
- name: ingredient name
- category: one of (spirit, liqueur, syrup, bitters, juice, fresh, mixer, garnish, other)
- spirit_type: type of spirit if applicable (e.g., Gin, Bourbon, Vodka, Tequila, Rum)
- style: style or sub-category (e.g., London Dry, Reposado, Blanco)
- substyle: additional style detail if applicable
- region: geographic region or appellation (e.g., Islay, Kentucky, Jalisco)
- cost_per_unit: cost per unit (number only, no dollar sign)
- unit: measurement unit (oz, ml, piece, etc.)
- supplier: supplier/brand name if mentioned
- abv: alcohol percentage if mentioned (number only)
- exclusive: whether this is an exclusive product (boolean: true or false)
- sku_number: SKU or item number if provided
- notes: any additional notes

Return ALL ingredients you can identify from the text.`,
        response_json_schema: {
          type: "object",
          properties: {
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  category: { type: "string" },
                  spirit_type: { type: "string" },
                  style: { type: "string" },
                  substyle: { type: "string" },
                  region: { type: "string" },
                  cost_per_unit: { type: "number" },
                  unit: { type: "string" },
                  supplier: { type: "string" },
                  abv: { type: "number" },
                  exclusive: { type: "boolean" },
                  sku_number: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
          required: ["ingredients"],
        },
      });

      const rawIngredients = response?.ingredients || [];
      const processedIngredients = rawIngredients.map((ing) => ({
        ...ing,
        name: normalizeCase(ing.name),
      }));

      setParsedIngredients(processedIngredients);

      const summary = buildAuditSummary(
        processedIngredients,
        existingIngredients
      );
      setAuditSummary(summary);
    } catch (error) {
      console.error("Error parsing text with LLM:", error);
      setError(
        "Failed to parse text with LLM. Please try again or check your input."
      );
    } finally {
      setIsProcessing(false);
      setProgress("");
    }
  };

  const handleParseUploadedDoc = async () => {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setProgress("Uploading file...");

    try {
      const uploadResponse = await UploadFile({ file: selectedFile });
      const fileId = uploadResponse?.file_id;

      if (!fileId) {
        throw new Error("No file_id returned from upload.");
      }

      setProgress("Extracting data from uploaded file...");

      const extractResponse = await ExtractDataFromUploadedFile({
        file_id: fileId,
      });

      const fileText = extractResponse?.text_content;

      if (!fileText || !fileText.trim()) {
        throw new Error(
          "No text content could be extracted from the uploaded file."
        );
      }

      setProgress("Parsing extracted text with LLM...");

      const response = await InvokeLLM({
        prompt: `Parse this extracted text and extract all ingredients with their details.

Text to parse:
${fileText}

For each ingredient, extract:
- name: ingredient name
- category: one of (spirit, liqueur, syrup, bitters, juice, fresh, mixer, garnish, other)
- spirit_type: type of spirit if applicable (e.g., Gin, Bourbon, Vodka, Tequila, Rum)
- style: style or sub-category (e.g., London Dry, Reposado, Blanco)
- substyle: additional style detail if applicable
- region: geographic region or appellation (e.g., Islay, Kentucky, Jalisco)
- cost_per_unit: cost per unit (number only, no dollar sign)
- unit: measurement unit (oz, ml, piece, etc.)
- supplier: supplier/brand name if mentioned
- abv: alcohol percentage if mentioned (number only)
- exclusive: whether this is an exclusive product (boolean: true or false)
- sku_number: SKU or item number if provided
- notes: any additional notes

Return ALL ingredients you can identify from the text.`,
        response_json_schema: {
          type: "object",
          properties: {
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  category: { type: "string" },
                  spirit_type: { type: "string" },
                  style: { type: "string" },
                  substyle: { type: "string" },
                  region: { type: "string" },
                  cost_per_unit: { type: "number" },
                  unit: { type: "string" },
                  supplier: { type: "string" },
                  abv: { type: "number" },
                  exclusive: { type: "boolean" },
                  sku_number: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
          required: ["ingredients"],
        },
      });

      const rawIngredients = response?.ingredients || [];
      const processedIngredients = rawIngredients.map((ing) => ({
        ...ing,
        name: normalizeCase(ing.name),
      }));

      setParsedIngredients(processedIngredients);

      const summary = buildAuditSummary(
        processedIngredients,
        existingIngredients
      );
      setAuditSummary(summary);
    } catch (error) {
      console.error("Error parsing uploaded document with LLM:", error);
      setError(
        "Failed to parse uploaded document. Please check the console for details."
      );
    } finally {
      setIsProcessing(false);
      setProgress("");
    }
  };

  const handleDownloadTemplate = () => {
    const header = "name,sku_number,cost_per_unit,unit\n";
    const example = "Example Product,123456,19.99,oz\n";
    const blob = new Blob([header + example], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ingredient_price_update_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setTextInput("");
    setSelectedFile(null);
    setParsedIngredients(null);
    setAuditSummary(null);
    setError("");
    setProgress("");
  };

  const handleSaveIngredients = async () => {
    if (!parsedIngredients || parsedIngredients.length === 0) {
      setError("No ingredients to save.");
      return;
    }

    setIsProcessing(true);
    setProgress("Saving ingredients...");

    const existing = Array.isArray(existingIngredients)
      ? existingIngredients
      : [];

    const ingredientsToCreate = [];
    const ingredientsToUpdate = [];

    for (const ingredient of parsedIngredients) {
      const existingMatch = findExistingIngredient(ingredient, existing);

      if (!existingMatch) {
        // new ingredient
        ingredientsToCreate.push({
          name: ingredient.name,
          category: ingredient.category,
          spirit_type: ingredient.spirit_type || null,
          style: ingredient.style || null,
          substyle: ingredient.substyle || null,
          region: ingredient.region || null,
          unit: ingredient.unit || "oz",
          cost_per_unit:
            typeof ingredient.cost_per_unit === "number"
              ? ingredient.cost_per_unit
              : 0,
          supplier: ingredient.supplier || "",
          abv: typeof ingredient.abv === "number" ? ingredient.abv : 0,
          exclusive:
            typeof ingredient.exclusive === "boolean"
              ? ingredient.exclusive
              : false,
          sku_number: ingredient.sku_number || null,
          description: ingredient.notes || "",
        });
      } else {
        // existing ingredient: only price + missing SKU
        const changedFields = getChangedFields(ingredient, existingMatch);
        if (Object.keys(changedFields).length > 0) {
          ingredientsToUpdate.push({
            id: existingMatch.id,
            data: changedFields,
          });
        }
      }
    }

    try {
      if (ingredientsToCreate.length > 0) {
        await Ingredient.bulkCreate(ingredientsToCreate);
      }

      if (ingredientsToUpdate.length > 0) {
        if (typeof Ingredient.bulkUpdate === "function") {
          // Fast path: server-side bulk update if available
          await Ingredient.bulkUpdate(ingredientsToUpdate);
        } else if (typeof Ingredient.update === "function") {
          // Fallback: client-side batching with limited concurrency
          const concurrency = 5; // tune this if you hit rate limits
          for (let i = 0; i < ingredientsToUpdate.length; i += concurrency) {
            const batch = ingredientsToUpdate.slice(i, i + concurrency);
            await Promise.all(
              batch.map(async ({ id, data }) => {
                try {
                  await Ingredient.update(id, data);
                } catch (err) {
                  console.error(
                    `Failed to update ingredient ${id} in bulk importer`,
                    err
                  );
                }
              })
            );
          }
        } else {
          console.warn(
            "No update method (bulkUpdate / update) found on Ingredient."
          );
        }
      }

      onComplete();
    } catch (error) {
      console.error("Error saving ingredients:", error);
      setError(
        "Failed to save some ingredients. Please check console for details."
      );
    } finally {
      setIsProcessing(false);
      setProgress("");
    }
  };

  const getBadgeVariantForCategory = (category) => {
    if (!category) return "outline";

    switch (category.toLowerCase()) {
      case "spirit":
        return "default";
      case "liqueur":
        return "secondary";
      case "syrup":
      case "mixer":
        return "outline";
      default:
        return "outline";
    }
  };

  const getBadgeStyleForCategory = (category) => {
    if (!category) return "";

    switch (category.toLowerCase()) {
      case "spirit":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "liqueur":
        return "bg-purple-50 text-purple-800 border-purple-200";
      case "syrup":
      case "mixer":
        return "bg-amber-50 text-amber-800 border-amber-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // ---------- UI ----------

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-gray-900">
              Bulk Ingredient Importer
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={mode === "csv" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("csv")}
            >
              CSV / Spreadsheet
            </Button>
            <Button
              variant={mode === "text" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("text")}
            >
              LLM Text Parsing
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6"
              onClick={() => setError("")}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {mode === "csv" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-800">
                  CSV Price Update Import
                </Label>
                <p className="text-xs text-gray-600 max-w-xl">
                  Upload a CSV containing ingredient name, SKU, cost per unit,
                  and unit. This will only update prices and missing SKUs for
                  matching ingredients. No new ingredients will be created
                  unless there is no match.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="text-xs"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download Template
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                  className="cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-xs text-gray-500">
                    Selected file: {selectedFile.name}
                  </p>
                )}
                <p className="text-[11px] text-gray-500">
                  Expected headers (case-insensitive): name, sku_number, cost
                  per unit, unit. Extra columns are ignored.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleParseCsv}
                  disabled={!selectedFile || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Parse CSV
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-800">
                Paste Text or Use Uploaded Docs
              </Label>
              <p className="text-xs text-gray-600 max-w-xl">
                Paste any product list or portfolio document text here, or
                upload a PDF/Word/Excel file to extract products with LLM.
              </p>
            </div>

            <Textarea
              rows={10}
              value={textInput}
              onChange={(e) => {
                setTextInput(e.target.value);
                setParsedIngredients(null);
                setAuditSummary(null);
              }}
              placeholder="Paste product list text here..."
              disabled={isProcessing}
            />

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                  className="cursor-pointer w-64"
                />
                {selectedFile && (
                  <span className="text-xs text-gray-500">
                    {selectedFile.name}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleParseTextWithLLM}
                  disabled={isProcessing || !textInput.trim()}
                  variant="default"
                  size="sm"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Parsing Text...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Parse Text with LLM
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleParseUploadedDoc}
                  disabled={isProcessing || !selectedFile}
                  variant="outline"
                  size="sm"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Parsing File...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Extract & Parse Uploaded File
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {progress && (
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
            {progress}
          </div>
        )}

        {auditSummary && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm space-y-2">
            <div className="font-medium text-slate-900">
              Import summary: {auditSummary.total} row
              {auditSummary.total === 1 ? "" : "s"} •{" "}
              {auditSummary.updateCount} price update
              {auditSummary.updateCount === 1 ? "" : "s"} •{" "}
              {auditSummary.unchangedCount} unchanged •{" "}
              {auditSummary.newCount} new / no match
            </div>

            {auditSummary.priceChanges.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">
                  Price changes (showing first{" "}
                  {Math.min(20, auditSummary.priceChanges.length)}):
                </div>
                <ul className="text-xs text-slate-700 space-y-1">
                  {auditSummary.priceChanges
                    .slice(0, 20)
                    .map((chg, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="font-medium">
                          {chg.name}
                          {chg.sku_number
                            ? ` (SKU ${chg.sku_number})`
                            : ""}
                        </span>
                        <span className="text-slate-500">
                          {chg.oldPrice != null
                            ? `$${chg.oldPrice.toFixed(2)}`
                            : "N/A"}{" "}
                          →{" "}
                          <span className="text-blue-700 font-semibold">
                            ${chg.newPrice.toFixed(2)}
                          </span>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {(auditSummary.duplicateSkusInImport.length > 0 ||
              auditSummary.duplicateSkusInExisting.length > 0) && (
              <div className="mt-2 space-y-2">
                {auditSummary.duplicateSkusInImport.length > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    <div className="font-semibold flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3" />
                      Duplicate SKUs in import file
                    </div>
                    <ul className="space-y-1">
                      {auditSummary.duplicateSkusInImport.map((d, idx) => (
                        <li key={idx}>
                          <span className="font-mono text-amber-900">
                            {d.sku_number}
                          </span>{" "}
                          used for: {d.names.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {auditSummary.duplicateSkusInExisting.length > 0 && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    <div className="font-semibold flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3" />
                      Duplicate SKUs in existing database
                    </div>
                    <ul className="space-y-1">
                      {auditSummary.duplicateSkusInExisting.map((d, idx) => (
                        <li key={idx}>
                          <span className="font-mono text-red-900">
                            {d.sku_number}
                          </span>{" "}
                          used for: {d.names.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100 mt-2">
          <Button
            onClick={handleSaveIngredients}
            disabled={
              isProcessing || !parsedIngredients || parsedIngredients.length === 0
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Import Ingredients
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
