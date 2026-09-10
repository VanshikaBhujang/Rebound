'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Session } from '../types';
import { PlayCircle, Clock, Eye, Gamepad2, Coffee, CheckCircle2, User, AlertCircle, Sparkles } from 'lucide-react';

interface SessionCardProps {
  session: Session;
}

const GAME_LABELS: Record<string, string> = {
  'Pool': 'Pool 🎱',
  'MidSnooker': 'Mid Snooker 🎱',
  'PS4': 'PS4 🎮',
  'None': 'No Game',
};

const GAME_RATES: Record<string, number> = {
  'Pool': 160,
  'MidSnooker': 220,
  'PS4': 80,
  'None': 0,
};

export const SessionCard: React.FC<SessionCardProps> = ({ session }) => {
  const [sessionElapsed, setSessionElapsed] = useState('');
  const [activePlayElapsed, setActivePlayElapsed] = useState('');
  const [liveGameCost, setLiveGameCost] = useState(0);

  // Find active table play (if any)
  const activePlay = session.tablePlays?.find((tp) => !tp.endTime);
  const isTableActive = !!activePlay;

  useEffect(() => {
    const tick = () => {
      // 1. Calculate overall session duration
      const sessionStart = new Date(session.startTime).getTime();
      const sessionEnd = session.endTime ? new Date(session.endTime).getTime() : Date.now();
      const sessionDiff = Math.max(0, sessionEnd - sessionStart); // guard against clock skew
      const sh = Math.floor(sessionDiff / 3600000);
      const sm = Math.floor((sessionDiff % 3600000) / 60000);
      const ss = Math.floor((sessionDiff % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setSessionElapsed(`${pad(sh)}:${pad(sm)}:${pad(ss)}`);

      // 2. Calculate active table play duration & live cost
      if (activePlay) {
        const playStart = new Date(activePlay.startTime).getTime();
        const playDiff = Math.max(0, Date.now() - playStart);
        const ph = Math.floor(playDiff / 3600000);
        const pm = Math.floor((playDiff % 3600000) / 60000);
        const ps = Math.floor((playDiff % 60000) / 1000);
        setActivePlayElapsed(`${pad(ph)}:${pad(pm)}:${pad(ps)}`);

        // Calculate live active play cost
        const rate = GAME_RATES[activePlay.gameType] || 0;
        const hours = playDiff / 3600000;
        const cost = activePlay.gameType === 'PS4'
          ? rate * activePlay.playerCount * hours
          : rate * hours;
        setLiveGameCost(Math.round(cost));
      } else {
        setActivePlayElapsed('');
        setLiveGameCost(0);
      }
    };

    tick(); // run immediately so there is no blank flash on mount
    // Only keep ticking for active sessions; completed sessions are frozen
    if (session.endTime) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session, activePlay]);

  // Calculate billing totals
  const ordersTotal = session.orders?.reduce((sum, o) => sum + o.quantity * o.price, 0) || 0;
  const completedPlaysTotal = session.tablePlays?.filter((tp) => tp.endTime).reduce((sum, tp) => sum + tp.cost, 0) || 0;
  const totalAmount = ordersTotal + completedPlaysTotal + (session.customAmount || 0) + (session.priorUdhar || 0);

  const ordersCount = session.orders?.reduce((sum, o) => sum + o.quantity, 0) || 0;
  const isInClub = session.status === 'active';

  return (
    <div className="group relative bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-800 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(0,242,254,0.15)] transition-all duration-300 flex flex-col justify-between h-full space-y-4">
      
      {/* Top Header */}
      <div className="space-y-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Status Badge */}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wider ${
              isInClub ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}>
              <span className={`w-2 h-2 rounded-full mr-1.5 ${isInClub ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              {isInClub ? 'IN LOUNGE' : 'CLOSED'}
            </span>

            {/* Table Badge */}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isTableActive ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,242,254,0.2)]' : 'bg-slate-900/60 text-slate-500 border border-slate-800/80'
            }`}>
              {isTableActive
                ? `${GAME_LABELS[activePlay.gameType] || activePlay.gameType}`
                : 'No Active Table'
              }
            </span>
          </div>

          <div className="flex items-center text-xs font-mono font-bold text-cyan-400 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800">
            <Clock className="h-3.5 w-3.5 mr-1.5 text-cyan-400" />
            <span>{sessionElapsed}</span>
          </div>
        </div>

        {/* Customer Name */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-white flex items-center gap-2 font-display tracking-tight">
            <User className="h-4 w-4 text-cyan-400 shrink-0" />
            {session.customerName}
          </h3>
        </div>

        {/* Prior Udhar Alert */}
        {session.priorUdhar && session.priorUdhar > 0 ? (
          <div className="text-xs font-bold text-rose-300 bg-rose-950/60 border border-rose-500/40 px-3 py-1.5 rounded-xl animate-pulse flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>Prior Udhar: ₹{session.priorUdhar}</span>
          </div>
        ) : null}

        {/* Active Game Table Box */}
        {activePlay && (
          <div className="bg-gradient-to-r from-cyan-950/40 to-slate-900/80 border border-cyan-500/30 rounded-xl p-3 flex justify-between items-center text-xs text-cyan-200">
            <div>
              <p className="font-extrabold flex items-center gap-1.5 text-white">
                <Gamepad2 className="h-4 w-4 text-cyan-400" />
                {GAME_LABELS[activePlay.gameType] || activePlay.gameType}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono font-extrabold text-cyan-400 text-sm">{activePlayElapsed}</p>
            </div>
          </div>
        )}
      </div>

      {/* Middle Billing Bar */}
      <div className="pt-3 flex justify-between items-end border-t border-slate-800/80">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Current Bill</span>
          <div className="text-2xl font-black text-white tracking-tight glow-text-cyan">
            ₹{totalAmount.toFixed(2)}
          </div>
        </div>

        <div className="text-right text-xs text-slate-400 font-medium space-y-1">
          <p className="flex items-center gap-1 justify-end font-semibold text-slate-300">
            <Coffee className="h-3.5 w-3.5 text-cyan-400" />
            <span>{ordersCount} items ordered</span>
          </p>
          <p className="text-[10px] text-slate-500 font-mono">Staff: {session.staffUsername}</p>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-1">
        <Link
          href={`/sessions/${session.id}`}
          className="w-full inline-flex justify-center items-center px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider text-cyan-300 bg-slate-900 border border-slate-700/80 hover:bg-cyan-950/40 hover:border-cyan-500/50 hover:text-white transition-all duration-300 custom-button shadow-md"
        >
          <Eye className="h-4 w-4 mr-2 text-cyan-400" />
          View Live Session
        </Link>
      </div>
    </div>
  );
};

