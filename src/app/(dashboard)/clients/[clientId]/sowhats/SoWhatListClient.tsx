'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { SoWhat, SoWhatStatus, UserRole, ManagedListItem } from '@/types';
import { SOWHAT_STATUS_CONFIG, SOWHAT_ORIENTATION_CONFIG } from '@/types';

const STATUS_TABS: { key: SoWhatStatus | 'all'; label: string }[] = [
  { key: 'approved', label: 'Approved' },
  { key: 'draft', label: 'Draft' },
  { key: 'retired', label: 'Retired' },
  { key: 'all', label: 'All' },
];

interface Props {
  clientId: string;
  soWhats: SoWhat[];
  titleBands: ManagedListItem[];
  userRole: UserRole;
}

export default function SoWhatListClient({
  clientId,
  soWhats,
  titleBands,
  userRole,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SoWhatStatus | 'all'>('approved');

  const canCreate =
    userRole === 'internal-admin' ||
    userRole === 'internal-user' ||
    userRole === 'client-approver';

  const getAudienceLabel = useCallback(
    (tagId: string) => {
      const item = titleBands.find((tb) => tb.id === tagId);
      return item?.label || tagId;
    },
    [titleBands]
  );

  const filteredSoWhats =
    activeTab === 'all'
      ? soWhats
      : soWhats.filter((sw) => sw.status === activeTab);

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">So Whats</h1>
          <p className="mt-1 text-sm text-gray-500">
            Curated messages that answer the prospect&apos;s question: &ldquo;why should I care?&rdquo;
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push(`/clients/${clientId}/sowhats/new`)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add So What
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? soWhats.length
                : soWhats.filter((sw) => sw.status === tab.key).length;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    isActive ? 'bg-gray-100 text-[var(--primary)]' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* List */}
      {filteredSoWhats.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="mt-4 text-sm text-gray-500">
            {activeTab === 'approved'
              ? 'No approved So Whats yet. Create and approve So Whats to make them available for campaigns.'
              : `No ${activeTab === 'all' ? '' : activeTab + ' '}So Whats found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSoWhats.map((soWhat) => {
            const statusConfig = SOWHAT_STATUS_CONFIG[soWhat.status];

            return (
              <div
                key={soWhat.id}
                onClick={() => router.push(`/clients/${clientId}/sowhats/${soWhat.id}`)}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {soWhat.headline}
                      </h3>
                      <span
                        className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          color: statusConfig.colour,
                          backgroundColor: statusConfig.bgColour,
                        }}
                      >
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {soWhat.audienceTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                        >
                          {getAudienceLabel(tag)}
                        </span>
                      ))}
                      {soWhat.orientationTags.map((tag) => {
                        const config = SOWHAT_ORIENTATION_CONFIG[tag];
                        return (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{ color: config.colour, backgroundColor: config.bgColour }}
                          >
                            {config.label}
                          </span>
                        );
                      })}
                    </div>

                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      {soWhat.sourceRef && (
                        <span className="truncate">Source: {soWhat.sourceRef}</span>
                      )}
                      <span>{formatDate(soWhat.createdDate)}</span>
                    </div>
                  </div>

                  <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
