import React from 'react';
import { createRoot } from 'react-dom/client';
import App from 'components/App';
import * as globals from './global';
import { stage, analyzer } from './global';
import 'styles/index.less';
import './fonts.css';
import './index.html';

// Development settings
if (process.env.NODE_ENV !== 'production') {
  window._astrofox = globals;
}

// Production settings
if (process.env.NODE_ENV === 'production') {
  // Disable eval
  // eslint-disable-next-line
  window.eval = global.eval = undefined;
}

const container = document.getElementById('app');
const root = createRoot(container);

root.render(<App />);

// Add a cleanup handler to dispose of global resources on exit
window.addEventListener('beforeunload', () => {
  try {
    if (analyzer && typeof analyzer.destroy === 'function') {
      analyzer.destroy();
    }
    if (stage && typeof stage.destroy === 'function') {
      stage.destroy();
    }
  } catch (e) {
    // ignore errors during cleanup
  }
});
