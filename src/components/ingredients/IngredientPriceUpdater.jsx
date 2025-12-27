import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  X,
  Loader2,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function IngredientPriceUpdater({ onComplete, onCancel }) {
  const [step, setStep] = useState("upload");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedPriceUpdates, setParsedPriceUpdates] = useState([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  // ---------- Helpers ----------

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // update a single variant with retry; NEVER throws, returns true/false
  const updateVariantWithRetry = async (ProductVariantApi, updateObj) => {
    const maxAttempts = 10;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const payload = {
          purchase_price: updateObj.purchase_price,
        };
        if (updateObj.case_price !== undefined && updateObj.case_price !== null) {
          payload.case_price = updateObj.case_price;
        }
        if (updateObj.bottles_per_case !== undefined && updateObj.bottles_per_case !== null) {
          payload.bottles_per_case = updateObj.bottles_per_case;
        }
        
        await ProductVariantApi.update(updateObj.id, payload);
        return true; // success
      } catch (err) {
        const msg = (err?.message || err?.toString() || "").toLowerCase();
        const isRateLimit =
          msg.includes("rate limit") ||
          msg.includes("429") ||
          msg.includes("too many");

        if (!isRateLimit) {
          // some other error (validation, etc.) – log and give up
          console.error(
            `Permanent error updating variant ${updateObj.id}:`,
            err
          );
          return false;
        }

        // rate-limit: exponential-ish backoff with jitter
        const baseDelay = 1000; // 1s base
        const delay = baseDelay * attempt + Math.random() * 500;
        console.warn(
          `Rate limit updating variant ${updateObj.id} — retrying in ${Math.round(
            delay
          )}ms (attempt ${attempt})`
        );
        await sleep(delay);
      }
    }

    console.error(
      `Gave up updating variant ${updateObj.id} after multiple attempts due to persistent rate limiting.`
    );
    return false;
  };

  // ---------- File handling & CSV parsing ----------

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file (.csv).");
      return;
    }

    setSelectedFile(file);
    setError("");
  };

  // CSV shape: Product (optional), SKU, Purchase Price, Case Price (optional), Bottles Per Case (optional)
  const parseCSV = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("CSV must contain a header row and at least one data row.");
    }

    const rawHeaders = lines[0].split(",").map((h) => h.trim());
    const headersNorm = rawHeaders.map((h) =>
      h.toLowerCase().replace(/[\s_\-]/g, "")
    );

    const findIndex = (candidates) => {
      for (const cand of candidates) {
        const norm = cand.toLowerCase().replace(/[\s_\-]/g, "");
        const idx = headersNorm.indexOf(norm);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const nameIdx = findIndex(["product", "name", "productname", "item"]);
    const skuIdx = findIndex(["sku", "skunumber", "itemnumber"]);
    const priceIdx = findIndex([
      "purchaseprice",
      "bottleprice",
      "price",
      "bottle_price",
    ]);
    const casePriceIdx = findIndex(["caseprice", "case_price", "pricepercase"]);
    const bottlesPerCaseIdx = findIndex(["bottlespercase", "bottles_per_case", "packsize", "quantitypercase", "bottles"]);

    if (skuIdx === -1 || priceIdx === -1) {
      throw new Error(
        "CSV must contain columns for SKU and Purchase Price / Bottle Price."
      );
    }

    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]
        .split(",")
        .map((c) => c.trim().replace(/^"|"$/g, ""));

      if (cols.length <= Math.max(skuIdx, priceIdx)) continue;

      const sku = cols[skuIdx] || "";
      const rawPrice = cols[priceIdx] || "";
      const cleanedPrice = rawPrice.replace(/[$,]/g, "");
      const price = parseFloat(cleanedPrice);

      const name =
        nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx].trim() : "";

      // Parse case pricing if available
      let casePrice = null;
      if (casePriceIdx !== -1 && cols[casePriceIdx]) {
        const raw = cols[casePriceIdx].replace(/[$,]/g, "");
        const val = parseFloat(raw);
        if (!Number.isNaN(val)) casePrice = val;
      }

      let bottlesPerCase = null;
      if (bottlesPerCaseIdx !== -1 && cols[bottlesPerCaseIdx]) {
        const val = parseFloat(cols[bottlesPerCaseIdx]);
        if (!Number.isNaN(val)) bottlesPerCase = val;
      }

      if (!sku || Number.isNaN(price) || price < 0) continue;

      rows.push({
        sku: sku,
        price,
        casePrice,
        bottlesPerCase,
        name,
      });
    }

    return rows;
  };

  // ---------- Step 1: Parse CSV + preview ----------

  const handleParseFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError("");
    setProgress("Reading CSV and loading product variants...");

    try {
      const text = await selectedFile.text();
      const csvUpdatesRaw = parseCSV(text);

      if (!csvUpdatesRaw.length) {
        setError("No valid SKU / price rows found in CSV.");
        setIsProcessing(false);
        return;
      }

      // 1) De-duplicate CSV rows by SKU + price
      const seenCsv = new Set();
      const csvUpdates = [];
      for (const row of csvUpdatesRaw) {
        const key = `${String(row.sku || "").trim()}|${row.price}|${row.casePrice}|${row.bottlesPerCase}`;
        if (seenCsv.has(key)) continue;
        seenCsv.add(key);
        csvUpdates.push(row);
      }

      // Load all variants + ingredients once for fast matching
      const ProductVariantApi = base44?.entities?.ProductVariant;
      const IngredientApi = base44?.entities?.Ingredient;

      if (!ProductVariantApi || !IngredientApi) {
        throw new Error("Backend APIs for ProductVariant/Ingredient not available.");
      }

      const [allVariants, allIngredients] = await Promise.all([
        ProductVariantApi.filter({}),
        IngredientApi.list(),
      ]);

      // ingredient_id -> ingredient name
      const ingNameMap = {};
      (allIngredients || []).forEach((ing) => {
        if (ing && ing.id) {
          ingNameMap[ing.id] = ing.name || "";
        }
      });

      // sku -> all variants with that sku
      const variantsBySku = {};
      (allVariants || []).forEach((v) => {
        const sku = String(v.sku_number || "").trim();
        if (!sku) return;
        if (!variantsBySku[sku]) variantsBySku[sku] = [];
        variantsBySku[sku].push(v);
      });

      // Build raw previews with an is_changed flag
      const previewsRaw = csvUpdates.map((row) => {
        const sku = String(row.sku || "").trim();
        const variants = variantsBySku[sku] || [];

        if (!variants.length) {
          return {
            sku,
            item_name: row.name || "SKU Not Found",
            old_price: null,
            new_price: row.price,
            new_case_price: row.casePrice,
            new_bottles_per_case: row.bottlesPerCase,
            is_new_sku: true,
            is_changed: false, // no actual update, but show as warning
            variantIds: [],
            ingredient_id: null,
          };
        }

        // Choose a "primary" variant based on largest purchase_quantity or size
        let primary = variants[0];
        variants.forEach((v) => {
          const base =
            Number(v.purchase_quantity || 0) ||
            Number(v.size_ml || 0) ||
            0;
          const currentBase =
            Number(primary.purchase_quantity || 0) ||
            Number(primary.size_ml || 0) ||
            0;
          if (base > currentBase) {
            primary = v;
          }
        });

        const oldPrice =
          primary.purchase_price != null ? Number(primary.purchase_price) : null;
        const oldCasePrice = primary.case_price != null ? Number(primary.case_price) : null;
        const oldBottlesPerCase = primary.bottles_per_case != null ? Number(primary.bottles_per_case) : null;

        const ingredientName =
          ingNameMap[primary.ingredient_id] || row.name || "Unknown Item";

        let isChanged = oldPrice == null || Number(oldPrice) !== Number(row.price);
        
        // Check for case price changes
        if (row.casePrice != null && Number(row.casePrice) !== Number(oldCasePrice || 0)) {
          isChanged = true;
        }
        
        // Check for bottles per case changes
        if (row.bottlesPerCase != null && Number(row.bottlesPerCase) !== Number(oldBottlesPerCase || 0)) {
          isChanged = true;
        }

        return {
          sku,
          item_name: ingredientName,
          old_price: oldPrice,
          new_price: row.price,
          new_case_price: row.casePrice,
          new_bottles_per_case: row.bottlesPerCase,
          is_new_sku: false,
          is_changed: isChanged,
          variantIds: variants.map((v) => v.id),
          ingredient_id: primary.ingredient_id,
        };
      });

      // 2) De-duplicate previews AND drop unchanged SKUs
      //    (only show real changes or missing SKUs)
      const seenPreview = new Set();
      const previews = [];
      for (const p of previewsRaw) {
        const key = `${p.sku}|${p.new_price}|${p.new_case_price}|${p.new_bottles_per_case}`;
        if (seenPreview.has(key)) continue;
        seenPreview.add(key);

        // show:
        // - SKUs with a real price change
        // - SKUs not found (so you can fix them)
        if (!p.is_new_sku && !p.is_changed) continue;

        previews.push(p);
      }

      setParsedPriceUpdates(previews);
      setStep("confirm");
      setProgress("");
    } catch (err) {
      console.error("Error parsing or loading data:", err);
      setError(`Failed to parse CSV or load data: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------- Step 2: Apply updates (sequential, retry) ----------

  const handleApplyUpdates = async () => {
    setIsProcessing(true);
    setError("");
    setProgress("");

    try {
      const ProductVariantApi = base44?.entities?.ProductVariant;
      if (!ProductVariantApi) {
        throw new Error("ProductVariant API not available.");
      }

      // Flat list of variant updates: only changed SKUs that exist
      const updates = [];
      parsedPriceUpdates.forEach((u) => {
        if (u.is_new_sku) return; // never create variants for unknown SKUs
        if (!u.is_changed) return; // guardrail: skip no-op matches
        (u.variantIds || []).forEach((id) => {
          updates.push({
            id,
            purchase_price: u.new_price,
            case_price: u.new_case_price,
            bottles_per_case: u.new_bottles_per_case
          });
        });
      });

      if (!updates.length) {
        setProgress("No price changes to apply. Done.");
        setTimeout(() => onComplete && onComplete(), 1000);
        return;
      }

      const total = updates.length;
      let processed = 0;
      let successes = 0;
      let failures = 0;

      for (const u of updates) {
        setProgress(
          `Applying price updates... (${processed}/${total})`
        );

        const ok = await updateVariantWithRetry(ProductVariantApi, u);
        if (ok) {
          successes++;
        } else {
          failures++;
        }

        processed++;

        // throttle between calls
        await sleep(250); // 0.25s between each

        // every 50 updates, take a longer breather
        if (processed % 50 === 0) {
          await sleep(8000); // 8s pause every 50 writes
        }
      }

      setProgress(
        `Finished. Updated ${successes} variant price${
          successes === 1 ? "" : "s"
        }${failures ? `, ${failures} failed (check console).` : "."}`
      );
      setTimeout(() => {
        onComplete && onComplete();
      }, 1500);
    } catch (err) {
      console.error("Error applying price updates:", err);
      setError(
        "Unexpected error applying price updates. Some updates may not have been applied."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------- Template download ----------

  const downloadTemplate = () => {
    const templateData =
      "Product,SKU,Purchase Price,Case Price,Bottles Per Case\n" +
      "Example Whiskey,77340,18.99,110.00,6\n" +
      "Example Tequila,123456,37.60,215.00,6\n";
    const blob = new Blob([templateData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "monthly_price_update_template.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ---------- UI: Step 2 (Confirm) ----------

  if (step === "confirm") {
    const changedCount = parsedPriceUpdates.filter(
      (p) => !p.is_new_sku
    ).length;
    const unmatchedCount = parsedPriceUpdates.filter(
      (p) => p.is_new_sku
    ).length;

    return (
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-blue-900">
              Confirm Price Updates
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {progress && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="text-blue-700">{progress}</span>
              </div>
            )}
            {!progress && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>
                    Ready to apply {changedCount} price update
                    {changedCount === 1 ? "" : "s"}.
                  </strong>{" "}
                  This will update bottle purchase prices for matching SKUs.
                  {unmatchedCount > 0 && (
                    <>
                      {" "}
                      <span>
                        ({unmatchedCount} SKU
                        {unmatchedCount === 1 ? "" : "s"} not found and will
                        be skipped.)
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto border rounded-lg p-3 bg-gray-50">
              <h4 className="text-md font-semibold text-gray-800 mb-2">
                Updates to be applied:
              </h4>
              <ul className="space-y-2">
                {parsedPriceUpdates.map((update, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center text-sm text-gray-700 p-2 border-b last:border-b-0"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {update.item_name}
                      </span>
                      <span className="text-xs text-gray-600">
                        SKU: {update.sku}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      {update.is_new_sku ? (
                        <span className="text-orange-500 font-semibold">
                          SKU Not Found
                        </span>
                      ) : (
                        <>
                          <span className="text-gray-500 line-through text-xs">
                            Old:{" "}
                            {update.old_price != null
                              ? `$${Number(update.old_price).toFixed(2)}`
                              : "—"}
                          </span>
                          <span className="font-bold text-green-700">
                            New: ${Number(update.new_price).toFixed(2)}
                          </span>
                          {update.new_case_price && (
                            <div className="text-xs text-blue-600 mt-1">
                               Case: ${update.new_case_price.toFixed(2)} ({update.new_bottles_per_case} btls)
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back to Upload
              </Button>
              <Button
                onClick={handleApplyUpdates}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Apply Updates
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---------- UI: Step 1 (Upload) ----------

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-blue-900">
              Monthly Price Update
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {progress && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="text-blue-700">{progress}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Upload CSV File</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileUpload}
                accept=".csv"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload a CSV with columns: Product (optional), SKU, Purchase
                Price, Case Price (optional), Bottles Per Case (optional).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
              <span className="text-sm text-blue-600">
                Use this template for monthly price updates.
              </span>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">
              Template Format:
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>
                <strong>Columns:</strong> Product, SKU, Purchase
                Price, Case Price, Bottles Per Case
              </p>
              <p className="mt-2 text-xs text-blue-600">
                ⚠️ This will only update existing variants. It will{" "}
                <strong>never</strong> create new ingredients or size
                variants. SKUs not found are listed but not updated.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleParseFile}
              disabled={!selectedFile || isProcessing}
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
                  Parse CSV
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}