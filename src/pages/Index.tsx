import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, BookOpen, Brain, FileText, GraduationCap, Users, MessageSquare, Clock, CheckCircle } from 'lucide-react';
import gideonHero from '@/assets/gideon-hero.jpg';
import robotFeatures from '@/assets/robot-features.jpg';
import robotCommunity from '@/assets/robot-community.png';
import xplaneLogo from '@/assets/xplane-logo.png';
export default function Index() {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const features = [{
    icon: Brain,
    title: 'Smart Explanations',
    description: 'Complex topics broken down using examples from your daily life'
  }, {
    icon: FileText,
    title: 'Upload Documents',
    description: 'Upload PDFs and images - Gideon explains them in simple terms'
  }, {
    icon: BookOpen,
    title: 'Personal Library',
    description: 'All your documents saved and organized for easy access'
  }, {
    icon: GraduationCap,
    title: 'Adaptive Tests',
    description: 'Pop quizzes and tests to ensure you truly understand'
  }, {
    icon: Users,
    title: 'Study Sessions',
    description: 'Learn together with study groups and real-time collaboration'
  }, {
    icon: MessageSquare,
    title: 'Community',
    description: 'Connect with study mates and share knowledge'
  }];
  const howItWorks = [{
    step: '01',
    title: 'Sign Up Free',
    description: 'Create your account and set your preferences'
  }, {
    step: '02',
    title: 'Ask Gideon',
    description: 'Type your question or upload study materials'
  }, {
    step: '03',
    title: 'Learn & Test',
    description: 'Get simple explanations and take quizzes to reinforce learning'
  }, {
    step: '04',
    title: 'Join Sessions',
    description: 'Collaborate with peers in live study sessions'
  }];
  return <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse-glow" style={{
        animationDelay: '1s'
      }} />
        <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" style={{
        animationDelay: '2s'
      }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6 md:px-12">
        <div className="flex items-center gap-3">
          <img src={xplaneLogo} alt="X-Plane" className="w-10 h-10 rounded-xl shadow-lg shadow-primary/25" />
          <span className="font-display font-semibold text-xl text-foreground">X-Plane</span>
        </div>
        
        <nav className="flex items-center gap-4">
          {user ? <Button onClick={() => navigate('/dashboard')} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button> : <>
              <Button variant="ghost" onClick={() => navigate('/auth')} className="text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
              <Button onClick={() => navigate('/auth')} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25">
                Get Started
              </Button>
            </>}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-12 pb-20 md:pt-20 md:pb-32">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
              
              <span className="text-sm text-primary font-medium">AI-Powered Learning by Alphadominity</span>
            </div>

            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in-up">
              <span className="text-foreground">Meet </span>
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Ezra</span>
              <br />
              <span className="text-foreground text-3xl md:text-5xl lg:text-5xl">Your AI Study Companion</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 animate-fade-in-up mx-auto lg:mx-0" style={{
            animationDelay: '0.2s'
          }}>
              Break down complex university topics with real-world examples. 
              Learn faster, understand deeper, and ace your exams with personalized AI tutoring.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up justify-center lg:justify-start" style={{
            animationDelay: '0.4s'
          }}>
              <Button size="lg" onClick={() => navigate(user ? '/dashboard' : '/auth')} className="bg-primary text-primary-foreground px-8 py-6 text-lg shadow-xl shadow-primary/30 hover:bg-primary/90 hover:shadow-primary/40 transition-all">
                Start Learning Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({
              behavior: 'smooth'
            })} className="px-8 py-6 text-lg border-border hover:bg-secondary">
                See How It Works
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center gap-8 mt-12 justify-center lg:justify-start animate-fade-in-up" style={{
            animationDelay: '0.6s'
          }}>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">10K+</p>
                <p className="text-sm text-muted-foreground">Students</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">50K+</p>
                <p className="text-sm text-muted-foreground">Questions Answered</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">4.9★</p>
                <p className="text-sm text-muted-foreground">Rating</p>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative animate-fade-in-up" style={{
          animationDelay: '0.3s'
        }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl blur-2xl" />
            <img alt="Gideon AI Assistant" className="relative rounded-3xl shadow-2xl shadow-primary/20 w-full max-w-lg mx-auto border-border/50 border-0" src="/lovable-uploads/1b783510-de26-4d00-98d5-3e569496e733.png" />
            <div className="absolute -bottom-4 -right-4 bg-card border border-border rounded-2xl p-4 shadow-xl animate-fade-in-up" style={{
            animationDelay: '0.8s'
          }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Ready to help!</p>
                  <p className="text-xs text-muted-foreground">Ask me anything</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-6 py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need to <span className="text-primary">Excel</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
               Ezra combines AI-powered explanations, document analysis, adaptive testing, and collaborative learning in one powerful platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => <div key={feature.title} className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 animate-fade-in-up" style={{
            animationDelay: `${0.1 * index}s`
          }}>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>)}
          </div>

          {/* Feature Showcase */}
          <div className="mt-20 grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <img alt="AI Features" className="rounded-3xl shadow-xl border-border/50 w-full max-w-md mx-auto border-0" src="/lovable-uploads/cd4cfcf8-293a-4fda-9403-aab92c6235b7.png" />
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-6">
                Personalized Learning Experience
              </h3>
              <div className="space-y-4">
                {['Adapts to your learning style and pace', 'Uses real-world examples from your field of study', 'Remembers context from previous conversations', 'Provides quizzes to reinforce understanding'].map((item, i) => <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-muted-foreground">{item}</p>
                  </div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 px-6 py-20 opacity-85 rounded-none">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              How <span className="text-primary">​Ezra</span> Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes and transform the way you learn
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => <div key={step.step} className="relative animate-fade-in-up" style={{
            animationDelay: `${0.15 * index}s`
          }}>
                {index < howItWorks.length - 1 && <div className="hidden lg:block absolute top-8 left-[60%] w-full h-px bg-gradient-to-r from-primary/50 to-transparent" />}
                <div className="text-4xl font-display font-bold text-primary/20 mb-4">{step.step}</div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>)}
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="relative z-10 px-6 py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                Learn Together with <span className="text-primary">Study Sessions</span>
              </h2>
              <p className="text-muted-foreground mb-8">
                Join study groups, participate in live sessions led by Ezra, and compete with peers through real-time quizzes. Learning is better together.
              </p>
              <div className="space-y-4 mb-8">
                {[{
                icon: Users,
                text: 'Create or join study groups'
              }, {
                icon: Clock,
                text: 'Real-time collaborative sessions'
              }, {
                icon: GraduationCap,
                text: 'Synchronized quizzes with leaderboards'
              }].map((item, i) => <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-foreground">{item.text}</p>
                  </div>)}
              </div>
              <Button onClick={() => navigate(user ? '/community' : '/auth')} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Explore Community
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div>
              <img src={robotCommunity} alt="Community Learning" className="rounded-3xl shadow-xl border border-border/50 w-full max-w-md mx-auto lg:ml-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to Transform Your Learning?
          </h2>
          <p className="text-muted-foreground mb-10">
            Join thousands of students who are already learning smarter with Gideon. 
            Start for free today.
          </p>
          <Button size="lg" onClick={() => navigate(user ? '/dashboard' : '/auth')} className="bg-primary text-primary-foreground px-10 py-6 text-lg shadow-xl shadow-primary/30 hover:bg-primary/90">
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={xplaneLogo} alt="X-Plane" className="w-8 h-8 rounded-lg shadow-md" />
            <span className="font-display font-medium text-foreground">X-Plane</span>
          </div>
          <p className="text-muted-foreground text-sm text-center">
            Built with ❤️ by <span className="text-primary font-medium">Alphadominity</span>
          </p>
          <p className="text-muted-foreground text-sm">
            © 2026 Alphadominity. All rights reserved.
          </p>
        </div>
      </footer>
    </div>;
}