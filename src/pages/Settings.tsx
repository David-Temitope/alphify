import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import UniversitySelect from '@/components/UniversitySelect';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  User, GraduationCap, Globe, Sparkles, BookOpen, Save, Loader2, Brain, X,
  CreditCard, AlertTriangle, Upload, Settings as SettingsIcon, Gift, Copy, Check
} from 'lucide-react';
import KUPurchase from '@/components/KUPurchase';
import AccountDeletion from '@/components/AccountDeletion';
import { useKnowledgeUnits } from '@/hooks/useKnowledgeUnits';
import { useReferralCode } from '@/hooks/useReferralCode';
import { format } from 'date-fns';
import BottomNav from '@/components/BottomNav';

const STUDENT_TYPES = [
  { value: 'science', label: 'Science' },
  { value: 'art', label: 'Art' },
  { value: 'commercial', label: 'Commercial' },
];

const FIELDS_OF_STUDY = [
  'Microbiology', 'Medicine and Surgery', 'Computer Science', 'Law', 
  'Accounting', 'Economics', 'Engineering', 'Pharmacy', 'Nursing',
  'Biochemistry', 'Physics', 'Chemistry', 'Mathematics', 'Biology',
  'Political Science', 'Mass Communication', 'Psychology', 'Sociology',
  'Business Administration', 'Public Administration', 'Architecture',
  'Fine Arts', 'Theatre Arts', 'Music', 'Philosophy', 'History',
  'English', 'French', 'Linguistics', 'Education', 'Agriculture',
  'Veterinary Medicine', 'Dentistry', 'Physiotherapy', 'Other'
];

const COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Egypt', 'United States',
  'United Kingdom', 'Canada', 'India', 'Australia', 'Other'
];

const UNIVERSITY_LEVELS = ['100L', '200L', '300L', '400L', '500L', '600L', 'Postgraduate'];

const AI_PERSONALITIES = [
  { id: 'close_friend', label: 'Close Friend', description: 'Casual, uses slang, very supportive' },
  { id: 'friendly_teacher', label: 'Friendly Teacher', description: 'Warm, patient, encouraging' },
  { id: 'encouraging', label: 'Encouraging', description: 'Lots of positive reinforcement' },
  { id: 'tough', label: 'Tough Love', description: 'Pushes you to do better, no shortcuts' },
  { id: 'nice', label: 'Nice & Gentle', description: 'Very kind, never critical' },
  { id: 'calm', label: 'Calm & Composed', description: 'Relaxed, never rushes' },
  { id: 'funny', label: 'Funny', description: 'Uses humor to teach' },
  { id: 'strict', label: 'Strict Professor', description: 'Formal, academic, by-the-book' },
];

const EXPLANATION_STYLES = [
  { id: 'five_year_old', label: 'Like a 5-year-old', description: 'Super simple, everyday examples' },
  { id: 'professional', label: 'Professional', description: 'Academic terminology' },
  { id: 'complete_beginner', label: 'Complete Beginner', description: 'Start from zero' },
  { id: 'visual_learner', label: 'Visual Descriptions', description: 'Lots of imagery' },
];

const COMMON_COURSES = [
  'MTH', 'CHM', 'PHY', 'BIO', 'GST', 'GNS', 'MCB', 'BCH', 'CSC', 'COS',
  'ENG', 'LIN', 'ECO', 'ACC', 'BUS', 'POL', 'SOC', 'PSY', 'LAW', 'MED',
  'PHA', 'NUR', 'ARC', 'AGR', 'EDU', 'HIS', 'PHI', 'FRE', 'ART', 'MUS'
];

