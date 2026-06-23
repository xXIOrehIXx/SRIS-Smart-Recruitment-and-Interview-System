import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// Import ConfigProvider từ thư viện antd
import { ConfigProvider } from 'antd'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ConfigProvider 
      theme={{ 
        token: { 
          colorPrimary: '#1677ff', 
        } 
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);