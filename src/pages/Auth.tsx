import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import alphifyLogo from '@/assets/alphify-logo.png';
import { useRef } from 'react';

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
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        o: Math.random() * 0.4 + 0.1,
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
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

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

        // Process referral code if provided
        if (referralCode.trim() && signUpData?.user) {
          try {
            await supabase.rpc('process_referral' as any, {
              _referral_code: referralCode.trim().toUpperCase(),
              _referred_user_id: signUpData.user.id,
            });
          } catch {
            // Silently fail - referral is optional
          }
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Floating particles */}
      <FloatingParticles />

      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <Button variant="ghost" onClick={() => navigate('/')} className="absolute top-6 left-6 z-10 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="w-full max-w-md animate-fade-in-up relative z-10">
        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 w-20 h-20 mx-auto bg-primary/30 rounded-full blur-2xl" />
            <img src={alphifyLogo} alt="Alphify" className="relative w-16 h-16 rounded-2xl shadow-2xl shadow-primary/40" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {isLogin ? 'Welcome Back' : 'Join Alphify'}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {isLogin ? 'Sign in to continue learning' : 'Start your learning journey'}
          </p>
        </div>

        {/* Form card */}
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 p-8 rounded-2xl shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-primary text-sm">Full Name</Label>
                  <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-secondary/50 border-border/50 focus:border-primary" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referralCode" className="text-primary text-sm">Referral Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="referralCode" type="text" placeholder="e.g. DAV001" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} className="bg-secondary/50 border-border/50 focus:border-primary uppercase" maxLength={10} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-primary text-sm">Email Address</Label>
              <Input id="email" type="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary/50 border-border/50 focus:border-primary" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-primary text-sm">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary/50 border-border/50 focus:border-primary pr-10" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-primary via-cyan-500 to-blue-500 text-primary-foreground py-6 shadow-lg shadow-primary/25 rounded-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card/80 px-2 text-muted-foreground">Or continue with</span></div>
          </div>

          <Button type="button" variant="outline" className="w-full mt-6 py-6 border-border/50 hover:bg-secondary/50 rounded-full" disabled={googleLoading} onClick={async () => {
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

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button onClick={() => setIsLogin(!isLogin)} className="ml-2 text-primary hover:underline font-medium">
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
            <button onClick={() => navigate('/terms')} className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
              By signing up, you agree to our Terms of Service
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
