import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SEO component that handles dynamic canonical tags for every page.
 * It ensures that regardless of the current hostname (e.g., lovable.app or www),
 * the canonical link always points to the primary domain: https://alphify.site
 */
export const SEO = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Standardize the canonical URL
    // 1. Base domain is always alphify.site
    // 2. Remove trailing slashes (except for the root) for consistency
    const baseDomain = 'https://alphify.site';
    const cleanPath = pathname === '/' ? '' : pathname.replace(/\/+$/, '');
    const canonicalUrl = `${baseDomain}${cleanPath}`;

    // Find or create the canonical link element
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;

    if (link) {
      link.setAttribute('href', canonicalUrl);
    } else {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      link.setAttribute('href', canonicalUrl);
      document.head.appendChild(link);
    }

    // Also update Open Graph and Twitter URLs for better sharing consistency
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', canonicalUrl);

    const twitterUrl = document.querySelector('meta[name="twitter:url"]');
    if (twitterUrl) twitterUrl.setAttribute('content', canonicalUrl);

  }, [pathname]);

  return null;
};

export default SEO;
