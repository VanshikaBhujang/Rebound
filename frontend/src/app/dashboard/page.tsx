'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { api } from '../../lib/api';
import { Table, Session, TableBooking, Udhar } from '../../types';
import { Navbar } from '../../components/Navbar';
import { TableStatusBar } from '../../components/TableStatusBar';
import { SessionCard } from '../../components/SessionCard';
import { NewSessionModal } from '../../components/NewSessionModal';
import { BookTableModal } from '../../components/BookTableModal';
import { AddOrderModal } from '../../components/AddOrderModal';
import { 
  Play, 
  Calendar, 
  Trash2, 
  Check, 
  PlusCircle, 
  BookOpen, 
  IndianRupee, 
  AlertTriangle,
  LogOut,
  RefreshCw,
  X,
  Coffee,
  Gamepad2,
  Cigarette,
  Eye,
  Lock,
  Unlock,
  Search
} from 'lucide-react';

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  // Component states
  const [tables, setTables] = useState<Table[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [totalCompletedSessions, setTotalCompletedSessions] = useState(0);
  const [bookings, setBookings] = useState<TableBooking[]>([]);
  const [udhars, setUdhars] = useState<Udhar[]>([]);
  const [totalDebtors, setTotalDebtors] = useState(0);
  const [salesToday, setSalesToday] = useState(0);
  const [udharOutstanding, setUdharOutstanding] = useState(0);

  // Modal controls
  const [showNewSession, setShowNewSession] = useState(false);
  const [showBookTable, setShowBookTable] = useState(false);
  const [showAddUdhar, setShowAddUdhar] = useState(false);
  const [showActiveDrawer, setShowActiveDrawer] = useState(false);
  const [activeOrderSessionId, setActiveOrderSessionId] = useState<string | null>(null);
  const [liveSessionSearch, setLiveSessionSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const globalSearchRef = useRef<HTMLInputElement>(null);
  // Add Udhar state
  const [newUdharCustomer, setNewUdharCustomer] = useState('');
  const [newUdharAmount, setNewUdharAmount] = useState('');
  const [udharError, setUdharError] = useState('');
  const [showUdharSuggestions, setShowUdharSuggestions] = useState(false);
  const [customerProfiles, setCustomerProfiles] = useState<{ customerName: string; customerPhone?: string }[]>([]);

  const [loadingData, setLoadingData] = useState(true);

  // Sales Today lock/flip card states
  const [isFlipped, setIsFlipped] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Auto-lock the sales card after 30 seconds of inactivity when unlocked and flipped
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isUnlocked && isFlipped) {
      timer = setTimeout(() => {
        setIsUnlocked(false);
        setIsFlipped(false);
        setPasswordInput('');
        setPasswordError('');
      }, 30000); // 30 seconds
    }
    return () => clearTimeout(timer);
  }, [isUnlocked, isFlipped]);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      setPasswordError('Password required');
      return;
    }
    try {
      setVerifyingPassword(true);
      setPasswordError('');
      await api.post('/auth/verify-password', { password: passwordInput, username: user?.username });
      setIsUnlocked(true);
      setPasswordInput('');
    } catch (err: any) {
      setPasswordError(err.message || 'Incorrect password');
    } finally {
      setVerifyingPassword(false);
    }
  };

  // Load dashboard cache on mount for instant zero-delay render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('rebound_dashboard_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.tables) setTables(parsed.tables);
          if (parsed.activeSessions) setActiveSessions(parsed.activeSessions);
          if (parsed.completedSessions) setCompletedSessions(parsed.completedSessions);
          if (typeof parsed.totalCompletedSessions === 'number') setTotalCompletedSessions(parsed.totalCompletedSessions);
          if (parsed.bookings) setBookings(parsed.bookings);
          if (parsed.udhars) setUdhars(parsed.udhars);
          if (typeof parsed.totalDebtors === 'number') setTotalDebtors(parsed.totalDebtors);
          if (typeof parsed.salesToday === 'number') setSalesToday(parsed.salesToday);
          if (typeof parsed.udharOutstanding === 'number') setUdharOutstanding(parsed.udharOutstanding);
          setLoadingData(false); // Cache successfully restored
        } catch (err) {
          console.error('Failed to parse dashboard cache:', err);
        }
      }
    }
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [token, authLoading, router]);

  const fetchData = async () => {
    if (!token) return;
    try {
      // If we don't have any cached data, set loadingData to true to show skeletons
      const hasCache = localStorage.getItem('rebound_dashboard_cache') !== null;
      if (!hasCache) {
        setLoadingData(true);
      }
      
      const [dashboard, allBookings, udharRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/bookings'),
        api.get('/udhar?page=1&limit=10')
      ]);

      const fetchedTables = dashboard.tables || [];
      const fetchedActive = dashboard.activeSessions || [];
      const fetchedCompleted = dashboard.completedSessions || [];
      const fetchedTotalCompleted = dashboard.totalCompletedSessions || 0;
      const fetchedSales = dashboard.salesToday || 0;
      const fetchedUdhar = dashboard.udharOutstanding || 0;
      const fetchedBookings = allBookings || [];
      const fetchedUdhars = udharRes.udhars || [];
      const fetchedTotalDebtors = udharRes.total || 0;

      setTables(fetchedTables);
      setActiveSessions(fetchedActive);
      setCompletedSessions(fetchedCompleted);
      setTotalCompletedSessions(fetchedTotalCompleted);
      setSalesToday(fetchedSales);
      setUdharOutstanding(fetchedUdhar);
      setBookings(fetchedBookings);
      setUdhars(fetchedUdhars);
      setTotalDebtors(fetchedTotalDebtors);

      // Save fresh data to local cache
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'rebound_dashboard_cache',
          JSON.stringify({
            tables: fetchedTables,
            activeSessions: fetchedActive,
            completedSessions: fetchedCompleted,
            totalCompletedSessions: fetchedTotalCompleted,
            salesToday: fetchedSales,
            udharOutstanding: fetchedUdhar,
            bookings: fetchedBookings,
            udhars: fetchedUdhars,
            totalDebtors: fetchedTotalDebtors
          })
        );
      }
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchDataTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDataDebounced = () => {
    if (fetchDataTimeoutRef.current) {
      clearTimeout(fetchDataTimeoutRef.current);
    }
    fetchDataTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, 300);
  };

  useEffect(() => {
    fetchData();
    return () => {
      if (fetchDataTimeoutRef.current) {
        clearTimeout(fetchDataTimeoutRef.current);
      }
    };
  }, [token]);

  // Real-time synchronization
  useWebSocket((message) => {
    console.log('WS Broadcast received:', message);
    fetchDataDebounced();
  });

  const handleDeleteBooking = async (id: number) => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      try {
        await api.delete(`/bookings/${id}`);
        setBookings(bookings.filter((b) => b.id !== id));
      } catch (e: any) {
        alert(e.message || 'Failed to cancel booking');
      }
    }
  };

  const handleSettleUdhar = async (id: number) => {
    if (confirm('Mark this udhar as fully paid and settled?')) {
      try {
        await api.post(`/udhar/${id}/pay`, {});
        fetchData();
      } catch (e: any) {
        alert(e.message || 'Failed to settle udhar');
      }
    }
  };

  const handleCreateUdhar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUdharCustomer || !newUdharAmount) {
      setUdharError('Please enter all fields');
      return;
    }
    setUdharError('');
    try {
      await api.post('/udhar', {
        customerName: newUdharCustomer,
        amount: parseFloat(newUdharAmount)
      });
      setNewUdharCustomer('');
      setNewUdharAmount('');
      setShowAddUdhar(false);
      fetchData();
    } catch (err: any) {
      setUdharError(err.message || 'Failed to log udhar');
    }
  };

  // Group udhars by customer name case-insensitively
  const groupedUdharsList = React.useMemo(() => {
    const groupsMap = new Map<string, { customerName: string; entries: Udhar[] }>();

    udhars.forEach((udhar) => {
      const key = udhar.customerName.trim().toLowerCase();
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          customerName: udhar.customerName.trim(),
          entries: [],
        });
      }
      groupsMap.get(key)!.entries.push(udhar);
    });

    const list = Array.from(groupsMap.values()).map((group) => {
      const totalOutstanding = group.entries
        .filter((e) => e.status === 'unpaid')
        .reduce((sum, e) => sum + e.amount, 0);

      // Sort entries strictly by date descending (newest debt at the top)
      const sortedEntries = [...group.entries].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Find the date of the most recent unpaid debt
      const mostRecentUnpaidEntry = group.entries
        .filter((e) => e.status === 'unpaid')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      const mostRecentUnpaidDate = mostRecentUnpaidEntry
        ? new Date(mostRecentUnpaidEntry.createdAt).getTime()
        : 0;

      return {
        customerName: group.customerName,
        totalOutstanding,
        entries: sortedEntries,
        mostRecentUnpaidDate
      };
    });

    // Sort customer groups: outstanding first, then sorted by mostRecentUnpaidDate descending
    return list.sort((a, b) => {
      if (a.totalOutstanding > 0 && b.totalOutstanding === 0) return -1;
      if (a.totalOutstanding === 0 && b.totalOutstanding > 0) return 1;
      if (a.totalOutstanding > 0 && b.totalOutstanding > 0) {
        return b.mostRecentUnpaidDate - a.mostRecentUnpaidDate;
      }
      return a.customerName.localeCompare(b.customerName);
    });
  }, [udhars]);

  // Fetch all known customers for autocomplete across the dashboard
  useEffect(() => {
    const fetchCustomerProfiles = async () => {
      try {
        const cached = localStorage.getItem('rebound_customer_profiles_cache');
        if (cached) {
          const { profiles, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 30 * 60 * 1000 && Array.isArray(profiles)) {
            setCustomerProfiles(profiles);
            return;
          }
        }
      } catch (e) {}

      try {
        const raw = await api.get('/sessions/customers/all');
        if (Array.isArray(raw)) {
          const profiles = raw.map((item: any) =>
            typeof item === 'string'
              ? { customerName: item, customerPhone: '' }
              : { customerName: item.customerName || '', customerPhone: item.customerPhone || '' }
          );
          setCustomerProfiles(profiles);
          localStorage.setItem('rebound_customer_profiles_cache', JSON.stringify({ profiles, timestamp: Date.now() }));
        }
      } catch (err) {
        console.error('Failed to load customer profiles:', err);
      }
    };
    fetchCustomerProfiles();
  }, []);

  // Merge database customer profiles, active sessions, and udhars into unified customer list
  const allKnownCustomers = React.useMemo(() => {
    const map = new Map<string, { customerName: string; customerPhone?: string; outstanding?: number }>();

    // 1. Database customer profiles
    customerProfiles.forEach((p) => {
      const key = p.customerName.trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, { customerName: p.customerName.trim(), customerPhone: p.customerPhone });
      }
    });

    // 2. Active sessions
    activeSessions.forEach((s) => {
      const key = (s.customerName || '').trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, { customerName: s.customerName.trim(), customerPhone: s.customerPhone || undefined });
      }
    });

    // 3. Existing debtors with current outstanding
    groupedUdharsList.forEach((u) => {
      const key = u.customerName.trim().toLowerCase();
      const existing = map.get(key);
      const totalDebt = u.entries.filter(e => e.status === 'unpaid').reduce((sum, e) => sum + e.amount, 0);
      if (existing) {
        existing.outstanding = totalDebt;
      } else {
        map.set(key, { customerName: u.customerName, outstanding: totalDebt });
      }
    });

    return Array.from(map.values());
  }, [customerProfiles, activeSessions, groupedUdharsList]);

  // Suggestions for Log Udhar input
  const udharSuggestions = React.useMemo(() => {
    const q = newUdharCustomer.trim().toLowerCase();
    if (!q) return [];
    return allKnownCustomers.filter((c) => {
      const nameMatch = c.customerName.toLowerCase().includes(q);
      const phoneMatch = c.customerPhone && c.customerPhone.includes(q);
      return nameMatch || phoneMatch;
    }).slice(0, 8);
  }, [newUdharCustomer, allKnownCustomers]);

  // Selected customer existing debt summary
  const selectedCustomerUdhar = React.useMemo(() => {
    const q = newUdharCustomer.trim().toLowerCase();
    if (!q) return null;
    return allKnownCustomers.find((c) => c.customerName.toLowerCase() === q && (c.outstanding || 0) > 0);
  }, [newUdharCustomer, allKnownCustomers]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0d14]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 pb-16 font-sans">
      <Navbar />

      {bookings.length > 0 && (
        <div className="w-full bg-rose-950/80 text-rose-200 overflow-hidden relative shadow-lg border-b border-rose-800/80 group/marquee backdrop-blur-md">
          {/* Sticky Left Label */}
          <div className="absolute left-0 top-0 bottom-0 bg-rose-900 text-rose-100 font-extrabold text-[11px] tracking-widest uppercase px-4 flex items-center shadow-[4px_0_15px_rgba(225,29,72,0.5)] z-10 font-display">
            <Calendar className="h-3.5 w-3.5 mr-2 text-rose-300 animate-pulse" />
            Upcoming Bookings
          </div>
          <style>{`
            @keyframes marquee-scroll {
              0% { transform: translateX(100vw); }
              100% { transform: translateX(-100%); }
            }
            .animate-marquee-scroll {
              animation: marquee-scroll 14s linear infinite;
              white-space: nowrap;
              will-change: transform;
            }
            .group\\/marquee:hover .animate-marquee-scroll {
              animation-play-state: paused;
            }
          `}</style>
          <div className="animate-marquee-scroll py-2 inline-flex items-center gap-16 pr-16">
            {bookings.map(b => (
              <span key={b.id} className="inline-flex items-center gap-2.5">
                <span className="bg-rose-900/90 text-rose-100 px-2.5 py-0.5 rounded-lg text-[10px] uppercase tracking-wider font-extrabold border border-rose-700/50 shadow-sm">
                  {b.table?.gameType ? `${b.table.gameType} Table` : 'Table'} {b.table?.number || b.tableId}
                </span>
                <span className="font-extrabold text-sm text-white tracking-wide">{b.customerName}</span>
                <span className="text-rose-300 font-mono text-xs font-semibold">
                  {new Date(b.bookingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => handleDeleteBooking(b.id)}
                  title="Cancel Booking"
                  className="ml-1 p-1 hover:bg-rose-800 rounded-full transition-colors text-rose-300 hover:text-white shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Active Sessions Card */}
          <div className="bg-[#111827]/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(0,242,254,0.15)] transition-all duration-300 flex items-center justify-between h-[120px]">
            <div>
              <p className="text-[11px] text-cyan-400 font-extrabold uppercase tracking-widest font-mono">Active Sessions</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 font-display tracking-tight glow-text-cyan">
                {activeSessions.length}
              </h2>
            </div>
            <button 
              onClick={() => setShowActiveDrawer(true)}
              className="bg-cyan-500/10 border border-cyan-500/30 p-3.5 rounded-2xl text-cyan-400 hover:bg-cyan-500/20 hover:scale-105 transition-all cursor-pointer focus:outline-none shadow-[0_0_15px_rgba(0,242,254,0.2)]"
              title="View Live Sessions"
            >
              <Play className="h-6 w-6" />
            </button>
          </div>

          {/* Password-protected Sales Today Flip Card */}
          <div className="flip-card h-[120px] w-full relative">
            <div className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}>
              {/* Front Side: Obfuscated Sales Today */}
              <div 
                className="flip-card-front bg-[#111827]/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-purple-500/50 hover:shadow-[0_0_25px_rgba(168,85,247,0.15)] flex items-center justify-between cursor-pointer select-none transition-all duration-300"
                onClick={() => {
                  setIsFlipped(true);
                  setPasswordError('');
                }}
              >
                <div>
                  <p className="text-[11px] text-purple-400 font-extrabold uppercase tracking-widest font-mono">Sales Today</p>
                  <h2 className="text-3xl font-extrabold text-slate-600 mt-1 tracking-widest">
                    ••••••
                  </h2>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Click to reveal revenue</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 p-3.5 rounded-2xl text-purple-400">
                  <Lock className="h-6 w-6" />
                </div>
              </div>

              {/* Back Side: Password Form or Unlocked Sales */}
              <div className="flip-card-back w-full h-full">
                {!isUnlocked ? (
                  <form 
                    onSubmit={handleVerifyPassword} 
                    className="bg-[#111827] p-4 rounded-2xl border border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.2)] flex flex-col justify-between h-full select-none"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-purple-300 font-extrabold uppercase tracking-wider font-mono">Enter Staff Password</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsFlipped(false);
                          setPasswordInput('');
                          setPasswordError('');
                        }} 
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Password..."
                        className="block flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button
                        type="submit"
                        disabled={verifyingPassword}
                        className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-xs font-bold rounded-xl text-white flex items-center shrink-0 disabled:opacity-50 transition-colors shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                      >
                        {verifyingPassword ? '...' : 'Verify'}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-[9px] text-rose-400 font-bold truncate text-left">{passwordError}</p>
                    )}
                  </form>
                ) : (
                  <div className="bg-[#111827] p-6 rounded-2xl border border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)] flex items-center justify-between h-full select-none">
                    <div>
                      <p className="text-[11px] text-emerald-400 font-extrabold uppercase tracking-widest font-mono">Sales Today</p>
                      <h2 className="text-3xl font-extrabold text-emerald-400 mt-1 font-display tracking-tight glow-text-emerald">
                        ₹{salesToday.toFixed(2)}
                      </h2>
                    </div>
                    <button 
                      onClick={() => {
                        setIsUnlocked(false);
                        setIsFlipped(false);
                      }}
                      title="Lock Sales"
                      className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl text-emerald-400 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/40 transition-all duration-300"
                    >
                      <Unlock className="h-6 w-6" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Outstanding Udhar Card */}
          <div className="bg-[#111827]/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-rose-500/50 hover:shadow-[0_0_25px_rgba(244,63,94,0.15)] transition-all duration-300 flex items-center justify-between h-[120px]">
            <div>
              <p className="text-[11px] text-rose-400 font-extrabold uppercase tracking-widest font-mono">Outstanding Udhar</p>
              <h2 className="text-3xl font-extrabold text-rose-400 mt-1 font-display tracking-tight">
                ₹{udharOutstanding.toFixed(2)}
              </h2>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-2xl text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Dashboard Actions Bar */}
        <div className="flex flex-wrap justify-between items-center gap-4 bg-[#111827]/80 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2.5 font-display tracking-wide uppercase">
            <span>Billiard Tables & Gaming Hub</span>
            {loadingData && <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBookTable(true)}
              className="inline-flex items-center px-4 py-2.5 border border-slate-700/80 text-xs font-bold uppercase tracking-wider rounded-xl text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-cyan-300 hover:border-cyan-500/50 transition-all custom-button"
            >
              <Calendar className="h-4 w-4 mr-2 text-cyan-400" />
              Book Table
            </button>
            <button
              onClick={() => setShowNewSession(true)}
              className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_20px_rgba(0,242,254,0.3)] transition-all custom-button"
            >
              <Play className="h-4 w-4 mr-2 text-white" />
              Start Session
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative">
          <div className="relative flex items-center bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-xl px-4 py-3 gap-3 focus-within:border-cyan-500/60 focus-within:shadow-[0_0_20px_rgba(0,242,254,0.1)] transition-all duration-300">
            <Search className="h-4 w-4 text-cyan-400 shrink-0" />
            <input
              ref={globalSearchRef}
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search sessions by customer name..."
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-semibold"
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch('')}
                className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {globalSearch.trim() && (() => {
            const q = globalSearch.trim().toLowerCase();
            const matchedActive = activeSessions.filter(s => s.customerName.toLowerCase().includes(q));
            const matchedCompleted = completedSessions.filter(s => s.customerName.toLowerCase().includes(q));
            const hasResults = matchedActive.length > 0 || matchedCompleted.length > 0;

            return (
              <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-[#0e131f]/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {!hasResults ? (
                  <div className="p-6 text-center text-slate-500 text-sm font-semibold">
                    No sessions found for &ldquo;{globalSearch}&rdquo;
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80">

                    {/* Active Sessions Section */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 font-mono">Active Sessions</span>
                        <span className="text-[10px] font-bold text-slate-500 font-mono">({matchedActive.length})</span>
                      </div>
                      {matchedActive.length === 0 ? (
                        <p className="text-xs text-slate-600 font-semibold pl-4">No active sessions match.</p>
                      ) : (
                        <div className="space-y-2">
                          {matchedActive.map((session) => {
                            const tableNames = session.tablePlays?.filter((tp: any) => !tp.endTime).map((tp: any) => tp.gameType === 'PS4' ? 'PS4' : `${tp.gameType} (T${tp.table?.number || ''})`).join(', ') || 'No Active Table';
                            const ordersTotal = session.orders?.reduce((sum: number, o: any) => sum + o.quantity * (o.menuItem?.price || o.price || 0), 0) || 0;
                            const completedPlaysTotal = session.tablePlays?.filter((tp: any) => tp.endTime).reduce((sum: number, tp: any) => sum + tp.cost, 0) || 0;
                            const staticTotal = ordersTotal + completedPlaysTotal + (session.customAmount || 0) + (session.priorUdhar || 0);
                            return (
                              <div
                                key={session.id}
                                onClick={() => { router.push(`/sessions/${session.id}`); setGlobalSearch(''); }}
                                className="flex items-center justify-between bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-1.5 h-8 rounded-full bg-emerald-400 shrink-0"></span>
                                  <div className="min-w-0">
                                    <p className="font-extrabold text-white text-sm truncate">{session.customerName}</p>
                                    <p className="text-[10px] text-cyan-400 font-semibold font-mono truncate">{tableNames}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-[10px] font-mono font-bold text-slate-400">
                                    {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="font-mono font-extrabold text-emerald-400 text-sm">₹{staticTotal.toFixed(0)}</span>
                                  <Eye className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Completed Sessions Section */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">Completed Sessions</span>
                        <span className="text-[10px] font-bold text-slate-500 font-mono">({matchedCompleted.length})</span>
                      </div>
                      {matchedCompleted.length === 0 ? (
                        <p className="text-xs text-slate-600 font-semibold pl-4">No completed sessions match.</p>
                      ) : (
                        <div className="space-y-2">
                          {matchedCompleted.map((session) => {
                            const formatTime = (d: string | Date) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const formatDate = (d: string | Date) => new Date(d).toLocaleDateString([], { day: '2-digit', month: 'short' });
                            return (
                              <div
                                key={session.id}
                                onClick={() => { router.push(`/sessions/${session.id}`); setGlobalSearch(''); }}
                                className="flex items-center justify-between bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/40 rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-1.5 h-8 rounded-full bg-slate-600 shrink-0"></span>
                                  <div className="min-w-0">
                                    <p className="font-extrabold text-white text-sm truncate">{session.customerName}</p>
                                    <p className="text-[10px] text-slate-400 font-mono truncate">
                                      {session.startTime && session.endTime
                                        ? `${formatTime(session.startTime)} – ${formatTime(session.endTime)} · ${formatDate(session.endTime)}`
                                        : 'Closed'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-mono font-extrabold text-cyan-400 text-sm">₹{(session.totalBill || 0).toFixed(0)}</span>
                                  <Eye className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Active Live Sessions Section */}
        <div>
          <h3 className="text-xs font-extrabold text-slate-400 mb-4 uppercase tracking-widest font-mono">Active Play Sessions</h3>
          {loadingData && activeSessions.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-[#111827] p-5 rounded-2xl border border-slate-800 animate-pulse space-y-4 h-[180px]">
                  <div className="flex justify-between items-center">
                    <div className="h-6 w-24 bg-slate-800 rounded-lg"></div>
                    <div className="h-4 w-16 bg-slate-800 rounded-full"></div>
                  </div>
                  <div className="h-4 w-32 bg-slate-800 rounded-lg"></div>
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="h-3 w-48 bg-slate-800 rounded-lg"></div>
                    <div className="h-3 w-40 bg-slate-800 rounded-lg"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="text-center py-12 bg-[#111827]/60 rounded-2xl border border-slate-800 text-slate-400 font-semibold text-sm">
              No active sessions running. Click <span className="text-cyan-400 font-bold">&quot;Start Session&quot;</span> to open a session.
            </div>
          ) : (() => {
            const playingSessions = activeSessions.filter((s) => s.tablePlays?.some((tp) => !tp.endTime));
            const otherSessions = activeSessions.filter((s) => !s.tablePlays?.some((tp) => !tp.endTime));

            return (
              <div className="space-y-6">
                {/* Playing Sessions */}
                {playingSessions.length > 0 && (
                  <div>
                    {otherSessions.length > 0 && (
                      <div className="flex items-center gap-2 mb-4">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                          Currently Playing ({playingSessions.length})
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {playingSessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          onOrderAdded={fetchData}
                          onAddItemsClick={(sid) => setActiveOrderSessionId(sid)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Separation Line between playing and other active sessions */}
                {playingSessions.length > 0 && otherSessions.length > 0 && (
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-[#0a0d14] px-4 py-1 text-slate-400 font-mono font-bold uppercase tracking-wider rounded-full border border-slate-800 shadow-sm flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        Other Active Sessions · In Lounge ({otherSessions.length})
                      </span>
                    </div>
                  </div>
                )}

                {/* Other Active Sessions (not playing) */}
                {otherSessions.length > 0 && (
                  <div>
                    {playingSessions.length === 0 && (
                      <div className="flex items-center gap-2 mb-4">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                          In Lounge ({otherSessions.length})
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {otherSessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          onOrderAdded={fetchData}
                          onAddItemsClick={(sid) => setActiveOrderSessionId(sid)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Two-Column Layout for Completed Sessions & Udhar Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Completed Sessions Ledger */}
          <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col h-[500px]">
            <h3 className="text-base font-extrabold text-white mb-4 flex items-center justify-between font-display tracking-tight">
              <span>Completed Sessions</span>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-900 text-cyan-400 border border-slate-800">
                {totalCompletedSessions} closed
              </span>
            </h3>
            
            <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-2">
              {loadingData && completedSessions.length === 0 ? (
                [1, 2, 3].map((n) => (
                  <div key={n} className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl animate-pulse flex justify-between items-center gap-4 h-[90px]">
                    <div className="flex-1 space-y-2.5">
                      <div className="h-4 w-28 bg-slate-800 rounded-lg"></div>
                      <div className="h-3 w-40 bg-slate-800 rounded-lg"></div>
                      <div className="flex gap-1">
                        <div className="h-4 w-12 bg-slate-800 rounded-full"></div>
                        <div className="h-4 w-12 bg-slate-800 rounded-full"></div>
                      </div>
                    </div>
                    <div className="h-8 w-8 bg-slate-800 rounded-full shrink-0"></div>
                  </div>
                ))
              ) : completedSessions.length === 0 ? (
                <div className="text-center py-20 text-slate-500 text-sm font-semibold">
                  No completed sessions yet.
                </div>
              ) : (
                completedSessions.map((session) => {
                  const hasCafe = session.orders?.some(
                    (o) => o.menuItem?.category === 'Cafe' || o.menuItem?.category === 'Cold Drinks'
                  );
                  const hasCigarette = session.orders?.some(
                    (o) => o.menuItem?.category === 'Cigarettes'
                  );
                  const hasTable = (session.tablePlays && session.tablePlays.length > 0) || session.gameCost > 0;

                  const formatTime = (dateStr: string | Date) => {
                    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  };
                  const formatDate = (dateStr: string | Date) => {
                    return new Date(dateStr).toLocaleDateString([], { day: '2-digit', month: 'short' });
                  };

                  return (
                    <div 
                      key={session.id} 
                      className="group bg-slate-900/90 border border-slate-800/90 p-3.5 rounded-2xl hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(0,242,254,0.1)] transition-all duration-300 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-white text-sm tracking-tight">{session.customerName}</span>
                          <span className="inline-flex items-center text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-lg shrink-0">
                            ₹{(session.totalBill || 0).toFixed(2)}
                          </span>
                        </div>
                        
                        <p className="text-[10px] text-slate-400 font-mono mt-1.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span>
                            {session.startTime && session.endTime ? (
                              `${formatTime(session.startTime)} - ${formatTime(session.endTime)} · ${formatDate(session.endTime)}`
                            ) : (
                              'Closed'
                            )}
                          </span>
                        </p>
                        
                        {/* Minimalist cyber tags */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {hasTable && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                              <Gamepad2 className="h-2.5 w-2.5 text-cyan-400" />
                              Table
                            </span>
                          )}
                          {hasCafe && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40">
                              <Coffee className="h-2.5 w-2.5 text-amber-400" />
                              Café
                            </span>
                          )}
                          {hasCigarette && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/40">
                              <Cigarette className="h-2.5 w-2.5 text-rose-400" />
                              Smoke
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Circular view button */}
                      <button
                        onClick={() => router.push(`/sessions/${session.id}`)}
                        title="View Session Details"
                        className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-cyan-500 hover:text-black hover:border-cyan-400 transition-all duration-300 shrink-0 shadow-sm flex items-center justify-center group-hover:scale-105"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
              {totalCompletedSessions > completedSessions.length && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => router.push('/sessions/completed')}
                    className="inline-flex items-center justify-center px-4 py-2 border border-slate-800 text-xs font-bold uppercase tracking-wider rounded-xl text-slate-300 bg-slate-900 hover:bg-slate-800 hover:border-cyan-500/50 transition-all duration-300 w-full shadow-sm"
                  >
                    More Completed Sessions...
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Udhar Ledger Ledger */}
          <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col h-[500px]">
            <h3 className="text-base font-extrabold text-white mb-4 flex items-center justify-between font-display tracking-tight">
              <span className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-cyan-400" />
                <span>Udhar Ledger</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-900 text-rose-400 border border-slate-800">
                  {totalDebtors} debtors
                </span>
                <button
                  onClick={() => setShowAddUdhar(true)}
                  className="text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <PlusCircle className="h-4 w-4" />
                  Log Udhar
                </button>
              </div>
            </h3>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-2">
              {loadingData && groupedUdharsList.length === 0 ? (
                [1, 2].map((n) => (
                  <div key={n} className="border border-slate-800 rounded-xl bg-slate-900 p-4 animate-pulse space-y-3 shadow-sm h-[135px]">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <div className="space-y-1.5">
                        <div className="h-4 w-24 bg-slate-800 rounded-lg"></div>
                        <div className="h-3 w-12 bg-slate-800 rounded-lg"></div>
                      </div>
                      <div className="h-6 w-28 bg-slate-800 rounded-lg"></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="h-3 w-20 bg-slate-800 rounded-lg"></div>
                      <div className="h-4 w-12 bg-slate-800 rounded-lg"></div>
                    </div>
                  </div>
                ))
              ) : groupedUdharsList.length === 0 ? (
                <div className="text-center py-20 text-slate-500 text-sm font-semibold">
                  No outstanding debts in ledger.
                </div>
              ) : (
                groupedUdharsList.map((group) => (
                  <div key={group.customerName} className="border border-slate-800/90 rounded-2xl overflow-hidden bg-slate-900/60 shadow-md">
                    {/* Customer Group Header */}
                    <div className="flex justify-between items-center p-3 bg-slate-900 border-b border-slate-800">
                      <div>
                        <h4 className="font-extrabold text-white text-sm tracking-tight">{group.customerName}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                        </p>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl border ${
                        group.totalOutstanding > 0 
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]' 
                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {group.totalOutstanding > 0 ? `Outstanding: ₹${group.totalOutstanding.toFixed(2)}` : 'Settled'}
                      </span>
                    </div>

                    {/* Customer Group Entries */}
                    <div className="p-2 space-y-2">
                      {group.entries.map((udhar) => (
                        <div 
                          key={udhar.id} 
                          className={`flex justify-between items-center p-2.5 rounded-xl border text-xs bg-slate-900 ${
                            udhar.status === 'paid' 
                              ? 'border-emerald-500/30 text-emerald-300' 
                              : 'border-rose-500/30 text-rose-300'
                          }`}
                        >
                          <div>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Logged: {new Date(udhar.createdAt).toLocaleDateString()}
                            </p>
                            {udhar.sessionId && (
                              <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                                Ref: {udhar.sessionId.slice(-12)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-extrabold ${udhar.status === 'paid' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              ₹{udhar.amount.toFixed(2)}
                            </span>
                            {udhar.status === 'unpaid' && (
                              <button
                                onClick={() => handleSettleUdhar(udhar.id)}
                                className="bg-emerald-950/80 hover:bg-emerald-500 hover:text-black text-emerald-300 border border-emerald-500/50 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-0.5 transition-all shadow-sm"
                              >
                                <Check className="h-3 w-3" />
                                Settle
                              </button>
                            )}
                            {udhar.status === 'paid' && (
                              <span className="text-[9px] font-extrabold text-emerald-400 uppercase bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-800 font-mono">
                                Paid
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {totalDebtors > 10 && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => router.push('/ledger')}
                    className="inline-flex items-center justify-center px-4 py-2 border border-slate-800 text-xs font-bold uppercase tracking-wider rounded-xl text-slate-300 bg-slate-900 hover:bg-slate-800 hover:border-cyan-500/50 transition-all duration-300 w-full shadow-sm"
                  >
                    More Udhar Ledger Entries...
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

      </main>


      {/* Modals */}
      {showNewSession && (
        <NewSessionModal
          tables={tables}
          staffUsername={user.username}
          udhars={groupedUdharsList}
          activeSessions={activeSessions}
          onClose={() => setShowNewSession(false)}
          onSuccess={(session) => {
            setShowNewSession(false);
            router.push(`/sessions/${session.id}`);
          }}
        />
      )}

      {showBookTable && (
        <BookTableModal
          tables={tables}
          onClose={() => setShowBookTable(false)}
          onSuccess={() => {
            setShowBookTable(false);
            fetchData();
          }}
        />
      )}

      {/* Log Manual Udhar Modal */}
      {showAddUdhar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#111827] rounded-3xl border border-slate-800 w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-white font-display uppercase tracking-wide">Log New Udhar</h2>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">Search customer or enter new name</p>
              </div>
              <button onClick={() => setShowAddUdhar(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {udharError && (
              <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-3 rounded-xl border border-rose-500/40">
                {udharError}
              </div>
            )}

            <form onSubmit={handleCreateUdhar} className="space-y-4">
              {/* Customer Name Search & Input */}
              <div className="relative">
                <label className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
                  <span>Customer Name <span className="text-cyan-400">*</span></span>
                  {newUdharCustomer && udharSuggestions.length === 0 && (
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40 uppercase">
                      New Customer
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Search existing customer (e.g. Ayush)..."
                  value={newUdharCustomer}
                  onChange={(e) => {
                    setNewUdharCustomer(e.target.value);
                    setShowUdharSuggestions(true);
                  }}
                  onFocus={() => setShowUdharSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowUdharSuggestions(false), 200)}
                  className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
                />

                {/* Autocomplete Suggestions Dropdown */}
                {showUdharSuggestions && udharSuggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 z-50 mt-1.5 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.9)] max-h-52 overflow-y-auto divide-y divide-slate-800">
                    <div className="px-3.5 py-2 text-[10px] font-mono font-bold uppercase text-slate-400 bg-slate-950/90 flex justify-between items-center sticky top-0">
                      <span>Matching Customers ({udharSuggestions.length})</span>
                      <span className="text-[9px] text-cyan-400">Click to select</span>
                    </div>
                    {udharSuggestions.map((c, idx) => (
                      <li
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setNewUdharCustomer(c.customerName);
                          setShowUdharSuggestions(false);
                        }}
                        className="px-3.5 py-2.5 text-xs text-slate-200 hover:bg-slate-800 hover:text-cyan-300 cursor-pointer font-semibold flex justify-between items-center transition-colors"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-bold text-white truncate">{c.customerName}</span>
                          {c.customerPhone && (
                            <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                              📱 {c.customerPhone}
                            </span>
                          )}
                        </div>
                        {c.outstanding && c.outstanding > 0 ? (
                          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-500/40 shrink-0">
                            Debt: ₹{c.outstanding.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-500/30 shrink-0">
                            No Debt
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Existing Debt Notice */}
              {selectedCustomerUdhar && selectedCustomerUdhar.outstanding && selectedCustomerUdhar.outstanding > 0 && (
                <div className="text-xs text-amber-300 bg-amber-950/60 p-3 rounded-xl border border-amber-500/40 leading-relaxed font-medium space-y-1">
                  <div>
                    ⚠️ <b>{selectedCustomerUdhar.customerName}</b> currently has an existing debt of{' '}
                    <b className="font-mono text-amber-200">₹{selectedCustomerUdhar.outstanding.toFixed(2)}</b>.
                  </div>
                  {newUdharAmount && parseFloat(newUdharAmount) > 0 && (
                    <div className="text-[11px] font-mono text-amber-200/90 pt-0.5 border-t border-amber-500/20">
                      Total debt will increase to: <b>₹{(selectedCustomerUdhar.outstanding + parseFloat(newUdharAmount)).toFixed(2)}</b>
                    </div>
                  )}
                </div>
              )}

              {/* Outstanding Amount */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
                  Outstanding Amount (₹) <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="e.g. 500"
                  value={newUdharAmount}
                  onChange={(e) => setNewUdharAmount(e.target.value)}
                  className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold font-mono"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowAddUdhar(false)}
                  className="inline-flex justify-center items-center px-4 py-2.5 border border-slate-800 text-xs font-bold uppercase tracking-wider rounded-xl text-slate-300 bg-slate-900 hover:bg-slate-800 transition-all custom-button"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center items-center px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_15px_rgba(0,242,254,0.3)] transition-all custom-button"
                >
                  Log Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Sessions Quick-Peek Drawer */}
      {showActiveDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" 
            onClick={() => setShowActiveDrawer(false)}
          ></div>
          
          {/* Drawer Panel */}
          <div className="relative w-full max-w-sm bg-[#0e131f] border-l border-slate-800 h-full shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 bg-[#111827] border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-lg font-extrabold text-white font-display tracking-tight uppercase">Live Sessions</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">Quick overview of active lounge sessions</p>
              </div>
              <button 
                onClick={() => setShowActiveDrawer(false)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="px-5 pt-4 shrink-0 bg-[#0e131f]">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
                <input
                  type="text"
                  placeholder="Search by customer name..."
                  value={liveSessionSearch}
                  onChange={(e) => setLiveSessionSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 bg-slate-900 text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeSessions.length === 0 ? (
                <div className="text-center py-10 bg-[#111827] border border-slate-800 rounded-2xl shadow-sm">
                  <p className="text-slate-400 text-xs font-semibold">No active sessions running.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeSessions
                    .filter(session => session.customerName.toLowerCase().includes(liveSessionSearch.toLowerCase()))
                    .map((session) => {
                    const tableNames = session.tablePlays?.filter(tp => !tp.endTime).map(tp => tp.gameType === 'PS4' ? 'PS4' : `${tp.gameType} (Table ${tp.table?.number || ''})`).join(', ') || 'No Active Table';
                    
                    const ordersTotal = session.orders?.reduce((sum, o) => sum + o.quantity * (o.menuItem?.price || o.price || 0), 0) || 0;
                    const completedPlaysTotal = session.tablePlays?.filter(tp => tp.endTime).reduce((sum, tp) => sum + tp.cost, 0) || 0;
                    const staticTotal = ordersTotal + completedPlaysTotal + (session.customAmount || 0) + (session.priorUdhar || 0);

                    return (
                      <div key={session.id} className="bg-[#111827] border border-slate-800 rounded-2xl p-3.5 shadow-md relative overflow-hidden group hover:border-cyan-500/50 transition-all">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400"></div>
                        <div className="flex justify-between items-start ml-2">
                          <div className="min-w-0 pr-8">
                            <p className="font-extrabold text-white text-sm truncate pr-2">{session.customerName}</p>
                            <p className="text-xs text-cyan-400 font-semibold mt-0.5 truncate pr-2">{tableNames}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                                Active
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 pl-2">
                            <p className="font-mono font-extrabold text-white text-sm glow-text-cyan">
                              ₹{staticTotal.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {/* Absolute Bottom Right Eye Button */}
                        <button
                          onClick={() => router.push(`/sessions/${session.id}`)}
                          className="absolute bottom-2 right-2 p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
                          title="View Session Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Items Modal */}
      {activeOrderSessionId && (
        <AddOrderModal
          sessionId={activeOrderSessionId}
          onClose={() => setActiveOrderSessionId(null)}
          onSuccess={() => {
            setActiveOrderSessionId(null);
            fetchData();
          }}
        />
      )}

    </div>
  );
}
