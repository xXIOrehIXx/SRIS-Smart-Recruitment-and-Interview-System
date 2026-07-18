import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import { AuthProvider } from "./contexts/AuthContext";
import { CompanyProvider } from "./contexts/CompanyContext";
import { BrandThemeProvider, useBrandTheme } from "./contexts/BrandThemeContext";
import viVN from "antd/locale/vi_VN";
import { useEffect } from "react";

const AntThemeWrapper = ({ children }) => {
  const { primaryColor, shades } = useBrandTheme();

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-color", primaryColor);
    document.documentElement.style.setProperty("--brand-color-hover", shades.hover);
    document.documentElement.style.setProperty("--brand-color-active", shades.active);
    document.documentElement.style.setProperty("--brand-color-light", shades.lightBg);
  }, [primaryColor, shades]);

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: primaryColor,
          colorSuccess: "#52c41a",
          colorWarning: "#faad14",
          colorError: "#ff4d4f",
          colorInfo: "#1890ff",
          colorBgContainer: "#ffffff",
          colorBgLayout: "#f5f5f5",
          borderRadius: 8,
          fontFamily:
            "'Inter', 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        components: {
          Button: {
            colorPrimary: primaryColor,
          },
          Menu: {
            colorPrimary: primaryColor,
            itemSelectedBg: shades.lightBg,
            itemSelectedColor: primaryColor,
          },
          Layout: {
            siderBg: "#ffffff",
            headerBg: "#ffffff",
          },
          Table: {
            colorPrimary: primaryColor,
            headerBg: "#f8faf7",
          },
          Input: {
            colorPrimary: primaryColor,
          },
          Select: {
            colorPrimary: primaryColor,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BrandThemeProvider>
          <CompanyProvider>
            <AntThemeWrapper>
              <App />
            </AntThemeWrapper>
          </CompanyProvider>
        </BrandThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
