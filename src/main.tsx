import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppRouter from './AppRouter.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  </StrictMode>,
);
