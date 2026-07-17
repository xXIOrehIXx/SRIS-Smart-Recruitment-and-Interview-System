import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Layout } from "antd";
import "./css/AuthLayout.css";

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
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="14" fill="#5D8C3E" />
                  <path
                    d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z"
                    stroke="white"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M20 22L24 26L28 22"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M24 18V26"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
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
