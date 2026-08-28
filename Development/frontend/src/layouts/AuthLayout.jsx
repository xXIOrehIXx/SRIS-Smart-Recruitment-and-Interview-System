import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Layout } from "antd";
import "./css/AuthLayout.css";
import LogoIcon from "../components/LogoIcon";

const { Content } = Layout;

const AuthLayout = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <Layout className={`auth-layout ${isLoginPage ? "auth-layout-dark" : ""}`}>
      <div className="auth-background">
        <div className="auth-shape auth-shape-1"></div>
        <div className="auth-shape auth-shape-2"></div>
        <div className="auth-shape auth-shape-3"></div>
        <div className="auth-shape auth-shape-4"></div>
      </div>
      <Content className="auth-content">
        <div className="auth-container">
          {!isLoginPage && (
            <div className="auth-brand">
              <div className="brand-logo">
                <LogoIcon size={48} />
              </div>
              <h1 className="brand-name">SRIS</h1>
              <p className="brand-tagline">
                Smart Recruitment & Interview System
              </p>
            </div>
          )}
          <div className="auth-card">
            <Outlet />
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default AuthLayout;
