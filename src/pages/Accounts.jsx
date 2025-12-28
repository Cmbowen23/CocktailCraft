import React, { useState, useEffect } from "react";
import { Account } from "@/api/entities";
import { Menu } from "@/api/entities";
import { Tasting } from "@/api/entities";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Plus, Search, Upload, Building2, Trash2, CheckSquare, Square, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import AccountForm from "../components/accounts/AccountForm";
import AccountRow from "../components/accounts/AccountRow";
import BulkAccountImporter from "../components/accounts/BulkAccountImporter";
import CocktailLoader from "@/components/ui/CocktailLoader";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [allTastings, setAllTastings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  const [viewMode, setViewMode] = useState("all"); // 'all', 'mine', 'custom'
  const [customAccountIds, setCustomAccountIds] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // First check if user is authenticated
      const user = await base44.auth.me();
      setCurrentUser(user);
      
      if (!user) {
        setAccounts([]);
        setAllMenus([]);
        setAllTastings([]);
        setIsLoading(false);
        return;
      }

      // Fetch users map if Admin or On Premise to display Sales Rep Name (Legacy support)
      if (user.role === 'admin' || ['on_premise', 'sales_rep', 'internal'].includes(user.user_type)) {
          base44.functions.invoke('getPotentialOwners').then(response => {
              const users = response.data || [];
              const map = {};
              users.forEach(u => {
                  map[u.id] = u.full_name;
                  if (u.email) map[u.email] = u.full_name;
              });
              setUsersMap(map);
          }).catch(err => console.error("Error loading users for sales rep display:", err));
      }
      
      // Fetch accounts based on Role
      let accountPromise;

      if (user.role === 'admin') {
        // Admin sees all accounts
        accountPromise = Account.list("-updated_at");
      } else if (['sales_rep', 'on_premise'].includes(user.user_type)) {
        // Sales Rep & On Premise: See assigned accounts OR created accounts OR UserAccountAccess
        const assignedIds = user.assigned_account_ids || [];

        accountPromise = Promise.all([
          // 1. Accounts they created or own via owner_user_id
          Account.filter({ owner_user_id: user.email }).catch(() => []),

          // 2. Accounts assigned via old array method
          assignedIds.length > 0
            ? Account.filter({ id: { $in: assignedIds } }).catch(() => [])
            : Promise.resolve([]),

          // 3. Accounts via UserAccountAccess
          base44.entities.UserAccountAccess.filter({ user_email: user.email }).then(access => {
              if (!access || access.length === 0) return [];
              const ids = access.map(a => a.account_id);
              return Account.filter({ id: { $in: ids } });
          }).catch(() => [])
        ]).then(([owned, assigned, accessible]) => {
          // Merge and deduplicate
          const map = new Map();
          [...owned, ...assigned, ...accessible].forEach(a => map.set(a.id, a));
          return Array.from(map.values()).sort((a, b) =>
            new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
          );
        });
      } else if (user.user_type === 'buyer_admin') {
        // Buyer Admin: Only see their primary account (and potentially others explicitly shared)
        // For now, restricting to their linked account_id to be safe
        if (user.account_id) {
          accountPromise = Account.filter({ id: user.account_id });
        } else {
          accountPromise = Promise.resolve([]);
        }
      } else {
        // Standard Internal User: See all accounts
        accountPromise = Account.list("-updated_at");
      }

      const [accountData, menuData, tastingData] = await Promise.all([
        accountPromise.catch(err => {
          console.error("Error loading accounts:", err);
          return [];
        }),
        Menu.list().catch(err => {
          console.error("Error loading menus:", err);
          return [];
        }),
        Tasting.list().catch(err => {
          console.error("Error loading tastings:", err);
          return [];
        }),
      ]);
      
      const accounts = accountData || [];
      const menus = menuData || [];
      const tastings = tastingData || [];
      
      // Sort accounts with custom priority logic
      const sortedAccounts = accounts.sort((a, b) => {
        const aHasUpcomingTasting = tastings.some(t => 
          t.account_id === a.id && 
          t.status === 'scheduled' && 
          new Date(t.date) > new Date()
        );
        
        const bHasUpcomingTasting = tastings.some(t => 
          t.account_id === b.id && 
          t.status === 'scheduled' && 
          new Date(t.date) > new Date()
        );
        
        const aHasMenuWork = menus.some(m => 
          m.account_id === a.id && 
          (m.status === 'draft' || m.status === 'tasting')
        );
        
        const bHasMenuWork = menus.some(m => 
          m.account_id === b.id && 
          (m.status === 'draft' || m.status === 'tasting')
        );
        
        if (aHasUpcomingTasting && !bHasUpcomingTasting) return -1;
        if (!aHasUpcomingTasting && bHasUpcomingTasting) return 1;
        
        if (aHasMenuWork && !bHasMenuWork) return -1;
        if (!aHasMenuWork && bHasMenuWork) return 1;
        
        const dateA = new Date(a.updated_date || 0);
        const dateB = new Date(b.updated_date || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setAccounts(sortedAccounts);
      setAllMenus(menus);
      setAllTastings(tastings);
      // Clear selection on reload to prevent deleting non-visible/deleted items
      setSelectedAccounts(new Set());
    } catch (err) {
      console.error("Error loading accounts data:", err);
      setError("Failed to load accounts. Please check your connection and try again.");
      setAccounts([]);
      setAllMenus([]);
      setAllTastings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (accountData) => {
    setError(null);
    try {
      if (editingAccount) {
        await Account.update(editingAccount.id, accountData);
      } else {
        await Account.create(accountData);
      }
      setShowForm(false);
      setEditingAccount(null);
      loadData();
    } catch (err) {
      console.error("Error submitting account:", err);
      setError("Failed to save account. Please try again.");
    }
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setShowForm(true);
    setError(null);
  };
  
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this account? This cannot be undone.")) {
      setError(null);
      try {
        await Account.delete(id);
        loadData();
      } catch (err) {
        console.error("Error deleting account:", err);
        setError("Failed to delete account. Please try again.");
      }
    }
  };

  const handleImportComplete = () => {
    setShowImporter(false);
    loadData();
    setError(null);
  };

  const handleSelectAccount = (id, isSelected) => {
    const newSelected = new Set(selectedAccounts);
    if (isSelected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedAccounts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAccounts.size === filteredAccounts.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(filteredAccounts.map(a => a.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedAccounts.size} accounts? This cannot be undone.`)) return;
    
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all(Array.from(selectedAccounts).map(id => Account.delete(id)));
      setSelectedAccounts(new Set());
      loadData();
    } catch (err) {
      console.error("Error deleting accounts:", err);
      setError("Failed to delete some accounts. Please try again.");
      loadData(); // Reload to show what's left
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (account.type && account.type.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (currentUser?.role === 'admin') {
      if (viewMode === 'mine') {
        return account.owner_user_id === currentUser.email || account.created_by === currentUser.email;
      }
      if (viewMode === 'custom') {
        return customAccountIds.includes(account.id);
      }
    }
    
    return true;
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="text-center py-12">
              <div className="text-red-500 mb-4">⚠️ {error}</div>
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Client Accounts</h1>
            <p className="text-gray-600 mt-1">Manage your clients and their cocktail menus</p>
          </div>
          <div className="flex gap-3">
            {selectedAccounts.size > 0 && (
              <Button 
                onClick={handleBulkDelete}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedAccounts.size})
              </Button>
            )}
            <Button 
              onClick={() => { setShowImporter(true); setError(null); }}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Import
            </Button>
            <Button 
              onClick={() => { setShowForm(true); setEditingAccount(null); setError(null); }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Account
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-8">
              <AccountForm
                account={editingAccount}
                onSubmit={handleSubmit}
                onCancel={() => setShowForm(false)}
              />
            </motion.div>
          )}
          {showImporter && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-8">
              <BulkAccountImporter
                onComplete={handleImportComplete}
                onCancel={() => setShowImporter(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="mb-8 border border-gray-200 shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-blue-500"
                />
              </div>
              
              {currentUser?.role === 'admin' && (
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="w-40 shrink-0">
                    <Select value={viewMode} onValueChange={setViewMode}>
                      <SelectTrigger>
                        <Filter className="w-4 h-4 mr-2 text-gray-500" />
                        <SelectValue placeholder="View" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        <SelectItem value="mine">My Accounts</SelectItem>
                        <SelectItem value="custom">Specific Accounts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {viewMode === 'custom' && (
                    <div className="flex-1 md:w-64">
                      <MultiSelect
                        options={accounts.map(a => ({ label: a.name, value: a.id }))}
                        selected={customAccountIds}
                        onChange={setCustomAccountIds}
                        placeholder="Select accounts..."
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {filteredAccounts.length > 0 && (
              <div className="mt-4 flex items-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSelectAll}
                  className="text-gray-600 hover:text-blue-600 pl-0"
                >
                  {selectedAccounts.size === filteredAccounts.length && filteredAccounts.length > 0 ? (
                    <CheckSquare className="w-5 h-5 mr-2 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 mr-2 text-gray-400" />
                  )}
                  Select All ({filteredAccounts.length})
                </Button>
                {selectedAccounts.size > 0 && (
                  <span className="text-sm text-gray-500 ml-2">
                    • {selectedAccounts.size} selected
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <AnimatePresence>
            {isLoading ? (
              <div className="flex justify-center py-12">
                  <CocktailLoader className="w-24 h-24 text-blue-600" />
              </div>
            ) : filteredAccounts.length > 0 ? (
              filteredAccounts.map((account) => {
                const tastingsForAccount = allTastings.filter(t => t.account_id === account.id);
                const menusForAccount = allMenus.filter(m => m.account_id === account.id);
                return (
                <AccountRow
                  key={account.id}
                  account={account}
                  salesRepName={account.sales_rep_name || usersMap[account.owner_user_id]}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  tastings={tastingsForAccount}
                  menus={menusForAccount}
                  selected={selectedAccounts.has(account.id)}
                  onSelect={handleSelectAccount}
                />
                );
              })
            ) : (
              <div className="col-span-full">
                <Card className="border border-gray-200 shadow-sm bg-white">
                  <CardContent className="text-center py-12">
                    <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      {searchTerm ? "No accounts match your search" : "No accounts yet"}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {searchTerm ? "Try adjusting your search" : "Create your first account to get started"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}