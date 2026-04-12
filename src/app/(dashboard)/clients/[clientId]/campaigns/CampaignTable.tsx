'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Campaign, Proposition } from '@/types';
import { CAMPAIGN_STATUS_CONFIG } from '@/types';

/**
 * Format an ISO date string to a readable date.
 */
function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Status badge component.
 */
function StatusBadge({ status }: { status: Campaign['status'] }) {
  const config = CAMPAIGN_STATUS_CONFIG[status] || CAMPAIGN_STATUS_CONFIG.draft;

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        color: config.colour,
        backgroundColor: config.bgColour,
      }}
    >
      {config.label}
    </span>
  );
}

type StatusFilter = 'all' | Campaign['status'];

export function CampaignTable({
  campaigns,
  clientId,
  propositions = [],
}: {
  campaigns: Campaign[];
  clientId: string;
  propositions?: Proposition[];
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered =
    statusFilter === 'all'
      ? campaigns
      : campaigns.filter((c) => c.status === statusFilter);

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-[var(--muted)]">Status:</span>
        {(['all', 'active', 'draft', 'paused', 'completed'] as StatusFilter[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-gray-100 text-[var(--muted)] hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'All' : CAMPAIGN_STATUS_CONFIG[s].label}
            </button>
          )
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Campaign Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Service Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Start Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Summary
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((campaign) => (
              <tr
                key={campaign.id}
                className="transition-colors hover:bg-gray-50"
              >
                <td className="px-6 py-4">
                  <Link
                    href={`/clients/${clientId}/campaigns/${campaign.id}`}
                    className="text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    {campaign.campaignName}
                  </Link>
                  {(campaign.propositionRefs || []).length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {campaign.propositionRefs!.map((propId) => {
                        const prop = propositions.find((p) => p.id === propId);
                        return (
                          <Link
                            key={propId}
                            href={`/clients/${clientId}/prospecting-profile`}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: '#F0E6F0', color: '#5C3D6E' }}
                            title={`Proposition: ${prop?.name || propId}`}
                          >
                            {prop?.name || propId}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={campaign.status} />
                </td>
                <td className="px-6 py-4 text-sm text-[var(--foreground)]">
                  {campaign.serviceType}
                </td>
                <td className="px-6 py-4 text-sm text-[var(--foreground)]">
                  {campaign.owner}
                </td>
                <td className="px-6 py-4 text-sm text-[var(--muted)]">
                  {formatDate(campaign.startDate)}
                </td>
                <td className="max-w-xs px-6 py-4">
                  <p
                    className="truncate text-sm text-[var(--muted)]"
                    title={campaign.campaignSummary}
                  >
                    {campaign.campaignSummary}
                  </p>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-[var(--muted)]"
                >
                  No campaigns match the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
