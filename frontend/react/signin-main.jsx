import React from 'react';
import { createRoot } from 'react-dom/client';
import '../js/main.js';
import SignIn from './SignIn';
import { AuthProvider } from './AuthProvider';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><AuthProvider><SignIn /></AuthProvider></React.StrictMode>
);
