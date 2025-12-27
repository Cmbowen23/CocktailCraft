import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { Loader2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function BatchCleanupPage() {
    const [isScanning, setIsScanning] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);
    const [debugRecipes, setDebugRecipes] = useState([]);
    const [cleanupComplete, setCleanupComplete] = useState(false);
    const [error, setError] = useState(null);

    const scanForDebugSettings = async () => {
        setIsScanning(true);
        setError(null);
        setCleanupComplete(false);
        
        try {
            const recipes = await base44.entities.Recipe.list();
            const debugRecipes = recipes.filter(
                (r) => r.batch_settings && r.batch_settings._debug_flag === "BATCH_TEST"
            );

            console.log("[BatchCleanup] Found debug recipes:", debugRecipes.length);
            setDebugRecipes(debugRecipes);
        } catch (err) {
            console.error("[BatchCleanup] Scan failed:", err);
            setError(err.message);
        } finally {
            setIsScanning(false);
        }
    };

    const cleanupDebugSettings = async () => {
        setIsCleaning(true);
        setError(null);
        
        try {
            for (const r of debugRecipes) {
                console.log("[BatchCleanup] Clearing batch_settings for", r.id, r.name);
                await base44.entities.Recipe.update(r.id, {
                    batch_settings: null,
                });
            }
            
            setCleanupComplete(true);
            setDebugRecipes([]);
        } catch (err) {
            console.error("[BatchCleanup] Cleanup failed:", err);
            setError(err.message);
        } finally {
            setIsCleaning(false);
        }
    };

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trash2 className="w-6 h-6 text-red-600" />
                        Batch Settings Cleanup
                    </CardTitle>
                    <CardDescription>
                        Remove debug BATCH_TEST settings from all recipes
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <Button 
                            onClick={scanForDebugSettings}
                            disabled={isScanning || isCleaning}
                            className="w-full"
                        >
                            {isScanning ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Scanning...
                                </>
                            ) : (
                                'Scan for Debug Settings'
                            )}
                        </Button>

                        {debugRecipes.length > 0 && (
                            <div className="space-y-4">
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="font-semibold text-yellow-900">
                                        Found {debugRecipes.length} recipe(s) with debug settings
                                    </p>
                                    <ul className="mt-2 space-y-1 text-sm text-yellow-800">
                                        {debugRecipes.map(r => (
                                            <li key={r.id}>• {r.name} (ID: {r.id})</li>
                                        ))}
                                    </ul>
                                </div>

                                <Button 
                                    onClick={cleanupDebugSettings}
                                    disabled={isCleaning}
                                    variant="destructive"
                                    className="w-full"
                                >
                                    {isCleaning ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Cleaning Up...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Clear Debug Settings
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {debugRecipes.length === 0 && !isScanning && !cleanupComplete && (
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-600">
                                Click "Scan" to check for recipes with debug settings
                            </div>
                        )}

                        {cleanupComplete && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-900">
                                <CheckCircle2 className="w-5 h-5" />
                                <p className="font-semibold">Cleanup complete!</p>
                            </div>
                        )}

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-900">
                                <AlertCircle className="w-5 h-5" />
                                <p>{error}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}