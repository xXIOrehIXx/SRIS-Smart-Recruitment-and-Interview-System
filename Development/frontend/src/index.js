import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import viVN from 'antd/locale/vi_VN';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider
        locale={viVN}
        theme={{
          token: {
            colorPrimary: '#5D8C3E',
            colorSuccess: '#52c41a',
            colorWarning: '#faad14',
            colorError: '#ff4d4f',
            colorInfo: '#1890ff',
            colorBgContainer: '#ffffff',
            colorBgLayout: '#f5f5f5',
            borderRadius: 8,
            fontFamily: "'Inter', 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif",
          },
          components: {
            Button: {
              colorPrimary: '#5D8C3E',
              colorPrimaryHover: '#4a7230',
              colorPrimaryActive: '#3d5f28',
              algorithm: true,
            },
            Menu: {
              colorPrimary: '#5D8C3E',
              itemSelectedBg: 'rgba(93, 140, 62, 0.1)',
              itemSelectedColor: '#5D8C3E',
            },
            Layout: {
              siderBg: '#ffffff',
              headerBg: '#ffffff',
            },
            Card: {
              colorPrimary: '#5D8C3E',
            },
            Table: {
              colorPrimary: '#5D8C3E',
              headerBg: '#f8faf7',
            },
            Input: {
              colorPrimary: '#5D8C3E',
              activeBorderColor: '#5D8C3E',
              hoverBorderColor: '#7BA55C',
            },
            Select: {
              colorPrimary: '#5D8C3E',
            },
          },
        }}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
