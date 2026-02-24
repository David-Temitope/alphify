import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, BookOpen, Brain, FileText, GraduationCap, Users, MessageSquare, Clock, CheckCircle, Sparkles } from 'lucide-react';
import alphifyLogo from '@/assets/alphify-logo.png';
import { blogPosts } from '@/data/blogPosts';
import { useEffect, useRef } from 'react';

function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: { x: number; y: number; r: number; dx: number; dy: number; o: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        o: Math.random() * 0.5 + 0.1,
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(187, 85%, 53%, ${p.o})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
}

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const features = [
    { icon: Brain, title: 'Smart Explanations', description: 'Complex topics broken down using examples from your daily life' },
    { icon: FileText, title: 'Upload Documents', description: 'Upload PDFs and images - Ezra explains them in simple terms' },
    { icon: BookOpen, title: 'Course Library', description: 'Shared course materials organized by university and department' },
    { icon: GraduationCap, title: 'Adaptive Tests', description: 'Pop quizzes and tests to ensure you truly understand' },
    { icon: Users, title: 'Study Sessions', description: 'Learn together with study groups and real-time collaboration' },
    { icon: MessageSquare, title: 'Community', description: 'Connect with study mates and share knowledge' },
  ];

  const howItWorks = [
    { step: '01', title: 'Sign Up Free', description: 'Create your account and set your preferences' },
    { step: '02', title: 'Ask Ezra', description: 'Type your question or upload study materials' },
    { step: '03', title: 'Learn & Test', description: 'Get simple explanations and take quizzes to reinforce learning' },
    { step: '04', title: 'Join Sessions', description: 'Collaborate with peers in live study sessions' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* ======= HERO SECTION ======= */}
      <section className="relative min-h-screen flex flex-col">
        {/* Animated particles */}
        <FloatingParticles />

        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
          <div className="flex items-center gap-3">
            <img src={alphifyLogo} alt="Alphify" className="w-10 h-10 rounded-xl shadow-lg shadow-primary/30" />
            <span className="font-display font-semibold text-xl text-foreground">Alphify</span>
          </div>
          <nav className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => navigate('/dashboard')} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25">
                Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/auth')} className="text-muted-foreground hover:text-foreground text-sm">Sign In</Button>
                <Button onClick={() => navigate('/auth')} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 text-sm">Get Started</Button>
              </>
            )}
          </nav>
        </header>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-20 pt-8 text-center">
          {/* Logo glow */}
          <div className="relative mb-8 animate-fade-in">
            <div className="absolute inset-0 w-24 h-24 mx-auto bg-primary/30 rounded-full blur-2xl" />
            <img src={alphifyLogo} alt="Alphify Logo" className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl shadow-2xl shadow-primary/40 mx-auto" />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-in">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-primary font-medium">AI-Powered Learning</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-5 animate-fade-in-up max-w-4xl leading-tight">
            Study Smarter{' '}
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-blue-500 bg-clip-text text-transparent">with Ezra</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-xl mb-10 animate-fade-in-up leading-relaxed" style={{ animationDelay: '0.15s' }}>
            Your AI study companion that breaks down complex topics, generates practice exams, and helps you ace university courses.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Button size="lg" onClick={() => navigate(user ? '/dashboard' : '/auth')} className="bg-gradient-to-r from-primary via-cyan-500 to-blue-500 text-primary-foreground px-10 py-6 text-lg shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all rounded-full">
              Start Learning Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Live stats pill */}
          <div className="mt-14 inline-flex items-center gap-4 px-6 py-3 rounded-full bg-card/60 backdrop-blur-xl border border-border/50 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-xp-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-xp-success" />
              </span>
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <span className="text-sm font-semibold text-foreground">10,000+</span>
            <span className="text-xs text-muted-foreground">Students learning right now</span>
          </div>
        </div>
      </section>

      {/* ======= FEATURES ======= */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need to <span className="text-primary">Excel</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Ezra combines AI explanations, document analysis, adaptive testing, and collaborative learning.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 hover:border-primary/40 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${0.08 * i}s` }}
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-base mb-1.5 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Personalized learning */}
          <div className="mt-24 grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/5 rounded-3xl blur-2xl" />
                <img alt="AI Features" className="relative rounded-3xl shadow-xl w-full max-w-md mx-auto border border-border/30" src="/lovable-uploads/cd4cfcf8-293a-4fda-9403-aab92c6235b7.png" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-6">
                Personalized Learning Experience
              </h3>
              <div className="space-y-4">
                {['Adapts to your learning style and pace', 'Uses real-world examples from your field of study', 'Remembers context from previous conversations', 'Provides quizzes to reinforce understanding'].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======= HOW IT WORKS ======= */}
      <section id="how-it-works" className="relative z-10 px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              How <span className="text-primary">Ezra</span> Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Get started in minutes</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, i) => (
              <div key={step.step} className="relative animate-fade-in-up" style={{ animationDelay: `${0.12 * i}s` }}>
                {i < howItWorks.length - 1 && <div className="hidden lg:block absolute top-8 left-[60%] w-full h-px bg-gradient-to-r from-primary/40 to-transparent" />}
                <div className="text-4xl font-display font-bold text-primary/15 mb-3">{step.step}</div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-1.5">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= COMMUNITY ======= */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
              Learn Together with <span className="text-primary">Study Sessions</span>
            </h2>
            <p className="text-muted-foreground mb-8">
              Join study groups, participate in live sessions led by Ezra, and compete with peers through real-time quizzes.
            </p>
            <div className="space-y-4 mb-8">
              {[
                { icon: Users, text: 'Create or join study groups' },
                { icon: Clock, text: 'Real-time collaborative sessions' },
                { icon: GraduationCap, text: 'Synchronized quizzes with leaderboards' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-foreground">{item.text}</p>
                </div>
              ))}
            </div>
            <Button onClick={() => navigate(user ? '/community' : '/auth')} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6">
              Explore Community <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-primary/5 rounded-3xl blur-2xl" />
            <img src="/lovable-uploads/aad7da7c-566e-4e11-b90d-652616e8bc3b.png" alt="Community Learning" className="relative rounded-3xl shadow-xl border border-border/30 w-full max-w-md mx-auto lg:ml-auto" />
          </div>
        </div>
      </section>

      {/* ======= BLOG ======= */}
      <section className="relative z-10 px-6 py-24" id="blog">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Study Tips for <span className="text-primary">Nigerian Students</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Practical advice to help you excel in your university exams
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {blogPosts.slice(0, 8).map((post, i) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-5 hover:border-primary/30 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 animate-fade-in-up block"
                style={{ animationDelay: `${0.08 * i}s` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{post.emoji}</span>
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">{post.tag}</span>
                </div>
                <h3 className="font-display font-semibold text-sm mb-2 text-foreground group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">{post.excerpt}</p>
                <div className="mt-3 text-primary text-xs font-medium flex items-center gap-1">Read more <ArrowRight className="h-3 w-3" /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ======= CTA ======= */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-3xl" />
            <div className="relative bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-12 md:p-16">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-5">
                Ready to Transform Your Learning?
              </h2>
              <p className="text-muted-foreground mb-10 max-w-lg mx-auto">
                Join thousands of students learning smarter with Ezra. Start for free today.
              </p>
              <Button size="lg" onClick={() => navigate(user ? '/dashboard' : '/auth')} className="bg-gradient-to-r from-primary via-cyan-500 to-blue-500 text-primary-foreground px-10 py-6 text-lg shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all rounded-full">
                Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ======= FOOTER ======= */}
      <footer className="relative z-10 border-t border-border/50 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={alphifyLogo} alt="Alphify" className="w-8 h-8 rounded-lg shadow-md" />
            <span className="font-display font-medium text-foreground">Alphify</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/terms')} className="text-muted-foreground text-sm hover:text-foreground transition-colors">Terms of Service</button>
          </div>
          <p className="text-muted-foreground text-sm">
            Built with ❤️ by <span className="text-primary font-medium">Alphadominity</span>
          </p>
          <p className="text-muted-foreground text-sm">© 2026 Alphadominity. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
