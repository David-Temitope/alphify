import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = async (file: File) => {
    // Validate file type - NO IMAGES ALLOWED
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    // Check if it's an image file
    if (file.type.startsWith('image/')) {
      toast({
        title: 'Images not supported',
        description: 'Please upload PDF, Word, or PowerPoint files only. Images are not allowed.',
        variant: 'destructive',
      });
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Unsupported file type',
        description: 'Please upload PDF, Word, or PowerPoint files only.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploadedFile(file);
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

      // For text files, read content directly
      let textContent = '';
      if (uploadedFile.type === 'text/plain') {
        textContent = await uploadedFile.text();
      } else if (uploadedFile.type === 'application/pdf') {
        // For PDFs, we'll pass a message to the AI about analyzing the PDF
        textContent = `[User uploaded PDF: ${uploadedFile.name}. Please note this is a PDF document that I'd like you to help me understand. For now, please ask me what specific topics or sections from this document I'd like to explore.]`;
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
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-lg rounded-2xl p-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold text-foreground">Upload Document</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
        >
          {uploadedFile ? (
            <div className="flex flex-col items-center">
              <FileText className="h-12 w-12 text-primary mb-4" />
              <p className="font-medium text-foreground mb-1">{uploadedFile.name}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {(uploadedFile.size / 1024).toFixed(1)} KB
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadedFile(null)}
              >
                Remove
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground mb-2">
                Drag and drop your file here, or
              </p>
              <label className="cursor-pointer">
                <span className="text-primary hover:underline">browse files</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.doc,.docx,.ppt,.pptx"
                  onChange={handleFileInput}
                />
              </label>
              <p className="text-sm text-muted-foreground mt-4">
                PDF, Word, or PowerPoint files only (max 10MB)
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={processFile}
            disabled={!uploadedFile || isUploading}
            className="xp-gradient text-primary-foreground"
          >
            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUploading ? 'Processing...' : 'Upload & Analyze'}
          </Button>
        </div>
      </div>
    </div>
  );
}
