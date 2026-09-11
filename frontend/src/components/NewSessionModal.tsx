'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { X, Play, User, Phone, AlertTriangle, Lock, ExternalLink } from 'lucide-react';

interface CustomerProfile {
  customerName: string;
  customerPhone?: string;
}

interface NewSessionModalProps {
  tables?: any;
  staffUsername: string;
  udhars?: { customerName: string; totalOutstanding: number }[];
  activeSessions?: any[];
  onClose: () => void;
  onSuccess: (session: any) => void;
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  staffUsername,
  udhars = [],
  activeSessions = [],
  onClose,
  onSuccess,
}) => {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState('Cash');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerList, setCustomerList] = useState<CustomerProfile[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const CUSTOMER_CACHE_KEY = 'rebound_customer_profiles_cache';
  const CUSTOMER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  useEffect(() => {
    const fetchCustomers = async () => {
      // 1. Check localStorage cache first
      try {
        const cached = localStorage.getItem(CUSTOMER_CACHE_KEY);
        if (cached) {
          const { profiles, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CUSTOMER_CACHE_TTL && Array.isArray(profiles)) {
            setCustomerList(profiles);
            return;
          }
        }
      } catch (e) { /* ignore corrupt cache */ }

      // 2. Fetch fresh list from API
      try {
        const raw = await api.get('/sessions/customers/all');
        if (Array.isArray(raw)) {
          // Standardize profiles array
          const profiles: CustomerProfile[] = raw.map(item => 
            typeof item === 'string' 
              ? { customerName: item, customerPhone: '' } 
              : { customerName: item.customerName || '', customerPhone: item.customerPhone || '' }
          );
          setCustomerList(profiles);
          localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify({ profiles, timestamp: Date.now() }));
        }
      } catch (err) {
        console.error('Failed to fetch customer list', err);
      }
    };
    fetchCustomers();
  }, []);

  // Matching logic based on First Name and/or Mobile Number
  const trimmedFirstName = firstName.trim().toLowerCase();
  const trimmedPhone = customerPhone.trim();
  const fullTypedName = (firstName.trim() + ' ' + lastName.trim()).trim().toLowerCase();
  const rawTypedDigits = customerPhone.replace(/\D/g, '');

  const matchedSuggestions = (trimmedFirstName.length >= 1 || trimmedPhone.length >= 2)
    ? customerList.filter(profile => {
        const nameMatch = trimmedFirstName && profile.customerName.toLowerCase().includes(trimmedFirstName);
        const phoneMatch = trimmedPhone && profile.customerPhone && profile.customerPhone.includes(trimmedPhone);
        return nameMatch || phoneMatch;
      })
    : [];

  const isExactMatch = customerList.some(p => {
    const nameMatches = p.customerName.toLowerCase() === fullTypedName || p.customerName.toLowerCase() === trimmedFirstName;
    const phoneMatches = trimmedPhone ? (p.customerPhone && p.customerPhone.trim() === trimmedPhone) : false;
    return nameMatches || phoneMatches;
  });
  
  const hasBothRequiredFields = firstName.trim().length > 0 && customerPhone.trim().length > 0;
  const isNewCustomer = hasBothRequiredFields && !isExactMatch && matchedSuggestions.length === 0;

  // Detect if current customer already has an active session
  const matchingActive = (firstName.trim() || customerPhone.trim())
    ? activeSessions.find((s) => {
        const sName = (s.customerName || '').toLowerCase().trim();
        const sPhone = (s.customerPhone || '').replace(/\D/g, '');

        // 1. Phone match (if at least 6 digits)
        if (rawTypedDigits.length >= 6 && sPhone.length >= 6) {
          if (rawTypedDigits === sPhone || sPhone.endsWith(rawTypedDigits) || rawTypedDigits.endsWith(sPhone)) {
            return true;
          }
        }

        // 2. Full name exact match
        if (fullTypedName && fullTypedName.length >= 2 && sName === fullTypedName) {
          return true;
        }

        // 3. First name exact match if no last name entered
        if (!lastName.trim() && trimmedFirstName.length >= 2 && sName === trimmedFirstName) {
          return true;
        }

        return false;
      })
    : undefined;

  const matchingUdhar = (fullTypedName || trimmedFirstName)
    ? udhars.find((u) => {
        const uName = (u.customerName || '').toLowerCase().trim();
        const nameMatches = (fullTypedName && uName === fullTypedName) || (trimmedFirstName && uName === trimmedFirstName);
        return nameMatches && u.totalOutstanding > 0;
      })
    : undefined;

  const handleSelectSuggestion = (profile: CustomerProfile) => {
    const parts = profile.customerName.trim().split(' ');
    if (parts.length > 1) {
      setFirstName(parts[0]);
      setLastName(parts.slice(1).join(' '));
    } else {
      setFirstName(profile.customerName);
      setLastName('');
    }
    if (profile.customerPhone) {
      setCustomerPhone(profile.customerPhone);
    }
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!customerPhone.trim()) {
      setError('Mobile number is required');
      return;
    }
    if (matchingActive) {
      setError(`Cannot start session: Customer "${matchingActive.customerName}" already has an active session in progress.`);
      return;
    }
    setError('');
    setLoading(true);

    const fullCustomerName = (firstName.trim() + ' ' + lastName.trim()).trim();

    try {
      const data = await api.post('/sessions', {
        staffUsername,
        customerName: fullCustomerName,
        customerPhone: customerPhone.trim(),
        advanceAmount: advanceAmount ? parseFloat(advanceAmount) : undefined,
        advanceMethod: advanceAmount ? advanceMethod : undefined,
      });
      // Invalidate customer cache
      localStorage.removeItem(CUSTOMER_CACHE_KEY);
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in">
      <div className="bg-[#111827] rounded-2xl border border-slate-800 w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[88vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 px-4 py-2.5 bg-slate-900/80 shrink-0">
          <div>
            <h2 className="text-sm font-extrabold text-white font-display uppercase tracking-wide">Start New Session</h2>
            <p className="text-[10px] text-slate-400 font-mono">Search or enter customer details</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-2 bg-rose-950/60 text-rose-300 text-xs font-bold p-2 rounded-lg border border-rose-500/40 shrink-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          
          {/* Scrollable Content Body */}
          <div className="p-3.5 space-y-2.5 overflow-y-auto flex-1">
            {/* First Name & Last Name in 2 Columns */}
            <div className="grid grid-cols-2 gap-2">
              {/* First Name (Required) */}
              <div className="relative">
                <label className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-0.5 font-mono">
                  <span className="flex items-center gap-1 truncate">
                    <User className="h-3 w-3 text-cyan-400 shrink-0" />
                    First Name <span className="text-cyan-400">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="block w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-semibold"
                  placeholder="e.g. Rahul"
                />
              </div>

              {/* Last Name (Optional) */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-0.5 font-mono truncate">
                  Last Name <span className="text-slate-500 text-[9px] font-normal">(Opt)</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="block w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-semibold"
                  placeholder="e.g. Sharma"
                />
              </div>
            </div>

            {/* Mobile Number (Required) */}
            <div className="relative">
              <label className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-0.5 font-mono">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-cyan-400" />
                  Mobile Number <span className="text-cyan-400">*</span>
                </span>
                {isNewCustomer && (
                  <span className="text-[9px] font-extrabold text-emerald-300 uppercase tracking-widest bg-emerald-950 px-1.5 py-0.2 rounded-full border border-emerald-500/40 font-mono">
                    New Customer
                  </span>
                )}
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="block w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-semibold font-mono"
                placeholder="e.g. 9876543210"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && matchedSuggestions.length > 0 && (
                <ul className="absolute z-30 mt-1 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-36 overflow-y-auto">
                  <div className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase text-slate-400 border-b border-slate-800 bg-slate-950/80">
                    Matching Customers in Database
                  </div>
                  {matchedSuggestions.map((profile, idx) => {
                    const pPhone = (profile.customerPhone || '').replace(/\D/g, '');
                    const pName = profile.customerName.toLowerCase().trim();
                    const profileHasActive = activeSessions.some((s) => {
                      const sName = (s.customerName || '').toLowerCase().trim();
                      const sPhone = (s.customerPhone || '').replace(/\D/g, '');
                      const phoneMatch = pPhone.length >= 6 && sPhone.length >= 6 && (pPhone === sPhone || sPhone.endsWith(pPhone) || pPhone.endsWith(sPhone));
                      const nameMatch = pName && sName === pName;
                      return Boolean(phoneMatch || nameMatch);
                    });

                    return (
                      <li
                        key={idx}
                        className={`px-2.5 py-1.5 text-xs cursor-pointer font-semibold border-b border-slate-800/60 last:border-0 flex justify-between items-center transition-colors ${
                          profileHasActive
                            ? 'bg-rose-950/30 text-rose-300 hover:bg-rose-950/60'
                            : 'text-slate-200 hover:bg-slate-800 hover:text-cyan-300'
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(profile);
                        }}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate">{profile.customerName}</span>
                          {profileHasActive && (
                            <span className="text-[8px] font-mono font-extrabold uppercase px-1 py-0.2 rounded bg-rose-900 text-rose-200 border border-rose-500/40 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        {profile.customerPhone && (
                          <span className="text-[10px] font-mono text-cyan-400/80 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800 shrink-0">
                            📱 {profile.customerPhone}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Advance Payment (Optional) */}
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                Advance Payment Received <span className="text-slate-500 text-[9px] font-normal">(Optional)</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="col-span-2 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono font-extrabold"
                  placeholder="e.g. 1000"
                />
                <select
                  value={advanceMethod}
                  onChange={(e) => setAdvanceMethod(e.target.value)}
                  className="rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-white focus:border-emerald-500 focus:outline-none text-xs font-semibold"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
              {advanceAmount && parseFloat(advanceAmount) > 0 && (
                <p className="text-[10px] text-emerald-400 font-mono">
                  ✓ ₹{parseFloat(advanceAmount).toFixed(2)} advance credited to this session.
                </p>
              )}
            </div>

            {/* Active Session & Udhar Warning Banners */}
            {(matchingActive || matchingUdhar) && (
              <div className="space-y-1.5 pt-0.5">
                {matchingActive && (
                  <div className="bg-rose-950/80 border border-rose-500/60 rounded-xl p-2.5 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.15)] space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-rose-300 font-extrabold text-[10px] uppercase tracking-wider font-mono">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0 animate-pulse" />
                        <span>Active Session Detected!</span>
                      </div>
                      <span className="text-[8px] font-mono font-extrabold bg-rose-900 text-rose-200 px-1.5 py-0.2 rounded-full border border-rose-500/50 uppercase">
                        Blocked
                      </span>
                    </div>

                    <p className="text-[11px] text-rose-100 leading-tight">
                      <strong className="text-white font-bold">{matchingActive.customerName}</strong>
                      {matchingActive.customerPhone ? ` (${matchingActive.customerPhone})` : ''} already has a session on{' '}
                      <strong className="text-cyan-300">Table #{matchingActive.table?.number || '—'}</strong>.
                    </p>

                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 bg-black/40 px-2 py-1 rounded border border-rose-900/50">
                      <span>ID: <span className="text-cyan-300">{matchingActive.id}</span></span>
                      <span className="text-rose-300">Cannot have 2 active sessions</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/sessions/${matchingActive.id}`);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1 py-1 px-2.5 bg-rose-900/80 hover:bg-rose-800 text-rose-100 border border-rose-500/50 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open Existing Active Session
                    </button>
                  </div>
                )}

                {matchingUdhar && (
                  <div className="text-[10px] text-amber-300 bg-amber-950/60 py-1.5 px-2.5 rounded-lg border border-amber-500/40 leading-tight font-semibold flex items-center gap-1.5">
                    <span className="shrink-0">⚠️</span>
                    <span>
                      <b>{matchingUdhar.customerName}</b> has an outstanding debt of <b>₹{matchingUdhar.totalOutstanding.toFixed(2)}</b>.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-slate-800/80 bg-slate-900/90 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center items-center px-3.5 py-1.5 border border-slate-800 text-xs font-bold uppercase tracking-wider rounded-lg text-slate-300 bg-slate-900 hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || Boolean(matchingActive)}
              className={`inline-flex justify-center items-center px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all ${
                matchingActive
                  ? 'bg-rose-950/50 border border-rose-500/40 text-rose-300 cursor-not-allowed opacity-80 shadow-none'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50'
              }`}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
              ) : matchingActive ? (
                <>
                  <Lock className="h-3 w-3 mr-1 text-rose-400" />
                  Already Has Active Session
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Start Session
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
