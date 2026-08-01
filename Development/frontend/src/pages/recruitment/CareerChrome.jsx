import React from "react";
import { Layout, Button, Typography, Avatar } from "antd";
import { useNavigate, useParams } from "react-router-dom";

const { Header, Footer } = Layout;
const { Text } = Typography;

/** Logo mặc định khi công ty chưa cấu hình logo riêng. */
const FallbackMark = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <rect width="48" height="48" rx="12" fill="var(--brand-color, #5D8C3E)" />
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

const BrandMark = ({ brand, size = 36 }) =>
  brand?.logoUrl ? (
    <Avatar src={brand.logoUrl} size={size} shape="square" />
  ) : (
    <FallbackMark size={size} />
  );

/**
 * Header của Career Site CÔNG KHAI.
 * Đây là trang tuyển dụng CỦA CÔNG TY khách hàng, không phải trang bán SaaS:
 * hiện tên + logo của tenant, và chỉ có đúng 1 lối đi là quay về danh sách vị trí.
 * (Trước đây header hardcode "SRIS" kèm menu Product/Pricing — sai ngữ cảnh.)
 */
export const CareerHeader = ({ brand }) => {
  const navigate = useNavigate();
  const { slug } = useParams();

  const goToJobs = () => navigate(slug ? `/${slug}/career` : "/");

  return (
    <Header className="recruitment-page-header">
      <div className="header-logo" onClick={goToJobs} style={{ cursor: "pointer" }}>
        <BrandMark brand={brand} />
        <span>{brand?.name || "Tuyển dụng"}</span>
      </div>
      <div className="header-actions">
        <Button type="primary" shape="round" onClick={goToJobs}>
          Vị trí đang tuyển
        </Button>
      </div>
    </Header>
  );
};

/** Footer dùng chung cho Career Site công khai. */
export const CareerFooter = ({ brand }) => (
  <Footer className="recruitment-page-footer">
    <div className="footer-inner">
      <div className="footer-brand">
        <BrandMark brand={brand} size={28} />
        <span>{brand?.name || "Tuyển dụng"}</span>
      </div>
      <Text type="secondary">
        © {new Date().getFullYear()} {brand?.name || ""} · Trang tuyển dụng
      </Text>
    </div>
  </Footer>
);

export default CareerHeader;