interface UserSettings {
  student_type: string | null;
  field_of_study: string | null;
  country: string | null;
  university_level: string | null;
  university: string | null;
  ai_personality: string[];
  courses: string[];
  preferred_name: string | null;
  explanation_style: string | null;
  exam_sample_text: string | null;
  bio: string | null;
}

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { balance, isLoading: kuLoading, refetch: refetchKU } = useKnowledgeUnits();
  const { referralCode, referralCount } = useReferralCode();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');

  const [settings, setSettings] = useState<UserSettings>({
    student_type: null, field_of_study: null, country: null, university_level: null,
    university: null, ai_personality: ['friendly_teacher'], courses: [],
    preferred_name: null, explanation_style: 'five_year_old', exam_sample_text: null, bio: null,
  });
  const [customCourse, setCustomCourse] = useState('');

  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existingSettings) {
      setSettings({
        student_type: existingSettings.student_type,
        field_of_study: existingSettings.field_of_study,
        country: existingSettings.country,
        university_level: existingSettings.university_level,
        university: (existingSettings as any).university || null,
        ai_personality: existingSettings.ai_personality || ['friendly_teacher'],
        courses: existingSettings.courses || [],
        preferred_name: existingSettings.preferred_name,
        explanation_style: existingSettings.explanation_style || 'five_year_old',
        exam_sample_text: existingSettings.exam_sample_text || null,
        bio: (existingSettings as any).bio || null,
      });
    }
  }, [existingSettings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const settingsToSave = {
        student_type: settings.student_type, field_of_study: settings.field_of_study,
        country: settings.country, university_level: settings.university_level,
        university: settings.university, ai_personality: settings.ai_personality,
        courses: settings.courses, preferred_name: settings.preferred_name,
        explanation_style: settings.explanation_style, exam_sample_text: settings.exam_sample_text,
        bio: settings.bio,
      };
      if (existingSettings) {
        const { error } = await supabase.from('user_settings').update(settingsToSave).eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_settings').insert({ ...settingsToSave, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-settings'] }); toast({ title: 'Settings saved!' }); },
    onError: (error) => { toast({ title: 'Failed to save', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' }); },
  });

  const togglePersonality = (value: string) => {
    setSettings(prev => ({ ...prev, ai_personality: prev.ai_personality.includes(value) ? prev.ai_personality.filter(p => p !== value) : [...prev.ai_personality, value] }));
  };

  const toggleCourse = (course: string) => {
    setSettings(prev => ({ ...prev, courses: prev.courses.includes(course) ? prev.courses.filter(c => c !== course) : [...prev.courses, course] }));
  };

  const addCustomCourse = () => {
    if (customCourse.trim() && !settings.courses.includes(customCourse.trim().toUpperCase())) {
      setSettings(prev => ({ ...prev, courses: [...prev.courses, customCourse.trim().toUpperCase()] }));
      setCustomCourse('');
    }
  };

  const removeCourse = (course: string) => {
    setSettings(prev => ({ ...prev, courses: prev.courses.filter(c => c !== course) }));
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold text-foreground">Settings</h1>
          </div>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} size="sm" className="rounded-full bg-primary text-primary-foreground">
            {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </header>

      <main className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-secondary w-full">
            <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
            <TabsTrigger value="wallet" className="flex-1 flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" /> Wallet
            </TabsTrigger>
            <TabsTrigger value="account" className="flex-1 flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallet" className="space-y-4">
            {/* KU Balance */}
            <section className="p-4 rounded-2xl bg-card border border-border">
              <h2 className="font-display text-base font-semibold mb-3">Knowledge Units Balance</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-foreground">{balance}</p>
                  <p className="text-sm text-muted-foreground">Knowledge Units available</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">₦35 per unit</p>
                </div>
              </div>
              {balance <= 5 && (
                <p className="text-sm text-primary mt-3">
                  {balance === 0 ? '🔴 No units left — top up to continue learning!' : '⚡ Running low — top up soon!'}
                </p>
              )}
            </section>

            <section>
              <h2 className="font-display text-base font-semibold mb-3">Buy Knowledge Units</h2>
              <KUPurchase onSuccess={() => refetchKU()} />
            </section>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            {/* Personal Info */}
            <section className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold">Personal Information</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="preferred_name">What should I call you?</Label>
                  <Input id="preferred_name" placeholder="Your preferred name" value={settings.preferred_name || ''} onChange={(e) => setSettings(prev => ({ ...prev, preferred_name: e.target.value }))} className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label htmlFor="bio">Tell Ezra about yourself</Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">Describe your interests so Ezra can use relatable examples</p>
                  <Textarea id="bio" placeholder="e.g. I love WWE, I code with HTML, CSS & JS..." value={settings.bio || ''} onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))} className="mt-1 bg-secondary border-border min-h-[100px]" maxLength={500} />
                  <p className="text-xs text-muted-foreground mt-1 text-right">{(settings.bio || '').length}/500</p>
                </div>
              </div>
            </section>

            {/* Referral Code */}
            <section className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold">Referral Code</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Share your code with friends. When they sign up, you earn <strong>5 free KU!</strong></p>
              {referralCode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-secondary rounded-xl px-4 py-3 font-mono font-bold text-lg text-foreground tracking-wider text-center">
                      {referralCode}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-xl"
                      onClick={() => {
                        navigator.clipboard.writeText(referralCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Friends referred</span>
                    <span className="font-medium text-foreground">{referralCount}</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => {
                      const text = `Join me on Alphify — the AI study app for university students! Use my referral code: ${referralCode}\n\nhttps://alphify.site/auth`;
                      if (navigator.share) {
                        navigator.share({ title: 'Join Alphify', text });
                      } else {
                        navigator.clipboard.writeText(text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                  >
                    Share Invite Link
                  </Button>
                </div>
              ) : (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </section>

            {/* Explanation Style */}
            <section className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold">Explanation Style</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EXPLANATION_STYLES.map((style) => (
                  <button key={style.id} onClick={() => setSettings(prev => ({ ...prev, explanation_style: style.id }))}
                    className={`p-3 rounded-xl border text-left transition-all ${settings.explanation_style === style.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/50 hover:border-primary/50'}`}>
                    <div className="font-medium text-sm">{style.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{style.description}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Academic Info */}
            <section className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold">Academic Information</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Student Type</Label>
                  <Select value={settings.student_type || ''} onValueChange={(value) => setSettings(prev => ({ ...prev, student_type: value }))}>
                    <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue placeholder="Select track" /></SelectTrigger>
                    <SelectContent>{STUDENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Field of Study</Label>
                  <Select value={settings.field_of_study || ''} onValueChange={(value) => setSettings(prev => ({ ...prev, field_of_study: value }))}>
                    <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue placeholder="Select field" /></SelectTrigger>
                    <SelectContent>{FIELDS_OF_STUDY.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>University Level</Label>
                  <Select value={settings.university_level || ''} onValueChange={(value) => setSettings(prev => ({ ...prev, university_level: value }))}>
                    <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>{UNIVERSITY_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="university">University Name</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1">This determines your shared course files access</p>
                  <UniversitySelect value={settings.university} onChange={(value) => setSettings(prev => ({ ...prev, university: value }))} className="mt-1" />
                </div>
              </div>
            </section>

            {/* Country */}
            <section className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold">Location</h2>
              </div>
              <div>
                <Label>Country</Label>
                <Select value={settings.country || ''} onValueChange={(value) => setSettings(prev => ({ ...prev, country: value }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </section>

            {/* AI Personality */}
            <section className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold">AI Personality</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Select how you'd like Ezra to behave (multiple allowed)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AI_PERSONALITIES.map((p) => (
                  <button key={p.id} onClick={() => togglePersonality(p.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${settings.ai_personality.includes(p.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/50 hover:border-primary/50'}`}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={settings.ai_personality.includes(p.id)} className="pointer-events-none" />
                      <span className="font-medium text-sm">{p.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">{p.description}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Courses */}
            <section className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold">Your Courses</h2>
              </div>
              {settings.courses.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {settings.courses.map((course) => (
                    <span key={course} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                      {course}
                      <button onClick={() => removeCourse(course)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {COMMON_COURSES.map((course) => (
                  <button key={course} onClick={() => toggleCourse(course)}
                    className={`px-3 py-1 rounded-full text-sm transition-all ${settings.courses.includes(course) ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border hover:border-primary/50'}`}>
                    {course}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add custom course code" value={customCourse} onChange={(e) => setCustomCourse(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomCourse()} className="bg-secondary border-border" />
                <Button variant="outline" onClick={addCustomCourse}>Add</Button>
              </div>
            </section>

            {/* Exam Style */}
            <section className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold">Exam Question Style</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Upload past exams so Ezra matches your professor's style.</p>
              {settings.courses.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {settings.courses.map((course) => (
                    <button key={course} type="button"
                      onClick={() => { const input = document.getElementById(`exam-file-${course}`) as HTMLInputElement; if (input) input.click(); }}
                      className="px-3 py-2 rounded-lg text-sm flex items-center gap-2 bg-secondary border border-border hover:border-primary/50 cursor-pointer">
                      <Upload className="h-3 w-3" /> {course}
                      <input id={`exam-file-${course}`} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !user) return;
                          try {
                            const filePath = `${user.id}/exam-samples/${course}/${Date.now()}_${file.name}`;
                            const { error: uploadError } = await supabase.storage.from('user-files').upload(filePath, file);
                            if (uploadError) throw uploadError;
                            const { data: fileRecord, error: dbError } = await supabase.from('uploaded_files').insert({ user_id: user.id, file_name: file.name, file_path: filePath, file_type: file.type, file_size: file.size }).select().single();
                            if (dbError) throw dbError;
                            const { error: sampleError } = await supabase.from('exam_samples').upsert({ user_id: user.id, course, file_id: fileRecord.id }, { onConflict: 'user_id,course' });
                            if (sampleError) throw sampleError;
                            toast({ title: `${course} exam paper uploaded!` });
                          } catch (error) { toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' }); }
                        }} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">Add courses above to upload exam samples.</p>
              )}
              <div>
                <Label htmlFor="exam_sample">General Exam Question Samples</Label>
                <textarea id="exam_sample" placeholder="Paste sample exam questions here..." value={settings.exam_sample_text || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, exam_sample_text: e.target.value }))}
                  className="mt-2 w-full min-h-[120px] rounded-lg bg-secondary border border-border p-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y" />
              </div>
            </section>
          </TabsContent>

          <TabsContent value="account" className="space-y-4">
            <section className="p-4 rounded-2xl bg-card border border-border">
              <h2 className="font-display text-base font-semibold mb-3">Account Information</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{user?.email}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Member since</span>
                  <span className="text-sm font-medium">{user?.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : 'N/A'}</span>
                </div>
              </div>
            </section>

            <section className="p-4 rounded-2xl bg-card border border-destructive/30">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="font-display text-base font-semibold text-destructive">Delete Account</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Your account will be permanently removed after 7 days. You can cancel during this period.
              </p>
              <AccountDeletion />
            </section>
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
}
