import { useState, useCallback, useRef, useEffect } from 'react';

interface UseVoiceOptions {
  onTranscript?: (text: string) => void;
}

// Check browser support for speech APIs
const isSpeechRecognitionSupported = () => {
  if (typeof window === 'undefined') return false;
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

const isSpeechSynthesisSupported = () => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

// Get the SpeechRecognition constructor
const getSpeechRecognition = (): any => {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
};

export const useVoice = (options: UseVoiceOptions = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const voicesLoaded = useRef(false);

  // Load voices when available
  useEffect(() => {
    if (!isSpeechSynthesisSupported()) return;
    
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        voicesLoaded.current = true;
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const startListening = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      console.warn('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPiece;
        } else {
          interimTranscript += transcriptPiece;
        }
      }

      const fullTranscript = finalTranscript || interimTranscript;
      setTranscript(fullTranscript);
      
      if (finalTranscript && options.onTranscript) {
        options.onTranscript(finalTranscript);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
    setIsListening(true);
    setTranscript('');
  }, [options]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  // Get the best available voice - prefer natural/human-sounding voices
  const getBestVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    
    // Priority list of natural-sounding voices (in order of preference)
    const preferredVoices = [
      // Google voices (very natural)
      'Google UK English Female',
      'Google UK English Male', 
      'Google US English',
      // Microsoft natural voices
      'Microsoft Aria Online (Natural)',
      'Microsoft Guy Online (Natural)',
      'Microsoft Jenny Online (Natural)',
      // Apple voices
      'Samantha',
      'Karen',
      'Daniel',
      // Other quality voices
      'Fiona',
      'Moira',
    ];
    
    // Try to find a preferred voice
    for (const preferredName of preferredVoices) {
      const voice = voices.find(v => v.name.includes(preferredName));
      if (voice) return voice;
    }
    
    // Fallback: find any English voice that's not robotic-sounding
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    
    // Prefer voices marked as "premium" or "enhanced"
    const premiumVoice = englishVoices.find(v => 
      v.name.toLowerCase().includes('premium') || 
      v.name.toLowerCase().includes('enhanced') ||
      v.name.toLowerCase().includes('natural')
    );
    if (premiumVoice) return premiumVoice;
    
    // Return first English voice or default
    return englishVoices[0] || voices[0] || null;
  }, []);

  const speak = useCallback((text: string) => {
    if (!isSpeechSynthesisSupported()) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean up the text for speech
    const cleanText = text
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\[QUIZ\]/g, 'Quiz time!') // Replace quiz markers
      .replace(/\[EXAM\]/g, 'Exam time!') // Replace exam markers
      .replace(/```[\s\S]*?```/g, 'code block') // Replace code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code markers
      .replace(/---/g, '') // Remove horizontal rules
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .replace(/[📝🎓🤔🛑👋✨💡📄🧪⚗️🔬💊🩺📚🎯]/g, ''); // Remove emojis

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Get the best voice
    const voice = getBestVoice();
    if (voice) {
      utterance.voice = voice;
    }
    
    // Configure for more natural speech
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0; // Natural pitch
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [getBestVoice]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    isSupported: isSpeechRecognitionSupported() || isSpeechSynthesisSupported(),
  };
};
