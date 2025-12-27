import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, BookOpen, Users } from "lucide-react";
import { Menu } from "@/api/entities";
import { Account } from "@/api/entities";
import { Recipe } from "@/api/entities";
import { Tasting } from "@/api/entities";

export default function AddToMenuModal({ 
  recipes, 
  accountId: providedAccountId, 
  tastingId, 
  onSave, 
  onCancel 
}) {
  const [selectedAccountId, setSelectedAccountId] = useState(providedAccountId || null);
  const [allAccounts, setAllAccounts] = useState([]);
  const [existingMenus, setExistingMenus] = useState([]);
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [newMenuData, setNewMenuData] = useState({
    name: "",
    season: "All-Season",
    year: new Date().getFullYear(),
    description: ""
  });
  const [newAccountData, setNewAccountData] = useState({
    name: "",
    type: "restaurant",
    description: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("existing");
  const [accountMode, setAccountMode] = useState("existing"); // "existing" or "new"
  const [recipeData, setRecipeData] = useState([]);
  
  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load all accounts (needed for account selection dropdown)
        const accountsData = await Account.list();
        setAllAccounts(accountsData || []);

        // Load recipe data
        if (recipes && recipes.length > 0) {
          const recipePromises = recipes.map(id => Recipe.get(id));
          const recipesData = await Promise.all(recipePromises);
          setRecipeData(recipesData.filter(r => r !== null));
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
    };
    
    loadInitialData();
  }, [recipes]);

  // Load menus when account changes
  useEffect(() => {
    if (selectedAccountId) {
      loadMenusForAccount(selectedAccountId);
    } else {
      setExistingMenus([]);
      setSelectedMenuId("");
    }
  }, [selectedAccountId]);

  const loadMenusForAccount = async (accountId) => {
    if (!accountId) return;
    
    try {
      const menusData = await Menu.filter({ account_id: accountId }, "-created_date");
      setExistingMenus(menusData || []);
      
      // Auto-select first menu if only one exists
      if (menusData && menusData.length === 1) {
        setSelectedMenuId(menusData[0].id);
      }
    } catch (error) {
      console.error("Error loading menus:", error);
      setExistingMenus([]);
    }
  };

  const handleAddToExistingMenu = async () => {
    if (!selectedMenuId || !recipes || recipes.length === 0) return;
    
    setIsLoading(true);
    try {
      const menu = await Menu.get(selectedMenuId);
      if (!menu) {
        throw new Error("Selected menu not found");
      }

      // Get current recipe order or initialize empty array
      const currentRecipeOrder = menu.customer_menu_settings?.recipe_order || [];
      
      // Add new recipes to the order (avoid duplicates)
      const newRecipeOrder = [...currentRecipeOrder];
      recipes.forEach(recipeId => {
        if (!newRecipeOrder.includes(recipeId)) {
          newRecipeOrder.push(recipeId);
        }
      });

      // Update menu with new recipe order
      const updatedMenuSettings = {
        ...menu.customer_menu_settings,
        recipe_order: newRecipeOrder
      };

      await Menu.update(selectedMenuId, {
        customer_menu_settings: updatedMenuSettings
      });

      // CRITICAL FIX: Update menu_id on all recipes being added
      const updatePromises = recipes.map(recipeId => 
        Recipe.update(recipeId, { menu_id: selectedMenuId })
      );
      await Promise.all(updatePromises);

      onSave();
    } catch (error) {
      console.error("Error adding recipes to menu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewMenu = async () => {
    if (!newMenuData.name.trim()) return;
    
    setIsLoading(true);
    try {
      let accountIdToUse = selectedAccountId;
      
      // Create new account if needed
      if (accountMode === "new") {
        if (!newAccountData.name.trim()) {
          alert("Please enter an account name");
          setIsLoading(false);
          return;
        }
        
        const newAccount = await Account.create(newAccountData);
        accountIdToUse = newAccount.id;
      }
      
      if (!accountIdToUse) {
        alert("Please select or create an account");
        setIsLoading(false);
        return;
      }
      
      const menuData = {
        ...newMenuData,
        account_id: accountIdToUse,
        customer_menu_settings: {
          title: newMenuData.name,
          subtitle: "",
          footer_text: "",
          show_descriptions: true,
          show_prices: false,
          text_alignment: "left",
          use_unified_price: false,
          recipe_order: recipes || [],
          excluded_recipes: [],
          custom_recipe_names: {},
          custom_descriptions: {}
        }
      };

      const newMenu = await Menu.create(menuData);

      // CRITICAL FIX: Update menu_id on all recipes being added
      if (recipes && recipes.length > 0) {
        const updatePromises = recipes.map(recipeId => 
          Recipe.update(recipeId, { menu_id: newMenu.id })
        );
        await Promise.all(updatePromises);
      }

      // If this is part of a tasting, link the menu to the tasting
      if (tastingId) {
        await Tasting.update(tastingId, { menu_id: newMenu.id });
      }

      onSave();
    } catch (error) {
      console.error("Error creating menu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = selectedAccountId !== null || accountMode === "new";

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            Add {recipes?.length || 0} Recipe{(recipes?.length || 0) !== 1 ? 's' : ''} to Menu
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipe List Preview */}
          {recipeData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Recipes to Add ({recipeData.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {recipeData.map(recipe => (
                    <div key={recipe.id} className="text-sm text-gray-700 py-1 px-2 bg-gray-50 rounded">
                      {recipe.name}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Selection - Only show if no accountId was provided */}
          {!providedAccountId && (
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  Select or Create Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={accountMode} onValueChange={setAccountMode} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing">Existing Account</TabsTrigger>
                    <TabsTrigger value="new">New Account</TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing" className="space-y-4">
                    <Select value={selectedAccountId || ""} onValueChange={setSelectedAccountId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose an account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allAccounts.map(account => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-emerald-600" />
                              <span>{account.name}</span>
                              <span className="text-sm text-gray-500 ml-2">
                                ({account.type?.replace('_', ' ')})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!selectedAccountId && (
                      <p className="text-sm text-gray-600">
                        Please select an account to continue
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="new" className="space-y-4">
                    <div>
                      <Label htmlFor="account-name">Account Name *</Label>
                      <Input
                        id="account-name"
                        value={newAccountData.name}
                        onChange={(e) => setNewAccountData(prev => ({...prev, name: e.target.value}))}
                        placeholder="e.g., The Gilded Oak"
                      />
                    </div>
                    <div>
                      <Label htmlFor="account-type">Account Type</Label>
                      <Select 
                        value={newAccountData.type} 
                        onValueChange={(value) => setNewAccountData(prev => ({...prev, type: value}))}
                      >
                        <SelectTrigger>
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
                    <div>
                      <Label htmlFor="account-description">Description</Label>
                      <Input
                        id="account-description"
                        value={newAccountData.description}
                        onChange={(e) => setNewAccountData(prev => ({...prev, description: e.target.value}))}
                        placeholder="Brief description of the account"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Menu Selection/Creation - Only show if account is selected or new account mode */}
          {canProceed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Choose Menu Option</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing" disabled={existingMenus.length === 0 || accountMode === "new"}>
                      Add to Existing Menu
                    </TabsTrigger>
                    <TabsTrigger value="new">Create New Menu</TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing" className="space-y-4">
                    {existingMenus.length > 0 ? (
                      <>
                        <div>
                          <Label htmlFor="existing-menu">Select Menu</Label>
                          <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a menu..." />
                            </SelectTrigger>
                            <SelectContent>
                              {existingMenus.map(menu => (
                                <SelectItem key={menu.id} value={menu.id}>
                                  <div className="flex flex-col">
                                    <span>{menu.name}</span>
                                    <span className="text-sm text-gray-500">
                                      {menu.season} {menu.year} • {menu.status}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          onClick={handleAddToExistingMenu} 
                          disabled={!selectedMenuId || isLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                        >
                          {isLoading ? "Adding..." : "Add to Selected Menu"}
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No existing menus found for this account</p>
                        <p className="text-sm">Create a new menu instead</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="new" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="menu-name">Menu Name *</Label>
                        <Input
                          id="menu-name"
                          value={newMenuData.name}
                          onChange={(e) => setNewMenuData(prev => ({...prev, name: e.target.value}))}
                          placeholder="e.g., Summer 2024"
                        />
                      </div>
                      <div>
                        <Label htmlFor="menu-season">Season</Label>
                        <Select 
                          value={newMenuData.season} 
                          onValueChange={(value) => setNewMenuData(prev => ({...prev, season: value}))}
                        >
                          <SelectTrigger>
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
                    </div>
                    <div>
                      <Label htmlFor="menu-description">Description</Label>
                      <Input
                        id="menu-description"
                        value={newMenuData.description}
                        onChange={(e) => setNewMenuData(prev => ({...prev, description: e.target.value}))}
                        placeholder="Brief description of the menu theme or focus"
                      />
                    </div>
                    <Button 
                      onClick={handleCreateNewMenu} 
                      disabled={!newMenuData.name.trim() || isLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isLoading ? "Creating..." : `Create ${accountMode === "new" ? "Account & " : ""}Menu & Add Recipes`}
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}