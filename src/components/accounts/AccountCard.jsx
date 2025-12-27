import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Edit, Trash2, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const typeColors = {
  restaurant: "bg-blue-100 text-blue-800 border-blue-200",
  bar: "bg-purple-100 text-purple-800 border-purple-200",
  hotel: "bg-orange-100 text-orange-800 border-orange-200",
  catering: "bg-green-100 text-green-800 border-green-200",
  event_venue: "bg-pink-100 text-pink-800 border-pink-200",
  other: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function AccountCard({ account, onEdit, onDelete }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} whileHover={{ y: -5 }} transition={{ duration: 0.3 }}>
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col h-full">
        <CardHeader className="flex flex-row items-start justify-between pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-emerald-900 group-hover:text-emerald-700 transition-colors">{account.name}</h3>
              </div>
            </div>
            <Badge className={`text-xs ${typeColors[account.type]} border`}>{account.type.replace('_', ' ')}</Badge>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col flex-grow">
          <p className="text-gray-600 text-sm mb-4 line-clamp-2 flex-grow">{account.description}</p>
          <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-emerald-100">
            <Button variant="ghost" size="icon" onClick={() => onEdit(account)}><Edit className="w-4 h-4 text-emerald-600" /></Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(account.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            <Link to={createPageUrl(`AccountDetails?id=${account.id}`)} className="flex-1">
              <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700"><BookOpen className="w-4 h-4 mr-2" />View Menus</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}