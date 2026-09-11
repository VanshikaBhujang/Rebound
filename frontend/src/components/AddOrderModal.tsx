'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MenuItem } from '../types';
import { api } from '../lib/api';
import { X, Plus, Minus, Trash2, ShoppingBag, Search } from 'lucide-react';

interface AddOrderModalProps {
  sessionId: string;
  onClose: () => void;
  onSuccess: (order: any) => void;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  'Cafe': { bg: 'bg-amber-950/70', text: 'text-amber-300', border: 'border-amber-500/40', label: 'Café' },
  'Cold Drinks': { bg: 'bg-cyan-950/70', text: 'text-cyan-300', border: 'border-cyan-500/40', label: 'Cold Drink' },
  'Cigarettes': { bg: 'bg-rose-950/70', text: 'text-rose-300', border: 'border-rose-500/40', label: 'Cigarette' },
};

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  sessionId,
  onClose,
  onSuccess
}) => {
  const [mounted, setMounted] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const data = await api.get('/menu');
        setMenuItems(data);
      } catch (err: any) {
        console.error('Failed to fetch menu items:', err.message);
      }
    };
    fetchMenu();
  }, []);

  const isSearching = searchQuery.trim().length > 0;

  const matchesSearch = (item: MenuItem, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    const itemName = item.name.toLowerCase();
    const itemCat = item.category.toLowerCase();

    // 1. Direct substring in name or category
    if (itemName.includes(q) || itemCat.includes(q)) return true;

    // 2. Intelligent spelling & alias matching:
    // Cigarettes (handles "cigerrette", "cigertte", "cigrate", "cig", "smoke", etc.)
    const isCigaretteQuery = /^(cig|cigg|ciger|cigarr|cigerette|cigerrette|cigertte|cigratte|smoke)/i.test(q);
    if (isCigaretteQuery && itemCat === 'cigarettes') return true;

    // Cold drinks (handles "cold drink", "cold drinks", "drink", "soda", "beverage", "soft drink")
    const isDrinkQuery = /^(drink|cold|bever|soda|soft)/i.test(q);
    if (isDrinkQuery && itemCat === 'cold drinks') return true;

    // Cafe (handles "cafe", "coffee", "snack", "tea", "food")
    const isCafeQuery = /^(cafe|café|coffee|snack|food|eat)/i.test(q);
    if (isCafeQuery && itemCat === 'cafe') return true;

    // 3. Multi-word search (e.g. "marlboro adv", "coca 300")
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      const fullText = `${itemName} ${itemCat}`;
      return words.every((w) => fullText.includes(w));
    }

    return false;
  };

  const filteredItems = menuItems.filter((item) => {
    // If searching, search across ALL categories universally without needing to switch tabs
    if (isSearching) {
      return matchesSearch(item, searchQuery);
    }

    // When not searching, respect the selected category tab
    return category === 'All' || item.category === category;
  });

  const handleUpdateQty = (menuItem: MenuItem, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter((ci) => ci.menuItem.id !== menuItem.id));
    } else {
      const exists = cart.find((ci) => ci.menuItem.id === menuItem.id);
      if (exists) {
        setCart(
          cart.map((ci) =>
            ci.menuItem.id === menuItem.id ? { ...ci, quantity: qty } : ci
          )
        );
      } else {
        setCart([...cart, { menuItem, quantity: qty }]);
      }
    }
  };

  const grandTotal = cart.reduce((sum, ci) => sum + ci.quantity * ci.menuItem.price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Please add at least one item to place an order');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/orders', {
        sessionId,
        items: cart.map((ci) => ({
          menuItemId: ci.menuItem.id.toString(),
          quantity: ci.quantity
        }))
      });
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#111827] rounded-3xl border border-slate-800 w-full max-w-4xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] p-6 flex flex-col h-[600px] max-h-[90vh] space-y-4">
        
        {/* Header */}
        <div className="flex justify-between items-center shrink-0 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-extrabold text-white font-display uppercase tracking-wide">Add Items & Orders</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">Search anything across all categories or browse tabs</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-3 rounded-xl border border-rose-500/40 shrink-0">
            {error}
          </div>
        )}

        {/* Split Columns Layout */}
        <div className="flex-1 flex gap-5 min-h-0">
          
          {/* Left Column: Menu Item Selector */}
          <div className="flex-1 min-w-0 flex flex-col space-y-3">
            
            {/* Universal Search Bar */}
            <div className="relative shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search any item or category (e.g. Cigarette, Marlboro, Red Bull, Coffee)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-xs font-semibold border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 bg-slate-900 text-white placeholder-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category Selector Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded-xl border border-slate-800 bg-slate-900 shrink-0">
              {['All', 'Cafe', 'Cold Drinks', 'Cigarettes'].map((cat) => {
                const count = cat === 'All'
                  ? menuItems.length
                  : menuItems.filter((i) => i.category === cat).length;
                const isSelected = !isSearching ? category === cat : category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategory(cat);
                      setSearchQuery('');
                    }}
                    className={`group flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all min-w-0 ${
                      isSelected && !isSearching
                        ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(0,242,254,0.4)]'
                        : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80'
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold shrink-0 transition-colors ${
                        isSelected && !isSearching
                          ? 'bg-black/20 text-slate-950'
                          : 'bg-slate-800 text-slate-400 group-hover:bg-cyan-950 group-hover:text-cyan-300'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Live Search Status Bar */}
            {isSearching && (
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1 shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  Searching across <strong className="text-cyan-300">all categories</strong>: {filteredItems.length} found
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-cyan-400 hover:underline text-[10px]"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Menu Items List */}
            <div className="flex-1 overflow-y-auto min-h-0 border border-slate-800 rounded-2xl divide-y divide-slate-800 bg-slate-900/60">
              {filteredItems.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs font-semibold">
                  {isSearching ? `No items matching "${searchQuery}"` : 'No items in this category.'}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const cartItem = cart.find((ci) => ci.menuItem.id === item.id);
                  const style = CATEGORY_STYLES[item.category] || { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-700', label: item.category };

                  return (
                    <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-800/60 transition-colors">
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-extrabold text-white text-sm truncate">{item.name}</p>
                          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md border font-mono ${style.bg} ${style.text} ${style.border}`}>
                            {style.label}
                          </span>
                        </div>
                        <p className="text-xs text-cyan-400 font-mono font-bold mt-0.5">₹{item.price.toFixed(2)}</p>
                      </div>

                      {/* Add / Qty Control */}
                      <div className="shrink-0">
                        {cartItem ? (
                          <div className="flex items-center gap-2 border border-slate-800 rounded-xl p-1 bg-slate-900">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item, cartItem.quantity - 1)}
                              className="p-1 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-mono font-bold text-cyan-400">
                              {cartItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item, cartItem.quantity + 1)}
                              className="p-1 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item, 1)}
                            className="bg-slate-900 border border-slate-700 hover:border-cyan-400 hover:text-cyan-300 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                          >
                            <Plus className="h-3 w-3 text-cyan-400" />
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Order Cart Summary */}
          <div className="w-72 md:w-80 shrink-0 border border-slate-800 rounded-2xl bg-slate-900/90 p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                Selected Items ({cart.length})
              </h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors font-mono font-semibold"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Scrollable list of cart items */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-slate-500 text-xs font-semibold">
                  No items added to order.
                </div>
              ) : (
                cart.map((ci) => (
                  <div key={ci.menuItem.id} className="flex justify-between items-center p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs shadow-sm">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-bold text-white truncate">{ci.menuItem.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{ci.quantity} × ₹{ci.menuItem.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-cyan-400">
                        ₹{(ci.quantity * ci.menuItem.price).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(ci.menuItem, 0)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Amount & Place Order button */}
            <div className="border-t border-slate-800 pt-3.5 mt-auto space-y-3 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Grand Total:</span>
                <span className="text-base font-mono font-extrabold text-cyan-400">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || cart.length === 0}
                className="w-full inline-flex justify-center items-center px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4 mr-2 shrink-0" />
                    Place Order
                  </>
                )}
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>,
    document.body
  );
};
