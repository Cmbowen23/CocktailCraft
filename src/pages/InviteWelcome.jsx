import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wine, Copy, Check, UserPlus, LogIn } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function InviteWelcomePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const accessCode = urlParams.get('code') || '';
    const [copied, setCopied] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    React.useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await base44.auth.me();
                if (user) {
                    setIsLoggedIn(true);
                }
            } catch (err) {
                setIsLoggedIn(false);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        checkAuth();
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(accessCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSignup = () => {
        // Store access code for later use
        localStorage.setItem('cc_pending_access_code', accessCode);
        // Redirect to signup (Base44 hosted auth)
        base44.auth.redirectToLogin(window.location.origin + '/access-code-onboarding');
    };

    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/50 animate-pulse">
                    <Wine className="w-8 h-8 text-white" />
                </div>
            </div>
        );
    }

    if (isLoggedIn) {
        // User is already logged in, redirect to onboarding
        window.location.href = `/access-code-onboarding?code=${accessCode}`;
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg">
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/50">
                        <Wine className="w-8 h-8 text-white" />
                    </div>
                </div>

                <Card className="border-slate-700 bg-slate-800/50 text-white backdrop-blur-sm shadow-xl">
                    <CardHeader className="text-center pb-4">
                        <CardTitle className="text-2xl font-bold">You're Invited to CocktailCraft!</CardTitle>
                        <CardDescription className="text-slate-400">
                            Your access code is ready. Follow the steps below to get started.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-slate-900/80 p-6 rounded-lg border-2 border-blue-500/30">
                            <p className="text-sm text-slate-400 mb-3 text-center">Your Access Code:</p>
                            <div className="flex items-center gap-3">
                                <code className="flex-1 bg-slate-950 px-4 py-3 rounded-lg text-2xl font-mono text-center tracking-wider text-blue-400 border border-slate-700">
                                    {accessCode}
                                </code>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleCopy}
                                    className="border-slate-600 hover:bg-slate-700"
                                >
                                    {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4 bg-blue-900/20 p-4 rounded-lg border border-blue-500/20">
                            <h3 className="font-semibold text-blue-300 text-center">Important Instructions:</h3>
                            <ol className="space-y-3 text-sm text-slate-300">
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                                    <span><strong className="text-white">Sign up</strong> for a new account (don't log in with an existing account)</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                                    <span>Copy the access code above</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                                    <span>Enter it during onboarding to unlock your permissions</span>
                                </li>
                            </ol>
                        </div>

                        <Button
                            onClick={handleSignup}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 text-base font-medium"
                        >
                            <UserPlus className="w-5 h-5 mr-2" />
                            Sign Up & Continue
                        </Button>

                        <div className="text-center text-xs text-slate-500">
                            Already have an account? Make sure to sign up with a new email or use the correct account tied to this invitation.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}