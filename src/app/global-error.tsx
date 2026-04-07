'use client';

import { useEffect } from 'react';

/**
 * Global error boundary — catches unhandled errors at the root.
 *
 * ChunkLoadError: After a new deployment the chunk hashes change. If a user
 * has a stale HTML page cached, their browser requests old chunk filenames
 * that no longer exist (404). We detect this and do a full reload so the
 * browser fetches the fresh HTML (and therefore the correct chunk URLs).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error.name === 'ChunkLoadError' ||
    error.message?.includes('Loading chunk') ||
    error.message?.includes('Failed to fetch dynamically imported module');

  useEffect(() => {
    if (isChunkError) {
      // Prevent infinite reload loop — only reload once per session
      const key = 'chunk-error-reload';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
    }
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <html>
        <body style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
          <h2>Updating…</h2>
          <p style={{ color: '#666' }}>A new version is available. Reloading now.</p>
        </body>
      </html>
    );
  }

  return (
    <html>
      <body style={{ padding: '2rem', fontFamily: 'monospace' }}>
        <h1 style={{ color: 'red' }}>Global Error</h1>
        <pre style={{ background: '#fff0f0', padding: '1rem', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
          {error.message}
          {error.stack && '\n\n' + error.stack}
        </pre>
        <p>Digest: {error.digest || 'none'}</p>
        <button onClick={reset} style={{ padding: '8px 16px', background: 'red', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Try Again
        </button>
      </body>
    </html>
  );
}
