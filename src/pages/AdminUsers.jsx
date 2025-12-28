import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users,
  Search,
  Loader2,
  Shield,
  Building2,
  Mail,
  Wine,
  AlertTriangle,
  Trash2,
  Briefcase,
  Edit,
  Lock,
  QrCode,
  Send,
  Copy
  } from "lucide-react";
import EditUserModal from "@/components/admin/EditUserModal";
import InviteUserModal from "@/components/admin/InviteUserModal";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [menus, setMenus] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedAccessCode, setSelectedAccessCode] = useState(null);
  const [resendingEmail, setResendingEmail] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      // Check if user is admin
      if (user.role !== 'admin') {
        setError('Access denied. This page is only available to administrators.');
        setIsLoading(false);
        return;
      }

      const [usersData, invitationsData, menusData, accountsData] = await Promise.all([
        base44.entities.User.list().catch(err => {
          console.error("Error loading users:", err);
          return [];
        }),
        base44.entities.UserInvitation.list().catch(err => {
          console.error("Error loading invitations:", err);
          return [];
        }),
        base44.entities.Menu.list().catch(err => {
          console.error("Error loading menus:", err);
          return [];
        }),
        base44.entities.Account.list().catch(err => {
          console.error("Error loading accounts:", err);
          return [];
        })
      ]);

      setUsers(usersData || []);
      setInvitations(invitationsData || []);
      setMenus(menusData || []);
      setAccounts(accountsData || []);
    } catch (err) {
      console.error("Error loading admin data:", err);
      setError("Failed to load user data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getMenuName = (menuId) => {
    if (!menuId) return null;
    const menu = menus.find(m => m.id === menuId);
    return menu ? menu.name : 'Unknown Menu';
  };

  const getAccountName = (accountId) => {
    if (!accountId) return null;
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown Account';
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'user':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserTypeBadgeColor = (userType) => {
    switch (userType) {
      case 'internal':
        return 'bg-green-100 text-green-800';
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'buyer_admin':
        return 'bg-orange-100 text-orange-800';
      case 'sales_rep':
        return 'bg-blue-100 text-blue-800';
      case 'on_premise':
        return 'bg-teal-100 text-teal-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDeleteUser = async (id, email) => {
    // Check if it's a pending invitation (ID starts with 'invite-')
    const isInvite = id.startsWith('invite-');
    const label = isInvite ? 'invitation' : 'user';
    const realId = isInvite ? id.replace('invite-', '') : id;

    if (!isInvite && realId === currentUser?.id) {
      toast.error("You cannot delete your own account.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${label} for ${email}? This action cannot be undone.`)) {
      try {
        if (isInvite) {
           await base44.entities.UserInvitation.delete(realId);
           toast.success(`Invitation deleted successfully`);
        } else {
           await base44.entities.User.delete(realId);
           toast.success(`User deleted successfully`);
        }
        loadData();
      } catch (err) {
        console.error(`Error deleting ${label}:`, err);
        toast.error(`Failed to delete ${label}. ${err.message || 'Please try again.'}`);
      }
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleSaveUser = async (userId, userData) => {
    try {
      await base44.entities.User.update(userId, userData);
      setEditingUser(null);
      loadData();
    } catch (err) {
      console.error("Error updating user:", err);
      setError("Failed to update user. Please try again.");
    }
  };

  const handleShowQR = (accessCode) => {
    setSelectedAccessCode(accessCode);
    setShowQRModal(true);
  };

  const handleResendInvitation = async (invitation) => {
    setResendingEmail(invitation.id);
    try {
      const response = await base44.functions.invoke('sendUserInvitation', {
        email: invitation.email,
        full_name: invitation.full_name,
        company_name: invitation.company_name,
        role: invitation.role,
        user_type: invitation.user_type,
        account_id: invitation.account_id,
        assigned_account_ids: invitation.assigned_account_ids,
        send_email: true,
        resend_token: invitation.token
      });

      if (response.data && response.data.success) {
        toast.success(`Invitation email resent to ${invitation.email}`);
      } else {
        toast.error('Failed to resend invitation email');
      }
    } catch (err) {
      console.error("Error resending invitation:", err);
      toast.error('Failed to resend invitation email');
    } finally {
      setResendingEmail(null);
    }
  };

  const handleToggleViewAllRecipes = async (user, checked) => {
    try {
        // Optimistic update
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, view_all_recipes: checked } : u));
        await base44.entities.User.update(user.id, { view_all_recipes: checked });
    } catch (err) {
        console.error("Error updating permission", err);
        loadData(); // Revert on error
    }
  };

  // Merge users with their invitations
  const mergedData = React.useMemo(() => {
    const result = [];
    const processedEmails = new Set();
    
    // 1. Add all existing users
    users.forEach(user => {
      const emailLower = user.email.toLowerCase();
      processedEmails.add(emailLower);
      
      // Find the most recent pending invitation for this user
      const userInvitation = invitations
        .filter(inv => inv.email.toLowerCase() === emailLower)
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
      
      result.push({ 
        ...user, 
        type: 'user', 
        invitation: userInvitation || null 
      });
    });

    // 2. Add pending invitations (only one per email, most recent)
    const pendingInvitesByEmail = new Map();
    invitations.forEach(inv => {
      const emailLower = inv.email.toLowerCase();
      if (!processedEmails.has(emailLower)) {
        const existing = pendingInvitesByEmail.get(emailLower);
        if (!existing || new Date(inv.created_date) > new Date(existing.created_date)) {
          pendingInvitesByEmail.set(emailLower, inv);
        }
      }
    });

    pendingInvitesByEmail.forEach(inv => {
      result.push({
        id: `invite-${inv.id}`,
        email: inv.email,
        full_name: inv.full_name || 'Invited User',
        role: inv.role,
        user_type: inv.user_type,
        company_name: inv.company_name,
        account_id: inv.account_id,
        assigned_account_ids: inv.assigned_account_ids,
        created_date: inv.created_date,
        type: 'invitation',
        invitation: inv
      });
    });

    return result;
  }, [users, invitations]);

  const filteredItems = mergedData.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.full_name?.toLowerCase().includes(searchLower) ||
      item.email?.toLowerCase().includes(searchLower) ||
      item.company_name?.toLowerCase().includes(searchLower) ||
      (item.invitation && item.invitation.token.toLowerCase().includes(searchLower))
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <div className="text-red-500 mb-4 text-xl font-semibold">⚠️ {error}</div>
              <Button onClick={loadData} className="bg-blue-600 hover:bg-blue-700">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          </div>
          <div className="flex justify-between items-end">
            <p className="text-gray-600">View and manage user access across the platform</p>
            <div className="flex gap-2">
              <Link to={createPageUrl('duplicate-recipe-manager')}>
                <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
                  <Copy className="w-4 h-4 mr-2" />
                  Manage Duplicates
                </Button>
              </Link>
              <Button onClick={() => setShowInviteModal(true)} className="bg-blue-600 hover:bg-blue-700">
                <Mail className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            </div>
          </div>
        </div>

        <Card className="mb-6 border border-gray-200 shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-300 focus:border-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle>All Users ({filteredItems.length})</CardTitle>
            <CardDescription>
              Comprehensive list of all users and their menu access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredItems.length > 0 ? (
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <Card key={item.id} className={`border-gray-200 hover:shadow-md transition-shadow ${item.type === 'invitation' ? 'border-dashed border-2 bg-gray-50' : ''}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex-1 space-y-3 min-w-0">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold text-gray-900 truncate max-w-full">
                                {item.full_name || 'No Name'}
                              </h3>
                              {item.type === 'invitation' && (
                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 shrink-0">
                                  Pending Invite
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="w-4 h-4 shrink-0" />
                              <span className="text-sm break-all">{item.email}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge className={getRoleBadgeColor(item.role)}>
                              <Shield className="w-3 h-3 mr-1" />
                              {item.role || 'user'}
                            </Badge>
                            
                            {item.user_type && (
                              <Badge className={getUserTypeBadgeColor(item.user_type)}>
                                {item.user_type === 'internal' && 'Internal User'}
                                {item.user_type === 'admin' && 'Admin'}
                                {item.user_type === 'buyer_admin' && 'Buyer Admin'}
                                {item.user_type === 'sales_rep' && 'Sales Rep'}
                                {item.user_type === 'on_premise' && 'On Premise'}
                              </Badge>
                            )}

                            {item.company_name && (
                              <Badge variant="outline" className="border-gray-300">
                                <Building2 className="w-3 h-3 mr-1" />
                                {item.company_name}
                              </Badge>
                            )}
                          </div>

                          {item.type === 'user' && (
                            <div className="flex items-center space-x-2 mt-2">
                              <Switch 
                                id={`view-all-${item.id}`}
                                checked={item.view_all_recipes || false}
                                onCheckedChange={(checked) => handleToggleViewAllRecipes(item, checked)}
                              />
                              <Label htmlFor={`view-all-${item.id}`} className="text-xs text-gray-600 font-medium">
                                Global Recipe Access
                              </Label>
                            </div>
                          )}

                          {/* Invitation Status & Code Section */}
                          {item.invitation && (
                            <div className="bg-gray-100/50 p-3 rounded-lg border border-gray-200 space-y-2 text-sm">
                              <div className="flex items-center gap-2 font-medium">
                                <span className="text-gray-500">Invitation Status:</span>
                                <span className={item.invitation.status === 'accepted' ? 'text-green-600' : 'text-amber-600'}>
                                  {item.invitation.status === 'accepted' ? 'Accepted' : 'Pending'}
                                </span>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <span className="text-gray-500 shrink-0">Access Code:</span>
                                <code className="bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-800 font-mono tracking-wider text-xs break-all">
                                  {item.invitation.token}
                                </code>
                              </div>
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleShowQR(item.invitation.token)}
                                  className="h-7 text-xs"
                                >
                                  <QrCode className="w-3 h-3 mr-1" />
                                  Show QR
                                </Button>
                                {item.invitation.status === 'pending' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleResendInvitation(item.invitation)}
                                    disabled={resendingEmail === item.invitation.id}
                                    className="h-7 text-xs"
                                  >
                                    {resendingEmail === item.invitation.id ? (
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <Send className="w-3 h-3 mr-1" />
                                    )}
                                    Resend Email
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {item.account_id && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="font-medium shrink-0">Account:</span>
                              <span className="truncate">{getAccountName(item.account_id)}</span>
                            </div>
                          )}

                          {item.assigned_account_ids && item.assigned_account_ids.length > 0 && (
                            <div className="flex flex-col gap-1 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">Assigned Accounts:</span>
                              </div>
                              <div className="pl-6 flex flex-wrap gap-1">
                                {item.assigned_account_ids.map(accId => (
                                  <Badge key={accId} variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                                    {getAccountName(accId)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.accepted_menu_id && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <Wine className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-blue-900">Menu Access:</span>
                              <span className="text-blue-800">{getMenuName(item.accepted_menu_id)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-3">
                          <div className="text-xs text-gray-400 lg:text-right">
                            <div>Created: {new Date(item.created_date).toLocaleDateString()}</div>
                            <div className="mt-1">ID: {item.id}</div>
                          </div>
                          
                          <div className="flex flex-col gap-2 items-end w-full lg:w-auto">
                            {/* Only show Edit for real users, maybe for invitations we could have "Resend" or "Delete" later */}
                            {item.type === 'user' && (
                               <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleEditUser(item)}
                                className="w-full lg:w-auto border-gray-300 text-gray-700 hover:bg-gray-50"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit User
                              </Button>
                            )}

                            {/* Delete logic needs to handle users vs invitations */}
                            {item.id === currentUser?.id ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                disabled
                                className="w-full lg:w-auto text-gray-400 cursor-not-allowed bg-gray-50"
                              >
                                <Lock className="w-4 h-4 mr-2" />
                                Current User
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteUser(item.id, item.email)}
                                className="w-full lg:w-auto text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete {item.type === 'user' ? 'User' : 'Invite'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No users found matching your search</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {editingUser && (
        <EditUserModal
            user={editingUser}
            isOpen={!!editingUser}
            onClose={() => setEditingUser(null)}
            onSave={handleSaveUser}
            allAccounts={accounts}
            allMenus={menus}
        />
      )}

      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => {
          loadData();
          toast.success("Invitation sent successfully!");
        }}
        allAccounts={accounts}
        allMenus={menus}
      />

      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Access Code QR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">Access Code:</p>
              <code className="bg-gray-100 px-3 py-1 rounded text-lg font-mono">
                {selectedAccessCode}
              </code>
            </div>
            {selectedAccessCode && (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/invite-welcome?code=${selectedAccessCode}`)}`}
                alt="QR Code"
                className="w-64 h-64 border-2 border-gray-200 rounded"
              />
            )}
            <p className="text-xs text-gray-500 text-center">
              Scan to see invitation details and signup instructions
            </p>
            <div className="text-center w-full">
              <p className="text-xs text-gray-400 mb-2">Or share this link:</p>
              <code className="bg-gray-100 px-3 py-2 rounded text-xs break-all block">
                {window.location.origin}/invite-welcome?code={selectedAccessCode}
              </code>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}