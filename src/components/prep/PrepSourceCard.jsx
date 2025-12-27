import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus } from "lucide-react";

export default function PrepSourceCard({ item, index, onAdd }) {
  return (
    <Draggable draggableId={`source-${item.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-2"
          style={{ ...provided.draggableProps.style }}
        >
          <Card className={`hover:shadow-md transition-shadow group border-l-4 ${item.type === 'batch' ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
            <CardContent className="p-3">
              <div className="flex justify-between items-center gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-gray-900 leading-tight mb-1 truncate">{item.name}</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${item.type === 'batch' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {item.type === 'batch' ? 'Batch' : 'Sub-Recipe'}
                    </Badge>
                    {item.yield && (
                      <span className="text-[10px] text-gray-500 truncate max-w-[100px]">
                        Yield: {item.yield}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent drag interference if any
                            onAdd(item);
                        }}
                        title="Add to Prep List"
                    >
                        <Plus className="w-4 h-4 text-blue-600" />
                    </Button>
                    <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}