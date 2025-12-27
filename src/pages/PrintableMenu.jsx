import React, { useState, useEffect } from 'react';
import { Menu } from '@/api/entities';
import { Recipe } from '@/api/entities';
import { Ingredient } from '@/api/entities';
import { Loader2 } from 'lucide-react';
import { convertToMl, calculateIngredientCost, findMatchingIngredient, formatCurrency } from '../components/utils/costCalculations';
import { calculateBatchCostAndYield } from '../components/utils/batchCalculations';

const batchingRules = {
  spirit: { timing: 'pre-batch' },
  liqueur: { timing: 'pre-batch' },
  syrup: { timing: 'pre-batch' },
  bitters: { timing: 'pre-batch' },
  juice: { timing: 'day-of' },
  fresh: { timing: 'day-of' },
  mixer: { timing: 'per-serving' },
  garnish: { timing: 'per-serving' },
  other: { timing: 'day-of' }
};

export default function PrintableMenu() {
    const [menu, setMenu] = useState(null);
    const [recipes, setRecipes] = useState([]);
    const [allIngredients, setAllIngredients] = useState([]);
    const [viewModes, setViewModes] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const menuId = urlParams.get('id');
        const encodedModes = urlParams.get('viewModes');

        let parsedModes = {};
        if (encodedModes) {
            try {
                const decodedModes = decodeURIComponent(encodedModes);
                parsedModes = JSON.parse(decodedModes);
            } catch (e) {
                console.error("Error parsing viewModes from URL:", e);
                parsedModes = {}; // Default to empty if parsing fails
            }
        }

        setViewModes(parsedModes);

        if (menuId) {
            loadPrintData(menuId);
        } else {
            setError("No Menu ID provided.");
            setIsLoading(false);
        }
    }, []);

    const loadPrintData = async (menuId) => {
        try {
            const [menuData, recipeData, ingredientsData] = await Promise.all([
                Menu.get(menuId),
                Recipe.filter({ menu_id: menuId }),
                Ingredient.list()
            ]);
            setMenu(menuData);
            setRecipes(recipeData || []);
            setAllIngredients(ingredientsData || []);
            // Trigger print once data is loaded
            setTimeout(() => window.print(), 500);
        } catch (e) {
            console.error("Failed to load print data:", e);
            setError("Could not load data for printing.");
        } finally {
            setIsLoading(false);
        }
    };

    const generateSpecForRecipe = (recipe) => {
        // Single Spec Details Calculation
        let singleSpecTotalCost = 0;
        let totalAlcoholMl = 0;
        let totalVolumeMl = 0;

        const singleSpecIngredients = recipe.ingredients?.map((recipeIngredient) => {
            const matchedIngredient = findMatchingIngredient(recipeIngredient.ingredient_name, allIngredients);
            const amount = parseFloat(recipeIngredient.amount) || 0;
            const cost = calculateIngredientCost(matchedIngredient, amount, recipeIngredient.unit);
            singleSpecTotalCost += cost;

            const volumeInMl = convertToMl(amount, recipeIngredient.unit);
            if (volumeInMl > 0) {
                totalVolumeMl += volumeInMl;
                if (matchedIngredient && parseFloat(matchedIngredient.abv) > 0) {
                    totalAlcoholMl += volumeInMl * (parseFloat(matchedIngredient.abv) / 100);
                }
            }

            return {
                ...recipeIngredient,
                scaledAmount: amount.toFixed(2),
                cost: cost,
            };
        }) || [];

        // Assuming 25% dilution for single spec to calculate final volume and ABV
        const finalVolumeMl = totalVolumeMl * 1.25;
        const singleSpecAbv = finalVolumeMl > 0 ? (totalAlcoholMl / finalVolumeMl) * 100 : 0;
        const suggestedPrice = Math.round(singleSpecTotalCost * 5); // Multiplier is 5 as per outline

        // Service Spec Details Calculation
        const getIngredientCategory = (ingredientName) => {
            const ingredient = findMatchingIngredient(ingredientName, allIngredients);
            return ingredient?.category?.toLowerCase().trim() || 'other';
        };

        const preBatchItems = [];
        const serviceItems = [];
        let preBatchVolumeMl = 0;
        let preBatchCost = 0;
        const ingredientOverrides = recipe?.batch_settings?.ingredient_overrides || {};
        recipe.ingredients?.forEach(ing => {
            const category = getIngredientCategory(ing.ingredient_name);
            const defaultRule = batchingRules[category] || batchingRules.other;
            const override = ingredientOverrides[ing.ingredient_name];
            let isBatch = override === 'batch' ? true : (override === 'service' ? false : defaultRule.timing === 'pre-batch');

            const matchedIngredient = findMatchingIngredient(ing.ingredient_name, allIngredients);
            const amount = parseFloat(ing.amount) || 0;
            const cost = calculateIngredientCost(matchedIngredient, amount, ing.unit);

            if (isBatch) {
                preBatchItems.push(ing);
                preBatchVolumeMl += convertToMl(amount, ing.unit);
                preBatchCost += cost;
            } else {
                serviceItems.push({ ...ing, scaledAmount: amount.toFixed(2), cost: cost, isBatch: false });
            }
        });

        let effectiveBatchVolumeMl = preBatchVolumeMl;
        let dilutionPercentage = recipe?.batch_settings?.dilution_percentage || 25;
        if (recipe?.batch_settings?.include_dilution && preBatchVolumeMl > 0) {
            effectiveBatchVolumeMl += preBatchVolumeMl * (dilutionPercentage / 100);
        }
        if (preBatchItems.length > 0) {
            const batchAmountOz = effectiveBatchVolumeMl / 29.5735; // Convert ml to oz for display
            serviceItems.unshift({
                ingredient_name: `${recipe.name} Batch`,
                amount: batchAmountOz,
                unit: 'oz',
                cost: preBatchCost,
                scaledAmount: batchAmountOz.toFixed(2),
                notes: `Contains: ${preBatchItems.map(i => i.ingredient_name).join(', ')}` +
                       (recipe?.batch_settings?.include_dilution && preBatchVolumeMl > 0 ? ` (+${dilutionPercentage}% Dilution Water)` : ''),
                isBatch: true,
            });
        }
        const serviceSpecTotalCost = serviceItems.reduce((acc, i) => acc + i.cost, 0);

        // Determine what to print
        const isServiceSpec = viewModes[recipe.id] === 'service_spec';
        const printItems = isServiceSpec ? serviceItems : singleSpecIngredients;
        const printCost = isServiceSpec ? serviceSpecTotalCost : singleSpecTotalCost;
        const specTitle = isServiceSpec ? 'SERVICE SPEC' : 'COCKTAIL SPEC';
        const buildType = isServiceSpec ? 'Service Build' : 'Single Build';
        
        let batchSummaryHtml = '';
        if (recipe.batch_settings) {
            const batchData = calculateBatchCostAndYield({ recipe, allIngredients });
            if (batchData) {
                batchSummaryHtml = `
                    <div class="batch-summary">
                        <strong>Batch Prep:</strong> 
                        ${batchData.containerType === 'Custom' ? 'Custom Container' : batchData.containerType}
                        ${batchData.containerCount > 1 ? ` (x${batchData.containerCount})` : ''}
                        · ~${Math.round(batchData.servings)} serves
                        · $${formatCurrency(batchData.costPerContainer)} / batch
                    </div>
                `;
            }
        }

        // Generate HTML
        return `
            <div class="recipe-container">
                <h2>${recipe.name}</h2>
                ${batchSummaryHtml}
                <div class="build-type"><h3>${specTitle} - ${buildType}</h3></div>

                <div class="specs">
                    <div class="spec-item">
                        <div>Total Cost</div>
                        <div class="spec-value">$${printCost.toFixed(2)}</div>
                    </div>
                    ${!isServiceSpec ? `
                    <div class="spec-item">
                        <div>Total ABV</div>
                        <div class="spec-value">${singleSpecAbv.toFixed(1)}%</div>
                    </div>
                    <div class="spec-item">
                        <div>Suggested Price</div>
                        <div class="spec-value">$${suggestedPrice}</div>
                    </div>
                    ` : `
                    <div class="spec-item">
                        <div>Components</div>
                        <div class="spec-value">${printItems.length}</div>
                    </div>
                    `}
                </div>

                <h3>${isServiceSpec ? 'Service Components' : 'Ingredients'}</h3>
                <table class="ingredients-table">
                    <thead>
                        <tr>
                            <th>Amount</th><th>Unit</th><th>${isServiceSpec ? 'Component' : 'Ingredient'}</th><th>Cost</th>
                            ${isServiceSpec ? '<th>Notes</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${printItems.map(ing => `
                            <tr class="${ing.isBatch ? 'batch-ingredient' : ''}">
                                <td>${ing.scaledAmount}</td>
                                <td>${ing.unit || ''}</td>
                                <td>${ing.ingredient_name || ''}</td>
                                <td>$${ing.cost.toFixed(2)}</td>
                                ${isServiceSpec ? `<td>${ing.notes || ''}</td>` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <h3>Instructions</h3>
                <div class="instructions">
                    ${recipe.instructions?.map((step, index) => `<div class="instruction-step"><strong>Step ${index + 1}:</strong> ${step}</div>`).join('') || '<p>No instructions available</p>'}
                </div>

                ${recipe.garnish ? `<div class="garnish-section"><h3>Garnish</h3><p>${recipe.garnish}</p></div>` : ''}
                ${recipe.glassware ? `<div class="garnish-section"><h3>Glassware</h3><p>${recipe.glassware}</p></div>` : ''}
            </div>
        `;
    };

    if (isLoading) {
      return <div className="flex items-center justify-center h-screen text-lg font-medium text-emerald-800"><Loader2 className="w-8 h-8 mr-3 animate-spin" /> Preparing menu for printing...</div>;
    }

    if (error) {
      return <div className="p-8 text-center text-red-600 font-semibold">{error}</div>;
    }

    return (
        <div className="print-container">
            <style>{`
                @media print {
                    body, .print-container { margin: 0; padding: 0; }
                    .recipe-container { page-break-inside: avoid; }
                    @page { size: A4; margin: 20mm; }
                }
                .print-container { padding: 4px; }
                .print-header { text-align: center; margin-bottom: 30px; }
                .print-header h1 { font-size: 2.5em; margin-bottom: 10px; color: #064e3b; }
                .print-header p { font-size: 1.1em; color: #555; margin-bottom: 10px; }
                .print-info { font-size: 0.9em; color: #777; }

                .recipe-container {
                    border: 1px solid #ddd;
                    padding: 16px;
                    margin-bottom: 20px;
                    border-radius: 8px;
                    background-color: #fff;
                }
                .recipe-container h2 {
                    font-size: 1.8em;
                    color: #047857;
                    border-bottom: 2px solid #059669;
                    padding-bottom: 5px;
                    margin-bottom: 15px;
                    text-align: center;
                }
                .build-type {
                    font-size: 1em;
                    text-align: center;
                    color: #fff;
                    padding: 5px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                    background-color: #059669;
                }
                .build-type h3 {
                    margin: 0;
                    color: inherit;
                    font-size: 1em;
                    font-weight: bold;
                }

                .specs {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                .spec-item {
                    padding: 15px;
                    background-color: #f9f9f9;
                    border-radius: 8px;
                    text-align: center;
                    border: 1px solid #eee;
                }
                .spec-item div:first-child {
                    font-size: 0.9em;
                    color: #666;
                }
                .spec-item .spec-value {
                    font-size: 1.4em;
                    font-weight: bold;
                    color: #047857;
                    margin-top: 5px;
                }

                .recipe-container h3 {
                    font-size: 1.2em;
                    font-weight: bold;
                    color: #065f46;
                    margin-top: 25px;
                    margin-bottom: 10px;
                    border-bottom: 1px dashed #ccc;
                    padding-bottom: 5px;
                }

                .ingredients-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                .ingredients-table th, .ingredients-table td {
                    border: 1px solid #eee;
                    padding: 8px;
                    text-align: left;
                    font-size: 0.9em;
                }
                .ingredients-table th {
                    background-color: #f7fafc;
                }
                .batch-ingredient {
                    background-color: #dbeafe;
                    font-weight: bold;
                }

                .instructions {
                    margin-top: 10px;
                }
                .instruction-step {
                    margin-bottom: 8px;
                    line-height: 1.5;
                    font-size: 0.95em;
                }
                .instruction-step strong {
                    color: #065f46;
                }

                .garnish-section p {
                    font-style: italic;
                    color: #555;
                }
                .batch-summary {
                    background-color: #f3e8ff;
                    color: #6b21a8;
                    padding: 8px 12px;
                    border-radius: 6px;
                    margin-bottom: 15px;
                    font-size: 0.9em;
                    border: 1px solid #d8b4fe;
                    text-align: center;
                }
            `}</style>

            <header className="print-header">
                <h1>{menu?.name}</h1>
                <p>{menu?.description || 'Cocktail Specifications'}</p>
                <div className="print-info">
                    <span>Generated: {new Date().toLocaleDateString()}</span>
                </div>
            </header>

            <main>
                {recipes.map(recipe => (
                    <div key={recipe.id} dangerouslySetInnerHTML={{ __html: generateSpecForRecipe(recipe) }} />
                ))}
            </main>
        </div>
    );
}