import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wine, ArrowRight } from "lucide-react";

export default function AuthenticationPage() {
    
    const handleLogin = () => {
  // Use full URL so preview sandbox subpaths don’t break return routing
  base44.auth.redirectToLogin(window.location.href);
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
                            Professional Bar Management Platform
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <Button 
                            onClick={handleLogin}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 text-lg font-medium shadow-lg shadow-blue-900/20"
                        >
                            Log In / Sign Up <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                        <p className="text-center text-xs text-slate-500">
                            You will be redirected to our secure login page.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}