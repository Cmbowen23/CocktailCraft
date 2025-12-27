import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Edit, Trash2, BookOpen, Calendar as CalendarIcon, Wand2, User } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { isFuture, parseISO } from 'date-fns';
import { Account } from '@/api/entities';

const typeColors = {
  restaurant: "bg-blue-100 text-blue-800 border-blue-200",
  bar: "bg-purple-100 text-purple-800 border-purple-200",
  hotel: "bg-orange-100 text-orange-800 border-orange-200",
  catering: "bg-green-100 text-green-800 border-green-200",
  event_venue: "bg-pink-100 text-pink-800 border-pink-200",
  other: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function AccountRow({ account, onEdit, onDelete, tastings, menus, salesRepName, selected, onSelect }) {
    // Check for an upcoming tasting that is scheduled and in the future
    const upcomingTasting = tastings.find(tasting => {
        if (tasting.status !== 'scheduled') return false;
        try {
            // Ensure the date is valid before parsing
            const tastingDate = parseISO(tasting.date);
            return isFuture(tastingDate);
        } catch (e) {
            return false; // Invalid date format
        }
    });

    // Check if any menu for this account has a status of 'draft' or 'tasting'
    const menuNeedsWork = menus.find(menu => 
        menu.status === 'draft' || menu.status === 'tasting'
    );

    const handleViewMenus = async () => {
        try {
            // Update the account to move it to the top of the list
            // This operation typically updates a 'last_accessed' or 'updated_at'
            // timestamp on the server, causing a re-sort when accounts are fetched.
            await Account.update(account.id, account);
        } catch (error) {
            console.error("Error updating account:", error);
            // Continue with navigation even if update fails
        }
    };

    return (
        <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="border border-gray-200 shadow-sm bg-white hover:shadow-md transition-all duration-300 group overflow-hidden">
                <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
                    {onSelect && (
                        <div className="mr-3 flex-shrink-0">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={selected || false}
                                onChange={(e) => onSelect(account.id, e.target.checked)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate" title={account.name}>{account.name}</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {salesRepName && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full" title="Sales Rep">
                                        <User className="w-3 h-3" />
                                        <span className="truncate max-w-[150px]">{salesRepName}</span>
                                    </div>
                                )}
                                {upcomingTasting && (
                                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-800 bg-amber-50">
                                        <CalendarIcon className="w-3 h-3 mr-1" />
                                        Upcoming Tasting
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 ml-2 flex-shrink-0">
                         <Button variant="ghost" size="icon" onClick={() => onEdit(account)} title="Edit Account" className="w-8 h-8">
                            <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(account.id)} title="Delete Account" className="w-8 h-8">
                            <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                        <Link to={createPageUrl(`AccountDetails?id=${account.id}`)} onClick={handleViewMenus} className="hidden sm:block">
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 ml-2">
                                <BookOpen className="w-4 h-4 mr-2" />
                                View Menus
                            </Button>
                        </Link>
                         <Link to={createPageUrl(`AccountDetails?id=${account.id}`)} onClick={handleViewMenus} className="sm:hidden">
                            <Button size="icon" className="bg-blue-600 hover:bg-blue-700 ml-1 w-8 h-8">
                                <BookOpen className="w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}