'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SoWhat, SoWhatOrientation, ManagedListItem } from '@/types';

// ---------------------------------------------------------------------------
// Guidance Panel — always visible, non-dismissible
// ---------------------------------------------------------------------------

function GuidancePanel() {
  return (
    <div
      className="rounded-lg border-l-4 p-4 mb-6"
      style={{
        borderLeftColor: '#3B7584',
        backgroundColor: '#E8F4F8',
      }}
    >
      <p className="text-sm leading-relaxed text-gray-700">
        A So What answers one question: <strong>why should the prospect care?</strong> It&apos;s
        not a product description. It&apos;s not a feature list. It&apos;s the thing that makes
        someone on a cold call say &ldquo;tell me more&rdquo; or makes someone reading an email
        click reply.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-gray-700">
        Write the headline like you&apos;d say it — short, specific, provable. If you can&apos;t
        say it in one breath, shorten it. The email version should work dropped into an email body
        with no extra context. Every So What needs evidence — if you can&apos;t prove it, don&apos;t
        claim it.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Character Counter
// ---------------------------------------------------------------------------

function CharCounter({ current, max }: { current: number; max: number }) {
  const pct = current / max;
  let colour = 'text-gray-400';
  if (pct >= 0.95) colour = 'text-red-500';
  else if (pct >= 0.8) colour = 'text-amber-500';

  return (
    <span className={`text-xs ${colour}`}>
      {current} / {max}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Orientation Options
// ---------------------------------------------------------------------------

const ORIENTATION_OPTIONS: { value: SoWhatOrientation; label: string }[] = [
  { value: 'internal-facing', label: 'Internal-facing' },
  { value: 'external-facing', label: 'External-facing' },
  { value: 'both', label: 'Both' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  clientId: string;
  titleBands: ManagedListItem[];
  /** If provided, we're editing an existing So What */
  soWhat?: SoWhat;
  /** Mode — create or edit */
  mode: 'create' | 'edit';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SoWhatForm({ clientId, titleBands, soWhat, mode }: Props) {
  const router = useRouter();

  const [headline, setHeadline] = useState(soWhat?.headline || '');
  const [emailVersion, setEmailVersion] = useState(soWhat?.emailVersion || '');
  const [supportingEvidence, setSupportingEvidence] = useState(soWhat?.supportingEvidence || '');
  const [audienceTags, setAudienceTags] = useState<string[]>(soWhat?.audienceTags || []);
  const [orientationTags, setOrientationTags] = useState<SoWhatOrientation[]>(
    soWhat?.orientationTags || []
  );
  const [sourceRef, setSourceRef] = useState(soWhat?.sourceRef || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleAudienceTag = (tagId: string) => {
    setAudienceTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const toggleOrientationTag = (value: SoWhatOrientation) => {
    setOrientationTags((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const isValid =
    headline.trim().length > 0 &&
    headline.length <= 80 &&
    emailVersion.trim().length > 0 &&
    emailVersion.length <= 200 &&
    supportingEvidence.trim().length > 0 &&
    supportingEvidence.length <= 300 &&
    audienceTags.length > 0 &&
    orientationTags.length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const body = {
      headline: headline.trim(),
      emailVersion: emailVersion.trim(),
      supportingEvidence: supportingEvidence.trim(),
      audienceTags,
      orientationTags,
      sourceRef: sourceRef.trim(),
    };

    try {
      if (mode === 'create') {
        const res = await fetch(`/api/clients/${clientId}/sowhats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to create So What');
          return;
        }

        setSuccessMessage(
          'So What created as draft. An internal user will review and approve it for campaign use.'
        );
        // Navigate back after a brief delay to show the success message
        setTimeout(() => {
          router.push(`/clients/${clientId}/sowhats`);
          router.refresh();
        }, 1500);
      } else {
        // Edit mode
        const res = await fetch(`/api/clients/${clientId}/sowhats/${soWhat!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to update So What');
          return;
        }

        setSuccessMessage('So What updated.');
        setTimeout(() => {
          router.push(`/clients/${clientId}/sowhats/${soWhat!.id}`);
          router.refresh();
        }, 1000);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <GuidancePanel />

      <div className="space-y-6">
        {/* Headline */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Headline <span className="text-red-500">*</span>
          </label>
          <textarea
            value={headline}
            onChange={(e) => {
              // Prevent line breaks
              const val = e.target.value.replace(/\n/g, '');
              if (val.length <= 80) setHeadline(val);
            }}
            rows={1}
            maxLength={80}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] resize-none"
            placeholder="What you'd say on the phone in one breath."
          />
          <div className="mt-1 flex justify-between">
            <p className="text-xs text-gray-400">What you&apos;d say on the phone in one breath.</p>
            <CharCounter current={headline.length} max={80} />
          </div>
        </div>

        {/* Email Version */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Version <span className="text-red-500">*</span>
          </label>
          <textarea
            value={emailVersion}
            onChange={(e) => {
              if (e.target.value.length <= 200) setEmailVersion(e.target.value);
            }}
            rows={3}
            maxLength={200}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] resize-none"
            placeholder="Drop this into an email body. No preamble needed."
          />
          <div className="mt-1 flex justify-between">
            <p className="text-xs text-gray-400">Drop this into an email body. No preamble needed.</p>
            <CharCounter current={emailVersion.length} max={200} />
          </div>
        </div>

        {/* Supporting Evidence */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supporting Evidence <span className="text-red-500">*</span>
          </label>
          <textarea
            value={supportingEvidence}
            onChange={(e) => {
              if (e.target.value.length <= 300) setSupportingEvidence(e.target.value);
            }}
            rows={3}
            maxLength={300}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] resize-none"
            placeholder="The proof. A stat, a case study, a named result."
          />
          <div className="mt-1 flex justify-between">
            <p className="text-xs text-gray-400">The proof. A stat, a case study, a named result. Why should the prospect believe you?</p>
            <CharCounter current={supportingEvidence.length} max={300} />
          </div>
        </div>

        {/* Audience Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Audience <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {titleBands.map((tb) => {
              const selected = audienceTags.includes(tb.id);
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => toggleAudienceTag(tb.id)}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                    selected
                      ? 'border-transparent text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                  style={selected ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : undefined}
                >
                  {tb.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-gray-400">Who does this resonate with?</p>
          {audienceTags.length === 0 && (
            <p className="mt-1 text-xs text-red-500">At least one audience tag is required.</p>
          )}
        </div>

        {/* Orientation Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Orientation <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ORIENTATION_OPTIONS.map((opt) => {
              const selected = orientationTags.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleOrientationTag(opt.value)}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                    selected
                      ? 'border-transparent text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                  style={selected ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : undefined}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-gray-400">Is this for internal contacts, external contacts, or both?</p>
          {orientationTags.length === 0 && (
            <p className="mt-1 text-xs text-red-500">At least one orientation tag is required.</p>
          )}
        </div>

        {/* Source Reference */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source Reference
          </label>
          <input
            type="text"
            value={sourceRef}
            onChange={(e) => {
              if (e.target.value.length <= 200) setSourceRef(e.target.value);
            }}
            maxLength={200}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
            placeholder="Where does this come from? White paper, case study, briefing document."
          />
          <div className="mt-1 flex justify-between">
            <p className="text-xs text-gray-400">Where does this come from? White paper, case study, briefing document.</p>
            <CharCounter current={sourceRef.length} max={200} />
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={saving || !isValid}
            className="px-6 py-2.5 text-sm font-medium text-white rounded-md disabled:opacity-50 shadow-sm"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {saving
              ? mode === 'create'
                ? 'Creating...'
                : 'Saving...'
              : mode === 'create'
                ? 'Create So What'
                : 'Save Changes'}
          </button>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
