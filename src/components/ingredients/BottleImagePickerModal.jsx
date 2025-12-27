import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, Image as ImageIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function BottleImagePickerModal({ 
  isOpen, 
  onClose, 
  ingredient, 
  onImageSelected 
}) {
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [manualUrl, setManualUrl] = useState('');

  React.useEffect(() => {
    if (isOpen && ingredient) {
      fetchCandidates();
      setManualUrl('');
    }
  }, [isOpen, ingredient]);

  const fetchCandidates = async () => {
    setIsLoading(true);
    setError(null);
    setCandidates([]);
    
    try {
      const response = await base44.functions.invoke('fetchBottleImageCandidates', {
        ingredientName: ingredient.name,
        supplier: ingredient.supplier,
        category: ingredient.category,
        style: ingredient.style,
        substyle: ingredient.substyle,
        region: ingredient.region
      });

      if (response.data?.candidates && response.data.candidates.length > 0) {
        setCandidates(response.data.candidates);
        setSearchQuery(response.data.searchQuery || '');
      } else {
        setError(response.data?.message || 'No valid images found. Please enter a direct image URL below.');
      }
    } catch (err) {
      console.error('Error fetching bottle images:', err);
      setError('Failed to search for bottle images. Please try again or enter a URL manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectImage = (candidate) => {
    onImageSelected(candidate.imageUrl);
    onClose();
  };

  const handleUseManualUrl = () => {
    if (manualUrl.trim()) {
      onImageSelected(manualUrl.trim());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Select Bottle Image for {ingredient?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {searchQuery && (
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <span className="font-semibold">Search query:</span> "{searchQuery}"
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="text-gray-600">Searching for bottle images...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={fetchCandidates}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {!isLoading && candidates.length > 0 && (
            <>
              <p className="text-sm text-gray-600">
                Found {candidates.length} validated image{candidates.length !== 1 ? 's' : ''}. Click on an image to select it.
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {candidates.map((candidate, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-lg ${
                      selectedImage === candidate.imageUrl 
                        ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => setSelectedImage(candidate.imageUrl)}
                  >
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 relative">
                      <img
                        src={candidate.imageUrl}
                        alt={candidate.altText || `Candidate ${index + 1}`}
                        className="w-full h-full object-contain"
                      />
                      {selectedImage === candidate.imageUrl && (
                        <div className="absolute top-2 right-2 bg-blue-600 rounded-full p-1">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      Source: {candidate.sourceDomain || 'Unknown'}
                    </div>
                    {candidate.altText && (
                      <div className="text-xs text-gray-500 truncate mt-1">
                        {candidate.altText}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => selectedImage && handleSelectImage({ imageUrl: selectedImage })}
                  disabled={!selectedImage}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Use Selected Image
                </Button>
              </div>
            </>
          )}

          {!isLoading && (error || candidates.length === 0) && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Image URL Manually
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Paste a direct link to a bottle image (must end in .jpg, .png, .webp, etc.)
                </p>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://example.com/bottle-image.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={fetchCandidates}
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  Try Search Again
                </Button>
                <Button 
                  onClick={handleUseManualUrl}
                  disabled={!manualUrl.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Use This URL
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}