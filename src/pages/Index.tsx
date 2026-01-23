import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, ArrowRight, BookOpen, Brain, FileText, GraduationCap } from 'lucide-react';

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen xp-bg-gradient relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-xp-glow/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl xp-gradient flex items-center justify-center font-display font-bold text-lg text-primary-foreground xp-glow-sm">
            Xp
          </div>
          <span className="font-display font-semibold text-xl text-foreground">Xplane</span>
        </div>
        
        <nav className="flex items-center gap-4">
          {user ? (
            <Button onClick={() => navigate('/dashboard')} className="xp-gradient text-primary-foreground">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
              <Button onClick={() => navigate('/auth')} className="xp-gradient text-primary-foreground xp-glow-sm">
                Get Started
              </Button>
            </>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-primary font-medium">AI-Powered Learning</span>
        </div>

        <h1 className="font-display text-5xl md:text-7xl font-bold max-w-4xl mb-6 animate-fade-in-up">
          <span className="text-foreground">Understand</span>{' '}
          <span className="gradient-text">Complex Topics</span>{' '}
          <span className="text-foreground">Simply</span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mb-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Your personal AI tutor that breaks down difficult university concepts using real-world examples 
          from your everyday student life. Learn faster, understand deeper.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <Button 
            size="lg" 
            onClick={() => navigate(user ? '/dashboard' : '/auth')}
            className="xp-gradient text-primary-foreground px-8 py-6 text-lg xp-glow"
          >
            Start Learning Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            className="px-8 py-6 text-lg border-border hover:bg-secondary"
          >
            See How It Works
          </Button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-24 max-w-6xl w-full">
          {[
            {
              icon: Brain,
              title: 'Smart Explanations',
              description: 'Complex topics broken down using examples from your daily life'
            },
            {
              icon: FileText,
              title: 'Upload Documents',
              description: 'Upload PDFs and files - AI explains them in simple terms'
            },
            {
              icon: BookOpen,
              title: 'Personal Library',
              description: 'All your documents saved and organized for easy access'
            },
            {
              icon: GraduationCap,
              title: 'Adaptive Tests',
              description: 'Pop quizzes and tests to ensure you truly understand'
            }
          ].map((feature, index) => (
            <div 
              key={feature.title}
              className="glass-card p-6 rounded-2xl animate-fade-in-up hover:border-primary/30 transition-all duration-300"
              style={{ animationDelay: `${0.6 + index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-muted-foreground text-sm">
        <p>Built for university students who want to actually understand, not just memorize.</p>
      </footer>
    </div>
  );
}
