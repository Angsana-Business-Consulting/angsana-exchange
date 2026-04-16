'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
import type { RelationshipEntry } from '@/types';
import {
  RELATIONSHIP_TYPE_CONFIG,
  AGREEMENT_TYPE_CONFIG,
  AGREEMENT_STATUS_CONFIG,
} from '@/types';

interface RelationshipCardProps {
  entry: RelationshipEntry;
}

/**
 * Individual relationship card with core fields and expandable MSA-PSL section.
 * Cards without agreements have no expand chevron.
 */
export default function RelationshipCard({ entry }: RelationshipCardProps) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = RELATIONSHIP_TYPE_CONFIG[entry.relationshipType];
  const hasAgreement = entry.hasAgreement === true;

  // Build the scope detail line: brandOrDivision • service • geography
  const scopeParts = [entry.brandOrDivision, entry.service, entry.geography].filter(Boolean);

  return (
    <div
      className={`rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md ${
        entry.status === 'archived' ? 'opacity-60' : ''
      }`}
    >
      {/* Core fields — always visible */}
      <div
        className={`p-4 ${hasAgreement ? 'cursor-pointer' : ''}`}
        onClick={() => hasAgreement && setExpanded(!expanded)}
      >
        {/* Row 1: Company name + badges */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{entry.companyName}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Agreement type pill */}
            {hasAgreement && entry.agreementType && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: '#E0F2F7',
                  color: '#004156',
                }}
              >
                {AGREEMENT_TYPE_CONFIG[entry.agreementType].label}
              </span>
            )}
            {/* Relationship type badge */}
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: typeConfig.bgColour,
                color: typeConfig.colour,
              }}
            >
              {typeConfig.label}
            </span>
            {/* Expand chevron for agreement entries */}
            {hasAgreement && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="ml-1 text-gray-400 hover:text-gray-600"
                aria-label={expanded ? 'Collapse agreement details' : 'Expand agreement details'}
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
            {/* Three-dot menu (disabled placeholder) */}
            <button
              disabled
              className="ml-1 text-gray-300 cursor-not-allowed"
              title="Actions coming in next update"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Row 2: Scope line */}
        {scopeParts.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            {scopeParts.join(' \u2022 ')}
          </p>
        )}

        {/* Row 3: Key contacts */}
        {entry.keyContacts && (
          <p className="mt-1 text-xs text-gray-500">
            <span className="text-gray-400">Contacts:</span> {entry.keyContacts}
          </p>
        )}

        {/* Row 4: Tenure */}
        {entry.tenure && (
          <p className="mt-0.5 text-[11px] text-gray-400">
            Tenure: {entry.tenure}
          </p>
        )}

        {/* Notes */}
        {entry.notes && (
          <p className="mt-1 text-[11px] text-gray-400 italic">{entry.notes}</p>
        )}
      </div>

      {/* Expandable MSA-PSL section */}
      {hasAgreement && expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-2.5">
          {/* Agreement header: type badge + status badge */}
          <div className="flex items-center gap-2">
            {entry.agreementType && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: '#E0F2F7',
                  color: '#004156',
                }}
              >
                {AGREEMENT_TYPE_CONFIG[entry.agreementType].label}
              </span>
            )}
            {entry.agreementStatus && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: AGREEMENT_STATUS_CONFIG[entry.agreementStatus].bgColour,
                  color: AGREEMENT_STATUS_CONFIG[entry.agreementStatus].colour,
                }}
              >
                {AGREEMENT_STATUS_CONFIG[entry.agreementStatus].label}
              </span>
            )}
          </div>

          {/* Scope */}
          {entry.agreementScope && (
            <p className="text-xs text-gray-600">{entry.agreementScope}</p>
          )}

          {/* Dates */}
          {(entry.startDate || entry.endDate) && (
            <p className="text-[11px] text-gray-500">
              {formatDate(entry.startDate)}
              {' — '}
              {entry.endDate ? formatDate(entry.endDate) : 'Open-ended'}
            </p>
          )}

          {/* Where we're working */}
          {entry.whereWorking && entry.whereWorking.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-700 mb-1">Where we&apos;re working</p>
              <ul className="space-y-0.5">
                {entry.whereWorking.map((item, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-gray-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Where we could go */}
          {entry.whereCould && entry.whereCould.length > 0 && (
            <div className="border-l-2 border-dashed border-teal-300 pl-3">
              <p className="text-[11px] font-semibold text-teal-700 mb-1">Where we could go</p>
              <ul className="space-y-0.5">
                {entry.whereCould.map((item, i) => (
                  <li key={i} className="text-xs text-teal-600 flex items-start gap-1.5">
                    <span className="text-teal-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Format ISO date string to readable date. */
function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
