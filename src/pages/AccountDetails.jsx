import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Account } from "@/api/entities";
import { Menu } from "@/api/entities";
import { Tasting } from "@/api/entities";
import { User } from "@/api/entities";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, ArrowLeft, Edit, Trash2, BookOpen, ArrowRight, ExternalLink, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import MenuForm from "../components/menus/MenuForm";
import BulkRecipeImporter from "../components/recipes/BulkRecipeImporter";
import { Ingredient } from "@/api/entities";

const typeColors = {
  draft: "bg-gray-100 text-gray-800 border-gray-200",
  tasting: "bg-yellow-100 text-yellow-800 border-yellow-200",
  active: "bg-green-100 text-green-800 border-green-200",
};

export default function AccountDetailsPage() {
  const [account, setAccount] = useState(null);
  const [menus, setMenus] = useState([]);
  const [tastings, setTastings] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const accountId = urlParams.get('id');

  useEffect(() => {
    if (accountId) {
      loadData();
    }
  }, [accountId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const currentUser = await base44.auth.me();
      let accountData = null;
      if (accountId) {
        try {
          accountData = await Account.get(accountId);
        } catch (accountError) {
          console.error("Error loading account:", accountError);
          setError("Account not found or has been deleted.");
          setIsLoading(false);
          return;
        }
      }

      if (!accountData) {
        setError("Account not found.");
        setIsLoading(false);
        return;
      }

      setAccount(accountData);

      try {
        const menuData = await Menu.filter({ account_id: accountId }, "-created_date");
        
        // Filter menus if user is a restricted buyer
        if (currentUser?.user_type === 'buyer_admin') {
            let hasAccess = false;
            
            // 1. Check primary account
            if (currentUser.account_id === accountId) {
                hasAccess = true;
            }
            
            // 2. Check UserAccountAccess entity
            if (!hasAccess) {
                try {
                    const accessRecords = await base44.entities.UserAccountAccess.filter({ 
                        user_email: currentUser.email,
                        account_id: accountId 
                    });
                    if (accessRecords && accessRecords.length > 0) {
                        hasAccess = true;
                    }
                } catch (e) {
                    console.error("Error checking UserAccountAccess:", e);
                }
            }

            // 3. Check legacy buyer_menu_access (treat as full account access)
            if (!hasAccess && currentUser.buyer_menu_access?.some(a => a.account_id === accountId)) {
                hasAccess = true;
            }

            if (hasAccess) {
                setMenus(menuData || []);
            } else {
                setMenus([]);
            }
        } else {
           // Admin or internal user -> Show all
           setMenus(menuData || []);
        }

      } catch (menuError) {
        console.error("Error loading menus:", menuError);
        setMenus([]);
      }

      try {
        const tastingData = await Tasting.filter({ account_id: accountId }, "-created_date");
        setTastings(tastingData || []);
      } catch (tastingError) {
        console.error("Error loading tastings:", tastingError);
        setTastings([]);
      }

      try {
        const usersData = await User.list();
        setUsers(usersData || []);
      } catch (usersError) {
        console.error("Error loading users:", usersError);
        setUsers([]);
      }

    } catch (err) {
      console.error("Error loading account details:", err);
      setError("Failed to load account details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (menuData) => {
    try {
      const dataWithAccountId = { ...menuData, account_id: accountId };
      
      if (editingMenu) {
        await Menu.update(editingMenu.id, dataWithAccountId);
      } else {
        await Menu.create(dataWithAccountId);
      }
      
      setShowForm(false);
      setEditingMenu(null);
      loadData();
    } catch (err) {
      console.error("Error saving menu:", err);
      setError("Failed to save menu. Please try again.");
    }
  };

  const handleEdit = (menu) => {
    setEditingMenu(menu);
    setShowForm(true);
  };

  const handleDelete = async (menuId) => {
    if (window.confirm("Are you sure you want to delete this menu? All associated recipes will also be deleted.")) {
      try {
        await Menu.delete(menuId);
        loadData();
      } catch (err) {
        console.error("Error deleting menu:", err);
        setError("Failed to delete menu. Please try again.");
      }
    }
  };

  const getSharedUsersForMenu = (menuId) => {
    return users.filter(user => user.accepted_menu_id === menuId);
  };

  const filteredMenus = menus.filter(menu =>
    menu.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    menu.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="w-full h-96 bg-white/50 rounded-xl animate-pulse border border-gray-200"></div>
        </div>
      </div>
    );
  }

  if (error && !account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="text-center py-12">
              <div className="text-red-500 mb-4 text-xl font-semibold">⚠️ {error || "Account not found"}</div>
              <p className="text-gray-600 mb-6">The account you're looking for may have been deleted or moved.</p>
              <div className="flex gap-3 justify-center">
                <Link to={createPageUrl("Accounts")}>
                  <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Accounts
                  </Button>
                </Link>
                <Button onClick={loadData} className="bg-blue-600 hover:bg-blue-700">
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link to={createPageUrl("Accounts")} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Accounts
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{account?.name}</h1>
              <p className="text-gray-600 mt-1">Manage details and associated content</p>
            </div>
          </div>
        </div>

        {error && (
          <Card className="mb-8 border border-red-200 shadow-sm bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="menus" className="mt-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="menus">Menus ({(menus || []).length})</TabsTrigger>
            <TabsTrigger value="tastings">Tastings ({tastings.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="menus" className="mt-6">
            <div className="flex justify-end mb-4">
              <Button 
                onClick={() => { 
                  setShowForm(true); 
                  setEditingMenu(null);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Menu
              </Button>
            </div>
            
            <AnimatePresence>
              {showForm && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-8">
                  <Card className="border border-gray-200 shadow-sm bg-white">
                    <CardHeader>
                      <CardTitle>{editingMenu ? "Edit Menu" : "Create New Menu"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MenuForm
                        menu={editingMenu}
                        onSubmit={handleSubmit}
                        onCancel={() => { 
                          setShowForm(false); 
                          setEditingMenu(null);
                        }}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Card className="mb-8 border border-gray-200 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search menus..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-blue-500"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredMenus.length > 0 ? (
                  filteredMenus.map((menu) => {
                    const sharedUsers = getSharedUsersForMenu(menu.id);
                    return (
                      <motion.div
                        key={menu.id}
                        layout
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className="border border-gray-200 shadow-sm bg-white h-full flex flex-col">
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-xl text-gray-800">{menu.name}</CardTitle>
                                <CardDescription className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {menu.description || "No description provided."}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                {sharedUsers.length > 0 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-md border border-blue-200 cursor-help">
                                          <Users className="w-4 h-4 text-blue-600" />
                                          <span className="text-xs font-medium text-blue-700">{sharedUsers.length}</span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <div className="space-y-1">
                                          <p className="font-semibold text-xs mb-2">Shared with:</p>
                                          {sharedUsers.map((user, idx) => (
                                            <div key={idx} className="text-xs">
                                              • {user.full_name || user.email}
                                            </div>
                                          ))}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                <Badge variant="outline" className={`${typeColors[menu.type || "draft"]} text-xs capitalize`}>
                                  {menu.type || "Draft"}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="flex-grow flex flex-col justify-between">
                            <div className="mb-4">
                              <Link to={createPageUrl(`MenuDetails?id=${menu.id}`)} className="block">
                                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                                  View Menu
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                              </Link>
                            </div>
                            
                            <div className="flex gap-2 mb-3">
                              <Button onClick={() => handleEdit(menu)} variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 flex-1">
                                <Edit className="w-4 h-4 mr-2" /> Edit
                              </Button>
                              <Button asChild variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 flex-1">
                                <Link to={createPageUrl(`CustomerMenuPreview?id=${menu.id}`)} target="_blank">
                                  <ExternalLink className="w-3 h-3 mr-2" />
                                  Preview
                                </Link>
                              </Button>
                            </div>
                            
                            <div className="flex justify-end pt-2 border-t border-gray-200">
                              <Button onClick={() => handleDelete(menu.id)} variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs">
                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="col-span-full">
                    <Card className="border border-gray-200 shadow-sm bg-white">
                      <CardContent className="text-center py-12">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">
                          {searchTerm ? "No menus match your search" : "No menus yet"}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {searchTerm ? "Try adjusting your search" : "Create your first menu to get started"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </TabsContent>
          <TabsContent value="tastings" className="mt-6">
            <Card className="border border-gray-200 shadow-sm bg-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Account Tastings</h3>
                {tastings.length > 0 ? (
                  <ul className="space-y-2">
                    {tastings.map((tasting) => (
                      <li key={tasting.id} className="p-3 bg-white rounded-md shadow-sm border border-gray-200">
                        <h4 className="font-medium text-gray-800">{tasting.name}</h4>
                        <p className="text-sm text-gray-600">{tasting.description || "No description"}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600">No tastings found for this account.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}