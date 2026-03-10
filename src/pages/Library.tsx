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
  Search, 
  FileText, 
  Trash2,
  Download,
  Upload,
  Folder,
  Clock,
  ExternalLink,
  Loader2,
  BookOpen,
  GraduationCap,
  Shield,
  AlertTriangle,
  Coins,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { useKnowledgeUnits } from '@/hooks/useKnowledgeUnits';
import BottomNav from '@/components/BottomNav';

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
  const { balance, refetch: refetchKU } = useKnowledgeUnits();

  const { data: userSettings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: adminAssignments } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_assignments', { _user_id: user!.id });
      if (error) throw error;
      return data as { university: string; department: string; level: string }[];
    },
  });

  const isAdmin = adminAssignments && adminAssignments.length > 0;

  const { data: personalFileCount } = useQuery({
    queryKey: ['personal-file-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase.from('uploaded_files').select('*', { count: 'exact', head: true }).eq('user_id', user!.id);
      return count || 0;
    },
  });

  // File size based KU cost: 1 KU per 1000KB (1MB)
  const calculateFileCost = (fileSize: number) => Math.max(1, Math.ceil(fileSize / (1000 * 1024)));

  const { data: files, isLoading } = useQuery({
    queryKey: ['shared-files'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shared_files').select('*').order('course_code', { ascending: true }).order('created_at', { ascending: false });
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shared-files'] }); toast({ title: 'File deleted successfully' }); },
    onError: () => { toast({ title: 'Failed to delete file', variant: 'destructive' }); },
  });

  const handleUpload = async () => {
    if (!uploadFile || !uploadCourseCode.trim()) return;
    setIsUploading(true);
    try {
      if (isAdmin && adminAssignments?.length) {
        const assignment = adminAssignments[0];
        const courseCode = uploadCourseCode.trim().toUpperCase();
        const filePath = `shared/${assignment.university}/${assignment.department}/${assignment.level}/${courseCode}/${Date.now()}_${uploadFile.name}`;
        const { error: uploadError } = await supabase.storage.from('user-files').upload(filePath, uploadFile);
        if (uploadError) throw uploadError;
        let extractedText: string | null = null;
        if (uploadFile.type === 'application/pdf') {
          try {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => { reader.onload = () => { resolve((reader.result as string).split(',')[1]); }; reader.onerror = reject; });
            reader.readAsDataURL(uploadFile);
            const pdfBase64 = await base64Promise;
            const { data: extractionData, error: extractionError } = await supabase.functions.invoke('extract-pdf-text', { body: { pdfBase64, mimeType: 'application/pdf' } });
            if (!extractionError && extractionData?.text) extractedText = extractionData.text;
          } catch (e) { console.error('PDF extraction failed:', e); }
        }
        const { error: insertError } = await supabase.from('shared_files').insert({ uploaded_by: user!.id, university: assignment.university, department: assignment.department, level: assignment.level, course_code: courseCode, file_name: uploadFile.name, file_path: filePath, file_type: uploadFile.type, file_size: uploadFile.size, extracted_text: extractedText, file_category: uploadCategory });
        if (insertError) throw insertError;
        queryClient.invalidateQueries({ queryKey: ['shared-files'] });

        // Notify all students in same university/department/level
        supabase.functions.invoke('notify-library-upload', {
          body: {
            university: assignment.university,
            department: assignment.department,
            level: assignment.level,
            courseCode,
            fileName: uploadFile.name,
            uploadedByName: 'Your Course Rep',
          },
        }).catch(e => console.error('Library upload notification failed:', e));

        toast({ title: 'File uploaded!', description: `${uploadFile.name} is now available to all students.` });
      } else {
        // Charge KU based on file size for personal uploads
        const fileCost = calculateFileCost(uploadFile.size);
        if (balance < fileCost) {
          toast({ title: 'Not enough KU', description: `This file requires ${fileCost} KU to upload (based on file size).`, variant: 'destructive' });
          setIsUploading(false);
          return;
        }
        // Deduct KU via edge function
        const { data: session } = await supabase.auth.getSession();
        if (session?.session) {
          const { error: kuError } = await supabase.from('ku_wallets').update({ balance: balance - fileCost }).eq('user_id', user!.id);
          if (kuError) throw new Error('Failed to deduct KU');
          await supabase.from('ku_transactions').insert({ user_id: user!.id, amount: -fileCost, type: 'file_upload', description: `File upload: ${uploadFile.name} (${Math.round(uploadFile.size / 1024)}KB)` });
        }
        const courseCode = uploadCourseCode.trim().toUpperCase();
        const filePath = `personal/${user!.id}/${courseCode}/${Date.now()}_${uploadFile.name}`;
        const { error: uploadError } = await supabase.storage.from('user-files').upload(filePath, uploadFile);
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from('uploaded_files').insert({ user_id: user!.id, file_name: uploadFile.name, file_path: filePath, file_type: uploadFile.type, file_size: uploadFile.size });
        if (insertError) throw insertError;
        queryClient.invalidateQueries({ queryKey: ['personal-file-count'] });
        refetchKU();
        toast({ title: 'File uploaded!', description: `${uploadFile.name} saved to your personal library.` });
      }
      setShowUpload(false); setUploadFile(null); setUploadCourseCode('');
    } catch (error) {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setIsUploading(false); }
  };

  const filteredFiles = files?.filter(file => file.file_name.toLowerCase().includes(searchQuery.toLowerCase()) || file.course_code.toLowerCase().includes(searchQuery.toLowerCase()));

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
    <div className="min-h-[100dvh] bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold text-foreground">Library</h1>
            {isAdmin && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                <Shield className="h-3 w-3" /> Admin
              </span>
            )}
          </div>
          <Button onClick={() => setShowUpload(true)} size="sm" className="rounded-full bg-primary text-primary-foreground">
            <Upload className="h-4 w-4 mr-1" /> Upload
          </Button>
        </div>
      </header>

      <main className="px-4 space-y-4">
        {/* Profile warning */}
        {!hasProfile && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Set your university to access shared files</p>
                <p className="text-xs text-muted-foreground mt-0.5">Go to Settings to complete your profile.</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate('/settings')}>Setup</Button>
            </div>
          </div>
        )}

        {/* Admin info */}
        {isAdmin && adminAssignments && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
            <p className="text-sm text-foreground font-medium mb-1">Your admin assignments:</p>
            {adminAssignments.map((a, i) => (
              <p key={i} className="text-xs text-muted-foreground">{a.university} / {a.department} / {a.level}</p>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files or course codes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-card border-border rounded-xl" />
        </div>

        {/* Files */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : groupedFiles && Object.keys(groupedFiles).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedFiles).map(([courseCode, courseFiles]) => (
              <div key={courseCode}>
                <div className="flex items-center gap-2 mb-3">
                  <Folder className="h-4 w-4 text-primary" />
                  <h2 className="font-display font-semibold text-foreground">{courseCode}</h2>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{courseFiles!.length}</span>
                </div>
                <div className="space-y-2">
                  {courseFiles!.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-lg flex-shrink-0">
                        {getFileIcon(file.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate text-sm">{file.file_name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.file_size)}</span>
                          <span>·</span>
                          <span>{format(new Date(file.created_at), 'MMM d')}</span>
                          <span className={`px-1.5 py-0.5 rounded ${file.file_category === 'exam_sample' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                            {file.file_category === 'exam_sample' ? 'Exam' : 'Material'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"
                          onClick={async () => {
                            try {
                              const { data, error } = await supabase.storage.from('user-files').download(file.file_path);
                              if (error) throw error;
                              const url = URL.createObjectURL(data);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = file.file_name;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            } catch {
                              toast({ title: 'Download failed', variant: 'destructive' });
                            }
                          }}>
                          <Download className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"
                          onClick={async () => {
                            const { data, error } = await supabase.from('conversations').insert({ user_id: user!.id, title: `Discussing: ${file.file_name}` }).select().single();
                            if (!error && data) navigate(`/chat/${data.id}?sharedFile=${file.id}`);
                          }}>
                          <ExternalLink className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        {isAdmin && file.uploaded_by === user?.id && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => deleteFile.mutate(file.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
          <div className="rounded-2xl bg-card border border-border p-10 text-center">
            <FileText className="h-12 w-12 text-primary mx-auto mb-3" />
            <h3 className="font-display font-semibold mb-1">No course files yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {!hasProfile ? 'Complete your profile in Settings to see shared files.' : isAdmin ? 'Upload materials for your students.' : 'Your admin hasn\'t uploaded files yet.'}
            </p>
            {!hasProfile && (
              <Button onClick={() => navigate('/settings')} size="sm" className="bg-primary text-primary-foreground">
                <GraduationCap className="h-4 w-4 mr-2" /> Complete Profile
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl p-6 border border-border animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                {isAdmin ? 'Upload Shared File' : 'Upload Personal File'}
              </h2>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setShowUpload(false); setUploadFile(null); setUploadCourseCode(''); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!isAdmin && (
              <div className="mb-4 p-3 rounded-lg bg-secondary border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {hasFreeSlotsLeft ? `Free upload (${librarySlots - (personalFileCount || 0)} slot${librarySlots - (personalFileCount || 0) > 1 ? 's' : ''} left)` : 'Additional slot costs 5 KU'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {hasFreeSlotsLeft ? 'This upload is free.' : `You have ${balance} KU. 5 KU will be deducted.`}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Course Code</label>
                <Input placeholder="e.g. MCB101" value={uploadCourseCode} onChange={(e) => setUploadCourseCode(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">File Category</label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
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
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setUploadFile(null)}>Remove</Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-foreground">Tap to select a file</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, Word, PowerPoint (max 10MB)</p>
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size <= 10 * 1024 * 1024) setUploadFile(f); else if (f) toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' }); }} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pb-4">
              <Button variant="outline" className="flex-1" onClick={() => { setShowUpload(false); setUploadFile(null); setUploadCourseCode(''); }}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!uploadFile || !uploadCourseCode.trim() || isUploading} className="flex-1 bg-primary text-primary-foreground">
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
