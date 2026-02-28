import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useVoice } from '@/hooks/useVoice';
import { useKnowledgeUnits } from '@/hooks/useKnowledgeUnits';
import ChatMessage from '@/components/ChatMessage';
import FileUpload from '@/components/FileUpload';
import { 
  ArrowLeft, 
  Send, 
  Paperclip, 
  Loader2,
  MessageSquarePlus,
  Menu,
  X,
  Mic,
  MicOff,
  Settings,
  Trash2,
  BookOpen,
  Search as SearchIcon,
  ChevronDown
} from 'lucide-react';
import alphifyLogo from '@/assets/alphify-logo.webp';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  is_quiz?: boolean;
  quiz_passed?: boolean;
  created_at: string;
}

interface UserSettings {
  student_type: string | null;
  field_of_study: string | null;
  country: string | null;
  university_level: string | null;
  ai_personality: string[];
  courses: string[];
  preferred_name: string | null;
  quiz_score_percentage: number;
  total_quizzes_taken: number;
  explanation_style: string | null;
}

export default function Chat() {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const fileIdFromLibrary = searchParams.get('file');
  const chatMode = searchParams.get('mode'); // 'assignment' or null
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [hasPlayedBounce, setHasPlayedBounce] = useState(false);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  
  // Knowledge Units
  const { balance, canChat, refetch: refetchKU } = useKnowledgeUnits();

  // Voice input
  const { isListening, transcript, startListening, stopListening, isSupported: voiceSupported } = useVoice({
    onTranscript: (text) => {
      setInput(prev => prev + (prev ? ' ' : '') + text);
    },
  });

  // Fetch user settings for personalization
  const { data: userSettings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserSettings | null;
    },
  });

  // Support both personal files (?file=) and shared files (?sharedFile=)
  const sharedFileId = searchParams.get('sharedFile');

  // Fetch personal file from library
  const { data: libraryFile } = useQuery({
    queryKey: ['library-file', fileIdFromLibrary],
    queryFn: async () => {
      if (!fileIdFromLibrary) return null;
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('id', fileIdFromLibrary)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!fileIdFromLibrary,
  });

  // Fetch shared file from library
  const { data: sharedFile } = useQuery({
    queryKey: ['shared-file', sharedFileId],
    queryFn: async () => {
      if (!sharedFileId) return null;
      const { data, error } = await supabase
        .from('shared_files')
        .select('*')
        .eq('id', sharedFileId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sharedFileId,
  });

  // Set file content when coming from library - extract PDF text if applicable
  useEffect(() => {
    if (libraryFile && !fileContent && !isExtractingFile) {
      const isPdf = libraryFile.file_type === 'application/pdf';
      
      if (isPdf) {
        const extractPdfText = async () => {
          setIsExtractingFile(true);
          try {
            const { data: fileBlob, error: downloadError } = await supabase.storage
              .from('user-files')
              .download(libraryFile.file_path);
            if (downloadError || !fileBlob) throw new Error('Failed to download file');

            const arrayBuffer = await fileBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
            const pdfBase64 = btoa(binary);

            const { data: extractionData, error: extractionError } = await supabase.functions.invoke('extract-pdf-text', {
              body: { pdfBase64, mimeType: 'application/pdf' },
            });
            if (extractionError) throw new Error('PDF text extraction failed');

            if (extractionData?.text) {
              setFileContent(extractionData.text);
              toast({ title: 'Document text extracted', description: `Ready to discuss: ${libraryFile.file_name}` });
            } else {
              throw new Error('No text could be extracted');
            }
          } catch (error) {
            console.error('Library PDF extraction error:', error);
            setFileContent(`[User wants to discuss file: ${libraryFile.file_name}. PDF text extraction failed.]`);
            toast({ title: 'File loaded (limited mode)', variant: 'destructive' });
          } finally {
            setIsExtractingFile(false);
          }
        };
        extractPdfText();
      } else {
        setFileContent(`[User wants to discuss file: ${libraryFile.file_name} (${libraryFile.file_type}).]`);
        toast({ title: 'File loaded from library', description: `Ready to discuss: ${libraryFile.file_name}` });
      }
    }
  }, [libraryFile, fileContent, isExtractingFile, toast]);

  // Set file content when coming from shared library - use cached text if available
  useEffect(() => {
    if (sharedFile && !fileContent && !isExtractingFile) {
      // If extracted_text is cached, use it directly (saves AI credits)
      if (sharedFile.extracted_text) {
        setFileContent(sharedFile.extracted_text);
        toast({ title: 'Document loaded', description: `Ready to discuss: ${sharedFile.file_name}` });
        return;
      }

      // Otherwise extract from storage
      const isPdf = sharedFile.file_type === 'application/pdf';
      if (isPdf) {
        const extractPdfText = async () => {
          setIsExtractingFile(true);
          try {
            const { data: fileBlob, error: downloadError } = await supabase.storage
              .from('user-files')
              .download(sharedFile.file_path);
            if (downloadError || !fileBlob) throw new Error('Failed to download file');

            const arrayBuffer = await fileBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
            const pdfBase64 = btoa(binary);

            const { data: extractionData, error: extractionError } = await supabase.functions.invoke('extract-pdf-text', {
              body: { pdfBase64, mimeType: 'application/pdf' },
            });
            if (extractionError) throw new Error('PDF text extraction failed');

            if (extractionData?.text) {
              setFileContent(extractionData.text);
              toast({ title: 'Document text extracted', description: `Ready to discuss: ${sharedFile.file_name}` });
            } else {
              throw new Error('No text could be extracted');
            }
          } catch (error) {
            console.error('Shared file extraction error:', error);
            setFileContent(`[User wants to discuss shared file: ${sharedFile.file_name}. Extraction failed.]`);
            toast({ title: 'File loaded (limited mode)', variant: 'destructive' });
          } finally {
            setIsExtractingFile(false);
          }
        };
        extractPdfText();
      } else {
        setFileContent(`[User wants to discuss shared file: ${sharedFile.file_name} (${sharedFile.file_type}).]`);
        toast({ title: 'File loaded', description: `Ready to discuss: ${sharedFile.file_name}` });
      }
    }
  }, [sharedFile, fileContent, isExtractingFile, toast]);

  // Fetch conversation
  const { data: conversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });

  // Fetch messages
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
  });

  // Fetch all conversations for sidebar
  const { data: allConversations } = useQuery({
    queryKey: ['all-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Handle scroll to show/hide scroll down arrow
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;

    if (!isAtBottom && !showScrollDown) {
      setHasPlayedBounce(false);
    }

    setShowScrollDown(!isAtBottom);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Update input with voice transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const resolveConversationId = useCallback(async (): Promise<string | null> => {
    if (conversationId) return conversationId;
    if (!user) return null;

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title: 'New Conversation' })
      .select()
      .single();

    if (error || !data) {
      toast({
        title: 'Error',
        description: 'Unable to start a new chat right now. Please try again.',
        variant: 'destructive',
      });
      return null;
    }

    queryClient.invalidateQueries({ queryKey: ['all-conversations'] });
    navigate(`/chat/${data.id}`, { replace: true });
    return data.id;
  }, [conversationId, user, queryClient, navigate, toast]);

  const handleSendMessage = useCallback(async (text?: string) => {
    const messageToSend = text || input.trim();
    if (!messageToSend || isStreaming || balance < (chatMode === 'assignment' ? 2 : 1)) {
      if (!messageToSend || isStreaming) return;

      const requiredKU = chatMode === 'assignment' ? 2 : 1;
      toast({
        title: 'Not enough Knowledge Units',
        description: `You need at least ${requiredKU} KU${chatMode === 'assignment' ? ' for Assignment Assist' : ''}. Top up your wallet!`,
        variant: 'destructive',
      });
      return;
    }

    const activeConversationId = await resolveConversationId();
    if (!activeConversationId) return;

    const userMessage = messageToSend;
    if (!text) setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    try {
      // Save user message
      await supabase.from('messages').insert({
        conversation_id: activeConversationId,
        user_id: user!.id,
        role: 'user',
        content: userMessage,
      });

      // Get all messages for context
      const { data: allMessages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });

      const messageHistory = allMessages?.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })) || [];

      // Add current message
      messageHistory.push({ role: 'user', content: userMessage });

      // Build personalization context
      let personalizationContext = '';
      if (userSettings) {
        personalizationContext = `
Student Profile:
- Name: ${userSettings.preferred_name || 'Student'}
- Student Type: ${userSettings.student_type || 'Not specified'}
- Field of Study: ${userSettings.field_of_study || 'Not specified'}
- University Level: ${userSettings.university_level || 'Not specified'}
- Country: ${userSettings.country || 'Not specified'}
- Courses: ${userSettings.courses?.join(', ') || 'Not specified'}
- Preferred AI Personality: ${userSettings.ai_personality?.join(', ') || 'friendly'}
- Explanation Style: ${userSettings.explanation_style || 'five_year_old'}
- Quiz Performance: ${userSettings.quiz_score_percentage || 0}% (${userSettings.total_quizzes_taken || 0} quizzes taken)
- About the Student: ${(userSettings as any).bio || 'Not provided'}
`;
      }

      // Get the current session token for authenticated requests
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please log in to continue');
      }

      // Call AI
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/xplane-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          messages: messageHistory,
          fileContent: fileContent,
          personalization: personalizationContext,
          mode: chatMode || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle rate limit / quota exhaustion with friendly message
        if (response.status === 429) {
          throw new Error('🚫 Ezra is currently overloaded. The AI service has reached its usage limit. Please wait a few minutes and try again. If this persists, the service may need a quota upgrade.');
        }
        
        throw new Error(errorData.error || 'Failed to get response');
      }

      // Stream response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setStreamingContent(fullContent);
              }
            } catch {
              buffer = line + '\n' + buffer;
              break;
            }
          }
        }
      }

      // Save assistant message
      const isQuiz = fullContent.includes('[QUIZ]') || (fullContent.includes('quiz') && fullContent.includes('?'));
      
      // Detect correct quiz answer and increment star rating
      const correctIndicators = ['correct', '✅', 'well done', 'great job', 'that\'s right', 'you got it', 'right answer', 'correct answer'];
      const lowerContent = fullContent.toLowerCase();
      const wasCorrectAnswer = correctIndicators.some(indicator => lowerContent.includes(indicator)) && 
        messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && 
        (messages[messages.length - 1]?.is_quiz || messages[messages.length - 1]?.content?.includes('[QUIZ]'));
      
      if (wasCorrectAnswer) {
        try {
          await supabase.rpc('increment_star_rating' as any, { _user_id: user!.id, _amount: 0.1 });
        } catch {
          // Silent fail - star increment is non-critical
        }
      }
      
      await supabase.from('messages').insert({
        conversation_id: activeConversationId,
        user_id: user!.id,
        role: 'assistant',
        content: fullContent,
        is_quiz: isQuiz,
        quiz_passed: wasCorrectAnswer || undefined,
      });

      // Update conversation title if first exchange
      if (messages.length === 0) {
        const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '');
        await supabase
          .from('conversations')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('id', activeConversationId);
      } else {
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', activeConversationId);
      }

      setFileContent(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] }),
        queryClient.invalidateQueries({ queryKey: ['all-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['ku-wallet'] }),
      ]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [input, isStreaming, resolveConversationId, user, messages, fileContent, userSettings, toast, queryClient, balance, chatMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user!.id, title: 'New Conversation' })
      .select()
      .single();
    
    if (!error && data) {
      queryClient.invalidateQueries({ queryKey: ['all-conversations'] });
      navigate(`/chat/${data.id}`);
    }
  };

  const handleFileProcessed = (content: string) => {
    setFileContent(content);
    setShowFileUpload(false);
    toast({
      title: 'Document ready!',
      description: 'Your file has been processed. Ask me anything about it!',
    });
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const filteredMessages = useMemo(() => {
    return searchQuery.trim()
      ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      : messages;
  }, [messages, searchQuery]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
            <div className="flex items-center gap-3">
            <img src={alphifyLogo} alt="Alphify" className="w-9 h-9 rounded-lg shadow-md" />
              <span className="font-display font-semibold text-sidebar-foreground">Alphify</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowSidebar(false)} className="lg:hidden">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <Button onClick={handleNewChat} className="w-full xp-gradient text-primary-foreground">
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
            <div className="space-y-1">
              {allConversations?.map((conv) => (
                <div
                  key={conv.id}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                    conv.id === conversationId 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                >
                  <button
                    onClick={() => {
                      navigate(`/chat/${conv.id}`);
                      setShowSidebar(false);
                    }}
                    className="flex-1 truncate text-left"
                  >
                    {conv.title}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const { error } = await supabase
                        .from('conversations')
                        .delete()
                        .eq('id', conv.id);
                      if (!error) {
                        queryClient.invalidateQueries({ queryKey: ['all-conversations'] });
                        if (conv.id === conversationId) {
                          navigate('/dashboard');
                        }
                        toast({ title: 'Conversation deleted' });
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Nav */}
          <div className="p-4 border-t border-sidebar-border space-y-2">
            <Button variant="ghost" onClick={() => navigate('/settings')} className="w-full justify-start text-sidebar-foreground">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="w-full justify-start text-sidebar-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Chat Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl p-4 flex flex-col gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors lg:hidden">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <Button variant="ghost" size="icon" onClick={() => setShowSidebar(true)} className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-semibold text-foreground truncate">
                {conversation?.title || 'New Conversation'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {chatMode === 'assignment' ? '📝 Assignment Assist Mode (2 KU/prompt)' : libraryFile ? `Discussing: ${libraryFile.file_name}` : 'Ask me anything - I\'ll explain it simply'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsSearching(!isSearching);
                if (isSearching) setSearchQuery('');
              }}
              className={cn("rounded-full", isSearching && "bg-primary/10 text-primary")}
            >
              <SearchIcon className="h-5 w-5" />
            </Button>
          </div>

          {isSearching && (
            <div className="relative animate-fade-in">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder="Search in chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
        </header>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 py-4 space-y-6 relative"
          onScroll={handleScroll}
        >
          {searchQuery && filteredMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <SearchIcon className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No messages found matching "{searchQuery}"</p>
            </div>
          )}

          {messages.length === 0 && !streamingContent && !searchQuery && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-20 h-20 rounded-2xl xp-gradient flex items-center justify-center font-display font-bold text-3xl text-primary-foreground xp-glow mb-6">
                E
              </div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-2">
                Hey there{userSettings?.preferred_name ? `, ${userSettings.preferred_name}` : ''}! I'm Ezra 👋
              </h2>
              <p className="text-muted-foreground max-w-md mb-8">
                I'm here to help you understand complex topics using real-world examples from your everyday student life. 
                What would you like to learn about today?
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['Explain calculus derivatives', 'What is entropy in chemistry?', 'Help me understand physics forces'].map((prompt) => (
                  <Button 
                    key={prompt}
                    variant="outline" 
                    className="text-sm"
                    onClick={() => setInput(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {filteredMessages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {streamingContent && (
            <ChatMessage 
              message={{ 
                id: 'streaming', 
                role: 'assistant', 
                content: streamingContent, 
                created_at: new Date().toISOString() 
              }} 
            />
          )}

          {isExtractingFile && (
            <div className="flex items-center gap-2 text-muted-foreground p-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm">Extracting document text... This may take a moment.</span>
            </div>
          )}

          {isStreaming && !streamingContent && (
            <div className="flex items-center gap-2 text-muted-foreground p-4">
              <div className="flex gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
              <span className="text-sm">Ezra is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />

          {/* Scroll Down Arrow */}
          {showScrollDown && (
            <Button
              variant="secondary"
              size="icon"
              onClick={scrollToBottom}
              onAnimationEnd={() => setHasPlayedBounce(true)}
              className={cn(
                "fixed bottom-24 right-6 lg:right-10 rounded-full shadow-lg border border-border z-20 transition-all",
                !hasPlayedBounce && "animate-bounce"
              )}
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* File Content Indicator */}
        {fileContent && (
          <div className="mx-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-primary">
              📄 {libraryFile ? libraryFile.file_name : 'Document attached'} - Ask me anything about it!
            </span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-primary border-primary/30 hover:bg-primary/10"
                onClick={() => {
                  handleSendMessage('[LECTURE_MODE] Please lecture me through this entire document, page by page, covering every topic thoroughly. After you finish, give me a comprehensive exam.');
                }}
              >
                <BookOpen className="h-4 w-4 mr-1" />
                Lecture This PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setFileContent(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Voice listening indicator */}
        {isListening && (
          <div className="mx-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 animate-pulse">
            <Mic className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">Listening... Speak now</span>
          </div>
        )}

        {/* KU Balance Indicator */}
        {balance <= 3 && balance > 0 && (
          <div className="mx-4 p-2 rounded-lg bg-primary/5 border border-primary/20 text-center">
            <p className="text-xs text-muted-foreground">
              {balance} Knowledge Unit{balance > 1 ? 's' : ''} remaining
            </p>
          </div>
        )}
        {balance === 0 && (
          <div className="mx-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
            <p className="text-sm text-destructive font-medium">No Knowledge Units left</p>
            <button onClick={() => navigate('/settings?tab=wallet')} className="text-xs text-primary underline mt-1">Top up now</button>
          </div>
        )}

        {/* Input Area — Gemini-style clean bottom bar */}
        <div className="sticky bottom-0 z-10 bg-background/80 backdrop-blur-xl px-3 pb-3 pt-2 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-end bg-secondary rounded-2xl border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all"
            >
              {/* Left action buttons */}
              <div className="flex items-center gap-0.5 pl-2 pb-2.5 flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon"
                  type="button"
                  onClick={() => setShowFileUpload(true)}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                {voiceSupported && (
                  <Button 
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={handleVoiceToggle}
                    className={cn(
                      "h-8 w-8 rounded-full",
                      isListening ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Ezra"
                className="flex-1 min-h-[44px] max-h-[200px] resize-none appearance-none bg-transparent border-0 ring-0 outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none py-3 px-2 text-[15px] text-foreground placeholder:text-muted-foreground/60"
                rows={1}
              />

              {/* Send button */}
              <div className="pr-2 pb-2.5 flex-shrink-0">
                <Button 
                  type="submit"
                  disabled={!input.trim() || isStreaming}
                  size="icon"
                  className="h-8 w-8 rounded-full xp-gradient text-primary-foreground disabled:opacity-30"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUpload 
          conversationId={conversationId || null}
          onClose={() => setShowFileUpload(false)}
          onFileProcessed={handleFileProcessed}
        />
      )}
    </div>
  );
}
