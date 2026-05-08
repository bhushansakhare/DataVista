// Sandboxed iframe used to render raw-HTML templates.
//
// SECURITY:
// `sandbox="allow-scripts"` lets the template's JS run (so user templates
// with their own chart libraries / animations / interactions still work),
// but the iframe is a UNIQUE ORIGIN — it cannot read the parent window's
// cookies, localStorage, or sessionStorage. This is the standard secure
// pattern for user-supplied HTML and is non-negotiable in a multi-tenant
// SaaS context. Without it, a workspace member could plant a script in a
// template that exfiltrates other users' session tokens.
//
// We deliberately do NOT add `allow-same-origin` (would defeat the
// boundary), `allow-top-navigation` (would let the iframe redirect the
// user away), or `allow-popups-to-escape-sandbox`.

import { useMemo } from 'react';

/**
 * @param {object} props
 * @param {string} [props.html]      — full HTML document (or fragment) to render via srcDoc.
 * @param {string} [props.url]       — external URL to load via src.
 * @param {string|number} [props.height='800px']
 * @param {string} [props.title='Template preview']
 * @param {boolean} [props.rounded=true] — show rounded corners (set false when the iframe is already inside a rounded container).
 */
export default function TemplateIframe({ html, url, height = '800px', title = 'Template preview', rounded = true }) {
  // For srcDoc: if the user pasted only a fragment (no <html>/<body>), wrap
  // it so styling and viewport scaling behave predictably. If they pasted a
  // full document, leave it alone byte-for-byte.
  const srcDoc = useMemo(() => {
    if (!html) return undefined;
    const looksLikeFullDoc = /<\s*html\b/i.test(html) || /<!doctype/i.test(html);
    if (looksLikeFullDoc) return html;
    return (
      `<!doctype html><html><head>` +
      `<meta charset="utf-8"/>` +
      `<meta name="viewport" content="width=device-width,initial-scale=1"/>` +
      `<style>html,body{margin:0;padding:0;background:transparent;font-family:system-ui,-apple-system,sans-serif;color:#0f172a}</style>` +
      `</head><body>${html}</body></html>`
    );
  }, [html]);

  if (!html && !url) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-ink-500">
        Nothing to preview yet — paste a template or enter a URL.
      </div>
    );
  }

  return (
    <iframe
      title={title}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      src={url || undefined}
      style={{
        width: '100%',
        height,
        border: 0,
        borderRadius: rounded ? '12px' : 0,
        background: 'transparent',
        display: 'block',
      }}
      // Don't allow loading auth-credentialed resources from arbitrary
      // origins. Public assets still load (CDN libraries, images, fonts).
      referrerPolicy="no-referrer"
    />
  );
}
