import './index.css';
import {createRoot} from 'react-dom/client';
import { lazy, Suspense, useState } from 'react';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { StartupView, type StartupPhase } from './components/StartupView';
import { StartupTransition } from './components/StartupTransition';

import { initializePwa } from './pwa';

initializePwa();

const path = window.location.pathname.replace(/\/$/, '');
const Application = lazy(() => import('./App.tsx'));

function StartupApplication() {
  const [phase, setPhase] = useState<StartupPhase>('boot');
  return <StartupTransition ready={phase === 'ready'} phase={phase === 'boot' ? 'boot' : 'library'} failed={phase === 'error'}>
    <Suspense fallback={null}><Application onStartupChange={setPhase} /></Suspense>
  </StartupTransition>;
}

const Page = path === '/design-system/preview'
  ? lazy(() => import('./design-system/Preview'))
  : path === '/design-system'
  ? lazy(() => import('./design-system/Showcase'))
  : StartupApplication;
createRoot(document.getElementById('root')!).render(<AppErrorBoundary><Suspense fallback={<StartupView />}><Page /></Suspense></AppErrorBoundary>);
