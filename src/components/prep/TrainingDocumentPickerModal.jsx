import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, FileText, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function TrainingDocumentPickerModal({ isOpen, onClose, onSave, initialSelectedIds = [], accountId }) {
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds));
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (isOpen) {
            loadDocuments();
            setSelectedIds(new Set(initialSelectedIds));
        }
    }, [isOpen, initialSelectedIds]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            let filter = {};
            if (accountId) {
                filter.account_id = accountId;
            }
            const docs = await base44.entities.TrainingDocument.filter(filter);
            setDocuments(docs || []);
        } catch (error) {
            console.error("Error loading documents:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSave = () => {
        onSave(Array.from(selectedIds));
        onClose();
    };

    const filteredDocuments = documents.filter(doc => 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Link Training Documents</DialogTitle>
                    <DialogDescription>
                        Select documents to attach to this prep session.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                        placeholder="Search documents..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        </div>
                    ) : filteredDocuments.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">No documents found.</p>
                    ) : (
                        filteredDocuments.map(doc => (
                            <div key={doc.id} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                <Checkbox 
                                    id={doc.id} 
                                    checked={selectedIds.has(doc.id)}
                                    onCheckedChange={() => toggleSelection(doc.id)}
                                />
                                <Label htmlFor={doc.id} className="flex-1 flex items-center cursor-pointer gap-2 font-normal">
                                    <FileText className="w-4 h-4 text-blue-500" />
                                    <span className="truncate">{doc.title}</span>
                                </Label>
                            </div>
                        ))
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Save Selection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}