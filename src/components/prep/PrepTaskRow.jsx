import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GripVertical, Trash2, ExternalLink, Minus, Plus } from "lucide-react";

export default function PrepTaskRow({ task, index, onUpdateQuantity, onRemove, onOpenPrep }) {
  // Status logic
  const getStatusColor = (status) => {
    switch(status) {
      case 'done': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'done': return 'Done';
      case 'in_progress': return 'In Progress';
      default: return 'Not Started';
    }
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="mb-3"
          style={{ ...provided.draggableProps.style }}
        >
          <Card className={`bg-white transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500 ring-opacity-50' : 'shadow-sm hover:shadow-md'}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-gray-400 hover:text-gray-600">
                <GripVertical className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-semibold text-gray-900 truncate">{task.name}</h4>
                  <Badge variant="secondary" className={`text-[10px] px-1.5 h-5 flex-shrink-0 ${task.itemType === 'batch' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}>
                    {task.itemType === 'batch' ? 'Batch' : 'Sub-Recipe'}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 h-5 flex-shrink-0 border-0 ${getStatusColor(task.status)}`}>
                    {getStatusLabel(task.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-100 rounded-md border border-gray-200 h-8">
                    <button 
                      onClick={() => onUpdateQuantity(task.id, Math.max(0.5, task.quantity - 0.5))}
                      className="px-2 hover:bg-gray-200 text-gray-600 h-full rounded-l-md transition-colors"
                      type="button"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <div className="w-12">
                        <input 
                            type="number"
                            value={task.quantity}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0) onUpdateQuantity(task.id, val);
                            }}
                            className="w-full h-full text-center text-sm font-medium bg-white border-x border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <button 
                      onClick={() => onUpdateQuantity(task.id, task.quantity + 0.5)}
                      className="px-2 hover:bg-gray-200 text-gray-600 h-full rounded-r-md transition-colors"
                      type="button"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs text-gray-500">
                    x Base {task.itemType === 'batch' ? 'Batch' : 'Sub-Recipe'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => onRemove(task.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}