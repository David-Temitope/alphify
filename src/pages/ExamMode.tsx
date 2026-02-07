import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import SubscriptionGate from '@/components/SubscriptionGate';
import { 
  ArrowLeft, 
  Clock, 
  BookOpen, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Trophy,
  RotateCcw
} from 'lucide-react';

interface Question {
  id: number;
  type: 'objective' | 'theory';
  question: string;
  options?: string[];
  correctAnswer?: string;
  marks: number;
}

interface ExamAttempt {
  id: string;
  course: string;
  exam_type: string;
  questions: Question[];
  answers: Record<number, string>;
  score: number | null;
  max_score: number;
  time_limit_minutes: number;
  started_at: string;
  completed_at: string | null;
  status: string;
}

export default function ExamMode() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [stage, setStage] = useState<'setup' | 'exam' | 'results'>('setup');
  const [course, setCourse] = useState('');
  const [examType, setExamType] = useState<'objective' | 'theory' | 'both'>('both');
  const [currentExam, setCurrentExam] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showReview, setShowReview] = useState(false);

  // Fetch user settings for courses and level
  const { data: userSettings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('user_settings')
        .select('courses, university_level, field_of_study')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch course-specific exam sample
  const { data: examSample } = useQuery({
    queryKey: ['exam-sample', user?.id, course],
    queryFn: async () => {
      if (!user || !course) return null;
      const { data } = await supabase
        .from('exam_samples')
        .select('sample_text')
        .eq('user_id', user.id)
        .eq('course', course)
        .maybeSingle();
      return data?.sample_text;
    },
    enabled: !!user && !!course,
  });

  // Timer effect
  useEffect(() => {
    if (stage !== 'exam' || !currentExam) return;

    const startTime = new Date(currentExam.started_at).getTime();
    const endTime = startTime + currentExam.time_limit_minutes * 60 * 1000;

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(timer);
        submitExam.mutate();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, currentExam]);

  const startExam = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-exam`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          course,
          examType,
          userLevel: userSettings?.university_level,
          fieldOfStudy: userSettings?.field_of_study,
          examSampleText: examSample,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate exam');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setCurrentExam(data);
      setAnswers({});
      setCurrentQuestion(0);
      setTimeRemaining(data.time_limit_minutes * 60);
      setStage('exam');
    },
    onError: (error) => {
      toast({
        title: 'Failed to start exam',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const submitExam = useMutation({
    mutationFn: async () => {
      if (!currentExam) throw new Error('No exam in progress');

      // Calculate score for objectives
      let score = 0;
      for (const q of currentExam.questions) {
        if (q.type === 'objective' && answers[q.id] === q.correctAnswer) {
          score += q.marks;
        }
        // Theory questions would need manual grading or AI grading
        // For now, we'll mark them as pending
      }

      const { error } = await supabase
        .from('exam_attempts')
        .update({
          answers,
          score,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', currentExam.id);

      if (error) throw error;

      return { ...currentExam, answers, score, status: 'completed' };
    },
    onSuccess: (data) => {
      setCurrentExam(data);
      setStage('results');
    },
    onError: (error) => {
      toast({
        title: 'Failed to submit exam',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const courses = userSettings?.courses || [];

  return (
    <SubscriptionGate 
      requiredPlans={['pro', 'premium']} 
      feature="Exam Mode"
      fallback={
        <div className="min-h-screen xp-bg-gradient flex flex-col">
          <header className="border-b border-border bg-background/50 backdrop-blur-xl p-4">
            <div className="max-w-4xl mx-auto flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="font-display font-semibold text-xl">Exam Mode</h1>
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="glass-card p-8 rounded-2xl text-center max-w-md">
              <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Unlock Exam Mode</h2>
              <p className="text-muted-foreground mb-6">
                Test your knowledge with AI-generated exams tailored to your courses and level. 
                Get 50 questions, a timer, and instant scoring!
              </p>
              <Button 
                onClick={() => navigate('/settings?tab=subscription')}
                className="xp-gradient text-primary-foreground"
              >
                Upgrade to Pro
              </Button>
            </div>
          </main>
        </div>
      }
    >
      <div className="min-h-screen xp-bg-gradient flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-background/50 backdrop-blur-xl p-4 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="font-display font-semibold text-xl flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Exam Mode
              </h1>
            </div>
            {stage === 'exam' && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${timeRemaining < 300 ? 'bg-destructive/20 text-destructive' : 'bg-secondary'}`}>
                <Clock className="h-4 w-4" />
                <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
          {/* Setup Stage */}
          {stage === 'setup' && (
            <div className="glass-card p-8 rounded-2xl animate-fade-in">
              <h2 className="font-display text-2xl font-bold mb-6">Start New Exam</h2>
              
              <div className="space-y-6">
                <div>
                  <Label>Select Course</Label>
                  <Select value={course} onValueChange={setCourse}>
                    <SelectTrigger className="mt-2 bg-secondary border-border">
                      <SelectValue placeholder="Choose a course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.length > 0 ? (
                        courses.map((c: string) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="general">General Knowledge</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {courses.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Add courses in Settings to get tailored exams
                    </p>
                  )}
                </div>

                <div>
                  <Label>Exam Type</Label>
                  <RadioGroup 
                    value={examType} 
                    onValueChange={(v) => setExamType(v as typeof examType)}
                    className="mt-2 grid grid-cols-3 gap-3"
                  >
                    <label className={`flex flex-col items-center p-4 rounded-xl border cursor-pointer transition-all ${examType === 'objective' ? 'border-primary bg-primary/10' : 'border-border bg-secondary/50 hover:border-primary/50'}`}>
                      <RadioGroupItem value="objective" className="sr-only" />
                      <span className="font-medium">Objective</span>
                      <span className="text-xs text-muted-foreground">50 MCQs</span>
                    </label>
                    <label className={`flex flex-col items-center p-4 rounded-xl border cursor-pointer transition-all ${examType === 'theory' ? 'border-primary bg-primary/10' : 'border-border bg-secondary/50 hover:border-primary/50'}`}>
                      <RadioGroupItem value="theory" className="sr-only" />
                      <span className="font-medium">Theory</span>
                      <span className="text-xs text-muted-foreground">50 written</span>
                    </label>
                    <label className={`flex flex-col items-center p-4 rounded-xl border cursor-pointer transition-all ${examType === 'both' ? 'border-primary bg-primary/10' : 'border-border bg-secondary/50 hover:border-primary/50'}`}>
                      <RadioGroupItem value="both" className="sr-only" />
                      <span className="font-medium">Both</span>
                      <span className="text-xs text-muted-foreground">40 + 10</span>
                    </label>
                  </RadioGroup>
                </div>

                <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                  <h3 className="font-medium mb-2">Exam Details</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 50 questions total</li>
                    <li>• 60 minutes time limit</li>
                    <li>• Questions matched to your {userSettings?.university_level || 'level'}</li>
                    <li>• Instant scoring for objectives</li>
                  </ul>
                </div>

                <Button 
                  onClick={() => startExam.mutate()}
                  disabled={!course || startExam.isPending}
                  className="w-full xp-gradient text-primary-foreground py-6 text-lg"
                >
                  {startExam.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating Exam...
                    </>
                  ) : (
                    'Start Exam'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Exam Stage */}
          {stage === 'exam' && currentExam && (
            <div className="space-y-6">
              {/* Progress */}
              <div className="glass-card p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    Question {currentQuestion + 1} of {currentExam.questions.length}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Object.keys(answers).length} answered
                  </span>
                </div>
                <Progress 
                  value={(Object.keys(answers).length / currentExam.questions.length) * 100} 
                />
              </div>

              {/* Current Question */}
              {currentExam.questions[currentQuestion] && (
                <div className="glass-card p-6 rounded-2xl animate-fade-in">
                  <div className="flex items-start gap-4 mb-6">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                      {currentQuestion + 1}
                    </span>
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {currentExam.questions[currentQuestion].type} • {currentExam.questions[currentQuestion].marks} mark(s)
                      </span>
                      <p className="text-lg mt-1">{currentExam.questions[currentQuestion].question}</p>
                    </div>
                  </div>

                  {currentExam.questions[currentQuestion].type === 'objective' && currentExam.questions[currentQuestion].options && (
                    <RadioGroup 
                      value={answers[currentExam.questions[currentQuestion].id] || ''} 
                      onValueChange={(v) => handleAnswer(currentExam.questions[currentQuestion].id, v)}
                      className="space-y-3"
                    >
                      {currentExam.questions[currentQuestion].options!.map((option, i) => {
                        const letter = option.charAt(0);
                        return (
                          <label 
                            key={i}
                            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                              answers[currentExam.questions[currentQuestion].id] === letter 
                                ? 'border-primary bg-primary/10' 
                                : 'border-border bg-secondary/50 hover:border-primary/50'
                            }`}
                          >
                            <RadioGroupItem value={letter} />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </RadioGroup>
                  )}

                  {currentExam.questions[currentQuestion].type === 'theory' && (
                    <textarea
                      value={answers[currentExam.questions[currentQuestion].id] || ''}
                      onChange={(e) => handleAnswer(currentExam.questions[currentQuestion].id, e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full min-h-[150px] rounded-xl bg-secondary border border-border p-4 resize-y focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                  disabled={currentQuestion === 0}
                >
                  Previous
                </Button>
                
                <div className="flex gap-2 flex-wrap justify-center">
                  {currentExam.questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentQuestion(i)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                        i === currentQuestion 
                          ? 'bg-primary text-primary-foreground' 
                          : answers[currentExam.questions[i].id] 
                            ? 'bg-green-500/20 text-green-500 border border-green-500/50' 
                            : 'bg-secondary border border-border hover:border-primary/50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                {currentQuestion === currentExam.questions.length - 1 ? (
                  <Button 
                    onClick={() => submitExam.mutate()}
                    disabled={submitExam.isPending}
                    className="xp-gradient text-primary-foreground"
                  >
                    {submitExam.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setCurrentQuestion(Math.min(currentExam.questions.length - 1, currentQuestion + 1))}
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Results Stage */}
          {stage === 'results' && currentExam && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-card p-8 rounded-2xl text-center">
                <Trophy className={`h-16 w-16 mx-auto mb-4 ${(currentExam.score || 0) >= currentExam.max_score * 0.5 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                <h2 className="font-display text-3xl font-bold mb-2">Exam Complete!</h2>
                <p className="text-muted-foreground mb-6">{currentExam.course} • {currentExam.exam_type}</p>
                
                <div className="text-6xl font-bold mb-2">
                  {currentExam.score} / {currentExam.max_score}
                </div>
                <p className="text-muted-foreground">
                  {Math.round(((currentExam.score || 0) / currentExam.max_score) * 100)}% Score
                </p>

                <div className="flex gap-4 justify-center mt-8">
                  <Button variant="outline" onClick={() => setShowReview(!showReview)}>
                    {showReview ? 'Hide' : 'Review'} Answers
                  </Button>
                  <Button 
                    onClick={() => {
                      setStage('setup');
                      setCurrentExam(null);
                      setAnswers({});
                    }}
                    className="xp-gradient text-primary-foreground"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    New Exam
                  </Button>
                </div>
              </div>

              {/* Review Section */}
              {showReview && (
                <div className="space-y-4">
                  <h3 className="font-display text-xl font-semibold">Review Answers</h3>
                  {currentExam.questions.map((q, i) => {
                    const userAnswer = answers[q.id];
                    const isCorrect = q.type === 'objective' && userAnswer === q.correctAnswer;
                    const isWrong = q.type === 'objective' && userAnswer && userAnswer !== q.correctAnswer;

                    return (
                      <div 
                        key={q.id} 
                        className={`glass-card p-4 rounded-xl border-l-4 ${
                          isCorrect ? 'border-l-green-500' : isWrong ? 'border-l-red-500' : 'border-l-border'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium">{q.question}</p>
                            
                            {q.type === 'objective' && (
                              <div className="mt-2 space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Your answer:</span>
                                  <span className={isWrong ? 'text-red-500' : 'text-green-500'}>
                                    {userAnswer || 'Not answered'}
                                  </span>
                                  {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                  {isWrong && <XCircle className="h-4 w-4 text-red-500" />}
                                </div>
                                {isWrong && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Correct answer:</span>
                                    <span className="text-green-500">{q.correctAnswer}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {q.type === 'theory' && (
                              <div className="mt-2 p-3 rounded-lg bg-secondary/50 text-sm">
                                <span className="text-muted-foreground">Your answer:</span>
                                <p className="mt-1">{userAnswer || 'Not answered'}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </SubscriptionGate>
  );
}
