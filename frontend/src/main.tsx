import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/style.css';
import { Toaster } from './components/ui/toast';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>,
);
