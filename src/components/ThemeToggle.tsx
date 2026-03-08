import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme, autoDark: boolean) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');

  if (autoDark) {
    const hour = new Date().getHours();
    root.classList.add(hour >= 19 || hour < 6 ? 'dark' : 'light');
  } else {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    root.classList.add(resolved);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('alphify-theme') as Theme) || 'dark';
  });
  const [autoDark, setAutoDarkState] = useState(() => {
    return localStorage.getItem('alphify-auto-dark') === 'true';
  });

  useEffect(() => {
    applyTheme(theme, autoDark);
    localStorage.setItem('alphify-theme', theme);
    localStorage.setItem('alphify-auto-dark', String(autoDark));
  }, [theme, autoDark]);

  useEffect(() => {
    if (theme !== 'system' && !autoDark) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme, autoDark);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, autoDark]);

  const setTheme = (t: Theme) => {
    setAutoDarkState(false);
    setThemeState(t);
  };

  const toggleAutoDark = () => {
    setAutoDarkState(prev => !prev);
  };

  return { theme, setTheme, autoDark, toggleAutoDark };
}

export default function ThemeToggle() {
  const { theme, setTheme, autoDark, toggleAutoDark } = useTheme();

  const icon = autoDark ? <Clock className="h-4 w-4" />
    : theme === 'dark' ? <Moon className="h-4 w-4" /> 
    : theme === 'light' ? <Sun className="h-4 w-4" /> 
    : <Monitor className="h-4 w-4" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          {icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="h-4 w-4 mr-2" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="h-4 w-4 mr-2" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="h-4 w-4 mr-2" /> System
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleAutoDark}>
          <Clock className="h-4 w-4 mr-2" />
          Auto Night Mode {autoDark ? '✓' : ''}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
