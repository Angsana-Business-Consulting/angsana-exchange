'use client';

import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

// =============================================================================
// Types
// =============================================================================

type TagPillVariant = 'campaign' | 'proposition' | 'neutral';
type TagPillSize = 'sm' | 'xs';

interface TagPillProps {
  /** The full text to display */
  label: string;
  /** Colour variant — campaign (teal), proposition (mauve), or neutral (grey) */
  variant?: TagPillVariant;
  /** Max width in px before truncation with ellipsis (default 200) */
  maxWidth?: number;
  /** Size — "sm" (default) or "xs" for compact contexts */
  size?: TagPillSize;
  /** Additional CSS classes */
  className?: string;
  /** Optional click handler — adds pointer cursor */
  onClick?: () => void;
  /** Optional href — renders as an anchor instead of a span */
  href?: string;
}

// =============================================================================
// Variant styles
// =============================================================================

const variantStyles: Record<TagPillVariant, { bg: string; text: string }> = {
  campaign: { bg: '#E1F5EE', text: '#085041' },
  proposition: { bg: '#F0ECF1', text: '#5C4B63' },
  neutral: { bg: '#F1F5F9', text: '#475569' },
};

const sizeStyles: Record<TagPillSize, { fontSize: string; padding: string }> = {
  sm: { fontSize: '11px', padding: '3px 10px' },
  xs: { fontSize: '10px', padding: '2px 8px' },
};

// =============================================================================
// Portal Tooltip (avoids clipping by parent overflow containers)
// =============================================================================

function PortalTooltip({ text, anchorRect }: { text: string; anchorRect: DOMRect }) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position after first render when we can measure the tooltip
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      (tooltipRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      const ttRect = node.getBoundingClientRect();
      const gap = 6;

      // Position above the anchor, centred horizontally
      let top = anchorRect.top - ttRect.height - gap;
      let left = anchorRect.left + anchorRect.width / 2 - ttRect.width / 2;

      // If it would go off the top, show below instead
      if (top < 4) {
        top = anchorRect.bottom + gap;
      }
      // Clamp horizontally
      if (left < 4) left = 4;
      if (left + ttRect.width > window.innerWidth - 4) {
        left = window.innerWidth - ttRect.width - 4;
      }

      setPos({ top, left });
    },
    [anchorRect],
  );

  return createPortal(
    <div
      ref={setRef}
      className="fixed z-[99999] max-w-xs rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg pointer-events-none"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        opacity: pos ? 1 : 0,
        transition: 'opacity 100ms ease-in',
      }}
    >
      {text}
    </div>,
    document.body,
  );
}

// =============================================================================
// TagPill Component
// =============================================================================

export function TagPill({
  label,
  variant = 'campaign',
  maxWidth = 200,
  size = 'sm',
  className = '',
  onClick,
  href,
}: TagPillProps) {
  const textRef = useRef<HTMLSpanElement | HTMLAnchorElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Check truncation live on mouse enter — most reliable approach
  const handleMouseEnter = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    // scrollWidth > clientWidth means text is truncated by overflow:hidden
    if (el.scrollWidth > el.clientWidth + 1) {
      setAnchorRect(el.getBoundingClientRect());
      setShowTooltip(true);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
    setAnchorRect(null);
  }, []);

  const { bg, text } = variantStyles[variant];
  const { fontSize, padding } = sizeStyles[size];

  // Key fix: use display:inline-block (not inline-flex) + flexShrink:0
  // so the pill won't be compressed by a flex parent below its maxWidth.
  const pillStyle: React.CSSProperties = {
    display: 'inline-block',
    maxWidth,
    flexShrink: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    backgroundColor: bg,
    color: text,
    fontSize,
    padding,
    borderRadius: '9999px',
    fontWeight: 500,
    lineHeight: '1.4',
    verticalAlign: 'middle',
    cursor: onClick || href ? 'pointer' : 'default',
  };

  const hoverClass = onClick || href ? 'hover:opacity-80 transition-opacity' : '';
  const pillClassName = `${hoverClass} ${className}`.trim();

  if (href) {
    return (
      <>
        <a
          ref={textRef as React.RefObject<HTMLAnchorElement>}
          href={href}
          className={pillClassName}
          style={pillStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {label}
        </a>
        {showTooltip && anchorRect && <PortalTooltip text={label} anchorRect={anchorRect} />}
      </>
    );
  }

  return (
    <>
      <span
        ref={textRef as React.RefObject<HTMLSpanElement>}
        className={pillClassName}
        style={pillStyle}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {label}
      </span>
      {showTooltip && anchorRect && <PortalTooltip text={label} anchorRect={anchorRect} />}
    </>
  );
}
