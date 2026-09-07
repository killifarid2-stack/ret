import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import appIconUrl from '@/assets/app-icon.png';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center gradient-dark">
      <div className="text-center px-6">
        <img src={appIconUrl} alt="WAB-TKD" className="w-16 h-16 rounded-2xl mx-auto mb-5"
          style={{ boxShadow: 'var(--shadow-gold-strong)' }} />
        <h1 className="title-power text-5xl mb-3">404</h1>
        <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">This page doesn't exist.</p>
        <a href="/" className="btn-power inline-block px-6 py-2.5 rounded-xl font-display text-sm">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
