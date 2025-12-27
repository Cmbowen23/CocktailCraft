import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function PourCostCalculatorModal({ isOpen, onClose, ingredient }) {
    // Default states
    const [pourSize, setPourSize] = useState("1.5");
    
    // Single Pour State
    const [singleMenuPrice, setSingleMenuPrice] = useState("");
    const [singlePourCostPercent, setSinglePourCostPercent] = useState("");

    // Calculate cost per oz helper
    const getCostPerOz = (ing) => {
        if (!ing || !ing.cost_per_unit) return 0;
        const costPerBaseUnit = parseFloat(ing.cost_per_unit) || 0;
        const baseUnit = ing.unit || "oz";
        
        if (baseUnit === 'oz' || baseUnit === 'fl oz') return costPerBaseUnit;
        if (baseUnit === 'ml') return costPerBaseUnit * 29.5735;
        if (baseUnit === 'L') return (costPerBaseUnit / 1000) * 29.5735;
        return 0; 
    };

    // Calculate cost using current pourSize
    const calculatePourCostValue = (currentSize = pourSize) => {
        if (!ingredient || !ingredient.cost_per_unit) return 0;
        
        const baseUnit = ingredient.unit || "oz";
        const size = parseFloat(currentSize) || 0;

        if (baseUnit === "piece") {
            return (parseFloat(ingredient.cost_per_unit) || 0) * size;
        }

        const costPerOz = getCostPerOz(ingredient);
        return costPerOz * size;
    };
    
    const singleCost = calculatePourCostValue();

    // Reset state and calculate defaults when ingredient changes
    useEffect(() => {
        if (isOpen && ingredient) {
            // Determine intelligent default pour size
            const cat = (ingredient.category || "").toLowerCase();
            let size = "1";
            if (cat === 'wine') size = "5"; 
            else if (cat === 'beer') size = "12"; 
            else if (cat.includes('spirit') || cat.includes('liquor')) size = "1.5"; 
            
            setPourSize(size);

            // Calculate initial suggestions based on 18% PC using the NEW size
            // We can't use singleCost here because it uses the *render* pourSize which hasn't updated yet
            // So we must recalculate cost using 'size' variable
            let cost = 0;
            const costPerOz = getCostPerOz(ingredient);
            if (ingredient.unit === "piece") {
                 cost = (parseFloat(ingredient.cost_per_unit) || 0) * parseFloat(size);
            } else {
                 cost = costPerOz * parseFloat(size);
            }

            if (cost > 0) {
                const targetPC = 18; // Default target
                const suggestedPrice = cost / (targetPC / 100);
                setSinglePourCostPercent(targetPC.toString());
                setSingleMenuPrice(suggestedPrice.toFixed(2));
            } else {
                setSingleMenuPrice("");
                setSinglePourCostPercent("");
            }
        }
    }, [isOpen, ingredient]);

    // Recalculate Price when pourSize changes, keeping Pour Cost % static
    useEffect(() => {
        if (isOpen && pourSize && singlePourCostPercent) {
             const cost = calculatePourCostValue(pourSize);
             const pc = parseFloat(singlePourCostPercent);
             if (pc > 0 && cost > 0) {
                 const newPrice = cost / (pc / 100);
                 setSingleMenuPrice(newPrice.toFixed(2));
             }
        }
    }, [pourSize]);
    
    if (!ingredient) return null;

    // --- HANDLERS ---

    const handleSinglePriceChange = (val) => {
        setSingleMenuPrice(val);
        const price = parseFloat(val);
        if (price > 0 && singleCost > 0) {
            const pc = (singleCost / price) * 100;
            setSinglePourCostPercent(pc.toFixed(2));
        } else {
            setSinglePourCostPercent("");
        }
    };

    const handleSinglePCChange = (val) => {
        setSinglePourCostPercent(val);
        const pc = parseFloat(val);
        if (pc > 0 && singleCost > 0) {
            const price = singleCost / (pc / 100);
            setSingleMenuPrice(price.toFixed(2));
        } else {
            setSingleMenuPrice("");
        }
    };

    // Profit
    const profitValue = singleMenuPrice ? (parseFloat(singleMenuPrice) - singleCost) : null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm bg-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900">
                        {ingredient.name}
                    </DialogTitle>
                    <p className="text-sm text-gray-500">Pour Cost Calculator</p>
                </DialogHeader>

                <div className="flex items-center gap-3 py-4 border-b border-gray-100">
                    <Label className="font-medium text-gray-700 text-base whitespace-nowrap">Pour Size:</Label>
                    <div className="flex items-center">
                        <Input 
                            type="number" 
                            value={pourSize} 
                            onChange={(e) => setPourSize(e.target.value)}
                            className="w-20 bg-slate-50 border-slate-200 text-center font-medium"
                        />
                        <span className="ml-2 font-medium text-gray-500">oz</span>
                    </div>
                </div>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Cost</Label>
                            <div className="mt-1.5 text-xl font-medium text-gray-700">
                                ${singleCost.toFixed(2)}
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Pour Cost %</Label>
                            <div className="relative mt-1.5">
                                <Input 
                                    type="number" 
                                    value={singlePourCostPercent}
                                    onChange={(e) => handleSinglePCChange(e.target.value)}
                                    className="bg-slate-50 border-slate-200 pr-8 font-medium"
                                    placeholder="e.g. 18"
                                    step="0.1"
                                />
                                <span className="absolute right-3 top-2.5 text-gray-400 text-sm font-bold">%</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label className="text-sm text-blue-600 uppercase font-bold tracking-wider">Menu Price</Label>
                        <div className="relative mt-2">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-medium">$</span>
                            <Input 
                                type="number" 
                                value={singleMenuPrice}
                                onChange={(e) => handleSinglePriceChange(e.target.value)}
                                className="bg-white border-blue-200 pl-9 h-20 text-4xl font-bold text-gray-900 focus-visible:ring-blue-500"
                                placeholder=""
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                        <div className="flex justify-between items-center">
                            <Label className="text-sm text-gray-500 uppercase font-bold tracking-wider">Profit per pour</Label>
                            <div className={`text-3xl font-bold ${profitValue && profitValue >= 0 ? 'text-green-600' : 'text-gray-300'}`}>
                                {profitValue !== null ? `$${profitValue.toFixed(2)}` : '—'}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end pt-2">
                    <Button onClick={onClose} variant="outline">Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}