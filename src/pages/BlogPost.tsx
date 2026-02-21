import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, ArrowRight, Clock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBlogPostBySlug, blogPosts } from '@/data/blogPosts';
import alphifyLogo from '@/assets/alphify-logo.png';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const post = slug ? getBlogPostBySlug(slug) : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Post not found</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const otherPosts = blogPosts.filter(p => p.slug !== slug).slice(0, 3);
  const readingTime = Math.ceil(post.content.split(/\s+/).length / 200);

  return (
    <>
      {/* SEO Meta Tags via Helmet-like approach using useEffect */}
      <MetaTags post={post} />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
            <Link to="/" className="flex items-center gap-3">
              <img src={alphifyLogo} alt="Alphify" className="w-8 h-8 rounded-lg" />
              <span className="font-display font-semibold text-foreground">Alphify</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </div>
        </header>

        {/* Article */}
        <article className="max-w-3xl mx-auto px-6 py-12">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className="text-2xl">{post.emoji}</span>
            <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full flex items-center gap-1">
              <Tag className="h-3 w-3" /> {post.tag}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {readingTime} min read
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(post.publishedDate).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
            {post.title}
          </h1>

          <p className="text-lg text-muted-foreground mb-10 leading-relaxed border-l-4 border-primary pl-4">
            {post.excerpt}
          </p>

          {/* Content */}
          <div className="prose-custom">
            <ReactMarkdown
              components={{
                h2: ({ children }) => <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xl font-semibold text-foreground mt-8 mb-3">{children}</h3>,
                p: ({ children }) => <p className="text-foreground/80 mb-5 leading-relaxed text-base">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-6 mb-5 space-y-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-6 mb-5 space-y-2">{children}</ol>,
                li: ({ children }) => <li className="text-foreground/80 leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary/30 pl-4 my-6 text-muted-foreground italic">{children}</blockquote>
                ),
                hr: () => <hr className="my-8 border-border" />,
                a: ({ href, children }) => (
                  <Link to={href || '/'} className="text-primary underline hover:text-primary/80 transition-colors">
                    {children}
                  </Link>
                ),
                code: ({ children }) => (
                  <code className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono text-primary">{children}</code>
                ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* CTA */}
          <div className="mt-12 bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
            <h3 className="font-display text-xl font-bold text-foreground mb-3">
              Ready to Study Smarter?
            </h3>
            <p className="text-muted-foreground mb-6">
              Join thousands of students using Alphify's AI tutor Ezra to understand complex topics and ace their exams.
            </p>
            <Button onClick={() => navigate('/auth')} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Start Learning Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </article>

        {/* Related Posts */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <h2 className="font-display text-2xl font-bold text-foreground mb-8">More Study Tips</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {otherPosts.map(p => (
              <Link
                key={p.slug}
                to={`/blog/${p.slug}`}
                className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{p.emoji}</span>
                  <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">{p.tag}</span>
                </div>
                <h3 className="font-semibold text-sm text-foreground mb-2 line-clamp-2">{p.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8 text-center">
          <p className="text-sm text-muted-foreground">© 2025 Alphify by Alphadominity. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}

// Update document title and meta tags
function MetaTags({ post }: { post: ReturnType<typeof getBlogPostBySlug> }) {
  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} | Alphify Blog`;
    
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        if (name.startsWith('og:')) {
          el.setAttribute('property', name);
        } else {
          el.setAttribute('name', name);
        }
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', post.metaDescription);
    setMeta('keywords', post.keywords.join(', '));
    setMeta('og:title', post.title);
    setMeta('og:description', post.metaDescription);
    setMeta('og:type', 'article');
    setMeta('og:url', `https://alphify.lovable.app/blog/${post.slug}`);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', post.title);
    setMeta('twitter:description', post.metaDescription);

    return () => {
      document.title = 'Alphify — AI Study Companion';
    };
  }, [post]);

  if (!post) return null;

  return null;
}
