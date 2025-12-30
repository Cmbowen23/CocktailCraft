import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  GitMerge,
  Database,
  Clock,
  DollarSign,
  FileText,
  Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function DuplicateRecipeManager() {
  const [duplicates, setDuplicates] = useState([]);
  const [emptyRecipes, setEmptyRecipes] = useState([]);
  const [activeTab, setActiveTab] = useState('duplicates');
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [dependencies, setDependencies] = useState({});
  const [loadingDeps, setLoadingDeps] = useState(false);

  useEffect(() => {
    loadUser();
    loadDuplicates();
    loadEmptyRecipes();
  }, []);

  const loadUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      if (user?.role !== 'admin') {
        toast.error('Admin access required');
      }
    } catch (err) {
      console.error('Failed to load user:', err);
      toast.error('Failed to verify permissions');
    }
  };

  const loadDuplicates = async () => {
    setIsLoading(true);
    try {
      // Load all recipes using entity API instead of raw SQL
      const allRecipes = await base44.entities.Recipe.list('-created_at', 10000);

      // Group by normalized name
      const nameGroups = {};
      allRecipes.forEach(recipe => {
        const normalizedName = recipe.name?.toLowerCase().trim() || '';
        if (!normalizedName) return;

        if (!nameGroups[normalizedName]) {
          nameGroups[normalizedName] = [];
        }
        nameGroups[normalizedName].push({
          id: recipe.id,
          name: recipe.name,
          created_at: recipe.created_at,
          has_ingredients: recipe.ingredients && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0,
          ingredient_count: recipe.ingredients && Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0,
          has_description: recipe.description && recipe.description !== '',
          has_image: recipe.image_url && recipe.image_url !== '',
          image_url: recipe.image_url,
          menu_price: recipe.menu_price,
          category: recipe.category,
          base_spirit: recipe.base_spirit,
          difficulty: recipe.difficulty,
          is_cocktail: recipe.is_cocktail,
          description: recipe.description
        });
      });

      // Filter to only groups with duplicates
      const duplicateGroups = Object.entries(nameGroups)
        .filter(([_, versions]) => versions.length > 1)
        .map(([name, versions]) => ({
          name: versions[0].name, // Use the original name (not normalized)
          versions: versions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        }))
        .sort((a, b) => b.versions.length - a.versions.length);

      console.log('Duplicate query result:', duplicateGroups);
      console.log('Duplicate count:', duplicateGroups.length);
      setDuplicates(duplicateGroups);
    } catch (err) {
      console.error('Failed to load duplicates:', err);
      toast.error('Failed to load duplicate recipes: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmptyRecipes = async () => {
    try {
      // Load all recipes using entity API
      const allRecipes = await base44.entities.Recipe.list('-created_at', 10000);

      // Filter to only empty recipes (no ingredients)
      const emptyRecipes = allRecipes.filter(recipe =>
        !recipe.ingredients ||
        !Array.isArray(recipe.ingredients) ||
        recipe.ingredients.length === 0
      ).map(recipe => ({
        id: recipe.id,
        name: recipe.name,
        created_at: recipe.created_at,
        description: recipe.description,
        image_url: recipe.image_url,
        category: recipe.category,
        ingredient_count: recipe.ingredients && Array.isArray(recipe.ingredients) ? recipe.ingredients.length.toString() : 'null'
      }));

      console.log('Empty recipes query result:', emptyRecipes);
      console.log('Empty recipe count:', emptyRecipes.length);
      setEmptyRecipes(emptyRecipes);
    } catch (err) {
      console.error('Failed to load empty recipes:', err);
      toast.error('Failed to load empty recipes: ' + err.message);
    }
  };

  const checkDependencies = async (recipeId) => {
    setLoadingDeps(true);
    try {
      // Load ingredients and menus using entity API
      const [allIngredients, allMenus, recipe] = await Promise.all([
        base44.entities.Ingredient.list('-created_at', 5000),
        base44.entities.Menu.list('-created_at', 1000),
        base44.entities.Recipe.get(recipeId)
      ]);

      // Check which ingredients use this recipe as a sub-recipe
      const ingredientsUsingRecipe = allIngredients.filter(ing =>
        ing.sub_recipe_id === recipeId
      );

      // Check which menus contain this recipe
      const menusUsingRecipe = allMenus.filter(menu =>
        menu.id === recipe?.menu_id
      );

      const deps = {
        usedInIngredients: ingredientsUsingRecipe.length,
        ingredientNames: ingredientsUsingRecipe.map(ing => ing.name),
        usedInMenus: menusUsingRecipe.length,
        menuNames: menusUsingRecipe.map(menu => menu.name)
      };

      setDependencies(prev => ({
        ...prev,
        [recipeId]: deps
      }));

      return deps;
    } catch (err) {
      console.error('Failed to check dependencies:', err);
      toast.error('Failed to check recipe dependencies: ' + err.message);
      return null;
    } finally {
      setLoadingDeps(false);
    }
  };

  const deleteRecipe = async (recipeId, recipeName, reason = '') => {
    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('Admin access required');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${recipeName}"?\n\nThis action will be logged and can be reviewed in the audit log.`
    );

    if (!confirmed) return;

    try {
      // Simply delete the recipe (audit logging removed due to permissions)
      await base44.entities.Recipe.delete(recipeId);

      toast.success('Recipe deleted successfully');
      loadDuplicates();

      if (selectedGroup) {
        const updatedVersions = selectedGroup.versions.filter(v => v.id !== recipeId);
        if (updatedVersions.length > 0) {
          setSelectedGroup({ ...selectedGroup, versions: updatedVersions });
        } else {
          setSelectedGroup(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete recipe:', err);
      toast.error('Failed to delete recipe: ' + err.message);
    }
  };

  const deleteEmptyRecipe = async (recipeId, recipeName) => {
    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('Admin access required');
      return;
    }

    const confirmed = window.confirm(
      `Delete empty recipe "${recipeName}"?\n\nThis recipe has no ingredients and will be permanently removed.`
    );

    if (!confirmed) return;

    try {
      await base44.entities.Recipe.delete(recipeId);
      toast.success('Empty recipe deleted');
      loadEmptyRecipes();
    } catch (err) {
      console.error('Failed to delete recipe:', err);
      toast.error('Failed to delete recipe: ' + err.message);
    }
  };

  const bulkDeleteEmptyRecipes = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('Admin access required');
      return;
    }

    const confirmed = window.confirm(
      `Delete ALL ${emptyRecipes.length} empty recipes?\n\nThis will permanently remove all recipes with no ingredients. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      let deleted = 0;
      for (const recipe of emptyRecipes) {
        await base44.entities.Recipe.delete(recipe.id);
        deleted++;
      }
      toast.success(`Deleted ${deleted} empty recipes`);
      loadEmptyRecipes();
    } catch (err) {
      console.error('Failed to bulk delete:', err);
      toast.error('Failed to delete empty recipes: ' + err.message);
    }
  };

  const keepBestDeleteOthers = async (group) => {
    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('Admin access required');
      return;
    }

    // Find the version with highest completeness score
    let bestVersion = group.versions[0];
    let bestScore = getDataCompleteness(bestVersion);

    for (const version of group.versions) {
      const score = getDataCompleteness(version);
      if (score > bestScore) {
        bestScore = score;
        bestVersion = version;
      }
    }

    // Get versions to delete
    const toDelete = group.versions.filter(v => v.id !== bestVersion.id);

    const confirmed = window.confirm(
      `Keep "${bestVersion.name}" (${bestScore}% complete) and delete ${toDelete.length} other version(s)?\n\nVersions to delete:\n${toDelete.map(v => `- Created ${new Date(v.created_at).toLocaleDateString()} (${getDataCompleteness(v)}% complete)`).join('\n')}\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      let deleted = 0;
      for (const version of toDelete) {
        await base44.entities.Recipe.delete(version.id);
        deleted++;
      }
      toast.success(`Kept best version, deleted ${deleted} duplicate(s)`);
      loadDuplicates();
    } catch (err) {
      console.error('Failed to delete duplicates:', err);
      toast.error('Failed to delete duplicates: ' + err.message);
    }
  };

  const bulkCleanupAllDuplicates = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('Admin access required');
      return;
    }

    // Calculate total versions to delete
    let totalToDelete = 0;
    duplicates.forEach(group => {
      totalToDelete += group.versions.length - 1; // Keep 1, delete the rest
    });

    const confirmed = window.confirm(
      `Auto-clean ALL ${duplicates.length} duplicate groups?\n\nThis will:\n- Keep the most complete version of each recipe\n- Delete ${totalToDelete} duplicate recipe(s)\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      let totalDeleted = 0;
      for (const group of duplicates) {
        // Find best version for this group
        let bestVersion = group.versions[0];
        let bestScore = getDataCompleteness(bestVersion);

        for (const version of group.versions) {
          const score = getDataCompleteness(version);
          if (score > bestScore) {
            bestScore = score;
            bestVersion = version;
          }
        }

        // Delete all except best
        const toDelete = group.versions.filter(v => v.id !== bestVersion.id);
        for (const version of toDelete) {
          await base44.entities.Recipe.delete(version.id);
          totalDeleted++;
        }
      }

      toast.success(`Cleaned up ${duplicates.length} groups, deleted ${totalDeleted} duplicates`);
      loadDuplicates();
    } catch (err) {
      console.error('Failed to bulk cleanup:', err);
      toast.error('Failed to bulk cleanup: ' + err.message);
    }
  };

  const getDataCompleteness = (version) => {
    let score = 0;
    if (version.has_ingredients) score += 40;
    if (version.has_description) score += 20;
    if (version.has_image) score += 20;
    if (version.menu_price) score += 10;
    if (version.category) score += 5;
    if (version.difficulty) score += 5;
    return score;
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <Alert className="bg-red-50 border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <AlertDescription>
                <span className="font-semibold text-red-800">Access Denied</span>
                <p className="text-sm text-red-700 mt-2">
                  Only administrators can access the duplicate recipe manager.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link to={createPageUrl('admin-users')}>
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Recipe Cleanup Manager</h1>
            <p className="text-gray-600 mt-1">
              Manage duplicate and empty recipes
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => { loadDuplicates(); loadEmptyRecipes(); }} variant="outline" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
            {duplicates.length > 0 && (
              <Button
                onClick={bulkCleanupAllDuplicates}
                variant="default"
                size="default"
                className="bg-green-600 hover:bg-green-700"
                disabled={isLoading}
              >
                <GitMerge className="w-4 h-4 mr-2" />
                Clean All Duplicates Now
              </Button>
            )}
            {emptyRecipes.length > 0 && (
              <Button
                onClick={bulkDeleteEmptyRecipes}
                variant="destructive"
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All Empty Recipes
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="duplicates">
              <Copy className="w-4 h-4 mr-2" />
              Duplicates ({duplicates.length})
            </TabsTrigger>
            <TabsTrigger value="empty">
              <XCircle className="w-4 h-4 mr-2" />
              Empty Recipes ({emptyRecipes.length})
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <TabsContent value="duplicates">
              {duplicates.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Duplicates Found</h3>
                    <p className="text-gray-600">All recipes have unique names.</p>
                  </CardContent>
                </Card>
              ) : (
          <div className="space-y-4">
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <AlertDescription>
                <span className="font-semibold text-yellow-800">Found {duplicates.length} duplicate recipe groups</span>
                <p className="text-sm text-yellow-700 mt-1">
                  Use "Clean All" to automatically keep the best version of each recipe, or clean up groups individually.
                </p>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button
                onClick={bulkCleanupAllDuplicates}
                variant="default"
                size="lg"
                disabled={duplicates.length === 0}
              >
                <GitMerge className="w-4 h-4 mr-2" />
                Clean All Duplicates (Keep Best Versions)
              </Button>
            </div>

            {duplicates.map((group) => (
              <Card key={group.name} className="overflow-hidden">
                <CardHeader className="bg-gray-50 border-b">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <CardTitle className="text-xl">{group.name}</CardTitle>
                      <CardDescription>
                        {group.versions.length} versions found
                      </CardDescription>
                    </div>
                    <Badge variant="destructive" className="text-sm">
                      <Copy className="w-3 h-3 mr-1" />
                      {group.versions.length} duplicates
                    </Badge>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => keepBestDeleteOthers(group)}
                      variant="outline"
                      size="sm"
                      className="border-green-600 text-green-700 hover:bg-green-50"
                    >
                      <GitMerge className="w-3 h-3 mr-2" />
                      Keep Best, Delete Others
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.versions.map((version) => {
                      const completeness = getDataCompleteness(version);
                      const deps = dependencies[version.id];

                      return (
                        <Card key={version.id} className="border-2">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <Badge
                                  variant={completeness >= 70 ? "default" : completeness >= 40 ? "secondary" : "outline"}
                                  className="mb-2"
                                >
                                  {completeness}% complete
                                </Badge>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(version.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                {version.has_ingredients ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-gray-600">
                                  {version.ingredient_count || 0} ingredients
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {version.has_description ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-gray-600">Description</span>
                              </div>

                              <div className="flex items-center gap-2">
                                {version.has_image ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-gray-600">Image</span>
                              </div>

                              {version.menu_price && (
                                <div className="flex items-center gap-2">
                                  <DollarSign className="w-4 h-4 text-green-600" />
                                  <span className="text-gray-600">${version.menu_price}</span>
                                </div>
                              )}
                            </div>

                            {deps && (
                              <Alert className={deps.usedInIngredients > 0 || deps.usedInMenus > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
                                <AlertDescription className="text-xs">
                                  {deps.usedInIngredients > 0 && (
                                    <p className="text-red-700">Used in {deps.usedInIngredients} ingredients</p>
                                  )}
                                  {deps.usedInMenus > 0 && (
                                    <p className="text-red-700">On {deps.usedInMenus} menus</p>
                                  )}
                                  {deps.usedInIngredients === 0 && deps.usedInMenus === 0 && (
                                    <p className="text-green-700">No dependencies</p>
                                  )}
                                </AlertDescription>
                              </Alert>
                            )}

                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => checkDependencies(version.id)}
                                disabled={loadingDeps}
                              >
                                {loadingDeps ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                onClick={() => deleteRecipe(version.id, version.name, 'Duplicate cleanup')}
                                disabled={deps && (deps.usedInIngredients > 0 || deps.usedInMenus > 0)}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
              )}
            </TabsContent>

            <TabsContent value="empty">
              {emptyRecipes.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Empty Recipes</h3>
                    <p className="text-gray-600">All recipes have ingredients.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <Alert className="bg-orange-50 border-orange-200">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <AlertDescription>
                      <span className="font-semibold text-orange-800">Found {emptyRecipes.length} empty recipes</span>
                      <p className="text-sm text-orange-700 mt-1">
                        These recipes have no ingredients. They can be safely deleted.
                      </p>
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end">
                    <Button
                      onClick={bulkDeleteEmptyRecipes}
                      variant="destructive"
                      disabled={emptyRecipes.length === 0}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete All Empty Recipes
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    {emptyRecipes.map((recipe) => (
                      <Card key={recipe.id} className="border-orange-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{recipe.name || 'Untitled'}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Created: {new Date(recipe.created_at).toLocaleDateString()}
                              </CardDescription>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteEmptyRecipe(recipe.id, recipe.name)}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Ingredients:</span>
                              <span className="ml-2 font-semibold text-orange-600">None</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Description:</span>
                              <span className="ml-2">{recipe.description ? '✓' : '✗'}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Image:</span>
                              <span className="ml-2">{recipe.image_url ? '✓' : '✗'}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Category:</span>
                              <span className="ml-2">{recipe.category || 'None'}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
