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
    /[×÷=²³⁴⁵⁶⁷⁸⁹⁰√π∞∫Σ]/g,
    /\d+\s*[+\-×÷*/]\s*\d+/g,
    /Step \d+:/gi,
    /\d+\.\d+/g,
    /\d+\s*[xX]\s*\d+/g,
  ];
  const matches = mathIndicators.reduce((count, regex) => 
    count + (content.match(regex)?.length || 0), 0);
  return matches > 3;
};

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isQuiz = message.is_quiz;
  const { speak, stopSpeaking, isSpeaking } = useVoice();
  const [isThisSpeaking, setIsThisSpeaking] = useState(false);
  
  const rawFormatted = formatMathToPlainText(message.content);
  const formattedContent = rawFormatted
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])\n([\s]*[•\-\*\d]+[\.\)]\s)/g, '$1\n\n$2')
    .replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2')
    .replace(/([^\n])\n(\*\*[A-Z])/g, '$1\n\n$2')
    .replace(/([a-zA-Z0-9.!?:;)\]"])\n([a-zA-Z0-9\*#•\-\d([])/g, '$1\n\n$2');
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

  // User messages: compact bubble aligned right
  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 bg-secondary border border-border text-foreground">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{formattedContent}</p>
        </div>
      </div>
    );
  }

  // Assistant messages: full-width, no bubble, like Gemini
  return (
    <div className="animate-fade-in-up group">
      {/* Ezra label + voice button */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
          E
        </div>
        <span className="text-sm font-semibold text-foreground">Ezra</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSpeak}
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
          title={isThisSpeaking && isSpeaking ? 'Stop reading' : 'Read aloud'}
        >
          {isThisSpeaking && isSpeaking ? (
            <VolumeX className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* Content area — no box, full width */}
      <div className={cn(
        'pl-9',
        isMath && 'calculation-content'
      )}>
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

        <div className="markdown-content text-foreground">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-[15px]">{children}</p>,
              h1: ({ children }) => <h1 className="text-xl font-bold mt-6 mb-3 gradient-text">{children}</h1>,
              h2: ({ children }) => <h2 className="text-lg font-semibold mt-5 mb-3">{children}</h2>,
              h3: ({ children }) => <h3 className="text-base font-medium mt-4 mb-2">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1.5">{children}</ol>,
              li: ({ children }) => <li className="text-foreground leading-relaxed text-[15px]">{children}</li>,
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
              hr: () => <hr className="my-4 border-border" />,
            }}
          >
            {formattedContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
