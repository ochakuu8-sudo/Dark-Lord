import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

console.log("main.tsx: Starting render...");

const container = document.getElementById('root');
if (!container) {
  console.error("main.tsx: Root container not found!");
} else {
  try {
    const root = createRoot(container);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    );
    console.log("main.tsx: Render called.");
  } catch (e) {
    console.error("main.tsx: Render crashed immediately!", e);
  }
}

