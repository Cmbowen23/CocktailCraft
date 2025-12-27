import React, { useState, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle2, AlertCircle, Search, Filter, Download, AlertTriangle } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function ImageUploadAuditPage() {
    const location = useLocation();
    const { results = [], summary = {} } = location.state || {};
    const [filter, setFilter] = useState('all'); // all, success, error
    const [search, setSearch] = useState('');

    const filteredResults = useMemo(() => {
        return results.filter(item => {
            const matchesFilter = filter === 'all' 
                || (filter === 'success' && item.status === 'success')
                || (filter === 'error' && item.status === 'error')
                || (filter === 'skipped' && item.status === 'skipped')
                || (filter === 'not_found' && item.status === 'not_found');
            
            const matchesSearch = search === '' 
                || item.sku.toLowerCase().includes(search.toLowerCase())
                || item.message.toLowerCase().includes(search.toLowerCase());

            return matchesFilter && matchesSearch;
        });
    }, [results, filter, search]);

    // Redirect if no data (e.g. direct access)
    if (!location.state) {
        return (
            <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center">
                <Card className="w-full max-w-md text-center p-6">
                    <div className="mb-4 text-gray-400 flex justify-center">
                        <AlertCircle className="w-12 h-12" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">No Audit Data Found</h2>
                    <p className="text-gray-600 mb-6">
                        This page displays results from a bulk import. Please perform an import first.
                    </p>
                    <Link to={createPageUrl('Ingredients')}>
                        <Button>Back to Ingredients</Button>
                    </Link>
                </Card>
            </div>
        );
    }

    const downloadAuditLog = () => {
        const headers = ['SKU', 'Image URL', 'Status', 'Message'];
        const csvContent = [
            headers.join(','),
            ...results.map(r => [
                `"${r.sku}"`,
                `"${r.url}"`,
                r.status,
                `"${r.message}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `import-audit-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('Ingredients')}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Import Audit Report</h1>
                            <p className="text-gray-600 text-sm">
                                Processed {summary.total || results.length} items • {new Date().toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={downloadAuditLog}>
                        <Download className="w-4 h-4 mr-2" />
                        Export Log
                    </Button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Successful</p>
                                <h3 className="text-2xl font-bold text-green-700">{summary.updated || 0}</h3>
                            </div>
                            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={`border-l-4 ${summary.notFound > 0 ? 'border-l-amber-500' : 'border-l-gray-300'}`}>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Not Found</p>
                                <h3 className={`text-2xl font-bold ${summary.notFound > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
                                    {summary.notFound || 0}
                                </h3>
                            </div>
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${summary.notFound > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                <AlertTriangle className={`w-6 h-6 ${summary.notFound > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className={`border-l-4 ${summary.errors > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Errors</p>
                                <h3 className={`text-2xl font-bold ${summary.errors > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                                    {summary.errors || 0}
                                </h3>
                            </div>
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${summary.errors > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                                <AlertCircle className={`w-6 h-6 ${summary.errors > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Skipped</p>
                                <h3 className="text-2xl font-bold text-blue-700">
                                    {summary.skipped || 0}
                                </h3>
                            </div>
                            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <Filter className="w-6 h-6 text-blue-600" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters & Table */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <CardTitle>Detailed Log</CardTitle>
                            <div className="flex items-center gap-2">
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                                    <Input 
                                        placeholder="Search SKU or message..." 
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                                <div className="flex bg-gray-100 rounded-lg p-1 gap-1 overflow-x-auto">
                                    {['all', 'success', 'not_found', 'error', 'skipped'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFilter(f)}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                                                filter === f 
                                                    ? 'bg-white text-gray-900 shadow-sm' 
                                                    : 'text-gray-500 hover:text-gray-900'
                                            }`}
                                        >
                                            {f === 'not_found' ? 'Not Found' : f.charAt(0).toUpperCase() + f.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Message</TableHead>
                                        <TableHead className="text-right">Image</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResults.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                                No results match your filters
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredResults.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-mono font-medium">{item.sku}</TableCell>
                                                <TableCell>
                                                    {item.status === 'success' && (
                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Success</Badge>
                                                    )}
                                                    {item.status === 'error' && (
                                                        <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Error</Badge>
                                                    )}
                                                    {item.status === 'skipped' && (
                                                        <Badge variant="outline" className="text-blue-600 bg-blue-50 hover:bg-blue-50 border-blue-200">Skipped</Badge>
                                                    )}
                                                    {item.status === 'not_found' && (
                                                        <Badge variant="outline" className="text-amber-700 bg-amber-50 hover:bg-amber-50 border-amber-200">Not Found</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-gray-600">{item.message}</TableCell>
                                                <TableCell className="text-right">
                                                    {item.url && (
                                                        <a 
                                                            href={item.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline text-sm"
                                                        >
                                                            View Link
                                                        </a>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-4 text-sm text-gray-500 text-right">
                            Showing {filteredResults.length} of {results.length} records
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}