import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { X, Upload, FileText, Loader2 } from 'lucide-react';

interface FileUploadProps {
  conversationId: string | null;
  onClose: () => void;
  onFileProcessed: (content: string) => void;
}

export default function FileUpload({ conversationId, onClose, onFileProcessed }: FileUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    // Validate file type - Images now allowed with Google AI
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Unsupported file type',
        description: 'Please upload PDF, Word, PowerPoint, or image files.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 25MB.',
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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };


  const processFile = async () => {
    if (!uploadedFile || !user) return;

    setIsUploading(true);

    try {
      // Upload to storage
      const filePath = `${user.id}/${Date.now()}_${uploadedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, uploadedFile);

      if (uploadError) throw uploadError;

      let textContent = '';
      
      // Handle image files - analyze with Google AI
      if (uploadedFile.type.startsWith('image/')) {
        // Convert image to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix to get just the base64
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(uploadedFile);
        const imageBase64 = await base64Promise;

        // Get current session for authenticated request
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Please log in to continue');
        }

        // Call the image analysis edge function
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-image', {
          body: {
            imageBase64,
            mimeType: uploadedFile.type,
            prompt: `You are an educational AI assistant. Analyze this image carefully and provide a detailed, educational explanation of what you see.

IMPORTANT RULES:
1. Describe EXACTLY what is in the image - do not make assumptions
2. If it's a math problem, solve it step by step showing all work
3. If it's a diagram, explain each part clearly
4. If it's text/notes, explain the content
5. If it's a scientific figure, explain the concepts shown
6. Use simple language that a student can understand
7. Format your response with clear sections and numbered steps
8. NEVER use LaTeX notation - use plain text like × for multiplication, ² for squared

Start your response with: "Looking at your image, I can see..."`,
          },
        });

        if (analysisError) {
          console.error('Image analysis error:', analysisError);
          textContent = `[User uploaded image: ${uploadedFile.name}. The image analysis is temporarily unavailable. Please describe what's in the image so I can help you.]`;
        } else {
          textContent = `[IMAGE ANALYSIS]\n\n${analysisData.analysis}`;
        }
      } else if (uploadedFile.type === 'text/plain') {
        // For text files, read content directly
        textContent = await uploadedFile.text();
      } else if (uploadedFile.type === 'application/pdf') {
        // Extract text from PDF using the extract-pdf-text edge function
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
          });
          reader.readAsDataURL(uploadedFile);
          const pdfBase64 = await base64Promise;

          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error('Please log in to continue');
          }

          const { data: extractionData, error: extractionError } = await supabase.functions.invoke('extract-pdf-text', {
            body: { pdfBase64, mimeType: uploadedFile.type },
          });

          if (extractionError) {
            console.error('PDF extraction error:', extractionError);
            textContent = `[User uploaded PDF: ${uploadedFile.name}. PDF text extraction failed. Please ask the student what specific topics from this document they'd like to explore.]`;
          } else {
            textContent = extractionData.text || `[User uploaded PDF: ${uploadedFile.name}. No text could be extracted.]`;
            console.log(`PDF extracted: ${extractionData.pageCount} pages`);
          }
        } catch (pdfError) {
          console.error('PDF processing error:', pdfError);
          textContent = `[User uploaded PDF: ${uploadedFile.name}. PDF processing failed. Please ask the student what specific topics from this document they'd like to explore.]`;
        }
      } else {
        textContent = `[User uploaded file: ${uploadedFile.name} (${uploadedFile.type}). This is a document I'd like help understanding. Please ask me what specific topics from this file I'd like to explore.]`;
      }

      // Save to database
      await supabase.from('uploaded_files').insert({
        user_id: user.id,
        conversation_id: conversationId,
        file_name: uploadedFile.name,
        file_path: filePath,
        file_type: uploadedFile.type,
        file_size: uploadedFile.size,
      });

      onFileProcessed(textContent);
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
      <div className="mx-3 mb-3 bg-card rounded-2xl border border-border shadow-xl p-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold text-foreground">Attach File</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {uploadedFile ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border">
            <FileText className="h-8 w-8 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{uploadedFile.name}</p>
              <p className="text-xs text-muted-foreground">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setUploadedFile(null)}>
                Change
              </Button>
              <Button
                onClick={processFile}
                disabled={isUploading}
                size="sm"
                className="h-7 px-3 xp-gradient text-primary-foreground text-xs"
              >
                {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                {isUploading ? 'Processing...' : 'Analyze'}
              </Button>
            </div>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-foreground">Tap to select or drag a file</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, Word, PPT, or images (max 25MB)</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.txt,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
              onChange={handleFileInput}
            />
          </label>
        )}
      </div>
    </div>
  );
}
