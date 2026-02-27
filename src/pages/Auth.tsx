import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ArrowLeft, Loader2, BookOpen, Brain, Zap } from 'lucide-react';
import alphifyLogo from '@/assets/alphify-logo.webp';

function HexGrid() {
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

    let time = 0;
    let animId: number;

    const drawHex = (cx: number, cy: number, r: number, opacity: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `hsla(187, 85%, 53%, ${opacity})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const size = 40;
      const h = size * Math.sqrt(3);
      for (let row = -1; row < canvas.height / h + 1; row++) {
        for (let col = -1; col < canvas.width / (size * 1.5) + 1; col++) {
          const cx = col * size * 1.5;
          const cy = row * h + (col % 2 ? h / 2 : 0);
          const dist = Math.sqrt((cx - canvas.width / 2) ** 2 + (cy - canvas.height / 2) ** 2);
          const wave = Math.sin(dist * 0.005 - time * 0.02) * 0.5 + 0.5;
          const opacity = wave * 0.08;
          if (opacity > 0.01) drawHex(cx, cy, size * 0.45, opacity);
        }
      }
      time++;
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

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user) navigate('/dashboard');
  }, [user, authLoading, navigate]);

  // Set canonical link for security scanners
  useEffect(() => {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = 'https://alphify.site/auth';
    document.title = isLogin ? 'Sign In — Alphify' : 'Create Account — Alphify';
    return () => { document.title = 'Alphify — AI Study Companion for Nigerian University Students'; };
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
        });
        if (error) throw error;
        if (referralCode.trim() && signUpData?.user) {
          try {
            await supabase.rpc('process_referral' as any, {
              _referral_code: referralCode.trim().toUpperCase(),
              _referred_user_id: signUpData.user.id,
            });
          } catch { /* Silently fail - referral is optional */ }
        }
        toast({ title: 'Welcome to Alphify! 🎉', description: "Your account has been created. Let's start learning!" });
        navigate('/dashboard');
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'An unknown error occurred', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Brain, label: 'AI Tutor Ezra', desc: 'Get instant explanations tailored to you' },
    { icon: BookOpen, label: 'CBT Exam Mode', desc: 'Practice with real exam simulations' },
    { icon: Zap, label: 'Smart Study Groups', desc: 'Collaborate with AI-powered sessions' },
  ];

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      <HexGrid />

      {/* Left panel - branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center px-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-4 mb-10">
            <img src={alphifyLogo} alt="Alphify Logo" className="w-14 h-14 rounded-2xl shadow-xl shadow-primary/30" />
            <div>
              <h2 className="font-display text-3xl font-bold text-foreground">Alphify</h2>
              <p className="text-sm text-primary font-medium tracking-wide">AI Study Companion</p>
            </div>
          </div>

          <h1 className="font-display text-4xl font-bold text-foreground leading-tight mb-6">
            Study smarter,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-400 to-blue-400">not harder.</span>
          </h1>

          <div className="space-y-5 mt-10">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{f.label}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 pt-6 border-t border-border/30">
            <p className="text-xs text-muted-foreground">Trusted by thousands of Nigerian university students</p>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <Button variant="ghost" onClick={() => navigate('/')} className="absolute top-6 left-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="relative mb-3">
              <div className="absolute inset-0 w-16 h-16 mx-auto bg-primary/30 rounded-full blur-2xl" />
              <img src={alphifyLogo} alt="Alphify Logo" className="relative w-14 h-14 rounded-2xl shadow-xl shadow-primary/30" />
            </div>
            <h1 className="font-display text-xl font-bold text-foreground">Alphify</h1>
          </div>

          {/* Tab toggle */}
          <div className="flex bg-secondary/50 rounded-2xl p-1 mb-8 border border-border/30">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${isLogin ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${!isLogin ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" method="POST" action="/auth">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
                  <Input
                    id="fullName" name="fullName" type="text" placeholder="John Doe"
                    value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="bg-secondary/30 border-border/40 focus:border-primary h-12 rounded-xl"
                    required autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="referralCode" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Referral Code <span className="normal-case text-muted-foreground/60">(optional)</span>
                  </Label>
                  <Input
                    id="referralCode" name="referralCode" type="text" placeholder="e.g. DAV001"
                    value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="bg-secondary/30 border-border/40 focus:border-primary h-12 rounded-xl uppercase" maxLength={10}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</Label>
              <Input
                id="email" name="email" type="email" placeholder="you@university.edu"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/30 border-border/40 focus:border-primary h-12 rounded-xl"
                required autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</Label>
              <div className="relative">
                <Input
                  id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="bg-secondary/30 border-border/40 focus:border-primary h-12 rounded-xl pr-10"
                  required minLength={6} autoComplete={isLogin ? "current-password" : "new-password"}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-to-r from-primary to-cyan-500 text-primary-foreground shadow-lg shadow-primary/20 rounded-xl text-sm font-semibold mt-2">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/40" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">or</span></div>
          </div>

          {/* Google */}
          <Button type="button" variant="outline" className="w-full h-12 border-border/40 hover:bg-secondary/50 rounded-xl" disabled={googleLoading} onClick={async () => {
            setGoogleLoading(true);
            try {
              const { error } = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
              if (error) throw error;
            } catch (error) {
              toast({ title: 'Error', description: error instanceof Error ? error.message : 'Google sign-in failed', variant: 'destructive' });
              setGoogleLoading(false);
            }
          }}>
            {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continue with Google
          </Button>

          {/* Terms */}
          <div className="mt-6 text-center">
            <button onClick={() => navigate('/terms')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              By continuing, you agree to our Terms of Service
            </button>
          </div>

          {/* Site identity footer */}
          <div className="mt-8 text-center text-xs text-muted-foreground/60">
            <p>© {new Date().getFullYear()} Alphify by Alphadominity</p>
            <p className="mt-1">
              <a href="https://alphify.site" className="hover:text-foreground transition-colors">alphify.site</a>
              {' · '}
              <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
