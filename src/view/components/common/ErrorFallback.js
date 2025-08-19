import React from 'react';

const containerStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.5)',
  zIndex: 9999,
};

const boxStyle = {
  background: '#fff',
  padding: '20px',
  borderRadius: '8px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  maxWidth: '600px',
  width: '90%',
};

const titleStyle = {
  margin: 0,
  marginBottom: '8px',
  color: '#222',
};

const pStyle = {
  marginTop: 0,
  color: '#333',
};

const footerStyle = {
  marginTop: '16px',
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
};

const btnStyle = {
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  background: '#f5f5f5',
  cursor: 'pointer',
};

function ErrorFallback({ error, info, onRetry }) {
  const handleCopy = async () => {
    const text = `${error ? error.toString() : 'Error'}\n${info && info.componentStack ? info.componentStack : ''}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // ignore
    }
  };

  return (
    <div style={containerStyle}>
      <div style={boxStyle}>
        <h2 style={titleStyle}>Something went wrong</h2>
        <p style={pStyle}>
          We're sorry — a part of the app encountered an unexpected error. You can try to recover the view or reload the app.
        </p>
        <div style={footerStyle}>
          <button onClick={onRetry} style={btnStyle}>Retry</button>
          <button onClick={() => window.location.reload()} style={btnStyle}>Reload App</button>
          <button onClick={handleCopy} style={btnStyle}>Copy Details</button>
        </div>
      </div>
    </div>
  );
}

export default ErrorFallback;