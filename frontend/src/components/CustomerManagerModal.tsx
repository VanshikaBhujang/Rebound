'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { 
  X, 
  Search, 
  UserPlus, 
  User, 
  Phone, 
  Lock, 
  Calendar, 
  Trash2, 
  Check, 
  AlertTriangle, 
  CreditCard,
  IndianRupee,
  ChevronRight,
  ArrowLeft,
  Users
} from 'lucide-react';

interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  createdAt: string;
}

interface CustomerPayment {
  id: number;
  amount: number;
  method: string;
  createdAt: string;
  sessionId: string;
  session?: {
    id: string;
    customerName: string;
    status: string;
    totalBill: number;
  };
}

interface DeletionEligibility {
  canDelete: boolean;
  hasActiveSession: boolean;
  activeSession?: { id: string; tableName: string } | null;
  hasUdhar: boolean;
  totalUdhar: number;
  reasons: string[];
  reasonText?: string;
}

interface CustomerManagerModalProps {
  onClose: () => void;
  onCustomerUpdated?: () => void;
}

export const CustomerManagerModal: React.FC<CustomerManagerModalProps> = ({
  onClose,
  onCustomerUpdated
}) => {
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Edit form state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [eligibility, setEligibility] = useState<DeletionEligibility | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteTooltip, setShowDeleteTooltip] = useState(false);
  
  // Add customer form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);

  // Status message
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCustomers = async (search = '') => {
    try {
      setLoading(true);
      const data = await api.get(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      if (Array.isArray(data)) {
        setCustomers(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchCustomers(searchQuery);
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // When a customer is selected, load their details, payments & eligibility
  const handleSelectCustomer = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setEditFirstName(cust.firstName || '');
    setEditLastName(cust.lastName || '');
    setShowDeleteConfirm(false);
    setShowAddForm(false);
    setShowDeleteTooltip(false);
    setNotification(null);
    setEligibility(null);

    // Fetch payments and deletion eligibility concurrently
    setLoadingPayments(true);
    setLoadingEligibility(true);

    api.get(`/customers/${encodeURIComponent(cust.phone)}/payments`)
      .then((data) => {
        if (Array.isArray(data)) setPayments(data);
      })
      .catch((err: any) => {
        console.error('Failed to fetch customer payments:', err);
        setPayments([]);
      })
      .finally(() => setLoadingPayments(false));

    api.get(`/customers/${encodeURIComponent(cust.phone)}/eligibility`)
      .then((data: DeletionEligibility) => {
        setEligibility(data);
      })
      .catch((err: any) => {
        console.error('Failed to fetch customer deletion eligibility:', err);
        setEligibility({
          canDelete: false,
          hasActiveSession: false,
          hasUdhar: false,
          totalUdhar: 0,
          reasons: ['Unable to verify deletion status']
        });
      })
      .finally(() => setLoadingEligibility(false));
  };

  // Save edited customer details
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (!editFirstName.trim()) {
      setNotification({ type: 'error', message: 'First name is required' });
      return;
    }

    try {
      setSavingEdit(true);
      setNotification(null);
      const updated = await api.put(`/customers/${encodeURIComponent(selectedCustomer.phone)}`, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim()
      });

      setSelectedCustomer(updated);
      setNotification({ type: 'success', message: 'Customer details updated successfully' });
      
      // Invalidate customer cache
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rebound_customer_profiles_cache');
      }

      fetchCustomers(searchQuery);
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to update customer' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete customer
  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;

    try {
      setDeletingCustomer(true);
      await api.delete(`/customers/${encodeURIComponent(selectedCustomer.phone)}`);
      
      // Invalidate customer cache
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rebound_customer_profiles_cache');
      }

      setSelectedCustomer(null);
      setShowDeleteConfirm(false);
      setNotification({ type: 'success', message: 'Customer removed from database' });
      fetchCustomers(searchQuery);
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to delete customer' });
    } finally {
      setDeletingCustomer(false);
    }
  };

  // Add new customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim()) {
      setNotification({ type: 'error', message: 'First name is required' });
      return;
    }
    if (!newPhone.trim()) {
      setNotification({ type: 'error', message: 'Phone number is required' });
      return;
    }

    try {
      setAddingCustomer(true);
      setNotification(null);
      const created = await api.post('/customers', {
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        phone: newPhone.trim()
      });

      // Invalidate customer cache
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rebound_customer_profiles_cache');
      }

      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setShowAddForm(false);
      setNotification({ type: 'success', message: `Customer "${created.name}" created successfully` });
      fetchCustomers(searchQuery);
      handleSelectCustomer(created);
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to create customer' });
    } finally {
      setAddingCustomer(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#111827] rounded-3xl border border-slate-800 w-full max-w-4xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] p-6 flex flex-col h-[640px] max-h-[92vh] space-y-4">
        
        {/* Header */}
        <div className="flex justify-between items-center shrink-0 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white font-display uppercase tracking-wider flex items-center gap-2">
                Rebound Customers
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">Search, edit, manage profiles, and view payment history</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Notification */}
        {notification && (
          <div className={`text-xs font-bold p-3 rounded-xl border shrink-0 flex items-center justify-between ${
            notification.type === 'success' 
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40' 
              : 'bg-rose-950/70 text-rose-300 border-rose-500/40'
          }`}>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="opacity-70 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="flex-1 flex gap-5 min-h-0">
          
          {/* Left Column: Customer Search & List */}
          <div className="w-80 shrink-0 flex flex-col space-y-3 min-h-0 border-r border-slate-800 pr-5">
            
            {/* Action Bar: Search + Add Customer */}
            <div className="space-y-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
                  <input
                    type="text"
                    placeholder="Search name, surname, phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-7 py-2 text-xs font-semibold border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 bg-slate-900 text-white placeholder-slate-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(true);
                    setSelectedCustomer(null);
                    setNotification(null);
                  }}
                  className="px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,242,254,0.3)] shrink-0 transition-all"
                  title="Add New Customer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-400 px-1 flex justify-between items-center">
                <span>{loading ? 'Searching...' : `${customers.length} customers found`}</span>
                {searchQuery && (
                  <span className="text-cyan-400 text-[10px]">Filtered by "{searchQuery}"</span>
                )}
              </div>
            </div>

            {/* Scrollable Customer List */}
            <div className="flex-1 overflow-y-auto min-h-0 border border-slate-800 rounded-2xl bg-slate-900/60 divide-y divide-slate-800/80">
              {loading && customers.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs font-semibold">
                  Loading customers...
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs font-semibold space-y-2">
                  <p>No customers found matching "{searchQuery}"</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(true);
                      setNewFirstName(searchQuery);
                    }}
                    className="text-cyan-400 hover:underline text-xs"
                  >
                    + Add "{searchQuery}" as new customer
                  </button>
                </div>
              ) : (
                customers.map((c) => {
                  const isSelected = selectedCustomer?.phone === c.phone;
                  return (
                    <div
                      key={c.phone}
                      onClick={() => handleSelectCustomer(c)}
                      className={`p-3 cursor-pointer transition-all flex items-center justify-between ${
                        isSelected 
                          ? 'bg-cyan-950/50 border-l-4 border-cyan-400 text-white' 
                          : 'hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-extrabold text-white text-sm truncate flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                          <span>{c.name}</span>
                        </p>
                        <p className="text-xs font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-cyan-400/80 shrink-0" />
                          <span>{c.phone}</span>
                        </p>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600'}`} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Customer Details / Edit / Add Form */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-slate-900/50 rounded-2xl border border-slate-800 p-5 overflow-y-auto">
            
            {showAddForm ? (
              /* Add Customer Form */
              <div className="space-y-5 animate-in fade-in">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-white uppercase tracking-wider font-display">
                      Add New Customer
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">Create a new customer profile in the database</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                </div>

                <form onSubmit={handleAddCustomer} className="space-y-4 max-w-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 font-mono">
                        First Name <span className="text-cyan-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newFirstName}
                        onChange={(e) => setNewFirstName(e.target.value)}
                        placeholder="e.g. Ayush"
                        className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 font-mono">
                        Surname / Last Name
                      </label>
                      <input
                        type="text"
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                        placeholder="e.g. Chaudhary"
                        className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 font-mono">
                      Mobile Number <span className="text-cyan-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Mobile number is the unique immutable identifier for this customer.</p>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 border border-slate-800 text-xs font-bold uppercase tracking-wider rounded-xl text-slate-300 bg-slate-900 hover:bg-slate-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingCustomer}
                      className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50 transition-all"
                    >
                      {addingCustomer ? 'Saving...' : 'Create Customer'}
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedCustomer ? (
              /* Edit Selected Customer View */
              <div className="space-y-6 animate-in fade-in">
                
                {/* Customer Title */}
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-cyan-400 font-extrabold uppercase tracking-widest">
                      Customer Profile
                    </span>
                    <h3 className="text-xl font-extrabold text-white mt-0.5 flex items-center gap-2 font-display">
                      <User className="h-5 w-5 text-cyan-400 shrink-0" />
                      <span>{selectedCustomer.name}</span>
                    </h3>
                  </div>

                  {/* Delete Customer Button with Hover Tooltip */}
                  <div 
                    className="relative flex flex-col items-end"
                    onMouseEnter={() => setShowDeleteTooltip(true)}
                    onMouseLeave={() => setShowDeleteTooltip(false)}
                  >
                    <button
                      type="button"
                      disabled={!eligibility?.canDelete || loadingEligibility}
                      onClick={() => {
                        if (eligibility?.canDelete) {
                          setShowDeleteConfirm(!showDeleteConfirm);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                        loadingEligibility
                          ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-wait'
                          : eligibility?.canDelete
                          ? 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 cursor-pointer shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                          : 'bg-slate-900/90 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60 hover:border-amber-500/40'
                      }`}
                    >
                      {eligibility?.canDelete ? (
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      Delete Customer
                    </button>

                    {/* Floating Hover Tooltip - Only shown when hovering on the delete button */}
                    {showDeleteTooltip && eligibility && !eligibility.canDelete && (
                      <div className="absolute right-0 top-full mt-2 w-80 z-50 pointer-events-none bg-[#141210]/95 backdrop-blur-2xl border border-amber-500/50 rounded-2xl p-3.5 text-amber-200 text-xs space-y-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-amber-300 uppercase tracking-wider font-mono text-[11px]">
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                            <span>Deletion Locked</span>
                          </div>
                          <span className="text-[9px] font-mono text-amber-400/90 bg-amber-950/90 px-2 py-0.5 rounded border border-amber-500/30 uppercase tracking-wider">
                            Action Required
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {eligibility.hasActiveSession && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] font-semibold">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Active Session: {eligibility.activeSession?.tableName || 'Active Table'}</span>
                            </div>
                          )}
                          {eligibility.hasUdhar && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 font-mono text-[11px] font-semibold">
                              <IndianRupee className="h-3 w-3 text-rose-400" />
                              <span>Unpaid Udhar: ₹{eligibility.totalUdhar}</span>
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
                          Customer can only be deleted when their active game session is completed and all outstanding udhars are settled.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete Confirmation Alert (Only when eligible) */}
                {showDeleteConfirm && eligibility?.canDelete && (
                  <div className="bg-rose-950/80 border-2 border-rose-500/60 rounded-2xl p-4 text-rose-200 space-y-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-rose-300 font-extrabold text-xs uppercase tracking-wider font-mono">
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>Confirm Deletion</span>
                    </div>
                    <p className="text-xs text-rose-100 leading-relaxed font-medium">
                      Are you sure you want to delete <b>{selectedCustomer.name}</b> from the database? This will remove their saved customer directory profile. Past invoices and payment records will be preserved for financial accounting.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 bg-slate-900 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCustomer}
                        disabled={deletingCustomer}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all disabled:opacity-50"
                      >
                        {deletingCustomer ? 'Deleting...' : 'Yes, Delete from DB'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Editable Form */}
                <form onSubmit={handleSaveCustomer} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 font-mono">
                        First Name <span className="text-cyan-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 font-mono">
                        Surname / Last Name
                      </label>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        placeholder="e.g. Chaudhary"
                        className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
                      />
                    </div>
                  </div>

                  {/* Immutable Mobile Number */}
                  <div>
                    <label className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 font-mono">
                      <span>Mobile Number</span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        <Lock className="h-3 w-3 text-cyan-400" /> Immutable
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        value={selectedCustomer.phone}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800/80 px-3.5 py-2.5 text-slate-400 font-mono font-bold text-sm cursor-not-allowed opacity-80"
                      />
                      <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">Phone number serves as the fixed unique identifier.</p>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50 transition-all custom-button"
                    >
                      {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                    </button>
                  </div>
                </form>

                {/* Last 3-4 Payments with Dates */}
                <div className="border-t border-slate-800 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-cyan-400" />
                      Recent Payment Transactions (Last 3–4)
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500">
                      {payments.length} transactions
                    </span>
                  </div>

                  {loadingPayments ? (
                    <div className="text-center py-6 text-slate-500 text-xs font-semibold">
                      Loading payment history...
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-6 bg-slate-900/60 rounded-xl border border-slate-800/80 text-slate-500 text-xs font-medium">
                      No payment records found for this customer.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((p) => (
                        <div
                          key={p.id}
                          className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center hover:border-slate-700 transition-colors shadow-sm"
                        >
                          <div className="min-w-0 pr-2 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-extrabold text-cyan-400">
                                ₹{p.amount.toFixed(2)}
                              </span>
                              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded font-mono ${
                                p.method === 'UPI' 
                                  ? 'bg-purple-950 text-purple-300 border border-purple-500/40' 
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              }`}>
                                {p.method}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-500" />
                              {new Date(p.createdAt).toLocaleDateString([], { dateStyle: 'medium' })}{' '}
                              {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-mono text-slate-500 block truncate max-w-[140px]">
                              Session: {p.sessionId}
                            </span>
                            {p.session?.totalBill !== undefined && (
                              <span className="text-[10px] text-slate-400">
                                Bill: ₹{p.session.totalBill.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              /* Empty state: Select customer prompt */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 text-slate-500">
                  <User className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-300">No Customer Selected</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Select a customer from the left list to view/edit their details, or click "+ Add" to create a new profile.
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>,
    document.body
  );
};
