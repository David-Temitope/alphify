import { useEffect } from 'react';

/**
 * Hook to manage the canonical link and an optional JSON-LD script for a page.
 * @param href The canonical URL of the page.
 * @param jsonLd Optional JSON-LD object to be injected as a script tag.
 * @param scriptId Optional ID for the JSON-LD script tag.
 */
export function useCanonical(href: string, jsonLd?: object, scriptId?: string) {
  useEffect(() => {
    // Canonical link management
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', href);

    // JSON-LD script management
    let scriptEl: HTMLScriptElement | null = null;
    if (jsonLd && scriptId) {
      scriptEl = document.getElementById(scriptId) as HTMLScriptElement;
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = scriptId;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      // Cleanup: remove the canonical link and JSON-LD script on unmount
      canonical?.remove();
      if (scriptEl) {
        scriptEl.remove();
      }
    };
  }, [href, jsonLd, scriptId]);
}
