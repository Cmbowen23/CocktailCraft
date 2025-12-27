import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer } from 'lucide-react';
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { createPageUrl } from '@/utils';
import 'react-quill/dist/quill.snow.css';

export default function TrainingDocView() {
    const location = useLocation();
    const [doc, setDoc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [account, setAccount] = useState(null);
    const [menu, setMenu] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const id = params.get('id');
        if (id) {
            loadDoc(id);
        }
    }, [location.search]);

    const loadDoc = async (id) => {
        setLoading(true);
        try {
            const document = await base44.entities.TrainingDocument.get(id);
            setDoc(document);

            if (document.account_id) {
                const acc = await base44.entities.Account.get(document.account_id);
                setAccount(acc);
            }
            if (document.menu_id && document.menu_id !== 'none') {
                const m = await base44.entities.Menu.get(document.menu_id);
                setMenu(m);
            }
        } catch (error) {
            console.error("Error loading document:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderContent = (content) => {
        if (!content) return <p className="text-gray-500 italic">No content.</p>;
        
        // If content is a string (HTML or plain text)
        if (typeof content === 'string') {
            return <div className="ql-editor p-0" dangerouslySetInnerHTML={{ __html: content }} />;
        }
        
        // Fallback for legacy block content (convert to basic HTML structure for display)
        if (Array.isArray(content)) {
            return (
                <div className="space-y-4">
                    {content.map((block, idx) => {
                        if (block.type === 'heading') {
                            const Tag = `h${block.level || 2}`;
                            return <Tag key={idx} className="font-bold">{block.text}</Tag>;
                        }
                        if (block.type === 'paragraph') return <p key={idx}>{block.text}</p>;
                        if (block.type === 'list') return (
                            <ul key={idx} className="list-disc pl-5">
                                {(block.items || []).map((item, i) => <li key={i}>{item}</li>)}
                            </ul>
                        );
                        if (block.type === 'batch') return (
                            <div key={idx} className="bg-blue-50 p-4 rounded border border-blue-100">
                                <h4 className="font-bold text-blue-900">{block.title}</h4>
                                <p className="text-sm text-blue-800">Batch Instructions available in editor or Prep Actions tab.</p>
                            </div>
                        );
                        return null;
                    })}
                </div>
            );
        }
        
        return null;
    };

    if (loading) {
        return <div className="min-h-screen bg-white flex items-center justify-center"><LoadingSpinner className="w-24 h-24 text-blue-600" /></div>;
    }

    if (!doc) {
        return <div className="min-h-screen bg-white flex items-center justify-center">Document not found</div>;
    }

    return (
        <div className="min-h-screen bg-white print:bg-white">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-20 px-4 py-3 flex justify-between items-center print:hidden">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="-ml-2"
                    onClick={() => window.location.href = createPageUrl('TrainingDocs')}
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Button>
                
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => window.print()}>
                        <Printer className="w-5 h-5 text-gray-600" />
                    </Button>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 py-6 md:py-10 print:p-0 print:max-w-none">
                {/* Meta Header */}
                <header className="mb-8 pb-6 border-b border-gray-100">
                    <div className="flex flex-wrap gap-2 mb-4 print:hidden">
                        {account && (
                            <Badge variant="outline" className="text-gray-600 border-gray-300">
                                {account.name}
                            </Badge>
                        )}
                        {menu && (
                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                {menu.name}
                            </Badge>
                        )}
                        {doc.tags && doc.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="bg-gray-100 text-gray-700">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                    
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 leading-tight">
                        {doc.title}
                    </h1>
                </header>

                {/* Content */}
                <article className="prose prose-slate max-w-none pb-20 print:pb-0">
                    {renderContent(doc.html_content || doc.content)}
                </article>
            </main>
        </div>
    );
}