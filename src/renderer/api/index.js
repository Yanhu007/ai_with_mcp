// index.js - Initialize and render the React application
import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatApp from '../components/ChatApp';
import chatApi from './chatApi.js';

// Expose chatApi to window object for global access
if (typeof window !== 'undefined') {
  window.chatApi = chatApi;
}

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