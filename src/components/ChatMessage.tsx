import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { formatMathToPlainText } from '@/utils/formatMath';
import { useVoice } from '@/hooks/useVoice';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Check, X, AlertCircle, Calculator } from 'lucide-react';

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

// Detect if content is math-heavy for special styling
const isMathHeavy = (content: string): boolean => {
  const mathIndicators = [
    /[×÷=²³⁴⁵⁶⁷⁸⁹⁰√π∞∫Σ]/g,  // Math symbols
    /\d+\s*[+\-×÷*/]\s*\d+/g,   // Basic operations like "5 + 3"
    /Step \d+:/gi,              // Step-by-step solutions
    /\d+\.\d+/g,                // Decimals
    /\d+\s*[xX]\s*\d+/g,        // Multiplication with x
  ];
  const matches = mathIndicators.reduce((count, regex) => 
    count + (content.match(regex)?.length || 0), 0);
  return matches > 3; // Threshold for "math-heavy"
};

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isQuiz = message.is_quiz;
  const { speak, stopSpeaking, isSpeaking } = useVoice();
  const [isThisSpeaking, setIsThisSpeaking] = useState(false);
  
  // Format content to remove LaTeX
  const formattedContent = formatMathToPlainText(message.content);
  const isMath = !isUser && isMathHeavy(formattedContent);

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
        isUser ? 'bg-secondary text-foreground' : 'bg-gradient-to-br from-primary to-primary/60 text-primary-foreground'
      )}>
        {isUser ? '👤' : 'E'}
      </div>

      {/* Message Content */}
      <div className={cn(
        'flex-1 max-w-[80%] rounded-2xl p-4 relative',
        isUser ? 'chat-bubble-user' : 'chat-bubble-assistant',
        isQuiz && 'border-l-4 border-l-primary',
        isMath && 'calculation-card'
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

        {isMath && !isQuiz && (
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-primary/20">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Calculation</span>
          </div>
        )}

        {isUser ? (
          <p className="text-foreground whitespace-pre-wrap">{formattedContent}</p>
        ) : (
          <div className="markdown-content text-foreground space-y-4">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                h1: ({ children }) => <h1 className="text-xl font-bold mt-6 mb-3 gradient-text">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold mt-5 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-medium mt-4 mb-2">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>,
                li: ({ children }) => <li className="text-foreground leading-relaxed pl-1">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono text-primary">{children}</code>
                  ) : (
                    <code className="block bg-secondary p-3 rounded-lg text-sm font-mono overflow-x-auto my-3">{children}</code>
                  );
                },
                pre: ({ children }) => <pre className="bg-secondary p-4 rounded-lg my-4 overflow-x-auto">{children}</pre>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">{children}</blockquote>
                ),
                br: () => <br className="my-2" />,
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
