// index.js - Initialize and render the React application
import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatApp from '../components/ChatApp';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('app-root');
  
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<ChatApp />);
  } else {
    console.error('Root element not found');
  }
});