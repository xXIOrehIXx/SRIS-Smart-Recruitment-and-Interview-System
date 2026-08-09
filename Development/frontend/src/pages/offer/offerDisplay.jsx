import React from 'react';
import { Tag } from 'antd';
import { SendOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined } from '@ant-design/icons';

/**
 * Cách hiển thị thư mời dùng chung cho danh sách (OfferManagement) và trang chi tiết (OfferDetail).
 * Để chung một chỗ để hai màn không bao giờ gọi cùng một trạng thái bằng hai cái tên khác nhau.
 */

export const MATCHA_GREEN = '#5D8C3E';

const OFFER_STATUS = {
  PENDING: { color: 'processing', label: 'Đã gửi thư', icon: <SendOutlined /> },
  ACCEPTED: { color: 'success', label: 'Đã nhận việc', icon: <CheckCircleOutlined /> },
  DECLINED: { color: 'error', label: 'Đã từ chối', icon: <CloseCircleOutlined /> },
  DRAFT: { color: 'default', label: 'Nháp', icon: <EditOutlined /> },
};

export const getStatusTag = (status) => {
  const c = OFFER_STATUS[status] || { color: 'default', label: status, icon: null };
  return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>;
};

const APP_STATUS_LABEL = {
  NEW: 'Hồ sơ mới', SCREENING: 'Sàng lọc', INTERVIEW: 'Phỏng vấn',
  OFFER: 'Chờ gửi thư mời', HIRED: 'Trúng tuyển', REJECTED: 'Từ chối',
};

const APP_STATUS_COLOR = {
  NEW: 'default', SCREENING: 'processing', INTERVIEW: 'processing',
  OFFER: 'warning', HIRED: 'success', REJECTED: 'error',
};

export const getAppStatusTag = (status) => {
  const key = (status || '').toUpperCase();
  return <Tag color={APP_STATUS_COLOR[key] || 'default'}>{APP_STATUS_LABEL[key] || status || 'N/A'}</Tag>;
};

export const formatSalary = (record) => {
  if (!record?.salaryAmount) return 'Thỏa thuận';
  const period = record.salaryPeriod === 'NAM' ? '/năm' : '/tháng';
  return `${Number(record.salaryAmount).toLocaleString('vi-VN')} ${record.currency || 'VND'}${period}`;
};
