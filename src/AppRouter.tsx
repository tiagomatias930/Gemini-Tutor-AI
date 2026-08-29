import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

type Screen = 'landing' | 'tutor' | 'admin';

const LandingPage = lazy(() => import('./LandingPage').then(module => ({ default: module.LandingPage })));
const TutorScreen = lazy(() => import('./App'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));

const screenFromLocation = (): Screen => {
  if (window.location.pathname.startsWith('/admin') || window.location.hash === '#admin') return 'admin';
  if (window.location.pathname.startsWith('/tutor')) return 'tutor';
  return 'landing';
};

export default function AppRouter() {
  const [screen, setScreen] = useState<Screen>(screenFromLocation);

  const navigateTo = useCallback((target: Screen) => {
    const path = target === 'admin' ? '/admin' : target === 'tutor' ? '/tutor' : '/';
    window.history.pushState(null, '', path);
    setScreen(target);
  }, []);

  useEffect(() => {
    const handleLocationChange = () => setScreen(screenFromLocation());
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        navigateTo('admin');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigateTo]);

  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center" aria-live="polite">Loading…</main>}>
      {screen === 'admin' && <AdminDashboard onExit={() => navigateTo('landing')} />}
      {screen === 'landing' && <LandingPage onStartLearning={() => navigateTo('tutor')} />}
      {screen === 'tutor' && <TutorScreen onBack={() => navigateTo('landing')} />}
    </Suspense>
  );
}
