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

export default function AuthenticationPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        const checkSession = async () => {
            const session = await base44.auth.getSession();
            if (session) {
                navigate("/dashboard");
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
                                disabled={isLoading}
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