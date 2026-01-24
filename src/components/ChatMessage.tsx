import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { formatMathToPlainText } from '@/utils/formatMath';
import { useVoice } from '@/hooks/useVoice';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Check, X, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  is_quiz?: boolean;
  quiz_passed?: boolean;
  created_at: string;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isQuiz = message.is_quiz;
  const { speak, stopSpeaking, isSpeaking } = useVoice();
  const [isThisSpeaking, setIsThisSpeaking] = useState(false);
  
  // Format content to remove LaTeX
  const formattedContent = formatMathToPlainText(message.content);

  const handleSpeak = () => {
    if (isThisSpeaking && isSpeaking) {
      stopSpeaking();
      setIsThisSpeaking(false);
    } else {
      speak(formattedContent);
      setIsThisSpeaking(true);
    }
  };

  return (
    <div 
      className={cn(
        'flex gap-3 animate-fade-in-up group',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-sm',
        isUser ? 'bg-secondary text-foreground' : 'xp-gradient text-primary-foreground'
      )}>
        {isUser ? '👤' : 'Xp'}
      </div>

      {/* Message Content */}
      <div className={cn(
        'flex-1 max-w-[80%] rounded-2xl p-4 relative',
        isUser ? 'chat-bubble-user' : 'chat-bubble-assistant',
        isQuiz && 'border-l-4 border-l-primary'
      )}>
        {/* Voice button for assistant messages */}
        {!isUser && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSpeak}
            className="absolute -right-10 top-1 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
            title={isThisSpeaking && isSpeaking ? 'Stop reading' : 'Read aloud'}
          >
            {isThisSpeaking && isSpeaking ? (
              <VolumeX className="h-4 w-4 text-primary" />
            ) : (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )}

        {isQuiz && (
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
            <AlertCircle className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Quiz Time!</span>
            {message.quiz_passed !== null && (
              message.quiz_passed ? (
                <Check className="h-4 w-4 text-xp-success ml-auto" />
              ) : (
                <X className="h-4 w-4 text-destructive ml-auto" />
              )
            )}
          </div>
        )}

        {isUser ? (
          <p className="text-foreground whitespace-pre-wrap">{formattedContent}</p>
        ) : (
          <div className="markdown-content text-foreground">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 gradient-text">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-medium mt-2 mb-1">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-foreground">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono text-primary">{children}</code>
                  ) : (
                    <code className="block bg-secondary p-3 rounded-lg text-sm font-mono overflow-x-auto">{children}</code>
                  );
                },
                pre: ({ children }) => <pre className="bg-secondary p-4 rounded-lg mb-3 overflow-x-auto">{children}</pre>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary pl-4 italic my-3 text-muted-foreground">{children}</blockquote>
                ),
              }}
            >
              {formattedContent}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
