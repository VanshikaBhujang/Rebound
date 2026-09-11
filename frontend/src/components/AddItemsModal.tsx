'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Plus, Download, Search, Edit3, Check, RefreshCw, Tag, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface AddItemsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddItemsModal: React.FC<AddItemsModalProps> = ({ onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'manage' | 'bulk'>('manual');
  
  // Manual Entry State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Cafe');
  const [manualLoading, setManualLoading] = useState(false);
  
  // Search & Edit Inventory State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);

  // Bulk Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch menu items when modal mounts or when switching to 'manage' tab
  const fetchMenuItems = async () => {
    try {
      setLoadingItems(true);
      setError('');
      const items = await api.get('/menu');
      if (Array.isArray(items)) {
        setMenuItems(items);
      }
    } catch (err: any) {
      console.error('Failed to load menu items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  useEffect(() => {
    if (activeTab === 'manage' && menuItems.length === 0) {
      fetchMenuItems();
    }
  }, [activeTab]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price || !category.trim()) {
      setError('All fields are required');
      return;
    }

    setManualLoading(true);
    setError('');

    try {
      await api.post('/menu', {
        name: name.trim(),
        price: parseFloat(price),
        category: category.trim()
      });
      setHasEdited(true);
      setName('');
      setPrice('');
      setSuccessMsg(`"${name.trim()}" added to menu`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchMenuItems();
    } catch (err: any) {
      setError(err.message || 'Failed to add item');
    } finally {
      setManualLoading(false);
    }
  };

  // Start editing an item
  const handleStartEdit = (item: MenuItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditPrice(item.price.toString());
    setEditCategory(item.category);
    setError('');
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditName('');
    setEditPrice('');
    setEditCategory('');
  };

  // Save edited item
  const handleSaveEdit = async (itemId: number) => {
    if (!editName.trim()) {
      setError('Item name is required');
      return;
    }
    const numPrice = parseFloat(editPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Please enter a valid price');
      return;
    }

    try {
      setSavingEdit(true);
      setError('');
      const updated = await api.put(`/menu/${itemId}`, {
        name: editName.trim(),
        price: numPrice,
        category: editCategory.trim()
      });

      setMenuItems((prev) =>
        prev.map((item) => (item.id === itemId ? updated : item))
      );
      setEditingItemId(null);
      setHasEdited(true);
      setSuccessMsg(`"${updated.name}" updated successfully!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update item');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setError('');
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l);
    if (lines.length < 2) throw new Error('CSV must contain headers and at least one item row.');

    const headers = lines[0].toLowerCase().split(',');
    const nameIdx = headers.findIndex((h) => h.includes('name'));
    const priceIdx = headers.findIndex((h) => h.includes('price'));
    const categoryIdx = headers.findIndex((h) => h.includes('category'));

    if (nameIdx === -1 || priceIdx === -1 || categoryIdx === -1) {
      throw new Error("CSV must contain 'Name', 'Price', and 'Category' columns.");
    }

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length >= 3) {
        items.push({
          name: parts[nameIdx],
          price: parseFloat(parts[priceIdx]),
          category: parts[categoryIdx]
        });
      }
    }
    return items;
  };

  const handleBulkSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file first');
      return;
    }

    setBulkLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const items = parseCSV(text);

        await api.post('/menu/bulk', { items });
        setHasEdited(true);
        onSuccess();
      } catch (err: any) {
        setError(err.message || 'Failed to process CSV file');
        setBulkLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setBulkLoading(false);
    };
    reader.readAsText(selectedFile);
  };

  const downloadTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,Name,Price,Category\nMarlboro Advance,20,Cigarettes\nRed Bull,120,Cold Drinks\nFrench Fries,100,Cafe';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'items_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter items for "Search & Edit" tab
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleClose = () => {
    if (hasEdited) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'Cigarettes':
        return 'bg-rose-950/60 text-rose-300 border-rose-500/40';
      case 'Cold Drinks':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40';
      case 'Cafe':
      default:
        return 'bg-amber-950/60 text-amber-300 border-amber-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#111827] rounded-3xl border border-slate-800 w-full max-w-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-white font-display uppercase tracking-wide">
              Menu & Inventory
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Add new items or edit names and pricing
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-full transition-colors border border-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* 3 Tabs */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1">
            <button
              onClick={() => { setActiveTab('manual'); setError(''); }}
              className={`flex-1 py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all duration-200 ${
                activeTab === 'manual'
                  ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,242,254,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              + Single Item
            </button>
            <button
              onClick={() => { setActiveTab('manage'); setError(''); }}
              className={`flex-1 py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                activeTab === 'manage'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_10px_rgba(0,242,254,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="h-3 w-3" />
              Search & Edit ({menuItems.length})
            </button>
            <button
              onClick={() => { setActiveTab('bulk'); setError(''); }}
              className={`flex-1 py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all duration-200 ${
                activeTab === 'bulk'
                  ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bulk CSV
            </button>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="bg-emerald-950/80 text-emerald-300 text-xs font-bold p-3 rounded-xl border border-emerald-500/50 flex items-center gap-2 animate-in fade-in">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-3 rounded-xl border border-rose-500/40 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: ADD SINGLE ITEM */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-300 mb-1.5 uppercase tracking-widest font-mono">
                  Item Name <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold transition-all"
                  placeholder="e.g. Red Bull"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-300 mb-1.5 uppercase tracking-widest font-mono">
                    Price (₹) <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-mono font-semibold transition-all"
                    placeholder="120"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-300 mb-1.5 uppercase tracking-widest font-mono">
                    Category <span className="text-cyan-400">*</span>
                  </label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold transition-all cursor-pointer"
                  >
                    <option value="Cafe">Cafe</option>
                    <option value="Cold Drinks">Cold Drinks</option>
                    <option value="Cigarettes">Cigarettes</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-xs font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50 transition-all custom-button"
                >
                  {manualLoading ? 'Adding...' : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item to Menu
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SEARCH & EDIT MENU ITEMS */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              {/* Search Bar + Refresh */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by item name..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={fetchMenuItems}
                  disabled={loadingItems}
                  title="Refresh items"
                  className="p-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-cyan-300 hover:border-slate-700 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingItems ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Cafe', 'Cold Drinks', 'Cigarettes'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase font-mono tracking-wider transition-all ${
                      selectedCategory === cat
                        ? 'bg-cyan-500 text-black font-extrabold shadow-[0_0_8px_rgba(0,242,254,0.4)]'
                        : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                <span className="text-[10px] text-slate-500 font-mono self-center ml-auto">
                  {filteredItems.length} of {menuItems.length} items
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {loadingItems ? (
                  <div className="text-center py-8 text-xs font-semibold text-slate-500">
                    Loading menu items...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8 bg-slate-900/60 rounded-2xl border border-slate-800/80 text-xs text-slate-400">
                    No items found matching &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 transition-all ${
                        editingItemId === item.id
                          ? 'bg-cyan-950/30 border-cyan-500/60 shadow-[0_0_15px_rgba(0,242,254,0.15)]'
                          : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {editingItemId === item.id ? (
                        /* Inline Edit Form */
                        <div className="space-y-3">
                          <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Edit3 className="h-3.5 w-3.5" />
                            Editing Item #{item.id}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <label className="block text-[9px] font-mono uppercase text-slate-400 mb-1">Name</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-white text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-mono uppercase text-slate-400 mb-1">Price (₹)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-white text-xs font-mono font-bold focus:border-cyan-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-1">
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 text-xs font-medium focus:border-cyan-500 focus:outline-none cursor-pointer"
                            >
                              <option value="Cafe">Cafe</option>
                              <option value="Cold Drinks">Cold Drinks</option>
                              <option value="Cigarettes">Cigarettes</option>
                            </select>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={savingEdit}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(item.id)}
                                disabled={savingEdit}
                                className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] disabled:opacity-50"
                              >
                                {savingEdit ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Normal Item Row */
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-semibold text-white text-xs truncate">
                              {item.name}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-2 py-0.5 rounded-md border uppercase font-bold shrink-0 ${getCategoryBadgeClass(
                                item.category
                              )}`}
                            >
                              {item.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono font-extrabold text-cyan-300 text-sm">
                              ₹{item.price.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-950/50 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/40 rounded-lg text-[11px] font-bold transition-all shadow-sm"
                            >
                              <Edit3 className="h-3 w-3" />
                              Edit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BULK UPLOAD CSV */}
          {activeTab === 'bulk' && (
            <div className="space-y-5">
              <div
                className="border-2 border-dashed border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-cyan-500/50 hover:bg-slate-900/50 transition-all cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm mb-3">
                  <Upload className="h-6 w-6 text-cyan-400" />
                </div>
                <p className="text-xs font-bold text-white">
                  {selectedFile ? selectedFile.name : 'Click to select CSV file'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-1">.csv files only</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden"
                />
              </div>

              <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-widest font-mono">
                    Format Requirements
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="text-[10px] font-bold bg-slate-900 border border-cyan-500/40 text-cyan-300 px-2 py-1 rounded-lg hover:bg-cyan-500 hover:text-black transition-colors flex items-center"
                  >
                    <Download className="h-3 w-3 mr-1" /> Template
                  </button>
                </div>
                <p className="text-xs text-cyan-200/80 leading-relaxed font-mono">
                  Your CSV must contain exact headers: <b>Name, Price, Category</b>.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleBulkSubmit}
                  disabled={bulkLoading || !selectedFile}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-xs font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 transition-all custom-button"
                >
                  {bulkLoading ? 'Uploading...' : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Items
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
