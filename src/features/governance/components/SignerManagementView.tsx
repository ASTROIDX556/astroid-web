'use client';

import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Key, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Signer, ThresholdConfig } from '@/types/governance';

const STELLAR_PUBKEY_REGEX = /^G[A-Z2-7]{55}$/;

export const SignerManagementView: React.FC = () => {
  const [signers, setSigners] = useState<Signer[]>([
    {
      id: '1',
      address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      weight: 1,
      label: 'Primary Master Key',
    },
  ]);

  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    low: 1,
    medium: 2,
    high: 3,
  });

  const [newAddress, setNewAddress] = useState('');
  const [newWeight, setNewWeight] = useState<number>(1);
  const [newLabel, setNewLabel] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const totalWeight = signers.reduce((acc, curr) => acc + curr.weight, 0);

  const validateAddress = (addr: string): boolean => {
    const trimmed = addr.trim();
    if (!trimmed) {
      setAddressError('Stellar public key is required.');
      return false;
    }
    if (!STELLAR_PUBKEY_REGEX.test(trimmed)) {
      setAddressError('Invalid Stellar public key format (must start with "G" and be 56 Base32 characters).');
      return false;
    }
    if (signers.some((s) => s.address === trimmed)) {
      setAddressError('This signer address has already been added.');
      return false;
    }
    setAddressError(null);
    return true;
  };

  const handleAddSigner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddress(newAddress)) return;

    const newSigner: Signer = {
      id: Date.now().toString(),
      address: newAddress.trim(),
      weight: Number(newWeight) || 1,
      label: newLabel.trim() || undefined,
    };

    setSigners((prev) => [...prev, newSigner]);
    setNewAddress('');
    setNewWeight(1);
    setNewLabel('');
    setAddressError(null);
    setSuccessMessage('Signer added successfully.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRemoveSigner = (id: string) => {
    setSigners((prev) => prev.filter((s) => s.id !== id));
  };

  const handleThresholdChange = (key: keyof ThresholdConfig, value: number) => {
    const val = Math.max(0, value);
    setThresholds((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between border-b pb-4 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
            Multi-Sig Signer Management & Governance
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage authorized Stellar signers, weight distribution, and execution thresholds.
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Signer Weight</div>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{totalWeight}</div>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm dark:bg-green-950/40 dark:border-green-800 dark:text-green-300">
          <CheckCircle2 className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Operation Thresholds</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Low Threshold
            </label>
            <input
              type="number"
              min="0"
              value={thresholds.low}
              onChange={(e) => handleThresholdChange('low', Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Medium Threshold
            </label>
            <input
              type="number"
              min="0"
              value={thresholds.medium}
              onChange={(e) => handleThresholdChange('medium', Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              High Threshold
            </label>
            <input
              type="number"
              min="0"
              value={thresholds.high}
              onChange={(e) => handleThresholdChange('high', Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Signer</h2>
        <form onSubmit={handleAddSigner} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Stellar Public Key (G...)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="GBBD47IF6LWK..."
                  value={newAddress}
                  onChange={(e) => {
                    setNewAddress(e.target.value);
                    if (addressError) validateAddress(e.target.value);
                  }}
                  className={`w-full pl-9 pr-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 ${
                    addressError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500'
                  }`}
                />
              </div>
              {addressError && (
                <div className="flex items-center gap-1 text-red-500 text-xs mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{addressError}</span>
                </div>
              )}
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Signer Label (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Treasury Key"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Weight
              </label>
              <input
                type="number"
                min="1"
                max="255"
                value={newWeight}
                onChange={(e) => setNewWeight(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Signer
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Signers ({signers.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium">
              <tr>
                <th className="px-6 py-3">Label</th>
                <th className="px-6 py-3">Public Key</th>
                <th className="px-6 py-3">Weight</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {signers.map((signer) => (
                <tr key={signer.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {signer.label || '—'}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-600 dark:text-gray-300 break-all">
                    {signer.address}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                      {signer.weight}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveSigner(signer.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors cursor-pointer"
                      title="Remove Signer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SignerManagementView;