import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, Input, message } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  SettingOutlined,
  SearchOutlined,
  QuestionCircleOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import requestIcon from "./request-icon.svg";

const ICON_MAP = {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  UserAddOutlined,
};

/**
 * Một số item sidebar là "tính năng chính" của vai trò — gắn thêm badge pill
 * nổi bật bên phải label để user dễ nhận diệt nhanh. Hiện tại:
 *  - "/human-resource/requests" : Yêu cầu tuyển dụng (cả Admin lẫn Human Resource đều có).
 *    Match theo key để tránh phụ thuộc cứng vào label string.
 *
 * Cấu hình badge: { icon, label, color } — `color` là tên biến CSS (vd "matcha").
 * Pill chỉ hiện khi sidebar mở rộng (collapsed thì antd ẩn label luôn).
 */
const BADGE_LABEL_KEYS = {
  "/human-resource/requests": {
    icon: requestIcon,
    label: "Yêu cầu",
    color: "matcha",
  },
};

/**
 * Label component: chữ + pill badge đẩy sang phải.
 * Antd Menu render label như flex container nên dùng marginInlineStart:auto
 * để đẩy pill sát mép phải của menu item.
 */
const LabelWithBadge = ({ badge, children }) => (
  <span className="sidebar-label">
    <span className="sidebar-label-text">{children}</span>
    <span
      className={`sidebar-label-badge sidebar-label-badge--${badge.color}`}
    >
      <img src={badge.icon} alt="" className="sidebar-label-badge-icon" aria-hidden="true" />
      <span className="sidebar-label-badge-text">{badge.label}</span>
    </span>
  </span>
);

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, getMenuItems } = useAuth();
  const { primaryColor } = useBrandTheme();

  const menuItems = useMemo(() => {
    return getMenuItems().map((item) => {
      const iconEl = ICON_MAP[item.icon] || <DashboardOutlined />;
      const badge = !collapsed ? BADGE_LABEL_KEYS[item.key] : null;
      return {
        key: item.key,
        icon: iconEl,
        label: badge ? (
          <LabelWithBadge badge={badge}>{item.label}</LabelWithBadge>
        ) : (
          item.label
        ),
      };
    });
  }, [user?.role, getMenuItems, collapsed]);

  const bottomMenuItems = useMemo(
    () => [
      {
        key: "/settings",
        icon: <SettingOutlined />,
        label: "Cài đặt",
      },
    ],
    [],
  );

  const handleMenuClick = ({ key }) => {
    if (key === "logout") {
      logout();
      message.success("Đã đăng xuất");
      navigate("/login");
    } else if (key.startsWith("/")) {
      navigate(key);
    }
  };

  const getSelectedKey = () => {
    return location.pathname;
  };

  if (!user) return null;

  return (
    <div className="sidebar-container">
      <div className="sider-header">
        <div className="logo" onClick={() => navigate("/")}>
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill={primaryColor} />
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
            <path
              d="M24 18V26"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {!collapsed && <span className="logo-text">SRIS</span>}
        </div>
      </div>

      <div className="sider-search">
        <Input
          placeholder="Tìm kiếm..."
          prefix={<SearchOutlined style={{ color: "#8c8c8b" }} />}
          className="sidebar-search-input"
        />
      </div>

      <div className="sider-menu">
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={handleMenuClick}
          className="main-menu"
        />
      </div>

      <div className="sider-bottom">
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={bottomMenuItems}
          onClick={handleMenuClick}
          className="bottom-menu"
        />
      </div>
    </div>
  );
};

export default Sidebar;
