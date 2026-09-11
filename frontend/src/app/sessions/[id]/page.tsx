'use client';

import React, { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { api } from '../../../lib/api';
import { Session, Order, Table, TablePlay } from '../../../types';
import { Navbar } from '../../../components/Navbar';
import { AddOrderModal } from '../../../components/AddOrderModal';
import { RecordPaymentModal } from '../../../components/RecordPaymentModal';
import { CloseSessionModal } from '../../../components/CloseSessionModal';
import {
  ArrowLeft,
  Clock,
  Calendar,
  CreditCard,
  CheckCircle,
  Trash2,
  User,
  Phone,
  AlertCircle,
  ShoppingBag,
  Cigarette,
  GlassWater,
  Coffee,
  Gamepad2,
  Plus,
  Play,
  StopCircle,
  Printer,
  MessageCircle,
} from 'lucide-react';

const dateToTimeInput = (date: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const timeToDate = (timeStr: string, referenceDate: Date = new Date()): Date => {
  if (!timeStr) return new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(referenceDate);
  d.setHours(h, m, 0, 0);
  if (d.getTime() > Date.now() + 30 * 60000) {
    d.setDate(d.getDate() - 1);
  }
  return d;
};

const GAME_RATES: Record<string, number> = {
  Pool: 160,
  MidSnooker: 220,
  PS4: 80,
  None: 0,
};

const GAME_LABELS: Record<string, string> = {
  Pool: 'Pool (₹160/hr)',
  MidSnooker: 'Mid Snooker (₹220/hr)',
  PS4: 'PS4 (₹80/person/hr)',
  None: 'Café Only',
};

// ─── Category Section Component ─────────────────────────────────────────────
interface CategorySectionProps {
  title: string;
  icon: React.ReactNode;
  orders: Order[];
  isActive: boolean;
  onDelete: (id: number) => void;
  accentClass: string;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  title,
  icon,
  orders,
  isActive,
  onDelete,
  accentClass,
}) => {
  const total = orders.reduce((sum, o) => sum + o.quantity * o.price, 0);

  const groupedOrders = React.useMemo(() => {
    const groups: Record<number, {
      menuItemId: number;
      name: string;
      totalQuantity: number;
      price: number;
      items: Order[];
    }> = {};

    orders.forEach((o) => {
      if (!o.menuItem) return;
      const key = o.menuItemId;
      if (!groups[key]) {
        groups[key] = {
          menuItemId: key,
          name: o.menuItem.name,
          totalQuantity: 0,
          price: o.price,
          items: [],
        };
      }
      groups[key].totalQuantity += o.quantity;
      groups[key].items.push(o);
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  if (orders.length === 0) return null;

  return (
    <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-3.5 border-b border-slate-800 rounded-t-2xl ${accentClass}`}>

        <div className="flex items-center gap-2 font-semibold text-sm">
          {icon}
          <span>{title}</span>
          <span className="text-xs font-medium opacity-75 ml-1">
            ({orders.reduce((s, o) => s + o.quantity, 0)} items)
          </span>
        </div>
        <span className="font-bold text-sm">₹{total.toFixed(2)}</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-800">
        {groupedOrders.map((group) => {
          const hasMultiple = group.items.length > 1;
          return (
            <div key={group.menuItemId} className="flex items-center justify-between px-5 py-3.5 text-sm hover:bg-slate-900/60 transition-colors last:rounded-b-2xl">
              <div className="flex-1 min-w-0">
                <div className="relative group inline-flex items-center gap-2">
                  <span className="font-bold text-white cursor-help">{group.name}</span>
                  <span className="text-slate-400 font-mono font-semibold">× {group.totalQuantity}</span>
                  
                  {/* Order count timeline trigger badge */}
                  <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 font-mono cursor-help select-none">
                    <Clock className="h-2.5 w-2.5 text-cyan-400" />
                    {group.items.length} order{hasMultiple ? 's' : ''}
                  </span>

                  {/* Timeline Hover Popover Wrapper (bridges the hover gap) */}
                  <div className="absolute left-0 bottom-full pb-2 hidden group-hover:block z-50">
                    <div className="bg-[#0e131f] text-white text-xs rounded-xl p-3 shadow-2xl w-60 space-y-2 border border-slate-700 cursor-default relative">
                      <p className="font-extrabold text-[9px] text-cyan-400 border-b border-slate-800 pb-1.5 uppercase tracking-wider font-mono">
                        Order Timeline
                      </p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {group.items.map((item) => {
                          const t = item.createdAt ? new Date(item.createdAt) : new Date();
                          const tStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-3 text-[11px] font-mono">
                              <span className="text-slate-300 truncate" title={group.name}>{item.quantity} {group.name}</span>
                              <span className="text-slate-400 whitespace-nowrap shrink-0">{tStr}</span>
                              {isActive && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(item.id);
                                  }}
                                  className="text-rose-400 hover:text-rose-300 p-0.5 rounded transition-colors"
                                  title="Delete this order"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Tooltip Arrow */}
                      <div className="absolute top-full left-6 w-2 h-2 bg-[#0e131f] border-r border-b border-slate-700 transform rotate-45 -translate-y-1"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 ml-4">
                <span className="font-mono font-bold text-white text-sm">
                  ₹{(group.totalQuantity * group.price).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TablePlaySectionProps {
  tablePlays: TablePlay[];
  isActive: boolean;
  activePlayElapsed: string;
  onEndPlay: (tablePlayId?: number) => void;
  onDeletePlay?: (tablePlayId: number) => void;
}

const TablePlaySection: React.FC<TablePlaySectionProps> = ({
  tablePlays,
  isActive,
  activePlayElapsed,
  onEndPlay,
  onDeletePlay,
}) => {
  if (!tablePlays || tablePlays.length === 0) return null;

  const completedPlaysTotal = tablePlays.filter((tp) => tp.endTime).reduce((sum, tp) => sum + tp.cost, 0);
  const totalCost = completedPlaysTotal;

  return (
    <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-purple-950/40 text-purple-300 border-b border-purple-500/30 rounded-t-2xl">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Gamepad2 className="h-4 w-4 text-purple-400" />
          <span>Table & Game Play History</span>
          <span className="text-xs font-medium opacity-75 ml-1">
            ({tablePlays.length} Frame{tablePlays.length !== 1 ? 's' : ''})
          </span>
        </div>
        <span className="font-mono font-bold text-sm text-purple-300">₹{totalCost.toFixed(2)}</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-800">
        {tablePlays.map((tp) => {
          const isLive = !tp.endTime;
          let durStr = '';
          let costStr = '';

          if (isLive) {
            durStr = activePlayElapsed || 'Running...';
            costStr = 'Running...';
          } else {
            const durMs = new Date(tp.endTime!).getTime() - new Date(tp.startTime).getTime();
            const hrs = durMs / 3600000;
            const mins = Math.round((durMs % 3600000) / 60000);
            durStr = hrs >= 1
              ? `${Math.floor(hrs)}h ${mins}m`
              : `${mins}m`;
            costStr = `₹${tp.cost.toFixed(2)}`;
          }

          const label = tp.gameType === 'PS4'
            ? `PS4 (${tp.playerCount} Player${tp.playerCount > 1 ? 's' : ''})`
            : `${tp.gameType}${tp.table ? ` (Table ${tp.table.number})` : ''}`;

          return (
            <div key={tp.id} className="flex items-center justify-between px-5 py-3.5 text-sm hover:bg-slate-900/60 transition-colors last:rounded-b-2xl">
              <div className="flex-1 min-w-0">
                <div className="relative group inline-flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white cursor-help">{label}</span>
                  <span className={`text-slate-400 font-mono font-semibold ${isLive ? 'animate-pulse text-purple-400' : ''}`}>
                    × {durStr}
                  </span>
                  
                  {/* Start time badge */}
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-300 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 font-mono cursor-help select-none">
                    <Clock className="h-2.5 w-2.5 text-purple-400" />
                    Timeline
                  </span>

                  {isLive && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse uppercase tracking-wider">
                      LIVE
                    </span>
                  )}

                  {/* Timeline Hover Popover Wrapper */}
                  <div className="absolute left-0 bottom-full pb-2 hidden group-hover:block z-50">
                    <div className="bg-[#0e131f] text-white text-xs rounded-xl p-3 shadow-2xl w-60 space-y-2 border border-slate-700 cursor-default relative">
                      <p className="font-extrabold text-[9px] text-purple-400 border-b border-slate-800 pb-1.5 uppercase tracking-wider font-mono">
                        Play Timeline
                      </p>
                      <div className="space-y-1.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Started</span>
                          <span className="text-emerald-400 font-bold whitespace-nowrap shrink-0">
                            {new Date(tp.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {!isLive && tp.endTime && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Ended</span>
                            <span className="text-rose-400 font-bold whitespace-nowrap shrink-0">
                              {new Date(tp.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="absolute top-full left-6 w-2 h-2 bg-[#0e131f] border-r border-b border-slate-700 transform rotate-45 -translate-y-1"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 ml-4 shrink-0">
                <span className={`font-mono font-bold ${isLive ? 'text-purple-400 animate-pulse' : 'text-white'}`}>
                  {costStr}
                </span>
                {isLive && isActive && (
                  <button
                    onClick={() => onEndPlay(tp.id)}
                    className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-500/50 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Stop this game play"
                  >
                    <StopCircle className="h-3 w-3 text-rose-400 group-hover:text-white" />
                    Stop
                  </button>
                )}
                {isActive && onDeletePlay && (
                  <button
                    onClick={() => onDeletePlay(tp.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 border border-transparent hover:border-rose-500/30 rounded-lg transition-all shrink-0 cursor-pointer"
                    title="Delete this table play"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SessionDetailsPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const fetchSessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: session, mutate, error: sessionError } = useSWR<Session>(
    token && sessionId ? `/sessions/${sessionId}` : null,
    (url: string) => api.get(url),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    }
  );

  const { data: tablesData, mutate: mutateTables } = useSWR<Table[]>(
    token ? '/dashboard/tables' : null,
    (url: string) => api.get(url),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const tables = tablesData || [];
  const loading = !session && !sessionError;

  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showCloseSession, setShowCloseSession] = useState(false);
  const [showUdharForm, setShowUdharForm] = useState(false);
  const [udharCustomer, setUdharCustomer] = useState('');
  const [udharLoading, setUdharLoading] = useState(false);

  // Play start form states
  const [playGameType, setPlayGameType] = useState('Pool');
  const [playTableId, setPlayTableId] = useState('');
  const [playPlayerCount, setPlayPlayerCount] = useState('1');
  const [playLoading, setPlayLoading] = useState(false);
  const [startTimeStr, setStartTimeStr] = useState(() => dateToTimeInput());
  const [endTimeStr, setEndTimeStr] = useState('');
  const [showEndField, setShowEndField] = useState(false);
  const [stopPlayTarget, setStopPlayTarget] = useState<TablePlay | null>(null);
  const [stopPlayTimeStr, setStopPlayTimeStr] = useState(() => dateToTimeInput());

  // Live timers — initialize immediately from session data to avoid blank flash
  const [elapsed, setElapsed] = useState(() => {
    if (!session) return '';
    const start = new Date(session.startTime).getTime();
    const end = session.endTime ? new Date(session.endTime).getTime() : Date.now();
    const diffMs = end - start;
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    const s = Math.floor((diffMs % 60000) / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  });
  const [activePlayElapsed, setActivePlayElapsed] = useState('');

  // WhatsApp sending states
  const [waLoading, setWaLoading] = useState(false);
  const [waStatus, setWaStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchSessionDebounced = () => {
    if (fetchSessionTimeoutRef.current) {
      clearTimeout(fetchSessionTimeoutRef.current);
    }
    fetchSessionTimeoutRef.current = setTimeout(() => {
      mutate();
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (fetchSessionTimeoutRef.current) {
        clearTimeout(fetchSessionTimeoutRef.current);
      }
    };
  }, []);

  useWebSocket((message) => {
    if (
      message.type?.startsWith('SESSION_') || 
      message.type?.startsWith('TABLE_PLAY_') ||
      message.type?.startsWith('ORDER_') ||
      message.type?.startsWith('PAYMENT_') ||
      message.type?.startsWith('UDHAR_')
    ) {
      fetchSessionDebounced();
    }
  });

  // Overall session duration timer — consistent HH:MM:SS format for both active and completed
  useEffect(() => {
    if (!session) return;

    const computeElapsed = () => {
      const start = new Date(session.startTime).getTime();
      // For completed sessions use the frozen endTime; for active use live clock
      const end = (session.status === 'completed' && session.endTime)
        ? new Date(session.endTime).getTime()
        : Date.now();
      const diffMs = Math.max(0, end - start);
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    };

    // Set immediately so there is never a blank or stale flash
    setElapsed(computeElapsed());

    // Only tick for active sessions; completed sessions are frozen
    if (session.status === 'completed') return;

    const iv = setInterval(() => setElapsed(computeElapsed()), 1000);
    return () => clearInterval(iv);
  }, [session]);

  // Active table play elapsed timer
  useEffect(() => {
    if (!session) return;
    const activePlay = session.tablePlays?.find((tp) => !tp.endTime);
    if (!activePlay) {
      setActivePlayElapsed('');
      return;
    }
    const tick = () => {
      const start = new Date(activePlay.startTime).getTime();
      const diffMs = Date.now() - start;
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setActivePlayElapsed(`${pad(h)}:${pad(m)}:${pad(s)}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [session]);

  const handleDeleteOrder = async (orderId: number) => {
    if (!confirm('Remove this item from the bill?')) return;
    if (!session) return;

    const updatedOrders = session.orders?.filter(o => o.id !== orderId) || [];
    const menuCost = updatedOrders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
    mutate({
      ...session,
      orders: updatedOrders,
      menuCost,
      totalBill: menuCost + session.gameCost + (session.customAmount || 0)
    }, false);

    try {
      await api.delete(`/orders/${orderId}`);
      mutate();
    } catch (e: any) {
      alert(e.message || 'Failed to remove order');
      mutate();
    }
  };

  const handleStartTablePlay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playGameType || !user || !session) return;
    if ((playGameType === 'Pool' || playGameType === 'MidSnooker') && !playTableId) {
      alert('Please select a billiard table');
      return;
    }

    const startDate = timeToDate(startTimeStr);
    const parsedStartISO = startDate.toISOString();
    let parsedEndISO: string | undefined = undefined;

    if (showEndField && endTimeStr) {
      const endDate = timeToDate(endTimeStr);
      if (endDate.getTime() <= startDate.getTime()) {
        alert('End time must be after start time');
        return;
      }
      parsedEndISO = endDate.toISOString();
    }

    setPlayLoading(true);

    const currentTableId = playTableId ? parseInt(playTableId) : null;
    const resolvedPlayerCount = playGameType === 'PS4' ? parseInt(playPlayerCount) : 1;
    
    // Only perform optimistic live update if not adding an already-completed play
    if (!parsedEndISO) {
      const optimisticPlay: TablePlay = {
        id: Date.now(),
        sessionId,
        tableId: currentTableId,
        table: currentTableId ? tables.find(t => t.id === currentTableId) : undefined,
        gameType: playGameType,
        playerCount: resolvedPlayerCount,
        startTime: parsedStartISO,
        endTime: undefined,
        cost: 0,
        createdBy: user.username
      };

      const updatedTablePlays = [...(session.tablePlays || []), optimisticPlay];
      
      mutate({
        ...session,
        tableId: currentTableId,
        gameType: playGameType,
        playerCount: resolvedPlayerCount,
        tablePlays: updatedTablePlays
      }, false);
    }

    try {
      await api.post(`/sessions/${sessionId}/table/start`, {
        gameType: playGameType,
        tableId: playTableId ? parseInt(playTableId) : null,
        playerCount: playGameType === 'PS4' ? parseInt(playPlayerCount) : 1,
        staffUsername: user.username,
        startTime: parsedStartISO,
        endTime: parsedEndISO,
      });
      mutate();
      mutateTables();
      setPlayGameType('Pool');
      setPlayTableId('');
      setPlayPlayerCount('1');
      setStartTimeStr(dateToTimeInput());
      setEndTimeStr('');
      setShowEndField(false);
    } catch (err: any) {
      alert(err.message || 'Failed to start table play');
      mutate();
      mutateTables();
    } finally {
      setPlayLoading(false);
    }
  };

  const handleEndTablePlay = (targetPlayId?: number) => {
    if (!session) return;
    const activePlays = session.tablePlays?.filter((tp) => !tp.endTime) || [];
    const targetPlay = targetPlayId
      ? activePlays.find((tp) => tp.id === targetPlayId)
      : activePlays[0];

    if (!targetPlay) return;

    setStopPlayTarget(targetPlay);
    setStopPlayTimeStr(dateToTimeInput());
  };

  const confirmEndTablePlay = async () => {
    if (!session || !stopPlayTarget) return;

    const endDate = timeToDate(stopPlayTimeStr);
    const endMs = endDate.getTime();
    const startMs = new Date(stopPlayTarget.startTime).getTime();
    if (isNaN(endMs) || endMs <= startMs) {
      alert('End time must be after start time');
      return;
    }

    setPlayLoading(true);

    const endTimeISO = endDate.toISOString();
    const elapsedMs = endMs - startMs;
    const elapsedHours = elapsedMs / 3600000;
    const rate = GAME_RATES[stopPlayTarget.gameType] || 0;
    const calculatedCost = Math.round(stopPlayTarget.gameType === 'PS4'
      ? rate * stopPlayTarget.playerCount * elapsedHours
      : rate * elapsedHours);

    const updatedTablePlays = session.tablePlays?.map(tp => 
      tp.id === stopPlayTarget.id ? { ...tp, endTime: endTimeISO, cost: calculatedCost } : tp
    ) || [];

    mutate({
      ...session,
      gameCost: session.gameCost + calculatedCost,
      tablePlays: updatedTablePlays
    }, false);

    try {
      await api.post(`/sessions/${sessionId}/table/end`, {
        tablePlayId: stopPlayTarget.id,
        endTime: endTimeISO,
      });
      setStopPlayTarget(null);
      mutate();
      mutateTables();
    } catch (err: any) {
      alert(err.message || 'Failed to end table play');
      mutate();
      mutateTables();
    } finally {
      setPlayLoading(false);
    }
  };

  const handleDeleteTablePlay = async (tablePlayId: number) => {
    if (!confirm('Are you sure you want to delete this table play? This will free the table and remove it from the bill.')) return;
    if (!session) return;

    const updatedPlays = session.tablePlays?.filter((tp) => tp.id !== tablePlayId) || [];
    const remainingCompletedCost = updatedPlays.filter((tp) => tp.endTime).reduce((sum, tp) => sum + (tp.cost || 0), 0);
    const newTotalBill = Math.max(0, session.menuCost + remainingCompletedCost + (session.customAmount || 0));

    // Optimistic UI update
    mutate({
      ...session,
      tablePlays: updatedPlays,
      gameCost: remainingCompletedCost,
      totalBill: newTotalBill
    }, false);

    try {
      await api.delete(`/sessions/${session.id}/table-play/${tablePlayId}`);
      mutate();
      mutateTables();
    } catch (e: any) {
      alert(e.message || 'Failed to delete table play');
      mutate();
      mutateTables();
    }
  };

  const handleLogToUdhar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !udharCustomer) return;
    setUdharLoading(true);
    try {
      const remaining = Math.max(0, netDue);
      await api.post('/udhar', {
        customerName: udharCustomer,
        amount: remaining,
        sessionId: session.id,
      });
      mutate();
      setShowUdharForm(false);
    } catch (err: any) {
      alert(err.message || 'Failed to log udhar');
    } finally {
      setUdharLoading(false);
    }
  };

  if (authLoading || (!user && !sessionError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0d14]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0d14] text-white p-6 space-y-4">
        <div className="bg-[#111827] border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <AlertCircle className="h-12 w-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-extrabold font-display">Session Not Found</h2>
          <p className="text-sm text-slate-400">
            {sessionError.message || 'Unable to load details for this session. It may have been removed or database connection failed.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0d14]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const cigaretteOrders = session.orders?.filter((o) => o.menuItem?.category === 'Cigarettes') || [];
  const coldDrinkOrders = session.orders?.filter((o) => o.menuItem?.category === 'Cold Drinks') || [];
  const cafeOrders = session.orders?.filter((o) => o.menuItem?.category === 'Cafe') || [];

  const cigaretteTotal = cigaretteOrders.reduce((s, o) => s + o.quantity * o.price, 0);
  const coldDrinkTotal = coldDrinkOrders.reduce((s, o) => s + o.quantity * o.price, 0);
  const cafeTotal = cafeOrders.reduce((s, o) => s + o.quantity * o.price, 0);
  const menuTotal = cigaretteTotal + coldDrinkTotal + cafeTotal;

  // Calculate table play costs
  const completedPlaysTotal = session.tablePlays?.filter((tp) => tp.endTime).reduce((s, tp) => s + tp.cost, 0) || 0;
  const gameTotal = completedPlaysTotal;

  const paymentsTotal = session.payments?.reduce((s, p) => s + p.amount, 0) || 0;

  const todaysTotal = session.status === 'completed' ? session.totalBill : (menuTotal + gameTotal + (session.customAmount || 0));
  const priorOutstanding = session.priorUdhar || 0;
  const amountPaid = paymentsTotal;

  const totalPayable = todaysTotal + priorOutstanding;
  const netDue = Math.max(0, totalPayable - amountPaid);
  const displayTotal = totalPayable;
  const netOutstanding = netDue;
  const originalPriorOutstanding = priorOutstanding;
  const remainingPriorOutstanding = Math.min(priorOutstanding, netDue);
  const todayOutstanding = Math.max(0, todaysTotal - amountPaid);

  const isActive = session.status === 'active';
  const hasOrders =
    cigaretteOrders.length > 0 || coldDrinkOrders.length > 0 || cafeOrders.length > 0;

  // Active table play details
  const activePlay = session.tablePlays?.find((tp) => !tp.endTime);
  const isTableActive = !!activePlay;

  const hasTableActivity = (session.tablePlays && session.tablePlays.length > 0) || isTableActive;
  const hasActivity = hasOrders || hasTableActivity;

  const availableTables = tables.filter((t) => t.status === 'available' && t.gameType === playGameType);

  const handlePrintReceipt = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      alert('Please allow popups to print the receipt.');
      return;
    }

    const completedGamesCost = session.tablePlays?.filter((tp) => tp.endTime).reduce((s, tp) => s + tp.cost, 0) || 0;
    
    let activeGameCost = 0;
    if (isTableActive && activePlay) {
      const elapsedMs = Date.now() - new Date(activePlay.startTime).getTime();
      const hours = elapsedMs / 3600000;
      const rate = GAME_RATES[activePlay.gameType] || 0;
      activeGameCost = Math.round(activePlay.gameType === 'PS4'
        ? rate * activePlay.playerCount * hours
        : rate * hours);
    }

    const currentTableTotal = completedGamesCost + activeGameCost;
    const currentSubtotal = menuTotal + currentTableTotal;

    const receiptHtml = `
      <html>
      <head>
        <title>Receipt_${session.customerName}</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.3;
            width: 72mm;
            margin: 0 auto;
            padding: 6mm 4mm;
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .flex-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .space { margin: 12px 0; }
          .header { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
          @media print {
            body { 
              width: 72mm; 
              margin: 0 auto; 
              padding: 4mm 2mm; 
            }
            @page { 
              size: 80mm auto; 
              margin: 0; 
            }
          }
        </style>
      </head>
      <body>
        <div class="text-center header">REBOUND CAFE & BILLIARDS</div>
        <div class="text-center">Receipt Summary</div>
        <div class="divider"></div>
        <div class="flex-row"><span>Date:</span> <span>${new Date(session.startTime).toLocaleDateString()} ${new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div class="flex-row"><span>Customer:</span> <span>${session.customerName}</span></div>
        ${session.customerPhone ? `<div class="flex-row"><span>Phone:</span> <span>${session.customerPhone}</span></div>` : ''}
        <div class="flex-row"><span>Session ID:</span> <span>${session.id}</span></div>
        <div class="divider"></div>
        
        <!-- Orders -->
        ${(session.orders && session.orders.length > 0) ? (() => {
          const receiptGroups: Record<number, { name: string; totalQty: number; price: number }> = {};
          session.orders.forEach(o => {
            if (!o.menuItem) return;
            const key = o.menuItemId;
            if (!receiptGroups[key]) {
              receiptGroups[key] = {
                name: o.menuItem.name,
                totalQty: 0,
                price: o.price
              };
            }
            receiptGroups[key].totalQty += o.quantity;
          });

          return Object.values(receiptGroups).map(g => `
            <div class="flex-row">
              <span class="bold">${g.name} x ${g.totalQty}</span>
              <span>₹${(g.totalQty * g.price).toFixed(2)}</span>
            </div>
          `).join('');
        })() : ''}

        <!-- Table Plays with Space Separation -->
        ${(session.tablePlays && session.tablePlays.length > 0) ? `
          <div class="space"></div>
          <div class="divider"></div>
          ${session.tablePlays.map(tp => {
            let durMins = 0;
            let cost = tp.cost;
            if (tp.endTime) {
              const diff = new Date(tp.endTime).getTime() - new Date(tp.startTime).getTime();
              durMins = Math.round(diff / 60000);
            } else {
              const diff = Date.now() - new Date(tp.startTime).getTime();
              durMins = Math.round(diff / 60000);
              cost = activeGameCost;
            }
            const label = tp.gameType === 'PS4'
              ? `PS4 (${tp.playerCount} Players)`
              : `${tp.gameType}${tp.table ? ` (Table ${tp.table.number})` : ''}`;
            
            return `
              <div class="flex-row">
                <span>${label} (${durMins}m)</span>
                <span>₹${cost.toFixed(2)}</span>
              </div>
            `;
          }).join('')}
        ` : ''}

        <div class="divider"></div>
        
        <!-- Totals -->
        <div class="flex-row">
          <span>Today's Total:</span>
          <span>₹${todaysTotal.toFixed(2)}</span>
        </div>
        
        ${originalPriorOutstanding > 0 ? `
          <div class="flex-row">
            <span>Prior Outstanding:</span>
            <span>+₹${originalPriorOutstanding.toFixed(2)}</span>
          </div>
        ` : ''}
        
        <div class="divider"></div>
        <div class="flex-row bold">
          <span>Total Payable Amount:</span>
          <span>₹${totalPayable.toFixed(2)}</span>
        </div>
        
        ${amountPaid > 0 ? `
          <div class="flex-row">
            <span>Amount Paid / Advance:</span>
            <span>-₹${amountPaid.toFixed(2)}</span>
          </div>
        ` : ''}

        ${amountPaid > totalPayable ? `
          <div class="flex-row bold" style="color: #059669;">
            <span>Change Returned to Customer:</span>
            <span>₹${(amountPaid - totalPayable).toFixed(2)}</span>
          </div>
        ` : ''}
        
        ${amountPaid > 0 && remainingPriorOutstanding > 0 ? `
          <div class="flex-row">
            <span>Prior Outstanding Remaining:</span>
            <span>₹${remainingPriorOutstanding.toFixed(2)}</span>
          </div>
        ` : ''}

        ${amountPaid > 0 && todayOutstanding > 0 ? `
          <div class="flex-row">
            <span>Today's Outstanding:</span>
            <span>₹${todayOutstanding.toFixed(2)}</span>
          </div>
        ` : ''}
        
        <div class="divider"></div>
        <div class="flex-row bold">
          <span>Net Outstanding:</span>
          <span>₹${netOutstanding.toFixed(2)}</span>
        </div>
        
        <div class="divider"></div>
        <div class="text-center" style="margin-top: 15px; font-style: italic;">Thank you! Visit again.</div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  const handleShareWhatsApp = async () => {
    if (!session) return;
    if (!session.customerPhone) {
      setWaStatus({ type: 'error', message: 'Customer phone number is missing.' });
      return;
    }

    setWaLoading(true);
    setWaStatus(null);

    try {
      const res = await api.post(`/sessions/${sessionId}/send-whatsapp`, {});
      setWaStatus({
        type: 'success',
        message: `✓ Receipt sent via WhatsApp to ${session.customerPhone}`
      });
    } catch (err: any) {
      setWaStatus({
        type: 'error',
        message: err.message || 'Failed to send WhatsApp message'
      });
    } finally {
      setWaLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 pb-16 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">

        {/* ── Top nav ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2 text-cyan-400" />
            Back to Dashboard
          </button>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold tracking-wider ${
              isActive
                ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {isActive ? '● LIVE SESSION (IN)' : '✓ COMPLETED (OUT)'}
          </span>
        </div>

        {/* ── Hero Info Card ── */}
        <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Customer */}
            <div>
              <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest font-mono">Customer</span>
              <h1 className="text-2xl font-extrabold text-white mt-1 flex items-center gap-2 font-display tracking-normal">
                <User className="h-5 w-5 text-cyan-400 shrink-0" />
                <span className="inline-flex flex-wrap items-center gap-x-2.5">
                  {session.customerName.split(/\s+/).map((part, idx) => (
                    <span key={idx}>{part}</span>
                  ))}
                </span>
              </h1>
              {session.customerPhone && (
                <p className="text-xs font-mono font-semibold text-slate-400 flex items-center gap-1.5 mt-1 ml-0.5">
                  <Phone className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>{session.customerPhone}</span>
                </p>
              )}
            </div>

            {/* Overall Status */}
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest font-mono">Session Status</span>
              <p className="text-base font-extrabold text-slate-200 mt-1.5 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                {isActive ? 'IN (Active)' : 'OUT (Completed)'}
              </p>
            </div>

            {/* Elapsed */}
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest font-mono">
                Session Time
              </span>
              <p className="text-xl font-extrabold text-cyan-400 mt-1 flex items-center gap-1.5 font-mono">
                <Clock className="h-4 w-4 text-cyan-400 shrink-0" />
                {elapsed}
              </p>
            </div>

            {/* Started */}
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest font-mono">Started</span>
              <p className="text-sm font-semibold text-slate-300 mt-1.5 font-mono">
                {new Date(session.startTime).toLocaleString([], {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>
              {session.endTime && (
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Ended: {new Date(session.endTime).toLocaleTimeString([], { timeStyle: 'short' })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Table play action section (active session only) ── */}
        {isActive && (
          <div className="bg-[#111827]/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3 font-display uppercase tracking-wide">
              <Gamepad2 className="h-5 w-5 text-purple-400" />
              Billiard Table / PS4 Manager
            </h2>

            {(() => {
              const activePlays = session.tablePlays?.filter(tp => !tp.endTime) || [];
              return (
                <>
                  {activePlays.length > 0 && (
                    <div className="space-y-3 mb-4">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-purple-300 font-mono flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                        Active Game Plays ({activePlays.length})
                      </p>
                      <div className="grid grid-cols-1 gap-3">
                        {activePlays.map((ap) => {
                          const label = ap.gameType === 'PS4'
                            ? `PS4 (${ap.playerCount} Player${ap.playerCount > 1 ? 's' : ''})`
                            : `${ap.gameType}${ap.table ? ` (Table ${ap.table.number})` : ''}`;
                          return (
                            <div key={ap.id} className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 rounded-2xl p-4 border border-purple-500/40 shadow-md flex flex-wrap items-center justify-between gap-4">
                              <div>
                                <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-300 bg-purple-950 border border-purple-500/40 px-2 py-0.5 rounded-full">
                                  Occupied & Running
                                </span>
                                <h4 className="text-sm font-extrabold text-white mt-1 font-display">{label}</h4>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">Started by {ap.createdBy}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <button
                                  type="button"
                                  onClick={() => handleEndTablePlay(ap.id)}
                                  disabled={playLoading}
                                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_12px_rgba(244,63,94,0.3)] flex items-center gap-1.5 transition-all disabled:opacity-50 custom-button"
                                >
                                  <StopCircle className="h-4 w-4" />
                                  Stop Play
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Start / Add Table Play Inline Form */}
                  <form onSubmit={handleStartTablePlay} className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                      {/* 1. Game Type */}
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 font-mono">Game Type</label>
                        <select
                          value={playGameType}
                          onChange={(e) => {
                            setPlayGameType(e.target.value);
                            setPlayTableId('');
                          }}
                          className="block w-full rounded-xl border border-slate-800 px-3 py-2 text-white bg-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
                        >
                          <option value="Pool">Pool (₹160/hr)</option>
                          <option value="MidSnooker">Mid Snooker (₹220/hr)</option>
                          <option value="PS4">PS4 (₹80/p/hr)</option>
                        </select>
                      </div>

                      {/* 2. Select table or players */}
                      {(playGameType === 'Pool' || playGameType === 'MidSnooker') ? (
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 font-mono">Select Table</label>
                          <select
                            value={playTableId}
                            required
                            onChange={(e) => setPlayTableId(e.target.value)}
                            className="block w-full rounded-xl border border-slate-800 px-3 py-2 text-white bg-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-semibold"
                          >
                            <option value="">-- Select Table --</option>
                            {availableTables.map((t) => (
                              <option key={t.id} value={t.id.toString()}>
                                Table {t.number}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 font-mono">Players</label>
                          <div className="flex gap-1.5">
                            {['1', '2', '3', '4'].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setPlayPlayerCount(n)}
                                className={`flex-1 py-2 rounded-xl border text-xs font-extrabold transition-all ${
                                  playPlayerCount === n
                                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. Start Time with quick presets */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                            {showEndField ? 'Start / End Time' : 'Start Time'}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowEndField(!showEndField);
                              if (showEndField) setEndTimeStr('');
                            }}
                            className="text-[10px] font-mono text-cyan-400 hover:underline"
                          >
                            {showEndField ? 'Live Play' : '+ End Time'}
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={startTimeStr}
                            onChange={(e) => setStartTimeStr(e.target.value)}
                            className="block w-full rounded-xl border border-slate-800 px-3 py-2 text-white bg-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-sm font-mono font-semibold"
                          />
                          {showEndField && (
                            <input
                              type="time"
                              value={endTimeStr}
                              placeholder="End"
                              onChange={(e) => setEndTimeStr(e.target.value)}
                              className="block w-full rounded-xl border border-purple-500/50 px-3 py-2 text-white bg-slate-900 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm font-mono font-semibold"
                            />
                          )}
                        </div>
                      </div>

                      {/* 4. Action Button */}
                      <div>
                        <button
                          type="submit"
                          disabled={playLoading || ((playGameType === 'Pool' || playGameType === 'MidSnooker') && !endTimeStr && availableTables.length === 0)}
                          className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_15px_rgba(0,242,254,0.3)] transition-all disabled:opacity-50 custom-button"
                        >
                          <Play className="h-4 w-4 mr-1.5" />
                          {showEndField && endTimeStr ? 'Add Play' : 'Start Play'}
                        </button>
                      </div>
                    </div>

                    {/* Quick chips row for fast 1-click selection */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-[11px] font-mono">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mr-0.5">Quick Start:</span>
                        <button
                          type="button"
                          onClick={() => setStartTimeStr(dateToTimeInput(new Date()))}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
                            startTimeStr === dateToTimeInput(new Date())
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-slate-800/60 text-slate-400 hover:text-white border-slate-700/60'
                          }`}
                        >
                          Now
                        </button>
                        {[-10, -15, -30, -45, -60].map((mins) => {
                          const tStr = dateToTimeInput(new Date(Date.now() + mins * 60000));
                          const label = `${mins}m`;
                          return (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => setStartTimeStr(tStr)}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
                                startTimeStr === tStr
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                  : 'bg-slate-800/60 text-slate-400 hover:text-white border-slate-700/60'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {showEndField && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mr-0.5">Quick End:</span>
                          <button
                            type="button"
                            onClick={() => setEndTimeStr(dateToTimeInput(new Date()))}
                            className="px-2 py-0.5 rounded-md text-[11px] font-bold border bg-slate-800/60 text-slate-400 hover:text-white border-slate-700/60"
                          >
                            Now
                          </button>
                          {[30, 60, 90, 120].map((mins) => {
                            const startD = timeToDate(startTimeStr);
                            const tStr = dateToTimeInput(new Date(startD.getTime() + mins * 60000));
                            const label = `+${mins >= 60 ? `${mins / 60}h` : `${mins}m`}`;
                            return (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => setEndTimeStr(tStr)}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
                                  endTimeStr === tStr
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                    : 'bg-slate-800/60 text-slate-400 hover:text-white border-slate-700/60'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        )}

        {/* ── Action Bar (active only) ── */}
        {isActive && (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111827]/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800 shadow-xl">
            <h2 className="text-base font-extrabold text-white font-display uppercase tracking-wide">Orders & Payments</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRecordPayment(true)}
                className="inline-flex items-center px-4 py-2.5 border border-emerald-500/50 text-xs font-extrabold uppercase tracking-wider rounded-xl text-emerald-300 bg-emerald-950/80 hover:bg-emerald-500 hover:text-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] custom-button"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Advance or Partial Payment
              </button>
              <button
                onClick={() => setShowAddOrder(true)}
                className="inline-flex items-center px-4 py-2.5 border border-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-cyan-300 hover:border-cyan-500/50 transition-all custom-button"
              >
                <ShoppingBag className="h-4 w-4 mr-2 text-cyan-400" />
                Add Item
              </button>
              <button
                onClick={() => setShowCloseSession(true)}
                className="inline-flex items-center px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all custom-button"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Close Session
              </button>
            </div>
          </div>
        )}

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left — Categorized Orders */}
          <div className="lg:col-span-2 space-y-4">
            {!hasActivity ? (
              <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 p-12 text-center text-slate-500 text-sm shadow-xl">
                <ShoppingBag className="h-8 w-8 mx-auto mb-3 opacity-40 text-cyan-400" />
                <p className="font-semibold">No activity or orders logged yet.</p>
                {isActive && (
                  <button
                    onClick={() => setShowAddOrder(true)}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add an item
                  </button>
                )}
              </div>
            ) : (
              <>
                <CategorySection
                  title="Cigarettes"
                  icon={<Cigarette className="h-4 w-4" />}
                  orders={cigaretteOrders}
                  isActive={isActive}
                  onDelete={handleDeleteOrder}
                  accentClass="bg-rose-950/40 text-rose-300 border-b border-rose-500/30"
                />
                <CategorySection
                  title="Cold Drinks"
                  icon={<GlassWater className="h-4 w-4" />}
                  orders={coldDrinkOrders}
                  isActive={isActive}
                  onDelete={handleDeleteOrder}
                  accentClass="bg-cyan-950/40 text-cyan-300 border-b border-cyan-500/30"
                />
                <CategorySection
                  title="Café"
                  icon={<Coffee className="h-4 w-4" />}
                  orders={cafeOrders}
                  isActive={isActive}
                  onDelete={handleDeleteOrder}
                  accentClass="bg-amber-950/40 text-amber-300 border-b border-amber-500/30"
                />
                <TablePlaySection
                  tablePlays={session.tablePlays || []}
                  isActive={isActive}
                  activePlayElapsed={activePlayElapsed}
                  onEndPlay={handleEndTablePlay}
                  onDeletePlay={handleDeleteTablePlay}
                />
              </>
            )}
          </div>

          {/* Right — Billing + Payments */}
          <div className="space-y-6">

            {/* Billing Summary */}
            <div className="bg-[#111827]/90 backdrop-blur-2xl rounded-3xl border border-slate-800/90 p-6 shadow-2xl space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                <h3 className="text-sm font-extrabold text-white font-display uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-cyan-400" />
                  <span>Billing Summary</span>
                </h3>
                <span className={`text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                  isActive 
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {isActive ? 'Active Bill' : 'Closed Bill'}
                </span>
              </div>

              {/* Itemized Charges */}
              <div className="space-y-2 text-xs">
                {gameTotal > 0 && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Gamepad2 className="h-3.5 w-3.5 text-cyan-400" />
                      Games & Table Plays
                    </span>
                    <span className="font-mono font-bold text-white">₹{gameTotal.toFixed(2)}</span>
                  </div>
                )}
                {cigaretteTotal > 0 && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Cigarette className="h-3.5 w-3.5 text-rose-400" />
                      Cigarettes
                    </span>
                    <span className="font-mono font-bold text-white">₹{cigaretteTotal.toFixed(2)}</span>
                  </div>
                )}
                {coldDrinkTotal > 0 && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <GlassWater className="h-3.5 w-3.5 text-cyan-400" />
                      Cold Drinks
                    </span>
                    <span className="font-mono font-bold text-white">₹{coldDrinkTotal.toFixed(2)}</span>
                  </div>
                )}
                {cafeTotal > 0 && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Coffee className="h-3.5 w-3.5 text-amber-400" />
                      Café Kitchen
                    </span>
                    <span className="font-mono font-bold text-white">₹{cafeTotal.toFixed(2)}</span>
                  </div>
                )}
                {(session.customAmount ?? 0) !== 0 && (
                  <div className={`flex justify-between items-center text-xs font-semibold ${(session.customAmount ?? 0) < 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    <span>{(session.customAmount ?? 0) < 0 ? 'Discount' : 'Extra Surcharge'}</span>
                    <span className="font-mono">
                      {(session.customAmount ?? 0) < 0 ? '−' : '+'}₹{Math.abs(session.customAmount ?? 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {priorOutstanding > 0 && (
                  <div className="flex justify-between items-center text-xs font-semibold text-rose-400">
                    <span>Prior Outstanding Udhar</span>
                    <span className="font-mono font-bold">+₹{priorOutstanding.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Subtotals (Bill Total & Advance Paid) */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400 font-medium">
                  <span>Gross Bill Total</span>
                  <span className="font-mono font-bold text-slate-200">₹{totalPayable.toFixed(2)}</span>
                </div>

                {amountPaid > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span>💳</span> Advance / Partial Paid
                    </span>
                    <span className="font-mono font-bold">−₹{amountPaid.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Hero Settlement Card */}
              {isActive ? (
                amountPaid > totalPayable ? (
                  /* Case 1: Advance > Bill (e.g. Advance 500, Bill 30 -> Balance 470) */
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.15)] flex justify-between items-center gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 font-mono">
                          Advance Balance
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-400/80 font-medium mt-0.5">
                        Credit remaining with lounge
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight glow-text-emerald">
                        ₹{(amountPaid - totalPayable).toFixed(2)}
                      </div>
                      <span className="text-[9px] font-mono text-emerald-500 font-bold uppercase">
                        Due Now: ₹0.00
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Case 2: Bill >= Advance (e.g. Bill 100, Partial Paid 40 -> Total Payable: 60) */
                  <div className="bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-4 shadow-[0_0_20px_rgba(0,242,254,0.1)] flex justify-between items-center gap-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 font-mono block">
                        Net Payable Due
                      </span>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {amountPaid > 0 ? `After ₹${amountPaid.toFixed(0)} payment` : 'Payable at checkout'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-white font-mono tracking-tight glow-text-cyan">
                        ₹{netDue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                /* Completed Session view */
                <div className={`p-4 rounded-2xl border flex justify-between items-center ${
                  netOutstanding > 0 
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' 
                    : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                }`}>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono block">
                      {netOutstanding > 0 ? 'Unpaid Outstanding (Udhar)' : 'Final Status: Fully Settled'}
                    </span>
                    <span className="text-xs opacity-80">
                      {netOutstanding > 0 ? 'Recorded to customer ledger' : 'All dues cleared'}
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono">
                    ₹{netOutstanding.toFixed(2)}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={handlePrintReceipt}
                  disabled={isActive}
                  title={isActive ? "Close the session first to print the final receipt" : "Print Receipt"}
                  className={`inline-flex justify-center items-center px-3.5 py-2.5 border text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all ${
                    isActive
                      ? 'border-slate-800 text-slate-600 bg-slate-900/50 cursor-not-allowed'
                      : 'border-slate-700 text-slate-200 bg-slate-900 hover:bg-slate-800 hover:border-cyan-500/50 custom-button'
                  }`}
                >
                  <Printer className={`h-4 w-4 mr-1.5 ${isActive ? 'text-slate-600' : 'text-cyan-400'}`} />
                  {isActive ? 'Print (Closed)' : 'Print Receipt'}
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  disabled={isActive || waLoading}
                  title={isActive ? "Close the session first to send receipt via WhatsApp" : `Send Receipt directly to ${session.customerPhone || 'Customer'}`}
                  className={`inline-flex justify-center items-center px-3.5 py-2.5 border text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all ${
                    isActive
                      ? 'border-slate-800 text-slate-600 bg-slate-900/50 cursor-not-allowed'
                      : 'border-emerald-500/40 text-emerald-300 bg-emerald-950/80 hover:bg-emerald-500 hover:text-black shadow-[0_0_12px_rgba(16,185,129,0.2)] custom-button'
                  }`}
                >
                  {waLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-400 border-t-transparent mr-1.5" />
                  ) : (
                    <MessageCircle className={`h-4 w-4 mr-1.5 ${isActive ? 'text-slate-600' : 'text-emerald-400'}`} />
                  )}
                  {waLoading ? 'Sending...' : 'WhatsApp'}
                </button>
              </div>

              {/* Silent Background WhatsApp Notification Status */}
              {waStatus && (
                <div className={`p-3 rounded-xl text-xs font-mono font-bold space-y-1 transition-all ${
                  waStatus.type === 'success'
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-rose-950/90 text-rose-300 border border-rose-500/50'
                }`}>
                  <p className="flex items-center gap-1.5">
                    <span>{waStatus.type === 'success' ? '🚀' : '⚠️'}</span>
                    {waStatus.message}
                  </p>
                </div>
              )}

            </div>

            {/* Payments Log */}
            {session.payments && session.payments.length > 0 && (
              <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 p-6 shadow-xl space-y-3">
                <h3 className="text-base font-extrabold text-white flex items-center justify-between font-display">
                  <span>Payments Received</span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-900 text-emerald-400 border border-slate-800">
                    {session.payments.length} txns
                  </span>
                </h3>
                <div className="space-y-2">
                  {session.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30 text-xs"
                    >
                      <div>
                        <p className="font-bold text-white">{p.method} Payment</p>
                        <p className="text-slate-400 mt-0.5 font-mono">
                          {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-emerald-400">+₹{p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>


      {/* ── Modals ── */}
      {showAddOrder && (
        <AddOrderModal
          sessionId={session.id}
          onClose={() => setShowAddOrder(false)}
          onSuccess={(newOrders: any) => {
            setShowAddOrder(false);
            const ordersArray = Array.isArray(newOrders) ? newOrders : [newOrders];
            const updatedOrders = [...(session.orders || []), ...ordersArray];
            const menuCost = updatedOrders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
            mutate({
              ...session,
              orders: updatedOrders,
              menuCost,
              totalBill: menuCost + session.gameCost + (session.customAmount || 0)
            }, false);
            mutate();
          }}
        />
      )}
      {showRecordPayment && (
        <RecordPaymentModal
          sessionId={session.id}
          maxAmount={netDue}
          onClose={() => setShowRecordPayment(false)}
          onSuccess={() => { setShowRecordPayment(false); mutate(); }}
        />
      )}
      {showCloseSession && (
        <CloseSessionModal
          session={session}
          onClose={() => setShowCloseSession(false)}
          onSuccess={() => { setShowCloseSession(false); mutate(); }}
        />
      )}

      {/* Stop Table Play Modal (Fast time-only input) */}
      {stopPlayTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#111827] rounded-2xl border border-slate-800 w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-1.5 font-display">
                <StopCircle className="h-4 w-4 text-rose-400" />
                Stop Play
              </h3>
              <button
                type="button"
                onClick={() => setStopPlayTarget(null)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Game:</span>
                <span className="text-white font-bold">
                  {stopPlayTarget.gameType === 'PS4'
                    ? `PS4 (${stopPlayTarget.playerCount}p)`
                    : `${stopPlayTarget.gameType}${stopPlayTarget.table ? ` (T${stopPlayTarget.table.number})` : ''}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Started:</span>
                <span className="text-emerald-400 font-bold">
                  {new Date(stopPlayTarget.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                  End Time
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStopPlayTimeStr(dateToTimeInput(new Date()))}
                    className="text-[10px] font-mono text-cyan-400 hover:underline px-1"
                  >
                    Now
                  </button>
                  {[-5, -10, -15].map((m) => {
                    const t = dateToTimeInput(new Date(Date.now() + m * 60000));
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setStopPlayTimeStr(t)}
                        className="text-[10px] font-mono text-slate-400 hover:text-white px-1"
                      >
                        {m}m
                      </button>
                    );
                  })}
                </div>
              </div>
              <input
                type="time"
                value={stopPlayTimeStr}
                onChange={(e) => setStopPlayTimeStr(e.target.value)}
                className="block w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white text-xs font-mono font-semibold"
              />
            </div>

            {/* Calculated preview */}
            {(() => {
              const s = new Date(stopPlayTarget.startTime).getTime();
              const e = timeToDate(stopPlayTimeStr).getTime();
              if (e <= s) {
                return (
                  <p className="text-[11px] font-mono text-rose-400">End time must be after start time</p>
                );
              }
              const diffMs = e - s;
              const hrs = diffMs / 3600000;
              const mins = Math.round(diffMs / 60000);
              const rate = GAME_RATES[stopPlayTarget.gameType] || 0;
              const cost = Math.round(stopPlayTarget.gameType === 'PS4'
                ? rate * stopPlayTarget.playerCount * hrs
                : rate * hrs);

              return (
                <div className="flex justify-between items-center text-xs font-mono bg-rose-950/20 border border-rose-500/20 rounded-lg p-2.5">
                  <span className="text-slate-300">Duration: <strong className="text-white">{mins}m</strong></span>
                  <span className="text-emerald-400 font-extrabold text-sm">₹{cost}</span>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStopPlayTarget(null)}
                className="px-3.5 py-1.5 border border-slate-800 text-xs font-bold rounded-xl text-slate-400 hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={playLoading || (timeToDate(stopPlayTimeStr).getTime() <= new Date(stopPlayTarget.startTime).getTime())}
                onClick={() => confirmEndTablePlay()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-md transition-all disabled:opacity-50"
              >
                Stop Play
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
