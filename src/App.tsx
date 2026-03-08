import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";

// Lazy-loaded routes for code splitting (improves FCP by reducing initial bundle)
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chat = lazy(() => import("./pages/Chat"));
const Library = lazy(() => import("./pages/Library"));
const Settings = lazy(() => import("./pages/Settings"));
const Community = lazy(() => import("./pages/Community"));
const StudySession = lazy(() => import("./pages/StudySession"));
const ExamMode = lazy(() => import("./pages/ExamMode"));
const LectureMode = lazy(() => import("./pages/LectureMode"));
const GroupChat = lazy(() => import("./pages/GroupChat"));
const MateChat = lazy(() => import("./pages/MateChat"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Terms = lazy(() => import("./pages/Terms"));
const Progress = lazy(() => import("./pages/Progress"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));

const queryClient = new QueryClient();

// Initialize theme from localStorage on app load, with time-based auto-switch
function ThemeInit() {
  useEffect(() => {
    const applyTheme = () => {
      const theme = localStorage.getItem('alphify-theme') || 'dark';
      const autoSwitch = localStorage.getItem('alphify-auto-dark') === 'true';
      const root = document.documentElement;
      root.classList.remove('light', 'dark');

      if (autoSwitch) {
        const hour = new Date().getHours();
        const isDark = hour >= 19 || hour < 6; // Dark from 7pm to 6am
        root.classList.add(isDark ? 'dark' : 'light');
      } else if (theme === 'system') {
        root.classList.add(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      } else {
        root.classList.add(theme);
      }
    };

    applyTheme();

    // Re-check every 5 minutes for time-based switching
    const interval = setInterval(applyTheme, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  return null;
}

// Minimal loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeInit />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lecture"
                element={
                  <ProtectedRoute>
                    <LectureMode />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat/:conversationId?"
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/library"
                element={
                  <ProtectedRoute>
                    <Library />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community"
                element={
                  <ProtectedRoute>
                    <Community />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/group/:groupId"
                element={
                  <ProtectedRoute>
                    <GroupChat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/session/:sessionId"
                element={
                  <ProtectedRoute>
                    <StudySession />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mate-chat/:mateId"
                element={
                  <ProtectedRoute>
                    <MateChat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/exam"
                element={
                  <ProtectedRoute>
                    <ExamMode />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/progress"
                element={
                  <ProtectedRoute>
                    <Progress />
                  </ProtectedRoute>
                }
              />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;