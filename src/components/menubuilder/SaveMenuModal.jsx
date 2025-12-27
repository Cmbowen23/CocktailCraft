import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Building2, Menu as MenuIcon } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function SaveMenuModal({ sections, onClose, onSave }) {
  const [accounts, setAccounts] = useState([]);
  const [menus, setMenus] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [accountTab, setAccountTab] = useState('existing');
  const [menuTab, setMenuTab] = useState('existing');

  // Existing selections
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedMenuId, setSelectedMenuId] = useState('');

  // New account form
  const [newAccount, setNewAccount] = useState({
    name: '',
    description: '',
    type: 'restaurant'
  });

  // New menu form
  const [newMenu, setNewMenu] = useState({
    name: '',
    season: 'All-Season',
    year: new Date().getFullYear(),
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadMenusForAccount(selectedAccountId);
    } else {
      setMenus([]);
      setSelectedMenuId('');
    }
  }, [selectedAccountId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const accountsData = await base44.entities.Account.list();
      setAccounts(accountsData || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMenusForAccount = async (accountId) => {
    try {
      const menusData = await base44.entities.Menu.filter({ account_id: accountId });
      setMenus(menusData || []);
    } catch (error) {
      console.error('Error loading menus:', error);
      setMenus([]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let accountId = selectedAccountId;
      let menuId = selectedMenuId;

      // Create new account if needed
      if (accountTab === 'new') {
        if (!newAccount.name.trim()) {
          alert('Please enter an account name');
          setIsSaving(false);
          return;
        }
        const createdAccount = await base44.entities.Account.create(newAccount);
        accountId = createdAccount.id;
      }

      if (!accountId) {
        alert('Please select or create an account');
        setIsSaving(false);
        return;
      }

      // Prepare recipe IDs from sections
      const recipeIds = sections.flatMap(s => s.recipes);

      // Create new menu if needed
      if (menuTab === 'new') {
        if (!newMenu.name.trim()) {
          alert('Please enter a menu name');
          setIsSaving(false);
          return;
        }
        const menuData = {
          ...newMenu,
          account_id: accountId,
          customer_menu_settings: {
            recipe_order: recipeIds,
            excluded_recipes: []
          }
        };
        const createdMenu = await base44.entities.Menu.create(menuData);
        menuId = createdMenu.id;

        // CRITICAL FIX: Update menu_id on all recipes being added
        if (recipeIds.length > 0) {
          const updatePromises = recipeIds.map(recipeId => 
            base44.entities.Recipe.update(recipeId, { menu_id: menuId })
          );
          await Promise.all(updatePromises);
        }
      } else {
        // Update existing menu
        if (!menuId) {
          alert('Please select a menu');
          setIsSaving(false);
          return;
        }
        const existingMenu = menus.find(m => m.id === menuId);
        await base44.entities.Menu.update(menuId, {
          customer_menu_settings: {
            ...existingMenu.customer_menu_settings,
            recipe_order: recipeIds
          }
        });

        // CRITICAL FIX: Update menu_id on all recipes being added
        if (recipeIds.length > 0) {
          const updatePromises = recipeIds.map(recipeId => 
            base44.entities.Recipe.update(recipeId, { menu_id: menuId })
          );
          await Promise.all(updatePromises);
        }
      }

      // Redirect to account details page
      window.location.href = createPageUrl(`AccountDetails?id=${accountId}`);
      onSave();
    } catch (error) {
      console.error('Error saving menu:', error);
      alert('Failed to save menu. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const recipeCount = sections.reduce((total, section) => total + section.recipes.length, 0);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save Menu ({recipeCount} recipes)</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Account Selection */}
            <div>
              <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Select Account
              </h3>
              <Tabs value={accountTab} onValueChange={setAccountTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Existing Account</TabsTrigger>
                  <TabsTrigger value="new">New Account</TabsTrigger>
                </TabsList>
                <TabsContent value="existing" className="space-y-3 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="account-select">Account</Label>
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                      <SelectTrigger id="account-select">
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
                <TabsContent value="new" className="space-y-3 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-account-name">Account Name *</Label>
                    <Input
                      id="new-account-name"
                      value={newAccount.name}
                      onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                      placeholder="e.g., The Golden Tap"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-account-type">Type</Label>
                    <Select value={newAccount.type} onValueChange={(val) => setNewAccount({ ...newAccount, type: val })}>
                      <SelectTrigger id="new-account-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restaurant">Restaurant</SelectItem>
                        <SelectItem value="bar">Bar</SelectItem>
                        <SelectItem value="hotel">Hotel</SelectItem>
                        <SelectItem value="catering">Catering</SelectItem>
                        <SelectItem value="event_venue">Event Venue</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-account-desc">Description</Label>
                    <Textarea
                      id="new-account-desc"
                      value={newAccount.description}
                      onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                      placeholder="Brief description..."
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Menu Selection */}
            {(accountTab === 'existing' && selectedAccountId) || accountTab === 'new' ? (
              <div>
                <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <MenuIcon className="w-4 h-4" /> Select Menu
                </h3>
                <Tabs value={menuTab} onValueChange={setMenuTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing" disabled={accountTab === 'new' || menus.length === 0}>
                      Existing Menu {accountTab === 'existing' && menus.length > 0 && `(${menus.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="new">New Menu</TabsTrigger>
                  </TabsList>
                  <TabsContent value="existing" className="space-y-3 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="menu-select">Menu</Label>
                      <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
                        <SelectTrigger id="menu-select">
                          <SelectValue placeholder="Select a menu" />
                        </SelectTrigger>
                        <SelectContent>
                          {menus.map((menu) => (
                            <SelectItem key={menu.id} value={menu.id}>
                              {menu.name} {menu.season && `- ${menu.season}`} {menu.year && `${menu.year}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                  <TabsContent value="new" className="space-y-3 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-menu-name">Menu Name *</Label>
                      <Input
                        id="new-menu-name"
                        value={newMenu.name}
                        onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
                        placeholder="e.g., Summer 2025"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="new-menu-season">Season</Label>
                        <Select value={newMenu.season} onValueChange={(val) => setNewMenu({ ...newMenu, season: val })}>
                          <SelectTrigger id="new-menu-season">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Spring">Spring</SelectItem>
                            <SelectItem value="Summer">Summer</SelectItem>
                            <SelectItem value="Fall">Fall</SelectItem>
                            <SelectItem value="Winter">Winter</SelectItem>
                            <SelectItem value="All-Season">All-Season</SelectItem>
                            <SelectItem value="Event/Pop-up">Event/Pop-up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-menu-year">Year</Label>
                        <Input
                          id="new-menu-year"
                          type="number"
                          value={newMenu.year}
                          onChange={(e) => setNewMenu({ ...newMenu, year: parseInt(e.target.value) || new Date().getFullYear() })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-menu-desc">Description</Label>
                      <Textarea
                        id="new-menu-desc"
                        value={newMenu.description}
                        onChange={(e) => setNewMenu({ ...newMenu, description: e.target.value })}
                        placeholder="Brief description..."
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Continue'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}