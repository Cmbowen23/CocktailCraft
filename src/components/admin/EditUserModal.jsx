import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Plus, Trash2, X } from "lucide-react";

export default function EditUserModal({ user, isOpen, onClose, onSave, allAccounts = [], allMenus = [] }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    company_name: '',
    role: 'user',
    user_type: 'internal',
    account_id: '',
    assigned_account_ids: [],
    buyer_menu_access: []
  });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        company_name: user.company_name || '',
        role: user.role || 'user',
        user_type: user.user_type || 'internal',
        account_id: user.account_id || '',
        assigned_account_ids: user.assigned_account_ids || [],
        buyer_menu_access: user.buyer_menu_access || []
      });
    }
  }, [user]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBuyerMenuAccessChange = (index, field, value) => {
    const newAccess = [...formData.buyer_menu_access];
    if (!newAccess[index]) return;
    
    newAccess[index] = { ...newAccess[index], [field]: value };
    
    // If account changes, reset menu selection since menus are account-specific
    if (field === 'account_id') {
        newAccess[index].menu_ids = [];
    }
    
    setFormData(prev => ({ ...prev, buyer_menu_access: newAccess }));
  };

  const addBuyerMenuAccess = () => {
    setFormData(prev => ({
      ...prev,
      buyer_menu_access: [...prev.buyer_menu_access, { account_id: '', menu_ids: [] }]
    }));
  };

  const removeBuyerMenuAccess = (index) => {
    const newAccess = [...formData.buyer_menu_access];
    newAccess.splice(index, 1);
    setFormData(prev => ({ ...prev, buyer_menu_access: newAccess }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(user.id, formData);
  };

  const accountOptions = allAccounts.map(acc => ({ label: acc.name, value: acc.id }));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User: {user?.full_name}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input 
                id="full_name" 
                value={formData.full_name} 
                onChange={(e) => handleChange('full_name', e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                value={formData.email} 
                disabled 
                className="bg-gray-100 text-gray-500" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">System Role</Label>
              <Select value={formData.role} onValueChange={(val) => handleChange('role', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_type">User Type</Label>
              <Select value={formData.user_type} onValueChange={(val) => handleChange('user_type', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="buyer_admin">Buyer Admin</SelectItem>
                  <SelectItem value="sales_rep">Sales Rep</SelectItem>
                  <SelectItem value="on_premise">On Premise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input 
              id="company_name" 
              value={formData.company_name} 
              onChange={(e) => handleChange('company_name', e.target.value)} 
            />
          </div>

          {/* Buyer Admin Specific Fields */}
          {formData.user_type === 'buyer_admin' && (
            <div className="space-y-4 border rounded-md p-4 bg-gray-50">
              <h4 className="font-medium text-sm text-gray-700">Buyer Settings</h4>
              
              <div className="space-y-2">
                <Label htmlFor="account_id">Primary Account</Label>
                <Select value={formData.account_id} onValueChange={(val) => handleChange('account_id', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select primary account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Menu Access by Account</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addBuyerMenuAccess}>
                    <Plus className="w-3 h-3 mr-1" /> Add Access
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {formData.buyer_menu_access.map((access, index) => {
                    // Filter menus for the selected account in this row
                    const accountMenus = allMenus
                        .filter(m => m.account_id === access.account_id)
                        .map(m => ({ label: m.name, value: m.id }));

                    return (
                      <div key={index} className="flex gap-2 items-start p-2 border rounded bg-white">
                        <div className="flex-1 space-y-2">
                          <Select 
                            value={access.account_id} 
                            onValueChange={(val) => handleBuyerMenuAccessChange(index, 'account_id', val)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select Account" />
                            </SelectTrigger>
                            <SelectContent>
                              {allAccounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <MultiSelect 
                            options={accountMenus}
                            selected={access.menu_ids || []}
                            onChange={(val) => handleBuyerMenuAccessChange(index, 'menu_ids', val)}
                            placeholder={access.account_id ? "Select Menus..." : "Select Account First"}
                            className="h-9"
                          />
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 mt-1"
                          onClick={() => removeBuyerMenuAccess(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {formData.buyer_menu_access.length === 0 && (
                    <p className="text-xs text-gray-500 italic">No specific menu access rules configured.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sales/On-Premise Specific Fields */}
          {(formData.user_type === 'sales_rep' || formData.user_type === 'on_premise') && (
             <div className="space-y-2 border rounded-md p-4 bg-gray-50">
                <Label>Assigned Accounts</Label>
                <MultiSelect 
                    options={accountOptions}
                    selected={formData.assigned_account_ids || []}
                    onChange={(val) => handleChange('assigned_account_ids', val)}
                    placeholder="Select accounts..."
                />
             </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}