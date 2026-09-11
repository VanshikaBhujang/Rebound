'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Settings, Moon, PlusCircle, Grid, Gamepad2, Shield, Users } from 'lucide-react';
import { AddItemsModal } from './AddItemsModal';
import { AddTablesModal } from './AddTablesModal';
import { CustomerManagerModal } from './CustomerManagerModal';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showAddItems, setShowAddItems] = useState(false);
  const [showAddTables, setShowAddTables] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="bg-[#0e131f]/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-40 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Cyber Logo Brand */}
            <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/dashboard'}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-purple-500 to-indigo-600 p-[1.5px] shadow-[0_0_15px_rgba(0,242,254,0.4)]">
                <div className="w-full h-full bg-[#0a0d14] rounded-[10px] flex items-center justify-center">
                  <span className="text-lg">🎱</span>
                </div>
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent glow-text-cyan font-display uppercase">
                  Rebound
                </span>
                <span className="text-[10px] font-bold tracking-widest text-cyan-400/80 block -mt-1 font-mono uppercase">
                  Gaming Lounge & Cafe
                </span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center space-x-4 sm:space-x-6">
              {user && (
                <div className="hidden sm:flex items-center text-xs font-semibold px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 shadow-inner">
                  <User className="h-3.5 w-3.5 mr-2 text-cyan-400" />
                  <span>Logged as <span className="text-cyan-300 font-bold">{user.name}</span></span>
                </div>
              )}
              
              {/* Settings Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2.5 rounded-xl border transition-all duration-300 ${
                    showSettings 
                      ? 'bg-slate-800 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.2)]' 
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-cyan-300 hover:border-slate-700'
                  }`}
                  title="Settings & Admin"
                >
                  <Settings className={`h-5 w-5 transition-transform duration-500 ${showSettings ? 'rotate-90 text-cyan-400' : ''}`} />
                </button>
                
                {showSettings && (
                  <div className="absolute right-0 mt-3 w-60 bg-[#111827]/95 backdrop-blur-2xl rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] border border-slate-800/90 py-2.5 z-50 transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-slate-800/80 mb-1.5 sm:hidden">
                      <p className="text-[10px] font-bold text-cyan-400 tracking-wider uppercase">LOGGED IN AS</p>
                      <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                    </div>

                    <button 
                      onClick={() => { setShowAddItems(true); setShowSettings(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-cyan-950/40 hover:text-cyan-300 flex items-center transition-all group"
                    >
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 mr-3 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors">
                        <PlusCircle className="h-4 w-4" />
                      </div>
                      Add Menu Items
                    </button>
                    
                    <button 
                      onClick={() => { setShowAddTables(true); setShowSettings(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-emerald-950/40 hover:text-emerald-300 flex items-center transition-all group"
                    >
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 mr-3 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 transition-colors">
                        <Grid className="h-4 w-4" />
                      </div>
                      Add Billiard Tables
                    </button>

                    <button 
                      onClick={() => { setShowCustomers(true); setShowSettings(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-cyan-950/40 hover:text-cyan-300 flex items-center transition-all group"
                    >
                      <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 mr-3 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors">
                        <Users className="h-4 w-4" />
                      </div>
                      Rebound Customers
                    </button>

                    <div className="h-px bg-slate-800/80 my-1.5 mx-3" />

                    <button 
                      onClick={logout}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center transition-all group"
                    >
                      <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 mr-3 group-hover:bg-rose-500/20 transition-colors">
                        <LogOut className="h-4 w-4" />
                      </div>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </header>

      {showAddItems && (
        <AddItemsModal 
          onClose={() => setShowAddItems(false)} 
          onSuccess={() => {
            setShowAddItems(false);
            window.location.reload();
          }} 
        />
      )}

      {showAddTables && (
        <AddTablesModal 
          onClose={() => setShowAddTables(false)} 
          onSuccess={() => {
            setShowAddTables(false);
            window.location.reload();
          }} 
        />
      )}

      {showCustomers && (
        <CustomerManagerModal 
          onClose={() => setShowCustomers(false)} 
        />
      )}
    </>
  );
};

