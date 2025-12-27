import React, { useState, useEffect } from "react";
import { Menu } from "@/api/entities";
import { Account } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Calendar, Building2, BookOpen, User } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import MenuForm from "../components/menus/MenuForm";
import CocktailLoader from "@/components/ui/CocktailLoader";

export default function MenusPage() {
    const [menus, setMenus] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [recipeCounts, setRecipeCounts] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [menusData, accountsData, recipesData] = await Promise.all([
                Menu.list("-updated_date", 100),
                Account.list(),
                base44.entities.Recipe.list(null, 10000),
            ]);
            setMenus(Array.isArray(menusData) ? menusData : []);
            setAccounts(Array.isArray(accountsData) ? accountsData : []);

            const counts = {};
            if (Array.isArray(recipesData)) {
                recipesData.forEach(recipe => {
                    if (recipe.menu_id) {
                        counts[recipe.menu_id] = (counts[recipe.menu_id] || 0) + 1;
                    }
                });
            }
            setRecipeCounts(counts);
        } catch (error) {
            console.error("Error loading menus:", error);
            setMenus([]);
            setAccounts([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateMenu = async (menuData) => {
        try {
            await Menu.create(menuData);
            setShowForm(false);
            loadData();
        } catch (error) {
            console.error("Error creating menu:", error);
        }
    };

    const getAccountName = (accountId) => {
        if (!accountId) return 'No Account';
        const account = accounts.find(acc => acc.id === accountId);
        return account?.name || 'Unknown Account';
    };

    const getInitials = (email) => {
        if (!email) return "?";
        return email.substring(0, 2).toUpperCase();
    };



    const filteredMenus = menus.filter(menu =>
        menu.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (menu.description && menu.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        getAccountName(menu.account_id).toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <CocktailLoader className="w-24 h-24 text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Menus</h1>
                            <p className="text-gray-600 mt-1">Manage all cocktail menus</p>
                        </div>
                        <Button 
                            onClick={() => setShowForm(true)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Create New Menu
                        </Button>
                    </div>
                </div>

                <AnimatePresence>
                    {showForm && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="mb-8"
                        >
                            <MenuForm
                                accounts={accounts}
                                onSubmit={handleCreateMenu}
                                onCancel={() => setShowForm(false)}
                            />
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

                <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead className="w-[60px] text-center font-semibold">#</TableHead>
                                <TableHead className="font-semibold">Menu</TableHead>
                                <TableHead className="font-semibold">Account</TableHead>
                                <TableHead className="text-center font-semibold">Recipes</TableHead>
                                <TableHead className="text-right font-semibold">Created On</TableHead>
                                <TableHead className="text-right font-semibold">Owner</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMenus.length > 0 ? (
                                filteredMenus.map((menu, index) => (
                                    <TableRow key={menu.id} className="group hover:bg-blue-50/50 transition-colors">
                                        <TableCell className="text-center text-gray-500 text-sm font-medium">
                                            {index + 1}
                                        </TableCell>
                                        <TableCell>
                                            <Link to={createPageUrl(`MenuDetails?id=${menu.id}`)} className="block">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                                                            {menu.name} {menu.year && <span className="font-normal text-gray-500 ml-1">{menu.year}</span>}
                                                        </div>
                                                        {menu.description && (
                                                            <div className="text-xs text-gray-500 line-clamp-1 max-w-xs">
                                                                {menu.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Building2 className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm font-medium">{getAccountName(menu.account_id)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {recipeCounts[menu.id] || 0}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2 text-gray-500 text-sm">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(menu.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end">
                                                <div 
                                                    className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold ring-2 ring-white border border-indigo-200" 
                                                    title={`Created by: ${menu.created_by}`}
                                                >
                                                    {getInitials(menu.created_by)}
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Search className="w-8 h-8 mb-2 text-gray-300" />
                                            <p className="text-sm font-medium">No menus match your search</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    </div>
                </div>

                {filteredMenus.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            {searchTerm ? "No menus match your search" : "No menus yet"}
                        </h3>
                        <p className="text-gray-600 mb-4">
                            {searchTerm ? "Try adjusting your search" : "Create your first menu to get started"}
                        </p>
                        {!searchTerm && (
                            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="w-4 h-4 mr-2" />
                                Create New Menu
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}