import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useKnowledgeUnits } from '@/hooks/useKnowledgeUnits';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen,
  Upload,
  FileText,
  Loader2,
  ArrowLeft,
  Sparkles,
  ChevronRight,
  Target
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';

export default function LectureMode() {
  const { user } = useAuth();
  const { balance, canChat } = useKnowledgeUnits();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [course, setCourse] = useState('');
  const [topic, setTopic] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFile = useCallback((file: File) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Unsupported file type',
        description: 'Please upload PDF, Text, or Image files.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploadedFile(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleStartLecture = async () => {
    if (!user) return;

    if (!canChat) {
      toast({
        title: 'No Knowledge Units',
        description: 'You need at least 1 KU to start a lecture. Top up your wallet!',
        variant: 'destructive',
      });
      navigate('/settings?tab=wallet');
      return;
    }

    if (!topic && !uploadedFile) {
      toast({
        title: 'Missing information',
        description: 'Please provide a topic or upload a document to start.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      let fileId = null;
      let textContent = null;

      if (uploadedFile) {
        // Upload and process file
        const filePath = `${user.id}/${Date.now()}_${uploadedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(filePath, uploadedFile);

        if (uploadError) throw uploadError;

        if (uploadedFile.type === 'application/pdf') {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
          });
          reader.readAsDataURL(uploadedFile);
          const pdfBase64 = await base64Promise;

          const { data: extractionData, error: extractionError } = await supabase.functions.invoke('extract-pdf-text', {
            body: { pdfBase64, mimeType: uploadedFile.type },
          });

          if (!extractionError && extractionData?.text) {
            textContent = extractionData.text;
          }
        } else if (uploadedFile.type.startsWith('image/')) {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
          });
          reader.readAsDataURL(uploadedFile);
          const imageBase64 = await base64Promise;

          const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-image', {
            body: {
              imageBase64,
              mimeType: uploadedFile.type,
              prompt: "Extract all educational text and explain diagrams from this document."
            },
          });

          if (!analysisError && analysisData?.analysis) {
            textContent = analysisData.analysis;
          }
        } else {
          textContent = await uploadedFile.text();
        }

        const { data: fileData, error: fileError } = await supabase.from('uploaded_files').insert({
          user_id: user.id,
          file_name: uploadedFile.name,
          file_path: filePath,
          file_type: uploadedFile.type,
          file_size: uploadedFile.size,
          extracted_text: textContent
        }).select().single();

        if (fileError) throw fileError;
        fileId = fileData.id;
      }

      // Create conversation
      const lectureTitle = topic || (uploadedFile ? `Lecture: ${uploadedFile.name}` : 'New Lecture');
      const { data: conversation, error: convError } = await supabase.from('conversations').insert({
        user_id: user.id,
        title: lectureTitle,
        subject: course || null,
        mode: 'lecture'
      }).select().single();

      if (convError) throw convError;

      // Update user study history
      await supabase.from('user_settings').update({
        last_studied_at: new Date().toISOString(),
        last_studied_file_id: fileId,
        last_studied_topic: topic || (uploadedFile ? uploadedFile.name : null)
      }).eq('user_id', user.id);

      // Start the lecture in chat
      const prompt = textContent
        ? `[LECTURE_MODE] I have uploaded a document about "${lectureTitle}". Please start lecturing me on it thoroughly.`
        : `[LECTURE_MODE] Please lecture me on the topic: "${topic}"${course ? ` within the context of ${course}` : ''}. Start with the basics and go deep.`;

      navigate(`/chat/${conversation.id}?mode=lecture`, { state: { initialMessage: prompt, fileContent: textContent } });

    } catch (error) {
      toast({
        title: 'Initialization failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Lecture Mode
          </h1>
        </div>
      </header>

      <main className="px-4 py-6 space-y-8 max-w-2xl mx-auto">
        <section className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold font-display">Achieve Academic Dominance</h2>
          <p className="text-muted-foreground">Deeply understand your course materials through structured, human-like lectures.</p>
        </section>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">What are we studying?</label>
              <input
                type="text"
                placeholder="Course (e.g., GST 101, Intro to Law)"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
              <input
                type="text"
                placeholder="Topic (e.g., Photosynthesis, Contract Law)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or upload a document</span>
              </div>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {uploadedFile ? (
                <div className="flex flex-col items-center">
                  <FileText className="h-12 w-12 text-primary mb-3" />
                  <p className="font-medium text-foreground mb-1">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground mb-4">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  <Button variant="outline" size="sm" onClick={() => setUploadedFile(null)}>Remove File</Button>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-foreground mb-1">Drag and drop your PDF or image here</p>
                  <label className="cursor-pointer">
                    <span className="text-primary text-sm font-medium hover:underline">browse files</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          <Button
            onClick={handleStartLecture}
            disabled={isProcessing || (!topic && !uploadedFile)}
            className="w-full py-6 rounded-2xl xp-gradient text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/20"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-5 w-5" />
            )}
            {isProcessing ? 'Preparing your lecture...' : 'Start Lecture'}
          </Button>
        </div>

        {balance <= 3 && balance > 0 && (
          <div className="bg-primary/5 rounded-xl p-3 border border-primary/20 text-center">
            <p className="text-xs text-muted-foreground">
              You have {balance} KU remaining. A lecture consumes 1 KU per prompt.
            </p>
          </div>
        )}

        <section className="bg-primary/5 rounded-2xl p-5 border border-primary/10">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            What to expect
          </h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
              Personalized analogies for deep understanding
            </li>
            <li className="flex gap-2">
              <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
              Step-by-step breakdown of complex concepts
            </li>
            <li className="flex gap-2">
              <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
              Frequent mini-quizzes to ensure mastery
            </li>
          </ul>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
