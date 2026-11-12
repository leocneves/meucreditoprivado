
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPostHog } from './utils/posthog';

initPostHog();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Limpeza defensiva: remove elementos HTML órfãos caso tenham vazado fora do #root no body
Array.from(document.body.children).forEach((child) => {
  if (
    child !== rootElement &&
    !['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT'].includes(child.tagName.toUpperCase())
  ) {
    child.remove();
  }
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
