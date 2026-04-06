'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SoWhat, UserRole, ManagedListItem, Campaign } from '@/types';
import { SOWHAT_STATUS_CONFIG, SOWHAT_ORIENTATION_CONFIG } from '@/types';

interface Props {
  clientId: string;
  soWhat: SoWhat;
  titleBands: ManagedListItem[];
  usedInCampaigns: Pick<Campaign, 'id' | 'campaignName' | 'status'>[];
  userRole: UserRole;
  userEmail: string;
}

function isInternal(role: UserRole) {
  return role === 'internal-admin' || role === 'internal-user';
}

export default function SoWhatDetailClient({
  clientId,
  soWhat,
  titleBands,
  usedInCampaigns,
  userRole,
  userEmail,
}: Props) {
  const router = useRouter();
  const [actionInProgress, setActionInProgress] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState<'approve' | 'retire' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const statusConfig = SOWHAT_STATUS_CONFIG[soWhat.status];

  const canEdit =
    isInternal(userRole) ||
    (userRole === 'client-approver' &&
      soWhat.createdBy === userEmail &&
      soWhat.status === 'draft');

  const canChangeStatus = isInternal(userRole);
  const canDelete = userRole === 'internal-admin';

  const getAudienceLabel = (tagId: string) => {
    return titleBands.find((tb) => tb.id === tagId)?.label || tagId;
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleStatusChange = async (action: 'approve' | 'retire' | 'revert-to-draft') => {
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/sowhats/${soWhat.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToastMsg(`Error: ${data.error}`);
        return;
      }
      setShowStatusConfirm(null);
      router.refresh();
    } catch {
      showToastMsg('Failed to update status');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDelete = async () => {
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/sowhats/${soWhat.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        showToastMsg(`Error: ${data.error}`);
        return;
      }
      router.push(`/clients/${clientId}/sowhats`);
      router.refresh();
    } catch {
      showToastMsg('Failed to delete');
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with status badge and actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{soWhat.headline}</h1>
            <span
              className="inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-medium"
              style={{ color: statusConfig.colour, backgroundColor: statusConfig.bgColour }}
            >
              {statusConfig.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Created by {soWhat.createdBy} on {formatDate(soWhat.createdDate)}
            {soWhat.updatedBy !== soWhat.createdBy && (
              <> · Last edited by {soWhat.updatedBy}</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canEdit && (
            <button
              onClick={() =>
                router.push(`/clients/${clientId}/sowhats/${soWhat.id}/edit`)
              }
              className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Edit
            </button>
          )}
          <Link
            href={`/clients/${clientId}/sowhats`}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md border border-gray-300 hover:bg-gray-50 inline-flex items-center"
          >
            Back to Library
          </Link>
        </div>
      </div>

      {/* Content sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column — content */}
        <div className="space-y-6">
          {/* Email Version */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Email Version</h3>
            <p className="text-sm text-gray-900 leading-relaxed">{soWhat.emailVersion}</p>
          </div>

          {/* Supporting Evidence */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Supporting Evidence</h3>
            <p className="text-sm text-gray-900 leading-relaxed">{soWhat.supportingEvidence}</p>
          </div>

          {/* Source Reference */}
          {soWhat.sourceRef && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Source Reference</h3>
              <p className="text-sm text-gray-900">{soWhat.sourceRef}</p>
            </div>
          )}
        </div>

        {/* Right column — metadata, status, campaigns */}
        <div className="space-y-6">
          {/* Tags */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Audience</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {soWhat.audienceTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  {getAudienceLabel(tag)}
                </span>
              ))}
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">Orientation</h3>
            <div className="flex flex-wrap gap-2">
              {soWhat.orientationTags.map((tag) => {
                const cfg = SOWHAT_ORIENTATION_CONFIG[tag];
                return (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                    style={{ color: cfg.colour, backgroundColor: cfg.bgColour }}
                  >
                    {cfg.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Status Controls (internal users only) */}
          {canChangeStatus && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Status Controls</h3>
              <div className="flex flex-wrap gap-2">
                {soWhat.status === 'draft' && (
                  <button
                    onClick={() => setShowStatusConfirm('approve')}
                    disabled={actionInProgress}
                    className="px-4 py-2 text-sm font-medium text-white rounded-md bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {soWhat.status === 'approved' && (
                  <button
                    onClick={() => setShowStatusConfirm('retire')}
                    disabled={actionInProgress}
                    className="px-4 py-2 text-sm font-medium text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Retire
                  </button>
                )}
                {soWhat.status !== 'draft' && (
                  <button
                    onClick={() => handleStatusChange('revert-to-draft')}
                    disabled={actionInProgress}
                    className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Revert to Draft
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Used in Campaigns */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Used in Campaigns</h3>
            {usedInCampaigns.length === 0 ? (
              <p className="text-sm text-gray-400">Not currently used in any campaigns.</p>
            ) : (
              <ul className="space-y-2">
                {usedInCampaigns.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/clients/${clientId}/campaigns/${c.id}`}
                      className="text-sm text-[var(--primary)] hover:underline"
                    >
                      {c.campaignName}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Delete (admin only) */}
          {canDelete && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5">
              <h3 className="text-sm font-medium text-red-700 mb-2">Danger Zone</h3>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-medium text-red-700 rounded-md border border-red-300 hover:bg-red-100 disabled:opacity-50"
              >
                Delete So What
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Confirmation Dialog */}
      {showStatusConfirm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowStatusConfirm(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {showStatusConfirm === 'approve' ? 'Approve So What?' : 'Retire So What?'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {showStatusConfirm === 'approve'
                  ? 'This So What will become available for campaign selection.'
                  : "This So What will be removed from campaign selection. Campaigns already using it will retain it with a 'retired' indicator."}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowStatusConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleStatusChange(showStatusConfirm)}
                  disabled={actionInProgress}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${
                    showStatusConfirm === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {actionInProgress
                    ? 'Processing...'
                    : showStatusConfirm === 'approve'
                      ? 'Approve'
                      : 'Retire'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-red-700 mb-2">Delete So What?</h3>
              <p className="text-sm text-gray-600 mb-4">
                This action cannot be undone. The So What will be permanently deleted.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionInProgress}
                  className="px-4 py-2 text-sm font-medium text-white rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {actionInProgress ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
