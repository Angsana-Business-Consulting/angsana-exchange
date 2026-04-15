'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ShieldX, MoreHorizontal, Plus } from 'lucide-react';
import type { ExclusionEntry, ExclusionScope, ManagedListItem } from '@/types';
import { EXCLUSION_SCOPE_CONFIG } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────
function formatShortDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Component ────────────────────────────────────────────────────────

export function ExclusionsClient({ clientId }: { clientId: string }) {
  const [exclusions, setExclusions] = useState<ExclusionEntry[]>([]);
  const [reasonsList, setReasonsList] = useState<ManagedListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [scopeFilter, setScopeFilter] = useState<ExclusionScope | 'all'>('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [showRemoved, setShowRemoved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch exclusion reasons managed list
  useEffect(() => {
    fetch('/api/managed-lists/exclusionReasons')
      .then((r) => r.json())
      .then((data) => {
        if (data?.items) setReasonsList(data.items.filter((i: ManagedListItem) => i.active));
      })
      .catch(() => {});
  }, []);

  // Build API URL from filters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('status', showRemoved ? 'all' : 'active');
    if (scopeFilter !== 'all') params.set('scope', scopeFilter);
    if (reasonFilter !== 'all') params.set('reason', reasonFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    return `/api/clients/${clientId}/exclusions?${params.toString()}`;
  }, [clientId, scopeFilter, reasonFilter, showRemoved, debouncedSearch]);

  // Fetch exclusions
  useEffect(() => {
    setLoading(true);
    fetch(apiUrl)
      .then((r) => r.json())
      .then((data) => {
        setExclusions(data?.data ?? []);
      })
      .catch(() => setExclusions([]))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  // Reason display lookup
  const reasonLookup = useMemo(() => {
    const map: Record<string, string> = {};
    reasonsList.forEach((r) => (map[r.id] = r.label));
    return map;
  }, [reasonsList]);

  // Summary counts
  const summary = useMemo(() => {
    const active = exclusions.filter((e) => e.status === 'active');
    return {
      total: active.length,
      companyWide: active.filter((e) => e.scope === 'company-wide').length,
      companyScoped: active.filter((e) => e.scope === 'company-scoped').length,
      contactOnly: active.filter((e) => e.scope === 'contact-only').length,
    };
  }, [exclusions]);

  const clearFilters = useCallback(() => {
    setScopeFilter('all');
    setReasonFilter('all');
    setShowRemoved(false);
    setSearchQuery('');
  }, []);

  // ── Empty state (no exclusions at all) ──
  if (!loading && exclusions.length === 0 && scopeFilter === 'all' && reasonFilter === 'all' && !debouncedSearch && !showRemoved) {
    return (
      <div className="flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">Exclusions</h1>
              <p className="text-sm text-[var(--muted)]">{clientId}</p>
            </div>
            <button
              disabled
              title="Coming in next update"
              className="flex items-center gap-2 rounded-full bg-[#3B7584] px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add Exclusion
            </button>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex flex-1 flex-col items-center justify-center py-24">
          <ShieldX className="h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-[var(--foreground)]">No exclusions yet</h2>
          <p className="mt-2 max-w-md text-center text-sm text-[var(--muted)]">
            Exclusions prevent specific companies or contacts from being included in prospecting activity.
          </p>
          <button
            disabled
            title="Coming in next update"
            className="mt-4 flex items-center gap-2 rounded-full bg-[#3B7584] px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add Exclusion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b bg-white">
        {/* Page header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Exclusions</h1>
            <p className="text-sm text-[var(--muted)]">{clientId}</p>
          </div>
          <button
            disabled
            title="Coming in next update"
            className="flex items-center gap-2 rounded-full bg-[#3B7584] px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add Exclusion
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 px-6 pb-3">
          {/* Scope filter */}
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as ExclusionScope | 'all')}
            className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[#3B7584] focus:outline-none focus:ring-1 focus:ring-[#3B7584]"
          >
            <option value="all">All scopes</option>
            <option value="company-wide">Company-wide</option>
            <option value="company-scoped">Company-scoped</option>
            <option value="contact-only">Contact only</option>
          </select>

          {/* Reason filter */}
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[#3B7584] focus:outline-none focus:ring-1 focus:ring-[#3B7584]"
          >
            <option value="all">All reasons</option>
            {reasonsList.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
            <option value="no-reason">No reason given</option>
          </select>

          {/* Show removed toggle */}
          <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
            <div
              className={`relative h-5 w-9 rounded-full transition-colors ${showRemoved ? 'bg-[#3B7584]' : 'bg-gray-300'}`}
              onClick={() => setShowRemoved(!showRemoved)}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${showRemoved ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </div>
            Show removed
          </label>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search company or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-full border border-gray-300 bg-white py-1.5 pl-9 pr-4 text-sm text-[var(--foreground)] placeholder:text-gray-400 focus:border-[#3B7584] focus:outline-none focus:ring-1 focus:ring-[#3B7584] w-64"
            />
          </div>
        </div>

        {/* Summary bar */}
        <div className="px-6 pb-3">
          <p className="text-xs text-[var(--muted)]">
            {summary.total} active exclusion{summary.total !== 1 ? 's' : ''} • {summary.companyWide} company-wide • {summary.companyScoped} company-scoped • {summary.contactOnly} contact-only
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--muted)]">Loading exclusions…</p>
          </div>
        ) : exclusions.length === 0 ? (
          /* No results state */
          <div className="flex flex-col items-center py-12">
            <p className="text-sm text-[var(--muted)]">No exclusions match your filters</p>
            <button
              onClick={clearFilters}
              className="mt-2 text-sm font-medium text-[#3B7584] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                <th className="pb-2 pr-4">Company</th>
                <th className="pb-2 pr-4">Scope</th>
                <th className="pb-2 pr-4">Scope Detail</th>
                <th className="pb-2 pr-4">Reason</th>
                <th className="pb-2 pr-4">Added</th>
                {showRemoved && <th className="pb-2 pr-4">Status</th>}
                <th className="pb-2 w-10">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exclusions.map((entry) => (
                <tr
                  key={entry.id}
                  className={`border-b last:border-0 ${entry.status === 'removed' ? 'opacity-50' : ''}`}
                >
                  {/* Company */}
                  <td className="py-3 pr-4">
                    <div className="font-medium text-[var(--foreground)]">{entry.companyName}</div>
                    {entry.scope === 'contact-only' && entry.contactName && (
                      <div className="text-xs text-[var(--muted)]">
                        {entry.contactName}
                        {entry.contactTitle && <span className="italic"> — {entry.contactTitle}</span>}
                      </div>
                    )}
                  </td>

                  {/* Scope badge */}
                  <td className="py-3 pr-4">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        color: EXCLUSION_SCOPE_CONFIG[entry.scope].colour,
                        backgroundColor: EXCLUSION_SCOPE_CONFIG[entry.scope].bgColour,
                      }}
                    >
                      {EXCLUSION_SCOPE_CONFIG[entry.scope].label}
                    </span>
                  </td>

                  {/* Scope Detail */}
                  <td className="py-3 pr-4 text-[var(--muted)]">
                    {entry.scope === 'company-scoped' ? (
                      <div className="space-y-0.5">
                        {entry.brandOrDivision && <div>Brand: {entry.brandOrDivision}</div>}
                        {entry.service && <div>Service: {entry.service}</div>}
                        {entry.geography && <div>Geo: {entry.geography}</div>}
                      </div>
                    ) : entry.scope === 'contact-only' ? (
                      <div>
                        {entry.contactName}
                        {entry.contactTitle && <span className="italic"> — {entry.contactTitle}</span>}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {/* Reason */}
                  <td className="py-3 pr-4">
                    {entry.reason ? (
                      <span className="text-[var(--foreground)]">{reasonLookup[entry.reason] || entry.reason}</span>
                    ) : (
                      <span className="italic text-gray-400">—</span>
                    )}
                  </td>

                  {/* Added */}
                  <td className="py-3 pr-4">
                    <div className="text-[var(--foreground)]">{formatShortDate(entry.addedAt)}</div>
                    <div className="text-xs text-[var(--muted)]">by {entry.addedByName}</div>
                  </td>

                  {/* Status (only when show removed) */}
                  {showRemoved && (
                    <td className="py-3 pr-4 text-xs">
                      {entry.status === 'active' ? (
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                          <span>Removed</span>
                          {entry.removedAt && (
                            <span className="ml-1 text-[var(--muted)]">{formatShortDate(entry.removedAt)}</span>
                          )}
                        </span>
                      )}
                    </td>
                  )}

                  {/* Actions */}
                  <td className="py-3 text-center">
                    <button
                      disabled
                      className="rounded p-1 text-gray-400 cursor-not-allowed"
                      title="Actions coming in next update"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
