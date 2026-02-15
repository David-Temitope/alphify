import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  Search, 
  FileText, 
  Trash2, 
  Upload,
  Folder,
  Clock,
  ExternalLink,
  Loader2,
  BookOpen,
  GraduationCap,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';

export default function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>('course_material');
  const [uploadCourseCode, setUploadCourseCode] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Fetch user settings (university, field_of_study, level)
  const { data: userSettings } = useQuery({
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

  // Check if user is a department admin
  const { data: adminAssignments } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_assignments', {
        _user_id: user!.id,
      });
      if (error) throw error;
      return data as { university: string; department: string; level: string }[];
    },
  });

  const isAdmin = adminAssignments && adminAssignments.length > 0;

  // Fetch shared files matching student's profile
  const { data: files, isLoading } = useQuery({
    queryKey: ['shared-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_files')
        .select('*')
        .order('course_code', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      const file = files?.find(f => f.id === fileId);
      if (file) {
        await supabase.storage.from('user-files').remove([file.file_path]);
        const { error } = await supabase.from('shared_files').delete().eq('id', fileId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-files'] });
      toast({ title: 'File deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete file', variant: 'destructive' });
    },
  });

  const handleUpload = async () => {
    if (!uploadFile || !uploadCourseCode.trim() || !adminAssignments?.length) return;

    setIsUploading(true);
    try {
      const assignment = adminAssignments[0]; // Use first assignment
      const courseCode = uploadCourseCode.trim().toUpperCase();
      const filePath = `shared/${assignment.university}/${assignment.department}/${assignment.level}/${courseCode}/${Date.now()}_${uploadFile.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, uploadFile);
      if (uploadError) throw uploadError;

      // Extract text if PDF
      let extractedText: string | null = null;
      if (uploadFile.type === 'application/pdf') {
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
          });
          reader.readAsDataURL(uploadFile);
          const pdfBase64 = await base64Promise;

          const { data: extractionData, error: extractionError } = await supabase.functions.invoke('extract-pdf-text', {
            body: { pdfBase64, mimeType: 'application/pdf' },
          });

          if (!extractionError && extractionData?.text) {
            extractedText = extractionData.text;
          }
        } catch (e) {
          console.error('PDF extraction failed during upload:', e);
        }
      }

      // Save to shared_files table
      const { error: insertError } = await supabase.from('shared_files').insert({
        uploaded_by: user!.id,
        university: assignment.university,
        department: assignment.department,
        level: assignment.level,
        course_code: courseCode,
        file_name: uploadFile.name,
        file_path: filePath,
        file_type: uploadFile.type,
        file_size: uploadFile.size,
        extracted_text: extractedText,
        file_category: uploadCategory,
      });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['shared-files'] });
      setShowUpload(false);
      setUploadFile(null);
      setUploadCourseCode('');
      toast({ title: 'File uploaded!', description: `${uploadFile.name} is now available to all students.` });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const filteredFiles = files?.filter(file =>
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.course_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group files by course code
  const groupedFiles = filteredFiles?.reduce((acc, file) => {
    const key = file.course_code;
    if (!acc[key]) acc[key] = [];
    acc[key].push(file);
    return acc;
  }, {} as Record<string, typeof filteredFiles>);

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📽️';
    return '📁';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const university = (userSettings as any)?.university;
  const hasProfile = university && userSettings?.field_of_study && userSettings?.university_level;

  return (
    <div className="min-h-screen xp-bg-gradient">
      {/* Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-4 md:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="font-display font-semibold text-xl text-foreground">Course Library</h1>
              {isAdmin && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Admin
                </span>
              )}
            </div>
          </div>

          {isAdmin && (
            <Button
              onClick={() => setShowUpload(true)}
              className="xp-gradient text-primary-foreground"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-8">
        {/* Profile incomplete warning */}
        {!hasProfile && (
          <div className="mb-6 p-4 rounded-xl bg-secondary border border-border animate-fade-in">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Complete your academic profile</p>
                <p className="text-xs text-muted-foreground">
                  Set your university name, field of study, and level in Settings to see shared course files.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                Go to Settings
              </Button>
            </div>
          </div>
        )}

        {/* Admin assignment info */}
        {isAdmin && adminAssignments && (
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-fade-in">
            <p className="text-sm text-foreground font-medium mb-1">Your admin assignments:</p>
            {adminAssignments.map((a, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {a.university} / {a.department} / {a.level}
              </p>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="mb-8 animate-fade-in">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by file name or course code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary border-border focus:border-primary"
            />
          </div>
        </div>

        {/* Files grouped by course */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : groupedFiles && Object.keys(groupedFiles).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(groupedFiles).map(([courseCode, courseFiles]) => (
              <div key={courseCode} className="animate-fade-in-up">
                <div className="flex items-center gap-2 mb-4">
                  <Folder className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-semibold text-lg text-foreground">{courseCode}</h2>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    {courseFiles!.length} file{courseFiles!.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courseFiles!.map((file, index) => (
                    <div
                      key={file.id}
                      className="glass-card p-4 rounded-xl group hover:border-primary/30 transition-all animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-2xl">
                          {getFileIcon(file.file_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground truncate text-sm mb-1">
                            {file.file_name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span>•</span>
                            <span className={`px-1.5 py-0.5 rounded ${
                              file.file_category === 'exam_sample'
                                ? 'bg-orange-500/10 text-orange-500'
                                : 'bg-primary/10 text-primary'
                            }`}>
                              {file.file_category === 'exam_sample' ? 'Exam Sample' : 'Course Material'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(file.created_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const { data, error } = await supabase
                              .from('conversations')
                              .insert({ user_id: user!.id, title: `Discussing: ${file.file_name}` })
                              .select()
                              .single();
                            if (!error && data) {
                              navigate(`/chat/${data.id}?sharedFile=${file.id}`);
                            }
                          }}
                          className="text-xs"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ask Gideon
                        </Button>
                        {isAdmin && file.uploaded_by === user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteFile.mutate(file.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-12 rounded-2xl text-center animate-fade-in">
            <FileText className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="font-display text-xl font-semibold mb-2">No course files yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {!hasProfile
                ? 'Complete your academic profile in Settings to see shared files from your university.'
                : isAdmin
                  ? 'Upload course materials and exam samples for your students.'
                  : 'Your department admin hasn\'t uploaded any files yet. Check back soon!'}
            </p>
            {!hasProfile && (
              <Button onClick={() => navigate('/settings')} className="xp-gradient text-primary-foreground">
                <GraduationCap className="h-4 w-4 mr-2" />
                Complete Profile
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Admin Upload Modal */}
      {showUpload && isAdmin && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl p-6 animate-scale-in">
            <h2 className="font-display text-xl font-semibold text-foreground mb-6">Upload Shared File</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Course Code</label>
                <Input
                  placeholder="e.g. MCB101"
                  value={uploadCourseCode}
                  onChange={(e) => setUploadCourseCode(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">File Category</label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course_material">Course Material</SelectItem>
                    <SelectItem value="exam_sample">Exam Sample</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">File</label>
                <div className="border-2 border-dashed rounded-xl p-6 text-center border-border hover:border-primary/50 transition-all">
                  {uploadFile ? (
                    <div>
                      <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">{uploadFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(uploadFile.size)}</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setUploadFile(null)}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-foreground">Click to select a file</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, Word, PowerPoint (max 10MB)</p>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f && f.size <= 10 * 1024 * 1024) setUploadFile(f);
                          else if (f) toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => { setShowUpload(false); setUploadFile(null); setUploadCourseCode(''); }}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!uploadFile || !uploadCourseCode.trim() || isUploading}
                className="xp-gradient text-primary-foreground"
              >
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
