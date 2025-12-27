import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ImageReferenceManager() {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const user = await base44.auth.me();
      const userSettings = await base44.entities.AppSetting.filter({ user_id: user.id });
      
      if (userSettings && userSettings.length > 0) {
        setSettings(userSettings[0]);
      } else {
        // Create new settings
        const newSettings = await base44.entities.AppSetting.create({
          user_id: user.id,
          glassware_reference_images: []
        });
        setSettings(newSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!newDescription.trim()) {
      toast.error("Please enter a description first");
      return;
    }

    setIsUploading(true);
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      
      if (response.file_url) {
        const updatedImages = [
          ...(settings.glassware_reference_images || []),
          { url: response.file_url, description: newDescription.trim() }
        ];
        
        await base44.entities.AppSetting.update(settings.id, {
          glassware_reference_images: updatedImages
        });
        
        setSettings({ ...settings, glassware_reference_images: updatedImages });
        setNewDescription("");
        toast.success("Reference image added");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async (index) => {
    try {
      const updatedImages = settings.glassware_reference_images.filter((_, i) => i !== index);
      
      await base44.entities.AppSetting.update(settings.id, {
        glassware_reference_images: updatedImages
      });
      
      setSettings({ ...settings, glassware_reference_images: updatedImages });
      toast.success("Reference image removed");
    } catch (error) {
      console.error("Error removing image:", error);
      toast.error("Failed to remove image");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Image Reference Manager</h1>
        <p className="text-gray-600 mt-2">
          Upload reference images for AI image generation training (e.g., glassware types). These will be used as visual references when generating recipe images.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add New Reference Image</CardTitle>
          <CardDescription>Upload an image and provide a description</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (e.g., "Nick and Nora glass")
              </label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Enter description..."
                disabled={isUploading}
              />
            </div>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              <Button disabled={isUploading}>
                {isUploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload Image
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settings?.glassware_reference_images?.length > 0 ? (
          settings.glassware_reference_images.map((ref, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
                  <img
                    src={ref.url}
                    alt={ref.description}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium text-gray-900">{ref.description}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveImage(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-gray-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No reference images added yet</p>
          </div>
        )}
      </div>
    </div>
  );
}