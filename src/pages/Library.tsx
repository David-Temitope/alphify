import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useKnowledgeUnits } from '@/hooks/useKnowledgeUnits';
import { 
  ArrowLeft, 
  Search, 
  FileText, 
  Trash2, 
  Upload,
  Folder,
  Clock,
  ExternalLink,
  Plus,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import FileUpload from '@/components/FileUpload';

export default function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const { balance, librarySlots, buyLibrarySlot, isBuyingSlot } = useKnowledgeUnits();

  const { data: files, isLoading } = useQuery({
    queryKey: ['library-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const usedSlots = files?.length || 0;
  const hasAvailableSlot = usedSlots < librarySlots;

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      const file = files?.find(f => f.id === fileId);
      if (file) {
        await supabase.storage.from('user-files').remove([file.file_path]);
        const { error } = await supabase.from('uploaded_files').delete().eq('id', fileId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-files'] });
      toast({ title: 'File deleted — slot freed up!' });
    },
    onError: () => {
      toast({ title: 'Failed to delete file', variant: 'destructive' });
    },
  });

  const handleUploadClick = () => {
    if (hasAvailableSlot) {
      setShowUpload(true);
    } else {
      toast({
        title: 'No slots available',
        description: 'Buy more library space for 5 KU to upload another file.',
      });
    }
  };

  const handleBuySlot = async () => {
    const success = await buyLibrarySlot();
    if (success) {
      queryClient.invalidateQueries({ queryKey: ['library-files'] });
    }
  };

  const filteredFiles = files?.filter(file => 
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return '📊';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📽️';
    return '📁';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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
              <Folder className="h-6 w-6 text-primary" />
              <h1 className="font-display font-semibold text-xl text-foreground">My Library</h1>
              <span className="text-sm text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {usedSlots}/{librarySlots} slots
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBuySlot}
              disabled={isBuyingSlot || balance < 5}
              className="text-xs"
            >
              {isBuyingSlot ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              Buy Slot (5 KU)
            </Button>
            <Button 
              onClick={handleUploadClick}
              disabled={!hasAvailableSlot}
              className="xp-gradient text-primary-foreground"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-8">
        {/* Slot info banner when full */}
        {!hasAvailableSlot && usedSlots > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-secondary border border-border animate-fade-in">
            <p className="text-sm text-foreground">
              All {librarySlots} slot{librarySlots > 1 ? 's' : ''} used. 
              <button onClick={handleBuySlot} disabled={isBuyingSlot || balance < 5} className="text-primary font-medium ml-1 hover:underline">
                Buy another slot for 5 KU
              </button>
              {balance < 5 && <span className="text-muted-foreground ml-1">(need {5 - balance} more KU)</span>}
            </p>
          </div>
        )}

        {/* Search */}
        <div className="mb-8 animate-fade-in">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary border-border focus:border-primary"
            />
          </div>
        </div>

        {/* Files Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-4 rounded-xl animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-muted rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredFiles && filteredFiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFiles.map((file, index) => (
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
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(file.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                {file.summary && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                    {file.summary}
                  </p>
                )}

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
                        navigate(`/chat/${data.id}?file=${file.id}`);
                      }
                    }}
                    className="text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ask about this
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => deleteFile.mutate(file.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-12 rounded-2xl text-center animate-fade-in">
            <FileText className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="font-display text-xl font-semibold mb-2">Your library is empty</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Upload your PDFs, documents, and study materials. You have {librarySlots} free slot{librarySlots > 1 ? 's' : ''} to start!
            </p>
            <Button onClick={() => setShowUpload(true)} className="xp-gradient text-primary-foreground">
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First File
            </Button>
          </div>
        )}
      </main>

      {showUpload && (
        <FileUpload 
          conversationId={null}
          onClose={() => setShowUpload(false)}
          onFileProcessed={() => {
            setShowUpload(false);
            queryClient.invalidateQueries({ queryKey: ['library-files'] });
            toast({ title: 'File uploaded successfully!' });
          }}
        />
      )}
    </div>
  );
}
