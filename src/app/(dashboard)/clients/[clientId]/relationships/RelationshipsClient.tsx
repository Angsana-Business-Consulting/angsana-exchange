'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Info, Building2, Search, Plus } from 'lucide-react';
import RelationshipCard from '@/components/relationships/RelationshipCard';
import type { RelationshipEntry, RelationshipType } from '@/types';
import { RELATIONSHIP_TYPE_CONFIG } from '@/types';

interface RelationshipsClientProps {
  clientId: string;
}

/**
 * Relationships list page — client component.
 * Filter state, API fetch, card rendering, expand/collapse, summary bar.
 */
export default function RelationshipsClient({ clientId }: RelationshipsClientProps) {
  // ── Filter state ──────────────────────────────────────────────
  const [relationshipTypeFilter, setRelationshipTypeFilter] = useState<RelationshipType | 'all'>('all');
  const [agreementFilter, setAgreementFilter] = useState<'all' | 'true' | 'false'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ── Data state ────────────────────────────────────────────────
  const [entries, setEntries] = useState<RelationshipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Debounce search ───────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Fetch data ────────────────────────────────────────────────
  const fetchRelationships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', showArchived ? 'all' : 'active');
      if (relationshipTypeFilter !== 'all') params.set('relationshipType', relationshipTypeFilter);
      if (agreementFilter !== 'all') params.set('hasAgreement', agreementFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/clients/${clientId}/relationships?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load relationships: ${res.status}`);
      const json = await res.json();
      setEntries(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load relationships');
    } finally {
      setLoading(false);
    }
  }, [clientId, showArchived, relationshipTypeFilter, agreementFilter, debouncedSearch]);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  // ── Summary counts ────────────────────────────────────────────
  const summary = useMemo(() => {
    const activeEntries = entries.filter((e) => e.status === 'active');
    const total = activeEntries.length;
    const byType: Record<string, number> = {};
    for (const e of activeEntries) {
      byType[e.relationshipType] = (byType[e.relationshipType] || 0) + 1;
    }
    const withAgreements = activeEntries.filter((e) => e.hasAgreement).length;
    return { total, byType, withAgreements };
  }, [entries]);

  // ── Clear filters ─────────────────────────────────────────────
  const clearFilters = () => {
    setRelationshipTypeFilter('all');
    setAgreementFilter('all');
    setShowArchived(false);
    setSearchQuery('');
  };

  const hasActiveFilters =
    relationshipTypeFilter !== 'all' || agreementFilter !== 'all' || showArchived || searchQuery !== '';

  return (
    <div className="space-y-4">
      {/* ── Sticky sub-header ────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b pb-3 -mx-6 px-6 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Relationships</h1>
            <p className="text-xs text-gray-500">{clientId}</p>
          </div>
          <button
            disabled
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium text-white opacity-50 cursor-not-allowed"
            style={{ backgroundColor: '#3B7584' }}
            title="Coming in next update"
          >
            <Plus size={14} />
            Add Relationship
          </button>
        </div>
      </div>

      {/* ── Contextual banner ────────────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-lg p-3"
        style={{
          backgroundColor: '#F0F7F4',
          borderLeft: '3px solid #3B7584',
        }}
      >
        <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#3B7584' }} />
        <p className="text-xs text-gray-700">
          Your existing client relationships, lapsed clients, and agreements. Helps the team
          prospect intelligently around your current footprint.
        </p>
      </div>

      {/* ── Filter bar ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Relationship type filter */}
        <select
          value={relationshipTypeFilter}
          onChange={(e) => setRelationshipTypeFilter(e.target.value as RelationshipType | 'all')}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#3B7584]"
        >
          <option value="all">All types</option>
          <option value="active-client">Active client</option>
          <option value="lapsed-client">Lapsed client</option>
          <option value="prospect">Prospect</option>
          <option value="partner">Partner</option>
        </select>

        {/* Agreement filter */}
        <select
          value={agreementFilter}
          onChange={(e) => setAgreementFilter(e.target.value as 'all' | 'true' | 'false')}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#3B7584]"
        >
          <option value="all">All</option>
          <option value="true">With agreement</option>
          <option value="false">Without agreement</option>
        </select>

        {/* Show archived toggle */}
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-gray-200 rounded-full peer-checked:bg-[#3B7584] transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
          </div>
          Show archived
        </label>

        {/* Search */}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search relationships…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-full border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#3B7584] w-56"
          />
        </div>
      </div>

      {/* ── Summary bar ──────────────────────────────────────── */}
      {!loading && entries.length > 0 && (
        <p className="text-xs text-gray-500">
          {summary.total} active relationship{summary.total !== 1 ? 's' : ''}
          {Object.entries(summary.byType).map(([type, count]) => (
            <span key={type}>
              {' \u2022 '}{count} {RELATIONSHIP_TYPE_CONFIG[type as RelationshipType]?.label?.toLowerCase()}
            </span>
          ))}
          {summary.withAgreements > 0 && (
            <span>{' \u2022 '}{summary.withAgreements} with agreement{summary.withAgreements !== 1 ? 's' : ''}</span>
          )}
        </p>
      )}

      {/* ── Loading state ────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#3B7584]" />
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────── */}
      {error && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={fetchRelationships} className="mt-2 text-xs text-red-500 underline">
            Try again
          </button>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!loading && !error && entries.length === 0 && !hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 size={48} className="text-gray-300 mb-4" />
          <h3 className="text-sm font-medium text-gray-700">No relationships recorded</h3>
          <p className="mt-1 text-xs text-gray-500 max-w-sm">
            Record your existing client relationships, lapsed clients, and agreements to help
            the team prospect intelligently.
          </p>
          <button
            disabled
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium text-white opacity-50 cursor-not-allowed"
            style={{ backgroundColor: '#3B7584' }}
            title="Coming in next update"
          >
            <Plus size={14} />
            Add Relationship
          </button>
        </div>
      )}

      {/* ── No results state ─────────────────────────────────── */}
      {!loading && !error && entries.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-gray-500">No relationships match your filters</p>
          <button
            onClick={clearFilters}
            className="mt-2 text-xs text-[#3B7584] underline hover:no-underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Card grid ────────────────────────────────────────── */}
      {!loading && !error && entries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entries.map((entry) => (
            <RelationshipCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
