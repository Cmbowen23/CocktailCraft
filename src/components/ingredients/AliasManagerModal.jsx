import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export default function AliasManagerModal({ isOpen, onClose, aliases = [], onAliasesChange }) {
    const [newAlias, setNewAlias] = useState("");

    const handleAddAlias = () => {
        if (!newAlias.trim()) return;
        const trimmed = newAlias.trim();
        if (!aliases.includes(trimmed)) {
            onAliasesChange([...aliases, trimmed]);
        }
        setNewAlias("");
    };

    const handleRemoveAlias = (aliasToRemove) => {
        onAliasesChange(aliases.filter(a => a !== aliasToRemove));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddAlias();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Aliases</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <p className="text-sm text-gray-600 mb-2">
                            Aliases are alternative names used for matching ingredients during imports and recipe parsing (e.g. "Spiced Rum", "Captain Morgan").
                        </p>
                        <div className="flex gap-2">
                            <Input
                                value={newAlias}
                                onChange={(e) => setNewAlias(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter alias name..."
                            />
                            <Button onClick={handleAddAlias} type="button">Add</Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 min-h-[100px] content-start bg-gray-50 p-3 rounded-md border border-gray-100">
                        {aliases.length === 0 && (
                            <span className="text-sm text-gray-400 w-full text-center self-center italic">No aliases defined</span>
                        )}
                        {aliases.map((alias, idx) => (
                            <Badge key={idx} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                                {alias}
                                <X
                                    className="w-3 h-3 cursor-pointer hover:text-red-500"
                                    onClick={() => handleRemoveAlias(alias)}
                                />
                            </Badge>
                        ))}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={onClose}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}