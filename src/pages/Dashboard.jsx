import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Account } from '@/api/entities';
import { Menu } from '@/api/entities';
import { Tasting } from '@/api/entities';
import { Task } from '@/api/entities';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, CalendarDays, Clock, Building2, Wine, CheckCircle2, Circle, Trash2, Plus, ExternalLink, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CreateRecipeFlow from "@/components/recipes/CreateRecipeFlow";
import { Recipe } from "@/api/entities";
import { Ingredient } from "@/api/entities";
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

// Helper function to retry base44.auth.me() with exponential backoff
const fetchUserWithRetry = async (maxAttempts = 3) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const user = await base44.auth.me();
            if (user) {
                return user;
            }
        } catch (error) {
            if (attempt === maxAttempts) {
                return null;
            }
            const delay = 200 * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
};

// Retry helper with exponential backoff for entity calls
const retryWithBackoff = async (fn, maxRetries = 5, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      // Retry on 429 (Rate Limit) or 5xx (Server Errors)
      const isRetryable = err?.response?.status === 429 || (err?.response?.status >= 500 && err?.response?.status < 600);
      
      if (isRetryable && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 500;
        console.warn(`Request failed with ${err.response?.status}, retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
};

export default function DashboardPage() {
  const location = useLocation();
  const [accounts, setAccounts] = useState([]);
  const [menus, setMenus] = useState([]);
  const [tastings, setTastings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming');

  const [newTask, setNewTask] = useState({ name: '', due_date: '', notes: '' });
  const [showTaskForm, setShowTaskForm] = useState(false);

  const [newTasting, setNewTasting] = useState({
    name: '',
    date: '',
    time: '',
    account_id: '',
    notes: ''
  });
  const [showTastingForm, setShowTastingForm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showQuickAddRecipe, setShowQuickAddRecipe] = useState(false);
  const [allIngredients, setAllIngredients] = useState([]);

  useEffect(() => {
    loadUser();
    loadData();
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    try {
      const ingredientsData = await Ingredient.list('-updated_at', 5000);
      setAllIngredients(ingredientsData || []);
    } catch (error) {
      console.error("Error loading ingredients:", error);
    }
  };

  const loadUser = async () => {
    try {
      const user = await fetchUserWithRetry();
      setCurrentUser(user);
    } catch (err) {
      console.error("Error loading user:", err);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await fetchUserWithRetry();
      if (!user) {
        setAccounts([]);
        setMenus([]);
        setTastings([]);
        setTasks([]);
        setIsLoading(false);
        return;
      }

      // Serialized requests with retry logic and delays to prevent rate limiting

      const accountsData = await retryWithBackoff(() => Account.list()).catch(err => {
        console.error("Error loading accounts:", err);
        return [];
      });
      setAccounts(accountsData || []);
      await new Promise(resolve => setTimeout(resolve, 500));

      const menusData = await retryWithBackoff(() => Menu.list()).catch(err => {
        console.error("Error loading menus:", err);
        return [];
      });
      setMenus(menusData || []);
      await new Promise(resolve => setTimeout(resolve, 500));

      const tastingsData = await retryWithBackoff(() => Tasting.list('-date')).catch(err => {
        console.error("Error loading tastings:", err);
        return [];
      });
      setTastings(tastingsData || []);
      await new Promise(resolve => setTimeout(resolve, 500));

      const tasksData = await retryWithBackoff(() => Task.list('-due_date')).catch(err => {
        console.error("Error loading tasks:", err);
        return [];
      });
      setTasks(tasksData || []);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError("Failed to load dashboard data. Please try again.");
      setAccounts([]);
      setMenus([]);
      setTastings([]);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.name.trim()) {
      alert("Please enter a task name");
      return;
    }

    try {
      await Task.create({
        name: newTask.name,
        due_date: newTask.due_date || undefined,
        notes: newTask.notes || undefined,
        status: 'pending'
      });
      setNewTask({ name: '', due_date: '', notes: '' });
      setShowTaskForm(false);
      loadData();
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Failed to create task");
    }
  };

  const handleToggleTaskStatus = async (task) => {
    try {
      await Task.update(task.id, {
        status: task.status === 'completed' ? 'pending' : 'completed'
      });
      loadData();
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        await Task.delete(taskId);
        loadData();
      } catch (error) {
        console.error("Error deleting task:", error);
        alert("Failed to delete task");
      }
    }
  };

  const handleCreateTasting = async () => {
    if (!newTasting.name.trim() || !newTasting.date || !newTasting.time || !newTasting.account_id) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      await Tasting.create({
        ...newTasting,
        status: 'scheduled'
      });
      setNewTasting({ name: '', date: '', time: '', account_id: '', notes: '' });
      setShowTastingForm(false);
      loadData();
    } catch (error) {
      console.error("Error creating tasting:", error);
      alert("Failed to create tasting");
    }
  };

  const handleDeleteTasting = async (tastingId) => {
    if (window.confirm("Are you sure you want to delete this tasting?")) {
      try {
        await Tasting.delete(tastingId);
        loadData();
      } catch (error) {
        console.error("Error deleting tasting:", error);
        alert("Failed to delete tasting");
      }
    }
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : 'Unknown Account';
  };

  const handleQuickAddRecipe = async (recipeData) => {
    try {
      await Recipe.create(recipeData);
      toast.success("Recipe created successfully!");
      setShowQuickAddRecipe(false);
    } catch (error) {
      console.error("Error creating recipe:", error);
      toast.error("Failed to create recipe");
    }
  };

  const handleQuickAddComplete = () => {
    setShowQuickAddRecipe(false);
    toast.success("Recipes imported successfully!");
  };

  const getMenuName = (menuId) => {
    const menu = menus.find(m => m.id === menuId);
    return menu ? menu.name : 'No menu assigned';
  };

  const upcomingTastings = tastings.filter(t => 
    t.status === 'scheduled' && new Date(t.date) >= new Date(new Date().setHours(0,0,0,0))
  ).sort((a, b) => new Date(a.date) - new Date(b.date));

  const pastTastings = tastings.filter(t => 
    t.status === 'completed' || new Date(t.date) < new Date(new Date().setHours(0,0,0,0))
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="text-center py-12">
              <div className="text-red-500 mb-4">⚠️ {error}</div>
              <Button onClick={loadData} className="bg-blue-600 hover:bg-blue-700">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Manage your tastings and track your progress</p>
            </div>
          </div>
          
          {/* Quick Add Recipe Card */}
          <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg hover:shadow-xl transition-shadow mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Quick Add Recipe</h3>
                    <p className="text-sm text-gray-600">Create from text, photo, or manually</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowQuickAddRecipe(true)}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 shadow-md"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Recipe
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-48 bg-white/50 rounded-xl animate-pulse border border-gray-200" />
            ))}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-6 h-auto">
              <TabsTrigger value="upcoming">
                <Calendar className="w-4 h-4 mr-2" />
                Upcoming Tastings
              </TabsTrigger>
              <TabsTrigger value="past">
                <Clock className="w-4 h-4 mr-2" />
                Past Tastings
              </TabsTrigger>
              <TabsTrigger value="tasks">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Tasks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-6">
              <Card className="border border-gray-200 shadow-sm bg-white">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-blue-600" />
                      Upcoming Tastings
                    </CardTitle>
                    <Button 
                      onClick={() => setShowTastingForm(!showTastingForm)}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Tasting
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showTastingForm && (
                    <Card className="mb-6 bg-blue-50 border-blue-200">
                      <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <Input
                              placeholder="Tasting Name *"
                              value={newTasting.name}
                              onChange={(e) => setNewTasting({ ...newTasting, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Input
                              type="date"
                              value={newTasting.date}
                              onChange={(e) => setNewTasting({ ...newTasting, date: e.target.value })}
                            />
                          </div>
                          <div>
                            <Input
                              type="time"
                              value={newTasting.time}
                              onChange={(e) => setNewTasting({ ...newTasting, time: e.target.value })}
                            />
                          </div>
                          <div className="col-span-2">
                            <Select
                              value={newTasting.account_id}
                              onValueChange={(value) => setNewTasting({ ...newTasting, account_id: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Account *" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map(account => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Textarea
                              placeholder="Notes (optional)"
                              value={newTasting.notes}
                              onChange={(e) => setNewTasting({ ...newTasting, notes: e.target.value })}
                              className="h-20"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setShowTastingForm(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleCreateTasting} className="bg-blue-600 hover:bg-blue-700">
                            Create Tasting
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {upcomingTastings.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingTastings.map(tasting => (
                        <Card key={tasting.id} className="border-blue-200 bg-gradient-to-r from-blue-50 to-white">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-semibold text-gray-900">{tasting.name}</h3>
                                  <Badge className="bg-blue-100 text-blue-800">{tasting.status}</Badge>
                                </div>
                                <div className="space-y-1 text-sm text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    <span>{getAccountName(tasting.account_id)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                    <span>{format(new Date(tasting.date), 'MMMM d, yyyy')} at {tasting.time}</span>
                                  </div>
                                  {tasting.menu_id && (
                                    <div className="flex items-center gap-2">
                                      <Wine className="w-4 h-4 text-blue-600" />
                                      <span>Menu: {getMenuName(tasting.menu_id)}</span>
                                    </div>
                                  )}
                                  {tasting.notes && (
                                    <p className="text-gray-500 mt-2">{tasting.notes}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Link to={createPageUrl(`AccountDetails?id=${tasting.account_id}&tab=tastings`)}>
                                  <Button variant="outline" size="sm">
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteTasting(tasting.id)}
                                  className="text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <CalendarDays className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p>No upcoming tastings scheduled</p>
                      <p className="text-sm">Create your first tasting to get started</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="past" className="space-y-6">
              <Card className="border border-gray-200 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-600" />
                    Past Tastings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pastTastings.length > 0 ? (
                    <div className="space-y-4">
                      {pastTastings.map(tasting => (
                        <Card key={tasting.id} className="border-gray-200 bg-gray-50">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-semibold text-gray-900">{tasting.name}</h3>
                                  <Badge variant="outline">{tasting.status}</Badge>
                                </div>
                                <div className="space-y-1 text-sm text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4" />
                                    <span>{getAccountName(tasting.account_id)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    <span>{format(new Date(tasting.date), 'MMMM d, yyyy')} at {tasting.time}</span>
                                  </div>
                                  {tasting.menu_id && (
                                    <div className="flex items-center gap-2">
                                      <Wine className="w-4 h-4" />
                                      <span>Menu: {getMenuName(tasting.menu_id)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Link to={createPageUrl(`AccountDetails?id=${tasting.account_id}&tab=tastings`)}>
                                  <Button variant="outline" size="sm">
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteTasting(tasting.id)}
                                  className="text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p>No past tastings</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-6">
              <Card className="border border-gray-200 shadow-sm bg-white">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      Tasks
                    </CardTitle>
                    <Button 
                      onClick={() => setShowTaskForm(!showTaskForm)}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Task
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showTaskForm && (
                    <Card className="mb-6 bg-blue-50 border-blue-200">
                      <CardContent className="pt-6 space-y-4">
                        <Input
                          placeholder="Task name *"
                          value={newTask.name}
                          onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                        />
                        <Input
                          type="date"
                          value={newTask.due_date}
                          onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                          placeholder="Due date (optional)"
                        />
                        <Textarea
                          placeholder="Notes (optional)"
                          value={newTask.notes}
                          onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                          className="h-20"
                        />
                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setShowTaskForm(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleCreateTask} className="bg-blue-600 hover:bg-blue-700">
                            Create Task
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-6">
                    {pendingTasks.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Pending Tasks</h3>
                        <div className="space-y-2">
                          {pendingTasks.map(task => (
                            <Card key={task.id} className="border-gray-200">
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <button
                                    onClick={() => handleToggleTaskStatus(task)}
                                    className="mt-1 flex-shrink-0"
                                  >
                                    <Circle className="w-5 h-5 text-gray-400 hover:text-blue-600" />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900">{task.name}</p>
                                    {task.due_date && (
                                      <p className="text-sm text-gray-500 mt-1">
                                        Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                                      </p>
                                    )}
                                    {task.notes && (
                                      <p className="text-sm text-gray-600 mt-1">{task.notes}</p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="text-red-500 hover:bg-red-50 flex-shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {completedTasks.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Completed Tasks</h3>
                        <div className="space-y-2">
                          {completedTasks.map(task => (
                            <Card key={task.id} className="border-gray-200 bg-gray-50">
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <button
                                    onClick={() => handleToggleTaskStatus(task)}
                                    className="mt-1 flex-shrink-0"
                                  >
                                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-500 line-through">{task.name}</p>
                                    {task.due_date && (
                                      <p className="text-sm text-gray-400 mt-1">
                                        Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="text-red-500 hover:bg-red-50 flex-shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {pendingTasks.length === 0 && completedTasks.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p>No tasks yet</p>
                        <p className="text-sm">Create your first task to track your work</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Quick Add Recipe Modal */}
      <Dialog open={showQuickAddRecipe} onOpenChange={setShowQuickAddRecipe}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Add Recipe</DialogTitle>
          </DialogHeader>
          <CreateRecipeFlow
            onSubmit={handleQuickAddRecipe}
            onTextImportComplete={handleQuickAddComplete}
            onCancel={() => setShowQuickAddRecipe(false)}
            allIngredients={allIngredients}
            defaultTab="text"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}