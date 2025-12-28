import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wine, Loader2, ArrowRight, ShieldCheck } from "lucide-react";

export default function AccessCodeOnboardingPage() {
    // Check for code in URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code') || '';
    const codeFromStorage = localStorage.getItem('cc_pending_access_code') || '';
    
    const [accessCode, setAccessCode] = useState(codeFromUrl || codeFromStorage);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Clear stored code when component mounts
    React.useEffect(() => {
        if (codeFromStorage) {
            localStorage.removeItem('cc_pending_access_code');
        }
    }, [codeFromStorage]);

    const handleContinue = async () => {
        setIsLoading(true);
        setError("");

        try {
            const result = await base44.functions.applyAccessCode({ code: accessCode });

            if (result.success) {
                // Redirect to dashboard
                window.location.href = createPageUrl("Dashboard");
            } else {
                setError(result.message || "Invalid access code. Please try again.");
            }
        } catch (err) {
            console.error("Error applying code:", err);
            setError(err.message || "An unexpected error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = async () => {
        setIsLoading(true);
        setError("");

        try {
             const result = await base44.functions.applyAccessCode({ code: "" });
             if (result.success) {
                 window.location.href = createPageUrl("Dashboard");
             } else {
                 setError(result.message || "Failed to skip. Please try again.");
             }
        } catch (err) {
             console.error("Error skipping:", err);
             setError(err.message || "An unexpected error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/50">
                        <Wine className="w-8 h-8 text-white" />
                    </div>
                </div>

                <Card className="border-slate-700 bg-slate-800/50 text-white backdrop-blur-sm shadow-xl">
                    <CardHeader className="text-center pb-2">
                        <CardTitle className="text-2xl font-bold">Welcome to CocktailCraft</CardTitle>
                        <CardDescription className="text-slate-400">
                            Let's get your account set up.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="space-y-2 text-center">
                            <h3 className="text-lg font-medium text-white flex items-center justify-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-blue-400" />
                                Have an Access Code?
                            </h3>
                            <p className="text-sm text-slate-400">
                                Enter your company access code to unlock your specific role and permissions.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Input 
                                    placeholder="Enter access code" 
                                    value={accessCode}
                                    onChange={(e) => setAccessCode(e.target.value)}
                                    className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 text-center text-lg tracking-wide h-12"
                                />
                                {error && (
                                    <p className="text-sm text-red-400 text-center animate-pulse">
                                        {error}
                                    </p>
                                )}
                            </div>

                            <Button 
                                onClick={handleContinue} 
                                disabled={!accessCode.trim() || isLoading}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white h-11 text-base font-medium"
                            >
                                {isLoading && accessCode.trim() ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Continue with Code
                            </Button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-slate-700" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-slate-800 px-2 text-slate-500">Or</span>
                                </div>
                            </div>

                            <Button 
                                variant="outline" 
                                onClick={handleSkip}
                                disabled={isLoading}
                                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white h-11"
                            >
                                {isLoading && !accessCode.trim() ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Skip / I don't have a code
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                
                <p className="text-center text-slate-500 text-sm mt-6">
                    Generic users start with a clean, empty workspace.
                </p>
            </div>
        </div>
    );
}