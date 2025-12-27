import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    FileText, 
    Search, 
    Plus, 
    BookOpen,
    Calendar,
    Filter,
    Edit,
    Eye,
    MoreHorizontal,
    Trash2
} from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TrainingDocsPage() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAccount, setSelectedAccount] = useState("all");
    const [selectedMenu, setSelectedMenu] = useState("all");
    const [selectedTag, setSelectedTag] = useState("all");

    // Reference Data
    const [accounts, setAccounts] = useState([]);
    const [menus, setMenus] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const user = await base44.auth.me();
            setCurrentUser(user);

            if (user) {
                // Load all needed data in parallel
                const [docs, accs, ms] = await Promise.all([
                    base44.entities.TrainingDocument.list("-created_date"),
                    base44.entities.Account.list(),
                    base44.entities.Menu.list()
                ]);

                // Filter docs based on user permissions if needed
                let accessibleDocs = docs;
                if (user.role !== 'admin' && user.user_type === 'buyer_admin' && user.account_id) {
                    accessibleDocs = docs.filter(d => d.account_id === user.account_id);
                }

                setDocuments(accessibleDocs || []);
                setAccounts(accs || []);
                setMenus(ms || []);

                // Extract unique tags
                const tags = new Set();
                (accessibleDocs || []).forEach(d => {
                    if (d.tags && Array.isArray(d.tags)) {
                        d.tags.forEach(t => tags.add(t));
                    }
                });
                setAvailableTags(Array.from(tags).sort());
            }
        } catch (error) {
            console.error("Error loading training docs:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this document?')) {
            try {
                await base44.entities.TrainingDocument.delete(id);
                loadData();
            } catch (error) {
                console.error("Error deleting document:", error);
            }
        }
    };

    const filteredDocs = documents.filter(doc => {
        const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesAccount = selectedAccount === "all" || doc.account_id === selectedAccount;
        const matchesMenu = selectedMenu === "all" || doc.menu_id === selectedMenu;
        const matchesTag = selectedTag === "all" || (doc.tags && doc.tags.includes(selectedTag));
        return matchesSearch && matchesAccount && matchesMenu && matchesTag;
    });

    const getAccountName = (id) => accounts.find(a => a.id === id)?.name || 'Unknown Account';
    const getMenuName = (id) => menus.find(m => m.id === id)?.name || 'Unknown Menu';

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LoadingSpinner className="w-24 h-24 text-blue-600" />
            </div>
        );
    }

    // Permission check
    const canEdit = currentUser?.role === 'admin' || currentUser?.user_type === 'buyer_admin';

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Training & Prep</h1>
                        <p className="text-gray-600">Manage recipes, guides, batch instructions, and product info</p>
                    </div>
                    {canEdit && (
                        <Button 
                            onClick={() => window.location.href = createPageUrl('TrainingDocEditor')} 
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Document
                        </Button>
                    )}
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input 
                                placeholder="Search by title..." 
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter Account" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Accounts</SelectItem>
                                    {accounts.map(a => (
                                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            
                            <Select value={selectedMenu} onValueChange={setSelectedMenu}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter Menu" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Menus</SelectItem>
                                    {menus.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>


                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-sm font-medium text-gray-500">
                        <div className="col-span-6">Document</div>
                        <div className="col-span-4">Context</div>
                        <div className="col-span-2 text-right">Actions</div>
                    </div>
                    
                    {filteredDocs.map(doc => (
                        <Card key={doc.id} className="hover:shadow-md transition-shadow group">
                            <CardContent className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                    <div className="col-span-6">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                                                <FileText className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 
                                                    className="font-semibold text-gray-900 hover:text-blue-600 cursor-pointer"
                                                    onClick={() => window.location.href = createPageUrl(`TrainingDocEditor?id=${doc.id}`)}
                                                >
                                                    {doc.title}
                                                </h3>
                                                <div className="flex items-center text-xs text-gray-500 mt-1 gap-3">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {format(new Date(doc.created_date), 'MMM d, yyyy')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="col-span-4 text-sm text-gray-600">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-medium text-gray-900">{getAccountName(doc.account_id)}</span>
                                            {doc.menu_id && doc.menu_id !== 'none' && (
                                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full w-fit">
                                                    {getMenuName(doc.menu_id)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-2 flex justify-end gap-2">
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            className="text-gray-400 hover:text-blue-600"
                                            onClick={() => window.location.href = createPageUrl(`TrainingDocEditor?id=${doc.id}`)}
                                            title="Edit"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        
                                        {canEdit && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => window.location.href = createPageUrl(`TrainingDocEditor?id=${doc.id}`)}>
                                                        <Edit className="w-4 h-4 mr-2" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleDelete(doc.id)}
                                                        className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    
                    {filteredDocs.length === 0 && (
                        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No documents found</h3>
                            <p>Try adjusting your filters or create a new document.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}