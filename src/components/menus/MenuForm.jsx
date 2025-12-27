import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";

const seasons = ["Spring", "Summer", "Fall", "Winter", "All-Season", "Event/Pop-up"];
const statuses = ["draft"];

export default function MenuForm({ menu, accounts, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(menu || {
    name: "",
    account_id: "",
    season: "All-Season",
    year: new Date().getFullYear(),
    description: "",
    status: "draft"
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="border border-gray-200 shadow-sm bg-white">
      <CardHeader>
        <CardTitle className="text-gray-900">
          {menu ? 'Edit Menu' : 'Create New Menu'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Menu Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => handleInputChange('name', e.target.value)} 
                placeholder="e.g., Summer 2025" 
                required 
              />
            </div>
            <div>
              <Label htmlFor="account">Account (Optional)</Label>
              <Select value={formData.account_id || "none"} onValueChange={(value) => handleInputChange('account_id', value === "none" ? null : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Account (General)</SelectItem>
                  {accounts && accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="season">Season</Label>
              <Select value={formData.season} onValueChange={(value) => handleInputChange('season', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map(season => (
                    <SelectItem key={season} value={season}>{season}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Input 
                id="year" 
                type="number"
                value={formData.year} 
                onChange={(e) => handleInputChange('year', parseInt(e.target.value))} 
                placeholder="2025"
              />
            </div>
            {/* Status field removed */}
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              value={formData.description} 
              onChange={(e) => handleInputChange('description', e.target.value)} 
              placeholder="Describe the theme or focus of this menu..."
              className="h-24"
            />
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              {menu ? 'Update Menu' : 'Create Menu'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}