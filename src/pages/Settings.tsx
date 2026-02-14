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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Settings as SettingsIcon, 
  User, 
  GraduationCap, 
  Globe, 
  Sparkles,
  BookOpen,
  Save,
  Loader2,
  Brain,
  X,
  CreditCard,
  Trash2,
  AlertTriangle,
  Upload,
  FileText,
  MessageSquare
} from 'lucide-react';
import KUPurchase from '@/components/KUPurchase';
import AccountDeletion from '@/components/AccountDeletion';
import { useKnowledgeUnits } from '@/hooks/useKnowledgeUnits';
import { format } from 'date-fns';

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
  { id: 'five_year_old', label: 'Like a 5-year-old', description: 'Super simple, using toys and everyday examples' },
  { id: 'professional', label: 'Professional', description: 'Academic terminology, assumes some knowledge' },
  { id: 'complete_beginner', label: 'Complete Beginner', description: 'Start from absolute zero, define everything' },
  { id: 'visual_learner', label: 'Visual Descriptions', description: 'Lots of imagery, diagrams in words' },
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
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');

  const [settings, setSettings] = useState<UserSettings>({
    student_type: null,
    field_of_study: null,
    country: null,
    university_level: null,
    ai_personality: ['friendly_teacher'],
    courses: [],
    preferred_name: null,
    explanation_style: 'five_year_old',
    exam_sample_text: null,
    bio: null,
  });
  const [customCourse, setCustomCourse] = useState('');

  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
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
      // Security: Explicitly list fields to prevent mass assignment of
      // sensitive fields like quiz_score_percentage or total_quizzes_taken
      const settingsToSave = {
        student_type: settings.student_type,
        field_of_study: settings.field_of_study,
        country: settings.country,
        university_level: settings.university_level,
        ai_personality: settings.ai_personality,
        courses: settings.courses,
        preferred_name: settings.preferred_name,
        explanation_style: settings.explanation_style,
        exam_sample_text: settings.exam_sample_text,
        bio: settings.bio,
      };

      if (existingSettings) {
        const { error } = await supabase
          .from('user_settings')
          .update(settingsToSave)
          .eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_settings')
          .insert({ ...settingsToSave, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      toast({ title: 'Settings saved!', description: 'Your preferences have been updated.' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    },
  });

  const togglePersonality = (value: string) => {
    setSettings(prev => ({
      ...prev,
      ai_personality: prev.ai_personality.includes(value)
        ? prev.ai_personality.filter(p => p !== value)
        : [...prev.ai_personality, value],
    }));
  };

  const toggleCourse = (course: string) => {
    setSettings(prev => ({
      ...prev,
      courses: prev.courses.includes(course)
        ? prev.courses.filter(c => c !== course)
        : [...prev.courses, course],
    }));
  };

  const addCustomCourse = () => {
    if (customCourse.trim() && !settings.courses.includes(customCourse.trim().toUpperCase())) {
      setSettings(prev => ({
        ...prev,
        courses: [...prev.courses, customCourse.trim().toUpperCase()],
      }));
      setCustomCourse('');
    }
  };

  const removeCourse = (course: string) => {
    setSettings(prev => ({
      ...prev,
      courses: prev.courses.filter(c => c !== course),
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen xp-bg-gradient flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen xp-bg-gradient">
      {/* Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between p-4 md:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-6 w-6 text-primary" />
              <h1 className="font-display font-semibold text-xl text-foreground">Settings</h1>
            </div>
          </div>

          <Button 
            onClick={() => saveSettings.mutate()} 
            disabled={saveSettings.isPending}
            className="xp-gradient text-primary-foreground"
          >
            {saveSettings.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="wallet" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Wallet</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallet" className="space-y-6">
            {/* KU Balance */}
            <section className="glass-card p-6 rounded-2xl animate-fade-in">
              <h2 className="font-display text-lg font-semibold mb-4">Knowledge Units Balance</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold text-foreground">{balance}</p>
                  <p className="text-muted-foreground">Knowledge Units available</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">1 KU = 1 prompt</p>
                  <p className="text-sm text-muted-foreground">₦50 per unit</p>
                </div>
              </div>
              {balance <= 5 && (
                <p className="text-sm text-primary mt-3">
                  {balance === 0 ? '🔴 No units left — top up to continue learning!' : '⚡ Running low — top up soon!'}
                </p>
              )}
            </section>

            {/* Purchase Packages */}
            <section className="animate-fade-in-up">
              <h2 className="font-display text-lg font-semibold mb-4">Buy Knowledge Units</h2>
              <KUPurchase onSuccess={() => refetchKU()} />
            </section>
          </TabsContent>

          <TabsContent value="profile" className="space-y-8">
        {/* Personal Info */}
        <section className="glass-card p-6 rounded-2xl animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Personal Information</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="preferred_name">What should I call you?</Label>
              <Input
                id="preferred_name"
                placeholder="Your preferred name"
                value={settings.preferred_name || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, preferred_name: e.target.value }))}
                className="mt-1 bg-secondary border-border"
              />
            </div>

            <div>
              <Label htmlFor="bio">Tell Gideon about yourself</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Describe your interests, hobbies, and background so Gideon can use relatable examples when explaining things to you
              </p>
              <Textarea
                id="bio"
                placeholder="e.g. I'm David, I love WWE, I sing, I write code using HTML, CSS & JS, I love building new things, I'm a Yoruba boy..."
                value={settings.bio || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
                className="mt-1 bg-secondary border-border min-h-[100px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{(settings.bio || '').length}/500</p>
            </div>
          </div>
        </section>

        {/* Explanation Style */}
        <section className="glass-card p-6 rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center gap-3 mb-6">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">How would you like to be explained to?</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EXPLANATION_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => setSettings(prev => ({ ...prev, explanation_style: style.id }))}
                className={`p-4 rounded-xl border text-left transition-all ${
                  settings.explanation_style === style.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-secondary/50 hover:border-primary/50'
                }`}
              >
                <div className="font-medium">{style.label}</div>
                <div className="text-sm text-muted-foreground mt-1">{style.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Academic Info */}
        <section className="glass-card p-6 rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-3 mb-6">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Academic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Student Type</Label>
              <Select
                value={settings.student_type || ''}
                onValueChange={(value) => setSettings(prev => ({ ...prev, student_type: value }))}
              >
                <SelectTrigger className="mt-1 bg-secondary border-border">
                  <SelectValue placeholder="Select your track" />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Field of Study</Label>
              <Select
                value={settings.field_of_study || ''}
                onValueChange={(value) => setSettings(prev => ({ ...prev, field_of_study: value }))}
              >
                <SelectTrigger className="mt-1 bg-secondary border-border">
                  <SelectValue placeholder="Select your field" />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS_OF_STUDY.map(field => (
                    <SelectItem key={field} value={field}>{field}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>University Level</Label>
              <Select
                value={settings.university_level || ''}
                onValueChange={(value) => setSettings(prev => ({ ...prev, university_level: value }))}
              >
                <SelectTrigger className="mt-1 bg-secondary border-border">
                  <SelectValue placeholder="Select your level" />
                </SelectTrigger>
                <SelectContent>
                  {UNIVERSITY_LEVELS.map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Country */}
        <section className="glass-card p-6 rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-3 mb-6">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Location</h2>
          </div>
          
          <div>
            <Label>Country</Label>
            <p className="text-sm text-muted-foreground mb-2">This helps me explain using examples relevant to your education system</p>
            <Select
              value={settings.country || ''}
              onValueChange={(value) => setSettings(prev => ({ ...prev, country: value }))}
            >
              <SelectTrigger className="mt-1 bg-secondary border-border">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(country => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* AI Personality */}
        <section className="glass-card p-6 rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">AI Personality</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Select how you'd like me to behave (you can select multiple)</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AI_PERSONALITIES.map((personality) => (
              <button
                key={personality.id}
                onClick={() => togglePersonality(personality.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  settings.ai_personality.includes(personality.id)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-secondary/50 hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={settings.ai_personality.includes(personality.id)}
                    className="pointer-events-none"
                  />
                  <span className="font-medium">{personality.label}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 ml-6">{personality.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Courses */}
        <section className="glass-card p-6 rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Your Courses</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Select or add the course codes you study</p>
          
          {/* Selected courses */}
          {settings.courses.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.courses.map((course) => (
                <span 
                  key={course}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                >
                  {course}
                  <button onClick={() => removeCourse(course)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          
          {/* Common courses grid */}
          <div className="flex flex-wrap gap-2 mb-4">
            {COMMON_COURSES.map((course) => (
              <button
                key={course}
                onClick={() => toggleCourse(course)}
                className={`px-3 py-1 rounded-full text-sm transition-all ${
                  settings.courses.includes(course)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary border border-border hover:border-primary/50'
                }`}
              >
                {course}
              </button>
            ))}
          </div>
          
          {/* Add custom course */}
          <div className="flex gap-2">
            <Input
              placeholder="Add custom course code"
              value={customCourse}
              onChange={(e) => setCustomCourse(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomCourse()}
              className="bg-secondary border-border"
            />
            <Button variant="outline" onClick={addCustomCourse}>Add</Button>
          </div>
        </section>

        {/* Exam Question Style */}
        <section className="glass-card p-6 rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center gap-3 mb-6">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Exam Question Style</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Upload past exam papers or type sample questions so Gideon understands your professor's style when setting quizzes and exams.
          </p>
          
          {/* Course-specific exam samples */}
          {settings.courses.length > 0 ? (
            <div className="space-y-4 mb-6">
              <Label>Select Course for Exam Sample</Label>
              <div className="flex flex-wrap gap-2">
                {settings.courses.map((course) => (
                  <button
                    key={course}
                    type="button"
                    onClick={() => {
                      // Set active course for sample upload
                      const input = document.getElementById(`exam-file-${course}`) as HTMLInputElement;
                      if (input) input.click();
                    }}
                    className="px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 bg-secondary border border-border hover:border-primary/50 cursor-pointer"
                  >
                    <Upload className="h-3 w-3" />
                    {course}
                    <input
                      id={`exam-file-${course}`}
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user) return;
                        
                        try {
                          // Upload to storage with user.id as first folder
                          const filePath = `${user.id}/exam-samples/${course}/${Date.now()}_${file.name}`;
                          const { error: uploadError } = await supabase.storage
                            .from('user-files')
                            .upload(filePath, file);
                          
                          if (uploadError) throw uploadError;
                          
                          // Save to uploaded_files table
                          const { data: fileRecord, error: dbError } = await supabase
                            .from('uploaded_files')
                            .insert({
                              user_id: user.id,
                              file_name: file.name,
                              file_path: filePath,
                              file_type: file.type,
                              file_size: file.size,
                            })
                            .select()
                            .single();
                          
                          if (dbError) throw dbError;
                          
                          // Upsert exam_samples record
                          const { error: sampleError } = await supabase
                            .from('exam_samples')
                            .upsert({
                              user_id: user.id,
                              course: course,
                              file_id: fileRecord.id,
                            }, { onConflict: 'user_id,course' });
                          
                          if (sampleError) throw sampleError;
                          
                          toast({ 
                            title: `${course} exam paper uploaded!`, 
                            description: 'Gideon will reference this when creating quizzes for this course.' 
                          });
                        } catch (error) {
                          console.error('Upload error:', error);
                          toast({ 
                            title: 'Upload failed', 
                            description: error instanceof Error ? error.message : 'An unknown error occurred',
                            variant: 'destructive' 
                          });
                        }
                      }}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Click on a course code to upload exam samples for that specific course.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-secondary/50 border border-border mb-4">
              <p className="text-sm text-muted-foreground">
                Add courses in the "Current Courses" section above to upload course-specific exam samples.
              </p>
            </div>
          )}
          
          <div className="relative">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">OR TYPE SAMPLES</span>
            </div>
            <div className="border-t border-border my-4"></div>
          </div>
          
          <div>
            <Label htmlFor="exam_sample">General Exam Question Samples</Label>
            <textarea
              id="exam_sample"
              placeholder="Paste sample exam questions here...&#10;&#10;Example:&#10;1. Define osmosis and explain its importance in plant cells. (10 marks)&#10;2. Calculate the molarity of a solution containing... (5 marks)"
              value={settings.exam_sample_text || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, exam_sample_text: e.target.value }))}
              className="mt-2 w-full min-h-[150px] rounded-lg bg-secondary border border-border p-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              
            />
            <p className="text-xs text-muted-foreground mt-2">
              These samples help Gideon set questions in the same style as your professor. General samples apply to all courses unless you upload course-specific ones.
            </p>
          </div>
        </section>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            {/* Account Info */}
            <section className="glass-card p-6 rounded-2xl animate-fade-in">
              <h2 className="font-display text-lg font-semibold mb-4">Account Information</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{user?.email}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Member since</span>
                  <span className="font-medium">{user?.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : 'N/A'}</span>
                </div>
              </div>
            </section>

            {/* Delete Account */}
            <section className="glass-card p-6 rounded-2xl border-destructive/50 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h2 className="font-display text-lg font-semibold text-destructive">Delete Account</h2>
              </div>
              <p className="text-muted-foreground mb-4">
                Once you delete your account, there's no going back. Your account will be scheduled for deletion and permanently removed after 7 days. You can cancel during this period.
              </p>
              <AccountDeletion />
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
