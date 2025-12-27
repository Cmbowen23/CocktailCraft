import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, ArrowLeft, X, PlusCircle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import RecipeSearchDropdown from '@/components/training/RecipeSearchDropdown';

export default function TrainingDocEditor() {
    const location = useLocation();
    const [docId, setDocId] = useState(null);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Form State
    const [title, setTitle] = useState('');
    const [accountId, setAccountId] = useState('');
    const [menuId, setMenuId] = useState('');
    const [content, setContent] = useState(''); // HTML String
    const quillRef = React.useRef(null);
    
    // Available Data
    const [accounts, setAccounts] = useState([]);
    const [menus, setMenus] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const idParam = params.get('id');
        if (idParam) {
            setDocId(idParam);
        }
        
        loadData(idParam);
    }, [location.search]);

    const loadData = async (editingId) => {
        setLoading(true);
        try {
            const user = await base44.auth.me();
            setCurrentUser(user);

            const [allAccounts, allMenus] = await Promise.all([
                base44.entities.Account.list(),
                base44.entities.Menu.list()
            ]);

            setAccounts(allAccounts);
            setMenus(allMenus);

            // Default account from user if available
            if (user?.account_id) {
                setAccountId(user.account_id);
            }

            if (editingId) {
                const doc = await base44.entities.TrainingDocument.get(editingId);
                if (doc) {
                    setTitle(doc.title);
                    setAccountId(doc.account_id);
                    setMenuId(doc.menu_id || '');
                    
                    // Handle content
                    if (doc.html_content) {
                        setContent(doc.html_content);
                    } else if (typeof doc.content === 'string') {
                        setContent(doc.content);
                    } else if (Array.isArray(doc.content)) {
                        // Very basic fallback conversion for legacy block data
                        let html = '';
                        doc.content.forEach(block => {
                            if (block.type === 'heading') html += `<h${block.level || 2}>${block.text}</h${block.level || 2}>`;
                            else if (block.type === 'paragraph') html += `<p>${block.text}</p>`;
                            else if (block.type === 'list') {
                                html += '<ul>' + (block.items || []).map(i => `<li>${i}</li>`).join('') + '</ul>';
                            }
                            else if (block.type === 'batch') {
                                html += `<div class="batch-placeholder"><p><strong>Batch: ${block.title}</strong></p></div>`;
                            }
                        });
                        setContent(html);
                    }
                }
            } else {
                // Check for initial content from URL (from "Add Menu to Training Doc")
                const params = new URLSearchParams(location.search);
                const initialContent = params.get('initialContent');
                const initialTitle = params.get('initialTitle');
                const initialAccountId = params.get('initialAccountId');
                const initialMenuId = params.get('initialMenuId');

                if (initialContent) {
                    try {
                        setContent(decodeURIComponent(initialContent));
                    } catch (e) {
                        console.error("Failed to parse initial content");
                    }
                }
                if (initialTitle) setTitle(decodeURIComponent(initialTitle));
                if (initialAccountId) setAccountId(initialAccountId);
                if (initialMenuId) setMenuId(initialMenuId);
            }

        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            alert('Please enter a title');
            return;
        }
        if (!accountId) {
            alert('Please select an account');
            return;
        }

        setSaving(true);
        try {
            const docData = {
                title,
                account_id: accountId,
                menu_id: menuId || null,
                html_content: content,
                content: [] // Legacy field empty
            };

            if (docId) {
                await base44.entities.TrainingDocument.update(docId, docData);
            } else {
                const newDoc = await base44.entities.TrainingDocument.create(docData);
                setDocId(newDoc.id);
                // Redirect to ensure URL matches ID
                if (!docId) {
                     window.location.href = createPageUrl(`TrainingDocEditor?id=${newDoc.id}`);
                     return;
                }
            }
            alert('Document saved successfully!');
        } catch (error) {
            console.error("Error saving document:", error);
            alert('Failed to save document');
        } finally {
            setSaving(false);
        }
    };



    const handleInsertHtml = (html) => {
        // Insert into editor using Quill API if available
        if (quillRef.current) {
            const editor = quillRef.current.getEditor();
            const range = editor.getSelection(true);
            if (range) {
                editor.clipboard.dangerouslyPasteHTML(range.index, html);
            } else {
                // Append if no selection
                const length = editor.getLength();
                editor.clipboard.dangerouslyPasteHTML(length, html);
            }
        } else {
             // Fallback
             setContent(prev => prev + html);
        }
    };

    // Check if account selector should be hidden
    const shouldHideAccountSelector = currentUser?.user_type === 'buyer_admin';

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4 shadow-sm">
                <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => window.location.href = createPageUrl('TrainingDocs')}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <Input 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Document Title"
                            className="text-lg font-bold border-transparent hover:border-gray-200 focus:border-blue-500 max-w-md h-auto py-2"
                        />
                    </div>
                    <div className="flex items-center gap-2">

                        {docId && (
                            <Button 
                                variant="outline" 
                                onClick={() => window.location.href = createPageUrl(`TrainingDocView?id=${docId}`)}
                            >
                                Preview
                            </Button>
                        )}
                        <Button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {saving ? 'Saving...' : 'Save'} <Save className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-12 gap-8">
                {/* Sidebar */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                    <Card>
                        <CardContent className="p-4 space-y-4">
                            {!shouldHideAccountSelector && (
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1">Account</label>
                                    <Select value={accountId} onValueChange={setAccountId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accounts.map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">Menu (Optional)</label>
                                <Select value={menuId} onValueChange={setMenuId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Menu" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {menus.filter(m => !accountId || m.account_id === accountId).map(menu => (
                                            <SelectItem key={menu.id} value={menu.id}>{menu.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <RecipeSearchDropdown onInsert={handleInsertHtml} />
                                <p className="text-xs text-gray-500 mt-2">
                                    Drag and drop recipe into editor or click + to insert.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Editor */}
                <div className="col-span-12 lg:col-span-9">
                    <Card className="min-h-[600px] flex flex-col">
                        <ReactQuill 
                            ref={quillRef}
                            theme="snow" 
                            value={content} 
                            onChange={setContent} 
                            className="flex-1 h-full"
                            modules={{
                                toolbar: [
                                    [{ 'header': [1, 2, 3, false] }],
                                    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                                    [{'list': 'ordered'}, {'list': 'bullet'}],
                                    ['link', 'image'],
                                    ['clean']
                                ]
                            }}
                        />
                    </Card>
                </div>
                </div>


                </div>
                );
                }