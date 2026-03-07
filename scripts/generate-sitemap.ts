import fs from 'fs';
import path from 'path';
import { blogPosts } from '../src/data/blogPosts';

const BASE_URL = 'https://alphify.site';

function generateSitemap() {
  const blogPages = blogPosts.map(post => {
    // Determine priority based on the original sitemap's logic
    let priority = '0.8';
    const highPrioritySlugs = [
      'how-to-study-effectively-study-methods-2025',
      'how-to-prepare-for-cbt-exams',
      'how-to-use-past-questions-for-mastery',
      'how-to-pass-exams-without-cramming',
      'best-study-apps-for-academic-dominance'
    ];

    if (highPrioritySlugs.includes(post.slug)) {
      priority = '0.9';
    }

    return {
      url: `/blog/${post.slug}`,
      changefreq: 'monthly',
      priority,
    };
  });

  const staticPagesBefore = [
    { url: '/', changefreq: 'weekly', priority: '1.0' },
  ];

  const staticPagesAfter = [
    { url: '/terms', changefreq: 'yearly', priority: '0.3' },
  ];

  const allPages = [...staticPagesBefore, ...blogPages, ...staticPagesAfter];

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    page => `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  const publicPath = path.resolve(process.cwd(), 'public');
  const sitemapPath = path.join(publicPath, 'sitemap.xml');

  fs.writeFileSync(sitemapPath, sitemapContent);
  console.log(`Sitemap generated successfully at ${sitemapPath}`);
}

generateSitemap();
