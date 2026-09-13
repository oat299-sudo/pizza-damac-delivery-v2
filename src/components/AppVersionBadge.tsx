import React, { useEffect, useState } from 'react';

/**
 * Small "v1.2.0" badge so anyone can see which version is live on pizzadamac.com.
 * Reads /api/version (served by Cloud Run) → { version, revision }.
 *   version  = package.json "version" (bumped on every release, see VERSIONING.md)
 *   revision = Cloud Run revision id (changes on every deploy)
 * Shown in the customer footer and on the Staff Access login screen.
 */
export default function AppVersionBadge({ className = '' }: { className?: string }) {
  const [info, setInfo] = useState<{ version?: string; revision?: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/version', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (active && d) setInfo(d); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!info?.version) return null;
  const rev = info.revision ? String(info.revision).split('-').slice(-2).join('-') : '';
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] tracking-wide opacity-70 ${className}`}
      title={info.revision ? `Cloud Run revision: ${info.revision}` : undefined}
    >
      v{info.version}{rev ? <span className="opacity-60">· {rev}</span> : null}
    </span>
  );
}
