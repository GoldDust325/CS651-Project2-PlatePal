import React from 'react';
import { createRoot } from 'react-dom/client';
import '../js/main.js';
import App from './App';
import { AuthProvider } from './AuthProvider';

// The empty HTML root is populated by our React component tree.
createRoot(document.getElementById('root')).render(
  <React.StrictMode><AuthProvider><App /></AuthProvider></React.StrictMode>
);
