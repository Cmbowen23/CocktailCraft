import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

const accountTypes = ["restaurant", "bar", "hotel", "catering", "event_venue", "other"];

export default function AccountForm({ account, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(account || {
    name: "",
    description: "",
    type: "bar",
    account_code: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    notes: "",
    sales_rep_name: ""
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
          {account ? 'Edit Account' : 'Create New Account'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Account Name *</Label>
              <Input id="name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="e.g., The Gilded Lily" required />
            </div>
            <div>
              <Label htmlFor="type">Account Type *</Label>
              <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accountTypes.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
             <div>
                <Label htmlFor="account_code">Account Number</Label>
                <Input id="account_code" value={formData.account_code || ''} onChange={(e) => handleInputChange('account_code', e.target.value)} placeholder="e.g. ACC-001" />
             </div>
             <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formData.phone || ''} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="(555) 123-4567" />
             </div>
          </div>

          <div className="space-y-3 border-t pt-3 border-gray-100">
             <Label className="text-base font-semibold text-gray-700">Address Details</Label>
             
             <div>
                <Label htmlFor="address">Street Address</Label>
                <Input id="address" value={formData.address || ''} onChange={(e) => handleInputChange('address', e.target.value)} placeholder="123 Main St" />
             </div>
             
             <div className="grid grid-cols-3 gap-4">
                 <div className="col-span-1">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={formData.city || ''} onChange={(e) => handleInputChange('city', e.target.value)} placeholder="New York" />
                 </div>
                 <div className="col-span-1">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={formData.state || ''} onChange={(e) => handleInputChange('state', e.target.value)} placeholder="NY" />
                 </div>
                 <div className="col-span-1">
                    <Label htmlFor="zip">Zip Code</Label>
                    <Input id="zip" value={formData.zip || ''} onChange={(e) => handleInputChange('zip', e.target.value)} placeholder="10001" />
                 </div>
             </div>
          </div>

          <div className="pt-2">
             <Label htmlFor="sales_rep_name">Sales Rep</Label>
             <Input 
                id="sales_rep_name" 
                value={formData.sales_rep_name || ''} 
                onChange={(e) => handleInputChange('sales_rep_name', e.target.value)} 
                placeholder="Enter Sales Rep Name" 
             />
             <p className="text-xs text-gray-500 mt-1">Name of the sales rep responsible for this account.</p>
          </div>

          <div className="grid md:grid-cols-1 gap-4">
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description || ''} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="A brief description of the client or venue..." className="h-20" />
            </div>
            <div>
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea id="notes" value={formData.notes || ''} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder="Internal notes only..." className="h-20" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onCancel}><X className="w-4 h-4 mr-2" />Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />{account ? 'Update Account' : 'Create Account'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}