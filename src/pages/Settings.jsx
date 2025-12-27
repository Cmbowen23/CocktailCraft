import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/components/contexts/AppSettingsContext";
import { Loader2, Save, Settings as SettingsIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { BatchCleanupPanel } from "@/components/debug/BatchCleanupPanel";
import { base44 } from "@/api/base44Client"; // Import base44 client

export default function SettingsPage() {
    const { settings, updateSettings, isLoading } = useAppSettings();
    const [localOzSetting, setLocalOzSetting] = React.useState('auto');
    const [targetPourCost, setTargetPourCost] = React.useState(20);
    const [unitPreference, setUnitPreference] = React.useState('oz');
    const [isSaving, setIsSaving] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);

    React.useEffect(() => {
        if (settings) {
            setLocalOzSetting(settings.oz_interpretation || 'auto');
            setTargetPourCost(settings.target_pour_cost || 20);
            setUnitPreference(settings.default_unit_preference || 'oz');
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings({ 
                oz_interpretation: localOzSetting,
                target_pour_cost: parseFloat(targetPourCost),
                default_unit_preference: unitPreference
            });
            toast.success("Settings updated successfully");
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFullExport = async () => {
        if (!confirm("Download a full backup of your recipes, ingredients, and menus?")) return;
        
        setIsExporting(true);
        try {
            toast.info("Starting export... this may take a moment.");
            
            // 1. Fetch ALL data from Base 44
            const [recipes, ingredients, menus, accounts] = await Promise.all([
                base44.entities.Recipe.list(),
                base44.entities.Ingredient.list(),
                base44.entities.Menu.list(),
                base44.entities.Account.list()
            ]);
    
            const fullBackup = { 
                recipes, 
                ingredients, 
                menus, 
                accounts,
                exportDate: new Date().toISOString(),
                appVersion: "1.0"
            };
    
            // 2. Create a downloadable file
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `cocktail_craft_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            toast.success("Export Complete! Check your downloads folder.");
        } catch (e) {
            console.error(e);
            toast.error("Export failed. Check console for details.");
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <SettingsIcon className="w-8 h-8 text-blue-600" />
                        App Settings
                    </h1>
                    <p className="text-gray-600 mt-2">Manage your global application preferences.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Unit Conversions</CardTitle>
                        <CardDescription>
                            Configure how the application interprets measurement units.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-base font-semibold">
                                    "Oz" Unit Interpretation
                                </Label>
                                <p className="text-sm text-gray-500 max-w-xl">
                                    Determine how the generic "oz" unit is treated in calculations when density is not fully defined.
                                </p>
                            </div>
                            
                            <RadioGroup 
                                value={localOzSetting} 
                                onValueChange={setLocalOzSetting}
                                className="flex flex-col space-y-3"
                            >
                                <div className="flex items-start space-x-3 space-y-0">
                                    <RadioGroupItem value="auto" id="oz-auto" className="mt-1" />
                                    <div className="space-y-1">
                                        <Label htmlFor="oz-auto" className="font-medium cursor-pointer">
                                            Automatic (Recommended)
                                        </Label>
                                        <p className="text-sm text-gray-500">
                                            Context-aware: Treats "oz" as fluid ounces for liquids and weight ounces for solids based on ingredient category.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 space-y-0">
                                    <RadioGroupItem value="volume" id="oz-volume" className="mt-1" />
                                    <div className="space-y-1">
                                        <Label htmlFor="oz-volume" className="font-medium cursor-pointer">
                                            Always Volume
                                        </Label>
                                        <p className="text-sm text-gray-500">
                                            Treats "oz" exactly like "fl oz" (Fluid Ounces) for all ingredients. Useful if you measure everything by volume.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 space-y-0">
                                    <RadioGroupItem value="weight" id="oz-weight" className="mt-1" />
                                    <div className="space-y-1">
                                        <Label htmlFor="oz-weight" className="font-medium cursor-pointer">
                                            Always Weight
                                        </Label>
                                        <p className="text-sm text-gray-500">
                                            Treats "oz" exactly like standard weight ounces (28.35g) for all ingredients.
                                        </p>
                                    </div>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <CardTitle className="text-lg">Business Defaults</CardTitle>
                            
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="pour-cost">Target Pour Cost (%)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            id="pour-cost" 
                                            type="number" 
                                            value={targetPourCost}
                                            onChange={(e) => setTargetPourCost(e.target.value)}
                                            className="w-24"
                                        />
                                        <span className="text-gray-500 text-sm">Default warning threshold</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Default Unit System</Label>
                                    <RadioGroup 
                                        value={unitPreference} 
                                        onValueChange={setUnitPreference}
                                        className="flex gap-4"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="oz" id="unit-oz" />
                                            <Label htmlFor="unit-oz">Imperial (oz)</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="ml" id="unit-ml" />
                                            <Label htmlFor="unit-ml">Metric (ml)</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Save Preferences
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Data Export Section */}
                <Card className="mt-6 border-blue-100">
                    <CardHeader>
                        <CardTitle>Data Management</CardTitle>
                        <CardDescription>
                            Export all your data (recipes, ingredients, menus) to a JSON file for backup or external use.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-500">
                                This will generate a complete snapshot of your database.
                            </div>
                            <Button onClick={handleFullExport} disabled={isExporting} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                                {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                Export All Data
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-6">
                    <BatchCleanupPanel />
                </div>
            </div>
        </div>
    );
}