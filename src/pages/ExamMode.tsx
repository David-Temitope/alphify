import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useKnowledgeUnits } from "@/hooks/useKnowledgeUnits";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Clock, BookOpen, Loader2, CheckCircle2, XCircle, Trophy, RotateCcw, Coins } from "lucide-react";
import BottomNav from '@/components/BottomNav';

// Define interfaces for Question and ExamAttempt
interface Question {
  id: number;
  type: "objective" | "theory";
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
  const { balance, canStartExam, isLoading: kuLoading } = useKnowledgeUnits();

  const [stage, setStage] = useState<"setup" | "exam" | "results">("setup");
  const [course, setCourse] = useState("");
  const [examType, setExamType] = useState<"objective" | "theory" | "both">("both");
  const [currentExam, setCurrentExam] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showReview, setShowReview] = useState(false);

  const { data: userSettings } = useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("user_settings").select("courses, university_level, field_of_study").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: examSample } = useQuery({
    queryKey: ["exam-sample", user?.id, course],
    queryFn: async () => {
      if (!user || !course) return null;
      const { data } = await supabase.from("exam_samples").select("sample_text").eq("user_id", user.id).eq("course", course).maybeSingle();
      return data?.sample_text;
    },
    enabled: !!user && !!course,
  });

  useEffect(() => {
    if (stage !== "exam" || !currentExam) return;
    const startTime = new Date(currentExam.started_at).getTime();
    const endTime = startTime + currentExam.time_limit_minutes * 60 * 1000;
    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeRemaining(remaining);
      if (remaining === 0) { clearInterval(timer); submitExam.mutate(); }
    }, 1000);
    return () => clearInterval(timer);
  }, [stage, currentExam]);

  const startExam = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-exam`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ course, examType, userLevel: userSettings?.university_level, fieldOfStudy: userSettings?.field_of_study, examSampleText: examSample }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || "Failed to generate exam"); }
      return response.json();
    },
    onSuccess: (data) => { setCurrentExam(data); setAnswers({}); setCurrentQuestion(0); setTimeRemaining(data.time_limit_minutes * 60); setStage("exam"); },
    onError: (error) => { toast({ title: "Failed to start exam", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }); },
  });

  const submitExam = useMutation({
    mutationFn: async () => {
      if (!currentExam) throw new Error("No exam in progress");
      let score = 0;
      for (const q of currentExam.questions) { if (q.type === "objective" && answers[q.id] === q.correctAnswer) score += q.marks; }
      const { error } = await supabase.from("exam_attempts").update({ answers, score, status: "completed", completed_at: new Date().toISOString() }).eq("id", currentExam.id);
      if (error) throw error;
      return { ...currentExam, answers, score, status: "completed" };
    },
    onSuccess: async (data) => {
      setCurrentExam(data); setStage("results");
      try {
        const percentage = ((data.score || 0) / data.max_score) * 100;
        if (percentage >= 50) await supabase.rpc('increment_star_rating' as any, { _user_id: user!.id, _amount: 0.4 });
        const { data: settings } = await supabase.from('user_settings').select('total_quizzes_taken, quiz_score_percentage').eq('user_id', user!.id).maybeSingle();
        const prevTotal = settings?.total_quizzes_taken || 0;
        const prevAvg = settings?.quiz_score_percentage || 0;
        const newTotal = prevTotal + 1;
        const newAvg = Math.round(((prevAvg * prevTotal) + percentage) / newTotal);
        await supabase.from('user_settings').update({ total_quizzes_taken: newTotal, quiz_score_percentage: newAvg }).eq('user_id', user!.id);
      } catch (e) { console.error('Star rating update error:', e); }
    },
    onError: (error) => { toast({ title: "Failed to submit exam", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }); },
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswer = (questionId: number, answer: string) => { setAnswers((prev) => ({ ...prev, [questionId]: answer })); };

  const courses = userSettings?.courses || [];

  // KU gate
  if (!kuLoading && !canStartExam) {
    return (
      <div className="min-h-[100dvh] bg-background pb-20">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="font-display text-xl font-bold text-foreground">Exam Mode</h1>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="p-8 rounded-2xl bg-card border border-border text-center max-w-md">
            <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold mb-2">Unlock Exam Mode</h2>
            <p className="text-muted-foreground mb-2">You need at least 70 KU to start an exam.</p>
            <p className="text-sm text-muted-foreground mb-6 flex items-center justify-center gap-2">
              <Coins className="h-4 w-4" /> Your balance: {balance} KU
            </p>
            <Button onClick={() => navigate("/settings?tab=wallet")} className="bg-primary text-primary-foreground">Top Up Knowledge Units</Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Exam Mode
            </h1>
          </div>
          {stage === "exam" && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono font-bold ${timeRemaining < 300 ? "bg-destructive/20 text-destructive" : "bg-secondary text-foreground"}`}>
              <Clock className="h-4 w-4" /> {formatTime(timeRemaining)}
            </div>
          )}
        </div>
      </header>

      <main className="px-4 space-y-4">
        {/* Setup */}
        {stage === "setup" && (
          <div className="p-4 rounded-2xl bg-card border border-border">
            <h2 className="font-display text-lg font-bold mb-4">Start New Exam</h2>
            <div className="space-y-4">
              <div>
                <Label>Select Course</Label>
                <Select value={course} onValueChange={setCourse}>
                  <SelectTrigger className="mt-2 bg-secondary border-border"><SelectValue placeholder="Choose a course" /></SelectTrigger>
                  <SelectContent>
                    {courses.length > 0 ? courses.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>) : <SelectItem value="general">General Knowledge</SelectItem>}
                  </SelectContent>
                </Select>
                {courses.length === 0 && <p className="text-sm text-muted-foreground mt-2">Add courses in Settings to get tailored exams</p>}
              </div>
              <div>
                <Label>Exam Type</Label>
                <RadioGroup value={examType} onValueChange={(v) => setExamType(v as typeof examType)} className="mt-2 grid grid-cols-3 gap-2">
                  {[{ v: "objective", l: "Objective", d: "50 MCQs" }, { v: "theory", l: "Theory", d: "50 written" }, { v: "both", l: "Both", d: "40 + 10" }].map(({ v, l, d }) => (
                    <label key={v} className={`flex flex-col items-center p-3 rounded-xl border cursor-pointer transition-all ${examType === v ? "border-primary bg-primary/10" : "border-border bg-secondary/50"}`}>
                      <RadioGroupItem value={v} className="sr-only" />
                      <span className="font-medium text-sm">{l}</span>
                      <span className="text-xs text-muted-foreground">{d}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                <h3 className="font-medium text-sm mb-1">Exam Details</h3>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>• 50 questions · 60 minutes</li>
                  <li>• Matched to your {userSettings?.university_level || "level"}</li>
                  <li>• Instant scoring for objectives</li>
                </ul>
              </div>
              <Button onClick={() => startExam.mutate()} disabled={!course || startExam.isPending} className="w-full bg-primary text-primary-foreground py-5 text-base">
                {startExam.isPending ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generating...</> : "Start Exam"}
              </Button>
            </div>
          </div>
        )}

        {/* Exam */}
        {stage === "exam" && currentExam && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Q{currentQuestion + 1} of {currentExam.questions.length}</span>
                <span className="text-xs text-muted-foreground">{Object.keys(answers).length} answered</span>
              </div>
              <Progress value={(Object.keys(answers).length / currentExam.questions.length) * 100} />
            </div>

            {currentExam.questions[currentQuestion] && (
              <div className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-start gap-3 mb-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">{currentQuestion + 1}</span>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{currentExam.questions[currentQuestion].type} · {currentExam.questions[currentQuestion].marks} mark(s)</span>
                    <p className="text-base mt-1">{currentExam.questions[currentQuestion].question}</p>
                  </div>
                </div>

                {currentExam.questions[currentQuestion].type === "objective" && currentExam.questions[currentQuestion].options && (
                  <RadioGroup value={answers[currentExam.questions[currentQuestion].id] || ""} onValueChange={(v) => handleAnswer(currentExam.questions[currentQuestion].id, v)} className="space-y-2">
                    {currentExam.questions[currentQuestion].options!.map((option, i) => {
                      const letter = option.charAt(0);
                      return (
                        <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${answers[currentExam.questions[currentQuestion].id] === letter ? "border-primary bg-primary/10" : "border-border bg-secondary/50"}`}>
                          <RadioGroupItem value={letter} />
                          <span className="text-sm">{option}</span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                )}

                {currentExam.questions[currentQuestion].type === "theory" && (
                  <textarea value={answers[currentExam.questions[currentQuestion].id] || ""} onChange={(e) => handleAnswer(currentExam.questions[currentQuestion].id, e.target.value)}
                    placeholder="Type your answer..." className="w-full min-h-[120px] rounded-xl bg-secondary border border-border p-3 resize-y text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(prev => prev - 1)} className="flex-1">Previous</Button>
              {currentQuestion < currentExam.questions.length - 1 ? (
                <Button onClick={() => setCurrentQuestion(prev => prev + 1)} className="flex-1 bg-primary text-primary-foreground">Next</Button>
              ) : (
                <Button onClick={() => setShowReview(true)} className="flex-1 bg-primary text-primary-foreground">Review & Submit</Button>
              )}
            </div>

            {/* Question Grid */}
            <div className="p-3 rounded-xl bg-card border border-border">
              <p className="text-xs text-muted-foreground mb-2">Jump to question:</p>
              <div className="flex flex-wrap gap-1.5">
                {currentExam.questions.map((q, i) => (
                  <button key={q.id} onClick={() => setCurrentQuestion(i)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${i === currentQuestion ? "bg-primary text-primary-foreground" : answers[q.id] ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>{i + 1}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {showReview && currentExam && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-card rounded-2xl p-6 border border-border">
              <h3 className="font-display text-lg font-semibold mb-4">Submit Exam?</h3>
              <div className="space-y-2 mb-4">
                <p className="text-sm text-muted-foreground">{Object.keys(answers).length} of {currentExam.questions.length} answered</p>
                {Object.keys(answers).length < currentExam.questions.length && (
                  <p className="text-sm text-destructive">{currentExam.questions.length - Object.keys(answers).length} unanswered</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowReview(false)}>Continue</Button>
                <Button onClick={() => { setShowReview(false); submitExam.mutate(); }} disabled={submitExam.isPending} className="flex-1 bg-primary text-primary-foreground">
                  {submitExam.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {stage === "results" && currentExam && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-card border border-border text-center">
              <Trophy className={`h-16 w-16 mx-auto mb-4 ${(currentExam.score || 0) / currentExam.max_score >= 0.5 ? "text-amber-400" : "text-muted-foreground"}`} />
              <h2 className="font-display text-2xl font-bold mb-1">{currentExam.score} / {currentExam.max_score}</h2>
              <p className="text-muted-foreground">{Math.round(((currentExam.score || 0) / currentExam.max_score) * 100)}% — {currentExam.course}</p>
              {((currentExam.score || 0) / currentExam.max_score) >= 0.5 && (
                <p className="text-sm text-primary mt-2">⭐ +0.4 stars earned!</p>
              )}
            </div>

            {/* Review answers */}
            <div className="space-y-3">
              {currentExam.questions.filter(q => q.type === "objective").map((q, i) => {
                const isCorrect = answers[q.id] === q.correctAnswer;
                return (
                  <div key={q.id} className={`p-3 rounded-xl border ${isCorrect ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                    <div className="flex items-start gap-2">
                      {isCorrect ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{q.question}</p>
                        {!isCorrect && (
                          <p className="text-xs text-muted-foreground mt-1">Your answer: {answers[q.id] || "—"} · Correct: {q.correctAnswer}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setStage("setup"); setCurrentExam(null); setAnswers({}); }}>
                <RotateCcw className="h-4 w-4 mr-2" /> New Exam
              </Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={() => navigate("/dashboard")}>Dashboard</Button>
            </div>
          </div>
        )}
      </main>

      {stage === "setup" && <BottomNav />}
    </div>
  );
}
