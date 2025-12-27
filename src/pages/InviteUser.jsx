import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Copy, Check, Mail, Shield } from "lucide-react";

export default function InviteUserPage() {
    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        role: "user",
        user_type: "sales_rep", // Default to sales_rep as it's a common case
        company_name: "",
        send_email: true
    });
    const [isLoading, setIsLoading] = useState(false);
    const [generatedCode, setGeneratedCode] = useState(null);
    const [generatedUrl, setGeneratedUrl] = useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (checked) => {
        setFormData(prev => ({ ...prev, send_email: checked }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setGeneratedCode(null);
        setGeneratedUrl(null);

        try {
            // Map admin role selection if needed, or just use form data directly
            // user_type options: 'sales_rep', 'on_premise', 'buyer_admin', 'internal'
            
            const payload = {
                ...formData,
                // Ensure role is admin if user_type is internal/admin, or user otherwise
                role: formData.user_type === 'admin' ? 'admin' : 'user'
            };

            const response = await base44.functions.invoke("sendUserInvitation", payload);
            
            if (response.data.success) {
                setGeneratedCode(response.data.code);
                setGeneratedUrl(response.data.inviteUrl);
                toast.success("Invitation generated successfully");
            } else {
                toast.error(response.data.error || "Failed to generate invitation");
            }
        } catch (error) {
            console.error("Invite error:", error);
            toast.error("An error occurred while generating the invitation");
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    return (
        <div className="container mx-auto py-8 max-w-2xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Invite User</h1>
                <p className="text-gray-600">Generate access codes for new users to join the platform.</p>
            </div>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        Invitation Details
                    </CardTitle>
                    <CardDescription>
                        Enter the user's details to generate a unique access code.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="full_name">Full Name</Label>
                                <Input
                                    id="full_name"
                                    name="full_name"
                                    placeholder="e.g. John Doe"
                                    value={formData.full_name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="john@example.com"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="user_type">Role / User Type</Label>
                                <Select 
                                    value={formData.user_type} 
                                    onValueChange={(val) => handleSelectChange("user_type", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sales_rep">Sales Representative</SelectItem>
                                        <SelectItem value="on_premise">On Premise</SelectItem>
                                        <SelectItem value="buyer_admin">Buyer Admin</SelectItem>
                                        <SelectItem value="internal">Internal Staff</SelectItem>
                                        <SelectItem value="admin">System Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company_name">Company Name (Optional)</Label>
                                <Input
                                    id="company_name"
                                    name="company_name"
                                    placeholder="e.g. Fedway"
                                    value={formData.company_name}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="send_email" 
                                checked={formData.send_email}
                                onCheckedChange={handleCheckboxChange}
                            />
                            <Label htmlFor="send_email">Send invitation email automatically</Label>
                        </div>

                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                "Generate Access Code"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {generatedCode && (
                <Card className="bg-green-50 border-green-200">
                    <CardHeader>
                        <CardTitle className="text-green-800 flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            Access Code Generated
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-green-100 shadow-sm">
                            <span className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-2">
                                Share this code with the user
                            </span>
                            <div className="flex items-center gap-3">
                                <code className="text-4xl font-mono font-bold text-gray-900 tracking-widest">
                                    {generatedCode}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => copyToClipboard(generatedCode, "Access Code")}
                                    className="hover:bg-green-50 text-gray-500 hover:text-green-700"
                                >
                                    <Copy className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-green-800">Direct Invitation Link</Label>
                            <div className="flex gap-2">
                                <Input 
                                    value={generatedUrl} 
                                    readOnly 
                                    className="bg-white border-green-200 text-gray-600" 
                                />
                                <Button
                                    variant="outline"
                                    onClick={() => copyToClipboard(generatedUrl, "Link")}
                                    className="bg-white border-green-200 hover:bg-green-100 text-green-700"
                                >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Link
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}