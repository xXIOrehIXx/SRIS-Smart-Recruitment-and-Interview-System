import React from "react";
import { Layout, Button, Typography } from "antd";
import { useNavigate } from "react-router-dom";

const { Header, Footer } = Layout;
const { Text } = Typography;

/** Logo SRIS dùng chung cho header/footer của Career Site công khai. */
const SrisLogo = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <rect width="48" height="48" rx="12" fill="#5D8C3E" />
    <path
      d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z"
      stroke="white"
      strokeWidth="2"
    />
    <path
      d="M20 22L24 26L28 22"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M24 18V26" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Header dùng chung cho trang danh sách và trang chi tiết tin tuyển dụng. */
export const CareerHeader = () => {
  const navigate = useNavigate();

  return (
    <Header className="recruitment-page-header">
      <div
        className="header-logo"
        onClick={() => navigate("/")}
        style={{ cursor: "pointer" }}
      >
        <SrisLogo />
        <span>SRIS</span>
      </div>
      <div className="nav-links">
        <a href="#product">Product</a>
        <a href="#pricing">Pricing</a>
        <a href="#resources">Resources</a>
        <a href="#customers">Customers</a>
      </div>
      <div className="header-actions">
        <Button
          type="text"
          className="login-btn"
          onClick={() => navigate("/login")}
        >
          Log in
        </Button>
        <Button
          type="primary"
          shape="round"
          className="demo-btn"
          onClick={() => navigate("/register")}
        >
          Book a demo
        </Button>
      </div>
    </Header>
  );
};

/** Footer dùng chung cho Career Site công khai. */
export const CareerFooter = () => (
  <Footer className="recruitment-page-footer">
    <div className="footer-inner">
      <div className="footer-brand">
        <SrisLogo size={28} />
        <span>SRIS</span>
      </div>
      <Text type="secondary">© 2026 SRIS. All rights reserved.</Text>
    </div>
  </Footer>
);

export default CareerHeader;
