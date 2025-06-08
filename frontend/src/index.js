import React from 'react';
import ChatWidget from './ChatWidget';

// Handle React 18 createRoot with fallback for development
let createRoot;
try {
  createRoot = require('react-dom/client').createRoot;
} catch (e) {
  // Fallback for when react-dom/client is not available
  const ReactDOM = require('react-dom');
  createRoot = (container) => ({
    render: (element) => ReactDOM.render(element, container),
    unmount: () => ReactDOM.unmountComponentAtNode(container),
  });
}

// For UMD usage - expose widget initialization function
const initChatWidget = (containerId, options = {}) => {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id '${containerId}' not found`);
    return;
  }

  const root = createRoot(container);
  root.render(<ChatWidget {...options} />);
  
  return {
    destroy: () => root.unmount(),
  };
};

// Auto-initialize if running in development
if (process.env.NODE_ENV === 'development') {
  const container = document.getElementById('chat-widget-root');
  if (container) {
    const root = createRoot(container);
    root.render(<ChatWidget />);
  }
}

// Export for UMD
export default initChatWidget;
export { ChatWidget }; 