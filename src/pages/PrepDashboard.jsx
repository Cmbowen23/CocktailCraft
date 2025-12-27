import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlaskConical, Search, Calendar, Trash2, Play, History, CheckCircle2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { format } from "date-fns";
import { v4 as uuidv4 } from 'uuid';
import PrepSourceCard from "@/components/prep/PrepSourceCard";
import PrepTaskRow from "@/components/prep/PrepTaskRow";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TrainingDocumentPickerModal from "@/components/prep/TrainingDocumentPickerModal";
import { FileText, Book } from "lucide-react";

export default function PrepDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    
    // Data State
    const [prepItems, setPrepItems] = useState([]); 
    const [todayTasks, setTodayTasks] = useState([]); 
    const [linkedDocIds, setLinkedDocIds] = useState([]);
    const [prepSessionId, setPrepSessionId] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sourceTab, setSourceTab] = useState("batches"); // 'batches' | 'sub_recipes'
    const [showDocPicker, setShowDocPicker] = useState(false);
    const [activeTab, setActiveTab] = useState("today"); // 'today' | 'history'
    const [prepHistory, setPrepHistory] = useState([]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('tab') === 'history') {
            setActiveTab('history');
        }
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const user = await base44.auth.me();
            setCurrentUser(user);

            // Access Control
            const isAdmin = user?.role === 'admin';
            const isBuyerUser = !isAdmin && user?.user_type === 'buyer_admin';
            
            if (!isAdmin && !isBuyerUser) {
                 window.location.href = createPageUrl("Dashboard");
                 return;
            }

            // Fetch Recipes & Account Menus
            const [allRecipes, accountMenus] = await Promise.all([
                base44.entities.Recipe.list(null, 2000),
                user.account_id ? base44.entities.Menu.filter({ account_id: user.account_id }) : Promise.resolve([])
            ]);

            const allowedMenuIds = user.account_id ? new Set(accountMenus.map(m => m.id)) : null;
            
            // Fetch Default Versions to check for batch settings
            const defaultVersions = await base44.entities.RecipeVersion.filter({ status: 'default' });
            const defaultVersionsMap = new Map();
            (defaultVersions || []).forEach(v => {
                defaultVersionsMap.set(v.recipe_id, v);
            });

            // Filter Prep-able Items
            const items = [];
            (allRecipes || []).forEach(recipe => {
                if (allowedMenuIds && !allowedMenuIds.has(recipe.menu_id)) {
                    return;
                }

                // Check if recipe is batched using is_batched flag
                const isBatch = recipe.is_batched === true;
                
                const isSubRecipe = ['syrup', 'infusion', 'cordial', 'shrub', 'tincture', 'bitters', 'foam', 'wash', 'garnish_prep', 'oleo_saccharum', 'clarification', 'other'].includes(recipe.category?.toLowerCase());
                
                if (isBatch || isSubRecipe) {
                    items.push({
                        id: recipe.id,
                        name: recipe.name,
                        type: isBatch ? 'batch' : 'subRecipe',
                        yield: recipe.yield_amount ? `${recipe.yield_amount} ${recipe.yield_unit || ''}` : null,
                        category: recipe.category
                    });
                }
            });
            
            setPrepItems(items.sort((a, b) => a.name.localeCompare(b.name)));

            // Fetch Today's Prep Session (active only)
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            let sessionFilter = { date: todayStr, status: 'active' };
            if (user.account_id) {
                sessionFilter.account_id = user.account_id;
            }
            
            const sessions = await base44.entities.PrepSession.filter(sessionFilter);
            
            if (sessions && sessions.length > 0) {
                const session = sessions[0];
                setPrepSessionId(session.id);
                setTodayTasks(session.tasks || []);
                setLinkedDocIds(session.linked_document_ids || []);
            } else {
                const newSession = await base44.entities.PrepSession.create({
                    date: todayStr,
                    account_id: user.account_id || null,
                    tasks: [],
                    linked_document_ids: [],
                    status: 'active'
                });
                setPrepSessionId(newSession.id);
                setTodayTasks([]);
                setLinkedDocIds([]);
            }

            // Fetch Prep History (completed sessions)
            let historyFilter = { status: 'completed' };
            if (user.account_id) {
                historyFilter.account_id = user.account_id;
            }
            const historySessions = await base44.entities.PrepSession.filter(historyFilter);
            setPrepHistory((historySessions || []).sort((a, b) => new Date(b.date) - new Date(a.date)));

        } catch (error) {
            console.error("Error loading prep data:", error);
        } finally {
            setLoading(false);
        }
    };

    const saveSession = useCallback(async (tasks, docIds = null) => {
        if (!prepSessionId) return;
        try {
            const updates = { tasks };
            if (docIds !== null) {
                updates.linked_document_ids = docIds;
            }
            await base44.entities.PrepSession.update(prepSessionId, updates);
        } catch (error) {
            console.error("Error saving prep session:", error);
        }
    }, [prepSessionId]);

    const handleDocsUpdate = (newDocIds) => {
        setLinkedDocIds(newDocIds);
        // We need to pass current tasks to saveSession because of how I defined it, 
        // or update saveSession to merge. 
        // Let's modify saveSession call slightly to handle this better or just pass tasks.
        saveSession(todayTasks, newDocIds);
    };

    const handleAddTask = (item, index) => {
        // Check if already exists
        const existingTaskIndex = todayTasks.findIndex(t => t.itemId === item.id);
        
        if (existingTaskIndex >= 0) {
            const newTasks = [...todayTasks];
            newTasks[existingTaskIndex].quantity += 1;
            setTodayTasks(newTasks);
            saveSession(newTasks);
        } else {
            const newTask = {
                id: uuidv4(),
                itemId: item.id,
                itemType: item.type,
                name: item.name,
                quantity: 1,
                position: todayTasks.length,
                status: 'not_started',
                steps: [],
                completedStepIndices: []
            };
            const newTasks = [...todayTasks, newTask];
            setTodayTasks(newTasks);
            saveSession(newTasks);
        }
    };

    const onDragEnd = (result) => {
        const { source, destination } = result;

        if (!destination) return;

        // Dragging from Source List to Today's Prep
        if (source.droppableId === 'sourceList' && destination.droppableId === 'todayList') {
            const filteredSources = prepItems.filter(item => {
                const matchesType = sourceTab === 'batches' ? item.type === 'batch' : item.type === 'subRecipe';
                const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesType && matchesSearch;
            });
            
            const draggedItem = filteredSources[source.index];

            if (draggedItem) {
                handleAddTask(draggedItem);
            }
            return;
        }

        // Reordering Today's Prep
        if (source.droppableId === 'todayList' && destination.droppableId === 'todayList') {
            const newTasks = Array.from(todayTasks);
            const [reorderedItem] = newTasks.splice(source.index, 1);
            newTasks.splice(destination.index, 0, reorderedItem);
            setTodayTasks(newTasks);
            saveSession(newTasks);
            return;
        }
    };

    const handleUpdateQuantity = (taskId, newQuantity) => {
        const newTasks = todayTasks.map(task => 
            task.id === taskId ? { ...task, quantity: newQuantity } : task
        );
        setTodayTasks(newTasks);
        saveSession(newTasks);
    };

    const handleRemoveTask = (taskId) => {
        const newTasks = todayTasks.filter(task => task.id !== taskId);
        setTodayTasks(newTasks);
        saveSession(newTasks);
    };

    const handleClearList = () => {
        if (window.confirm("Clear the entire prep list?")) {
            setTodayTasks([]);
            saveSession([]);
        }
    };

    const handleStartPrep = async () => {
        try {
            // Mark session as started with timestamp
            await base44.entities.PrepSession.update(prepSessionId, {
                started_at: new Date().toISOString()
            });
            saveSession(todayTasks);
            window.location.href = createPageUrl(`PrepRun?sessionId=${prepSessionId}`);
        } catch (error) {
            console.error("Error starting prep:", error);
            window.location.href = createPageUrl(`PrepRun?sessionId=${prepSessionId}`);
        }
    };

    const filteredPrepItems = prepItems.filter(item => {
        const matchesType = sourceTab === 'batches' ? item.type === 'batch' : item.type === 'subRecipe';
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesType && matchesSearch;
    });

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <LoadingSpinner className="w-24 h-24 text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
                 <div className="flex flex-col mb-6 shrink-0">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                         <FlaskConical className="w-8 h-8 text-blue-600" />
                         Prep Overview
                    </h1>
                    <p className="text-gray-600 mt-1">Plan today's production.</p>
                    
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                        <TabsList>
                            <TabsTrigger value="today" className="gap-2">
                                <Calendar className="w-4 h-4" />
                                Today's Prep
                            </TabsTrigger>
                            <TabsTrigger value="history" className="gap-2">
                                <History className="w-4 h-4" />
                                History ({prepHistory.length})
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                 </div>

                 {activeTab === "today" ? (
                 <DragDropContext onDragEnd={onDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
                        {/* Left Column - Sources */}
                        <Card className="flex flex-col h-full bg-gray-50/50 border-gray-200">
                            <CardHeader className="pb-3 shrink-0">
                                <CardTitle className="text-lg flex items-center justify-between mb-2">
                                    <span>Available Items</span>
                                </CardTitle>
                                <Tabs value={sourceTab} onValueChange={setSourceTab} className="w-full">
                                    <TabsList className="w-full grid grid-cols-2">
                                        <TabsTrigger value="batches">Batches</TabsTrigger>
                                        <TabsTrigger value="sub_recipes">Sub-Recipes</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <div className="relative mt-3">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input 
                                        placeholder="Filter by name..." 
                                        className="pl-9 bg-white"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-3 pt-0">
                                <Droppable droppableId="sourceList" isDropDisabled={true}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className="min-h-[100px]"
                                        >
                                            {filteredPrepItems.map((item, index) => (
                                                <PrepSourceCard 
                                                    key={item.id} 
                                                    item={item} 
                                                    index={index} 
                                                    onAdd={() => handleAddTask(item)}
                                                />
                                            ))}
                                            {provided.placeholder}
                                            {filteredPrepItems.length === 0 && (
                                                <div className="text-center py-8 text-gray-400">
                                                    <p>No matching items found</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Droppable>
                            </CardContent>
                        </Card>

                        {/* Right Column - Today's Prep */}
                        <Card className="flex flex-col h-full border-blue-200 shadow-md">
                            <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4 shrink-0">
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-xl text-blue-900 flex items-center gap-2">
                                                <Calendar className="w-5 h-5" />
                                                Today's Prep List
                                            </CardTitle>
                                            <div className="text-sm font-medium text-blue-700 mt-1">
                                                {format(new Date(), 'MMMM d, yyyy')}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {todayTasks.length > 0 && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={handleClearList}
                                                    className="text-gray-500 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-1" /> Clear
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="bg-white/50 rounded-lg p-3 border border-blue-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-medium text-blue-900 flex items-center gap-2">
                                                    <Book className="w-4 h-4" />
                                                    Training Docs ({linkedDocIds.length})
                                                </span>
                                                <Button variant="ghost" size="sm" onClick={() => setShowDocPicker(true)} className="h-6 text-xs">
                                                    Manage
                                                </Button>
                                            </div>
                                            {linkedDocIds.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {linkedDocIds.map(id => (
                                                        <div key={id} className="bg-white px-2 py-1 rounded text-xs border border-blue-100 text-blue-700 flex items-center gap-1">
                                                            <FileText className="w-3 h-3" />
                                                            Doc
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <Button 
                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                            onClick={handleStartPrep}
                                            disabled={todayTasks.length === 0}
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            Start Prep
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-4 bg-blue-50/30">
                                <Droppable droppableId="todayList">
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={`min-h-[200px] h-full rounded-lg transition-colors ${
                                                snapshot.isDraggingOver ? 'bg-blue-100/50 ring-2 ring-blue-300 ring-inset' : ''
                                            }`}
                                        >
                                            {todayTasks.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg p-6">
                                                    <FlaskConical className="w-12 h-12 mb-3 opacity-50" />
                                                    <p className="font-medium">Your prep list is empty</p>
                                                    <p className="text-sm">Drag items from the left or click + to add</p>
                                                </div>
                                            ) : (
                                                todayTasks.map((task, index) => (
                                                    <PrepTaskRow 
                                                        key={task.id} 
                                                        task={task} 
                                                        index={index}
                                                        onUpdateQuantity={handleUpdateQuantity}
                                                        onRemove={handleRemoveTask}
                                                        onOpenPrep={() => {}} // No open prep in dashboard view
                                                    />
                                                ))
                                            )}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </CardContent>
                        </Card>
                    </div>
                 </DragDropContext>
                 ) : (
                    <div className="flex-1 overflow-y-auto">
                        <div className="grid gap-4">
                            {prepHistory.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p className="font-medium">No prep history yet</p>
                                    <p className="text-sm">Completed prep sessions will appear here</p>
                                </div>
                            ) : (
                                prepHistory.map(session => {
                                    const completedCount = (session.tasks || []).filter(t => t.status === 'done').length;
                                    const totalCount = (session.tasks || []).length;

                                    // Calculate duration
                                    let duration = null;
                                    if (session.started_at && session.completed_at) {
                                        const start = new Date(session.started_at);
                                        const end = new Date(session.completed_at);
                                        const diffMs = end - start;
                                        const diffMins = Math.round(diffMs / 60000);
                                        if (diffMins < 60) {
                                            duration = `${diffMins} min`;
                                        } else {
                                            const hours = Math.floor(diffMins / 60);
                                            const mins = diffMins % 60;
                                            duration = `${hours}h ${mins}m`;
                                        }
                                    }

                                    return (
                                        <Card key={session.id} className="hover:shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                            <h3 className="font-semibold text-gray-900">
                                                                {format(new Date(session.date), 'MMMM d, yyyy')}
                                                            </h3>
                                                            {duration && (
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                                                                    {duration}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-600">
                                                            {totalCount} task{totalCount !== 1 ? 's' : ''} completed
                                                        </p>
                                                        {session.tasks && session.tasks.length > 0 && (
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                {session.tasks.map(task => (
                                                                    <span key={task.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                                                        {task.name} ({task.quantity}x)
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={async () => {
                                                            if (window.confirm('Delete this prep session from history?')) {
                                                                try {
                                                                    await base44.entities.PrepSession.delete(session.id);
                                                                    setPrepHistory(prepHistory.filter(s => s.id !== session.id));
                                                                } catch (error) {
                                                                    console.error('Failed to delete session:', error);
                                                                }
                                                            }
                                                        }}
                                                        className="text-gray-400 hover:text-red-600"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    </div>
                 )}
            </div>

            {showDocPicker && (
                <TrainingDocumentPickerModal 
                    isOpen={showDocPicker}
                    onClose={() => setShowDocPicker(false)}
                    onSave={handleDocsUpdate}
                    initialSelectedIds={linkedDocIds}
                    accountId={currentUser?.account_id}
                />
            )}
        </div>
    );
}