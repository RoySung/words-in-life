import {createRoot} from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { AppErrorBoundary } from './components/AppErrorBoundary';

const path = window.location.pathname.replace(/\/$/, '');
const Page = path === '/design-system/preview'
  ? lazy(() => import('./design-system/Preview'))
  : path === '/design-system'
  ? lazy(() => import('./design-system/Showcase'))
  : lazy(() => import('./App.tsx'));
import './index.css';

createRoot(document.getElementById('root')!).render(<AppErrorBoundary><Suspense fallback={<p role="status">載入中…</p>}><Page /></Suspense></AppErrorBoundary>);
