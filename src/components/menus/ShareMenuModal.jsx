import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Link as LinkIcon, Copy, Check, Loader2 } from "lucide-react";
import { base44 } from '@/api/base44Client';

export default function ShareMenuModal({ menu, onClose }) {
  const [activeTab, setActiveTab] = useState("email");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerCompanyName, setBuyerCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const generateInvitationLink = async () => {
    setIsLoading(true);
    try {
      const token = crypto.randomUUID();

      await base44.entities.PublicLink.create({
        token: token,
        menu_id: menu.id,
        description: buyerName ? `Invitation for ${buyerName}` : 'Buyer invitation'
      });

      const invitationUrl = `${window.location.origin}/AcceptInvitation?token=${token}&account_id=${menu.account_id}&menu_id=${menu.id}`;
      setInvitationLink(invitationUrl);
      return invitationUrl;
    } catch (error) {
      console.error("Error generating invitation link:", error);
      alert("Failed to generate invitation link. Please try again.");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invitationLink) {
      const link = await generateInvitationLink();
      if (!link) return;
      
      try {
        await navigator.clipboard.writeText(link);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (error) {
        console.error("Error copying link:", error);
        alert("Failed to copy link to clipboard");
      }
    } else {
      try {
        await navigator.clipboard.writeText(invitationLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (error) {
        console.error("Error copying link:", error);
        alert("Failed to copy link to clipboard");
      }
    }
  };

  const handleSendEmail = async () => {
    if (!buyerEmail.trim()) {
      alert("Please enter a buyer email address");
      return;
    }

    if (!buyerName.trim()) {
      alert("Please enter the buyer's name");
      return;
    }

    setIsLoading(true);
    try {
      const token = crypto.randomUUID();

      await base44.entities.PublicLink.create({
        token: token,
        menu_id: menu.id,
        description: `Invitation for ${buyerName}`
      });

      const invitationUrl = `${window.location.origin}/AcceptInvitation?token=${token}&account_id=${menu.account_id}&menu_id=${menu.id}`;
      
      const emailBody = `Hello ${buyerName},

You've been invited to collaborate on a cocktail menu.

${buyerCompanyName ? `Company: ${buyerCompanyName}\n\n` : ''}Click the link below to accept the invitation and access the menu:

${invitationUrl}

This link will allow you to view and customize recipes, create batch preparations, and manage your menu needs.

Best regards,
CocktailCraft Team`;

      await base44.integrations.Core.SendEmail({
        to: buyerEmail,
        subject: 'Invitation to CocktailCraft Menu',
        body: emailBody,
        from_name: 'CocktailCraft'
      });

      setEmailSent(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error sending invitation:", error);
      alert("Failed to send invitation email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Menu with Buyer</DialogTitle>
          <DialogDescription>
            Invite a buyer to access and customize recipes from "{menu.name}"
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email">
              <Mail className="w-4 h-4 mr-2" />
              Email Invitation
            </TabsTrigger>
            <TabsTrigger value="link">
              <LinkIcon className="w-4 h-4 mr-2" />
              Copy Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4 mt-4">
            {emailSent ? (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6 text-center">
                  <Check className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <p className="text-green-800 font-medium">Invitation sent successfully!</p>
                  <p className="text-sm text-green-700 mt-2">
                    The buyer will receive an email with instructions to access the menu.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div>
                  <Label htmlFor="buyer-name">Buyer Name *</Label>
                  <Input
                    id="buyer-name"
                    type="text"
                    placeholder="John Doe"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="buyer-email">Buyer Email *</Label>
                  <Input
                    id="buyer-email"
                    type="email"
                    placeholder="buyer@example.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="buyer-company">Company Name (Optional)</Label>
                  <Input
                    id="buyer-company"
                    type="text"
                    placeholder="Acme Bar & Grill"
                    value={buyerCompanyName}
                    onChange={(e) => setBuyerCompanyName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <Button
                  onClick={handleSendEmail}
                  disabled={isLoading || !buyerEmail.trim() || !buyerName.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Invitation Email
                    </>
                  )}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="link" className="space-y-4 mt-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <p className="text-sm text-blue-800 mb-3">
                  Generate a shareable link that you can send via text message, Slack, or any other platform.
                </p>
                
                {invitationLink ? (
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded border border-blue-200 break-all text-sm font-mono">
                      {invitationLink}
                    </div>
                    <Button
                      onClick={handleCopyLink}
                      variant="outline"
                      className="w-full"
                      disabled={linkCopied}
                    >
                      {linkCopied ? (
                        <>
                          <Check className="w-4 h-4 mr-2 text-green-600" />
                          Link Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleCopyLink}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Generate & Copy Link
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-gray-600 text-center">
              Anyone with this link can accept the invitation and access the menu.
            </p>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}