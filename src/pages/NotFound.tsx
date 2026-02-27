import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, LayoutDashboard, BookOpen, Users } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
        <div className="space-y-4">
          <h1 className="text-8xl font-bold gradient-text">404</h1>
          <h2 className="text-2xl font-semibold">Oops! Page not found</h2>
          <p className="text-muted-foreground">
            It seems the page you are looking for has been moved or doesn't exist.
            Don't worry, Ezra is here to help you get back on track!
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button asChild variant="outline" className="flex items-center gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex items-center gap-2">
            <Link to="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex items-center gap-2">
            <Link to="/library">
              <BookOpen className="h-4 w-4" />
              Library
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex items-center gap-2">
            <Link to="/community">
              <Users className="h-4 w-4" />
              Community
            </Link>
          </Button>
        </div>

        <div className="pt-8">
          <Button asChild className="xp-gradient hover:opacity-90 transition-opacity">
            <Link to="/">
              Return to Homepage
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
