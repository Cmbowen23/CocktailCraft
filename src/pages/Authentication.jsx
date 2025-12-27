import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wine, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";

export default function AuthenticationPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        const checkSession = async () => {
            try {
                const user = await base44.auth.me();
                if (user) {
                    navigate("/dashboard");
                }
            } catch (error) {
                console.error('Error checking session:', error);
            }
        };
        checkSession();
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            if (isSignUp) {
                await base44.auth.signUp(email, password);
                toast({
                    title: "Account created",
                    description: "Please check your email to verify your account.",
                });
                setIsSignUp(false);
            } else {
                await base44.auth.signIn(email, password);
                toast({
                    title: "Welcome back",
                    description: "Successfully logged in.",
                });
                navigate("/dashboard");
            }
        } catch (err) {
            setError(err.message || "An error occurred during authentication");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError("");
        setIsGoogleLoading(true);

        try {
            await base44.auth.signInWithGoogle();
        } catch (err) {
            setError(err.message || "An error occurred during Google sign in");
            setIsGoogleLoading(false);
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
                        <CardTitle className="text-2xl font-bold">Welcome to Base44</CardTitle>
                        <CardDescription className="text-slate-400">
                            Professional Bar Management Platform
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-200">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-200">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                                />
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoading || isGoogleLoading}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 text-lg font-medium shadow-lg shadow-blue-900/20"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        {isSignUp ? "Creating Account..." : "Logging In..."}
                                    </>
                                ) : (
                                    isSignUp ? "Create Account" : "Log In"
                                )}
                            </Button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <Separator className="w-full bg-slate-600" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-slate-800/50 px-2 text-slate-400">Or continue with</span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading || isGoogleLoading}
                            className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 border-slate-600"
                        >
                            {isGoogleLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                                        <path
                                            fill="#4285F4"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="#34A853"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="#FBBC05"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="#EA4335"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    Sign in with Google
                                </>
                            )}
                        </Button>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setError("");
                                }}
                                className="text-sm text-blue-400 hover:text-blue-300"
                            >
                                {isSignUp ? "Already have an account? Log in" : "Need an account? Sign up"}
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}