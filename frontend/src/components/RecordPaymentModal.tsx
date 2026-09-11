'use client';

import React, { useState } from 'react';
import { api } from '../lib/api';
import { X, CreditCard } from 'lucide-react';

interface RecordPaymentModalProps {
  sessionId: string;
  maxAmount: number;
  onClose: () => void;
  onSuccess: (payment: any) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  sessionId,
  maxAmount,
  onClose,
  onSuccess
}) => {
  const [amount, setAmount] = useState(maxAmount > 0 ? maxAmount.toString() : '');
  const [method, setMethod] = useState('UPI'); // UPI, Cash
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/payments', {
        sessionId,
        amount: parseFloat(amount),
        method
      });
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#111827] rounded-3xl border border-slate-800 w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-extrabold text-white font-display uppercase tracking-wide">Advance or Partial Payment</h2>
            <p className="text-[11px] text-emerald-400 font-mono mt-0.5 font-semibold">💳 Amount will be automatically adjusted against the total bill</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/60 text-rose-300 text-xs font-bold p-3 rounded-xl border border-rose-500/40">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
              Advance or Partial Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1000"
              className="block w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm font-mono font-extrabold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
              Payment Method
            </label>
            <div className="flex rounded-xl border border-slate-800 p-1 bg-slate-900">
              {['UPI', 'Cash'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex-1 text-center py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all ${
                    method === m
                      ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,242,254,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center items-center px-4 py-2.5 border border-slate-800 text-xs font-bold uppercase tracking-wider rounded-xl text-slate-300 bg-slate-900 hover:bg-slate-800 transition-all custom-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center items-center px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-xs font-extrabold uppercase tracking-wider rounded-xl text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 transition-all custom-button"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-1.5" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

