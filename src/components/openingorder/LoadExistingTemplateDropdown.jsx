import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ListPlus, Loader2 } from "lucide-react";

export default function LoadExistingTemplateDropdown({ onAddTemplateItems, existingTemplates = [] }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    const standardTemplate = existingTemplates.find(t => t.name === "Standard Bar Opening Order");
    return standardTemplate?.id || "";
  });
  const [isLoading, setIsLoading] = useState(false);

  // Update default when templates load
  React.useEffect(() => {
    if (!selectedTemplateId && existingTemplates.length > 0) {
      const standardTemplate = existingTemplates.find(t => t.name === "Standard Bar Opening Order");
      if (standardTemplate) {
        setSelectedTemplateId(standardTemplate.id);
      }
    }
  }, [existingTemplates, selectedTemplateId]);

  const handleLoadTemplate = () => {
    if (!selectedTemplateId) return;

    setIsLoading(true);
    try {
      const selectedTemplate = existingTemplates.find(
        (t) => t.id === selectedTemplateId
      );
      if (selectedTemplate && selectedTemplate.items) {
        onAddTemplateItems(selectedTemplate.items);
      }
    } finally {
      setIsLoading(false);
      setSelectedTemplateId("");
    }
  };

  if (existingTemplates.length === 0) return null;

  return (
    <div className="flex items-end gap-2">
      <div className="grid gap-1.5">
        <label htmlFor="load-template-select" className="text-xs font-medium text-gray-700">Load from Existing Template</label>
        <Select
          value={selectedTemplateId}
          onValueChange={setSelectedTemplateId}
          disabled={isLoading}
        >
          <SelectTrigger id="load-template-select" className="w-[220px] h-9 text-sm">
            <SelectValue placeholder="Select a template..." />
          </SelectTrigger>
          <SelectContent>
            {existingTemplates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name} ({template.items?.length || 0} items)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleLoadTemplate}
        disabled={isLoading || !selectedTemplateId}
        className="flex-shrink-0"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <ListPlus className="w-4 h-4 mr-1" />
            Load
          </>
        )}
      </Button>
    </div>
  );
}