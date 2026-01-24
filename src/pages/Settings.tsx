import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
import { ArrowLeft, Save, Loader2, Settings as SettingsIcon, User, GraduationCap, Globe, BookOpen } from 'lucide-react';

const STUDENT_TYPES = [
  { value: 'science', label: 'Science' },
  { value: 'art', label: 'Arts/Humanities' },
  { value: 'commercial', label: 'Commercial/Business' },
];

const UNIVERSITY_LEVELS = [
  { value: '100L', label: '100 Level (Freshman)' },
  { value: '200L', label: '200 Level (Sophomore)' },
  { value: '300L', label: '300 Level (Junior)' },
  { value: '400L', label: '400 Level (Senior)' },
  { value: '500L', label: '500 Level (Graduate)' },
  { value: '600L', label: '600 Level (Postgraduate)' },
];

const AI_PERSONALITIES = [
  { value: 'friendly', label: 'Friendly & Casual' },
  { value: 'encouraging', label: 'Encouraging & Supportive' },
  { value: 'tough', label: 'Tough & Challenging' },
  { value: 'calm', label: 'Calm & Patient' },
  { value: 'teacher', label: 'Professional Teacher' },
  { value: 'close_friend', label: 'Close Friend' },
];

const POPULAR_COURSES = [
  'MTH', 'CHM', 'PHY', 'BIO', 'MCB', 'BCH', 'GST', 'GNS', 'CSC', 'ENG', 
  'ECO', 'ACC', 'BUS', 'LAW', 'MED', 'PHM', 'NUR', 'AGR', 'ARC', 'EEE'
];

const COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Egypt', 'United States', 
  'United Kingdom', 'Canada', 'India', 'Australia', 'Other'
];

const FIELDS_OF_STUDY = [
  'Microbiology', 'Medicine and Surgery', 'Computer Science', 'Law', 
  'Engineering', 'Pharmacy', 'Nursing', 'Accounting', 'Economics', 
  'Biochemistry', 'Physics', 'Chemistry', 'Mathematics', 'English', 
  'Political Science', 'Psychology', 'Architecture', 'Agriculture', 'Other'
];

interface UserSettings {
  student_type: string | null;
  field_of_study: string | null;
  country: string | null;
  university_level: string | null;
  ai_personality: string[];
  courses: string[];
  preferred_name: string | null;
}

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<UserSettings>({
    student_type: null,
    field_of_study: null,
    country: null,
    university_level: null,
    ai_personality: ['friendly'],
    courses: [],
    preferred_name: null,
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
        ai_personality: existingSettings.ai_personality || ['friendly'],
        courses: existingSettings.courses || [],
        preferred_name: existingSettings.preferred_name,
      });
    }
  }, [existingSettings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (existingSettings) {
        const { error } = await supabase
          .from('user_settings')
          .update(settings)
          .eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_settings')
          .insert({ ...settings, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      toast({ title: 'Settings saved!', description: 'Your preferences have been updated.' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
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

      <main className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
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
                    <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Country</Label>
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
          </div>
        </section>

        {/* Courses */}
        <section className="glass-card p-6 rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Your Courses</h2>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Select the courses you're taking this semester. This helps me tailor explanations to your curriculum.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {POPULAR_COURSES.map(course => (
              <button
                key={course}
                onClick={() => toggleCourse(course)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  settings.courses.includes(course)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {course}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add custom course code..."
              value={customCourse}
              onChange={(e) => setCustomCourse(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomCourse()}
              className="bg-secondary border-border"
            />
            <Button variant="outline" onClick={addCustomCourse}>Add</Button>
          </div>

          {settings.courses.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Selected:</span>
              {settings.courses.map(course => (
                <span key={course} className="px-2 py-1 bg-primary/20 text-primary rounded text-sm">
                  {course}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* AI Personality */}
        <section className="glass-card p-6 rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center gap-3 mb-6">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">AI Personality</h2>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Choose how you'd like Xplane to interact with you. You can select multiple options.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AI_PERSONALITIES.map(personality => (
              <label
                key={personality.value}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                  settings.ai_personality.includes(personality.value)
                    ? 'bg-primary/20 border border-primary/30'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                <Checkbox
                  checked={settings.ai_personality.includes(personality.value)}
                  onCheckedChange={() => togglePersonality(personality.value)}
                />
                <span className="text-foreground">{personality.label}</span>
              </label>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
