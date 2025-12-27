import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Mail, Building2, Shield, Loader2, Send, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

// Helper function to retry base44.auth.me() with exponential backoff
const fetchUserWithRetry = async (maxAttempts = 3) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const user = await base44.auth.me();
            if (user) {
                return user;
            }
        } catch (error) {
            if (attempt === maxAttempts) {
                return null;
            }
            const delay = 200 * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
};

export default function UserProfilePage() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [fullName, setFullName] = useState("");
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [accessCode, setAccessCode] = useState("");
    const [isResending, setIsResending] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const userData = await fetchUserWithRetry();
                setUser(userData);
                setFullName(userData?.full_name || "");
                
                // Fetch user's access code if available
                if (userData?.email) {
                    try {
                        const invitations = await base44.entities.UserInvitation.filter({ 
                            email: userData.email,
                            status: 'pending'
                        });
                        if (invitations.length > 0) {
                            setAccessCode(invitations[0].token);
                        }
                    } catch (error) {
                        console.error("Error fetching access code:", error);
                    }
                }
            } catch (error) {
                console.error("Error loading user:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadUser();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveSuccess(false);

        try {
            await base44.auth.updateMe({ full_name: fullName });
            setUser(prev => ({ ...prev, full_name: fullName }));
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to update profile. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
             // Clear tokens
            try {
                localStorage.removeItem('cc_rep_code');
                localStorage.removeItem('cc_invite_token');
            } catch (e) {
                console.warn('Unable to clear tokens', e);
            }
            await base44.auth.logout(createPageUrl('Authentication'));
        } catch (error) {
            console.error("Error logging out:", error);
            window.location.href = createPageUrl('Authentication');
        }
    };

    const handleLogin = () => {
        base44.auth.redirectToLogin('/');
    };

    const handleShowQR = async () => {
        if (!accessCode) {
            toast.error("No access code available");
            return;
        }
        
        // Generate QR code URL using a QR API service
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(accessCode)}`;
        setQrCodeUrl(qrUrl);
        setShowQRModal(true);
    };

    const handleResendInvitation = async () => {
        setIsResending(true);
        try {
            const invitations = await base44.entities.UserInvitation.filter({ 
                email: user.email,
                status: 'pending'
            });
            
            if (invitations.length === 0) {
                toast.error("No pending invitation found");
                return;
            }

            await base44.functions.invoke('sendUserInvitation', {
                invitationId: invitations[0].id
            });
            
            toast.success("Invitation email resent successfully!");
        } catch (error) {
            console.error("Error resending invitation:", error);
            toast.error("Failed to resend invitation");
        } finally {
            setIsResending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Not Logged In</CardTitle>
                        <CardDescription>Please log in to view your profile</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700">
                            Sign In
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Card className="border border-gray-200 shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold text-gray-900">My Profile</CardTitle>
                        <CardDescription>Manage your account settings and information</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <Mail className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <Label className="text-sm font-medium text-blue-900">Email</Label>
                                        <p className="text-blue-800">{user.email}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="full_name" className="flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Full Name
                                    </Label>
                                    <Input
                                        id="full_name"
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Enter your full name"
                                        className="border-gray-300"
                                    />
                                </div>

                                {user.company_name && (
                                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <Building2 className="w-5 h-5 text-gray-600" />
                                        <div>
                                            <Label className="text-sm font-medium text-gray-700">Company</Label>
                                            <p className="text-gray-800">{user.company_name}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <Shield className="w-5 h-5 text-gray-600" />
                                    <div>
                                        <Label className="text-sm font-medium text-gray-700">Role</Label>
                                        <p className="text-gray-800 capitalize">{user.role || 'User'}</p>
                                    </div>
                                </div>

                                {accessCode && (
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <Label className="text-sm font-medium text-blue-900 mb-2 block">Access Code</Label>
                                        <div className="flex items-center gap-2 mb-2">
                                            <code className="flex-1 px-3 py-2 bg-white rounded border border-blue-200 text-blue-900 font-mono text-lg tracking-wider">
                                                {accessCode}
                                            </code>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleShowQR}
                                                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                                            >
                                                <QrCode className="w-4 h-4 mr-2" />
                                                Show QR Code
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleResendInvitation}
                                                disabled={isResending}
                                                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                                            >
                                                {isResending ? (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Send className="w-4 h-4 mr-2" />
                                                )}
                                                Resend Email
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {saveSuccess && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-green-800 text-sm">Profile updated successfully!</p>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Changes'
                                    )}
                                </Button>
                                <Button 
                                    type="button"
                                    variant="outline"
                                    onClick={handleLogout}
                                    className="border-gray-300"
                                >
                                    Logout
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Access Code QR</DialogTitle>
                        <DialogDescription>
                            Scan this QR code to quickly enter your access code
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-4">
                        {qrCodeUrl && (
                            <img 
                                src={qrCodeUrl} 
                                alt="Access Code QR" 
                                className="w-64 h-64 border-4 border-blue-100 rounded-lg"
                            />
                        )}
                        <code className="px-4 py-2 bg-blue-50 rounded border border-blue-200 text-blue-900 font-mono text-lg">
                            {accessCode}
                        </code>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}