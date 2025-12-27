import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Circle, FileText, ExternalLink, Flag } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import PrepDrawer from "@/components/prep/PrepDrawer";
import { format } from "date-fns";

export default function PrepRunPage() {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [activeTask, setActiveTask] = useState(null);
    const [completedTasks, setCompletedTasks] = useState(0);
    const [linkedDocs, setLinkedDocs] = useState([]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('sessionId');
        if (sessionId) {
            loadSession(sessionId);
        } else {
            setLoading(false);
        }
    }, []);

    const loadSession = async (sessionId) => {
        setLoading(true);
        try {
            const s = await base44.entities.PrepSession.get(sessionId);
            setSession(s);
            updateStats(s);

            if (s.linked_document_ids && s.linked_document_ids.length > 0) {
                // Fetch docs
                // We can't use bulk get easily if not supported, so loop or list filter
                // Filter is better
                // But filter by IDs array isn't standard in all APIs. 
                // Let's just list all and filter in memory if list isn't huge, or promise.all gets.
                // Promise.all is safer for specific IDs.
                const docs = await Promise.all(s.linked_document_ids.map(id => base44.entities.TrainingDocument.get(id)));
                setLinkedDocs(docs.filter(d => d));
            }
        } catch (error) {
            console.error("Error loading session:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateStats = (s) => {
        if (!s || !s.tasks) return;
        const completed = s.tasks.filter(t => t.status === 'done').length;
        setCompletedTasks(completed);
    };

    const handleTaskUpdate = async (updatedTask) => {
        if (!session) return;
        
        const newTasks = session.tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
        
        // Optimistic update
        const updatedSession = { ...session, tasks: newTasks };
        setSession(updatedSession);
        updateStats(updatedSession);
        
        // Update active task without reloading drawer
        if (activeTask && activeTask.id === updatedTask.id) {
            setActiveTask(updatedTask);
        }

        try {
            await base44.entities.PrepSession.update(session.id, { tasks: newTasks });
        } catch (error) {
            console.error("Failed to save task update", error);
        }
    };

    const toggleTaskStatus = async (task) => {
        const newStatus = task.status === 'done' ? 'not_started' : 'done';
        handleTaskUpdate({ ...task, status: newStatus });
    };

    const finishSession = async () => {
        if (!session) return;
        try {
            // Mark current session as completed with timestamp
            const completedAt = new Date().toISOString();
            await base44.entities.PrepSession.update(session.id, { 
                status: 'completed',
                completed_at: completedAt
            });
            
            // Create a new empty session for today
            const user = await base44.auth.me();
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            await base44.entities.PrepSession.create({
                date: todayStr,
                account_id: user.account_id || null,
                tasks: [],
                linked_document_ids: [],
                status: 'active',
                started_at: new Date().toISOString()
            });
            
            setActiveTask(null); // Close drawer
            toast.success("Session completed!");
            
            // Redirect to history tab with a timestamp to force reload
            window.location.href = createPageUrl('PrepDashboard') + '?tab=history&t=' + Date.now();
        } catch (error) {
            console.error("Failed to complete session", error);
            toast.error("Failed to complete session");
        }
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <LoadingSpinner className="w-16 h-16 text-blue-600" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Session Not Found</h1>
                <Button onClick={() => window.location.href = createPageUrl('PrepDashboard')}>
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    const progress = session.tasks.length > 0 ? Math.round((completedTasks / session.tasks.length) * 100) : 0;

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <Button 
                            variant="ghost" 
                            onClick={() => window.location.href = createPageUrl('PrepDashboard')}
                            className="gap-2 pl-0 hover:bg-transparent hover:text-blue-600"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </Button>
                        <h1 className="text-3xl font-bold text-gray-900 mt-2">Prep Session</h1>
                        <p className="text-gray-600">{format(new Date(session.date), 'MMMM d, yyyy')}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{progress}%</div>
                        <p className="text-xs text-gray-500">Complete</p>
                    </div>
                </div>

                {linkedDocs.length > 0 && (
                    <div className="mb-6 bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            Training Documents
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {linkedDocs.map(doc => (
                                <a 
                                    key={doc.id} 
                                    href={createPageUrl(`TrainingDocView?id=${doc.id}`)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200"
                                >
                                    {doc.title}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {completedTasks === session.tasks.length && session.tasks.length > 0 && (
                    <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-green-900 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    All Tasks Complete!
                                </h3>
                                <p className="text-sm text-green-700 mt-1">Great work! Finish this session to add it to your prep history.</p>
                            </div>
                            <Button 
                                onClick={finishSession}
                                className="bg-green-600 hover:bg-green-700 text-white gap-2"
                            >
                                <Flag className="w-4 h-4" />
                                Finish Session
                            </Button>
                        </div>
                    </div>
                )}

                <div className="grid gap-4">
                    {session.tasks.map((task, index) => (
                        <Card 
                            key={task.id} 
                            className={`transition-all cursor-pointer hover:shadow-md border-l-4 ${
                                task.status === 'done' ? 'border-l-green-500 bg-gray-50' : 'border-l-blue-500'
                            }`}
                            onClick={() => setActiveTask(task)}
                        >
                            <CardContent className="p-4 flex items-center gap-4">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleTaskStatus(task);
                                    }}
                                    className="text-gray-400 hover:text-green-600 transition-colors"
                                >
                                    {task.status === 'done' ? (
                                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                                    ) : (
                                        <Circle className="w-6 h-6" />
                                    )}
                                </button>
                                <div className="flex-1">
                                    <h3 className={`font-semibold ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                        {task.name}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        Quantity: {task.quantity}x {task.itemType === 'batch' ? 'Batch' : 'Sub-Recipe'}
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm">Open</Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {activeTask && (
                <PrepDrawer 
                    task={activeTask} 
                    onClose={() => setActiveTask(null)} 
                    onUpdateTask={handleTaskUpdate}
                />
            )}
        </div>
    );
}