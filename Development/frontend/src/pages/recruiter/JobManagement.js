import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Input, Select, Space, Dropdown, Modal, Typography, Avatar, Badge, message, Popconfirm } from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  FilterOutlined, 
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ExportOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { jobsAPI } from '../../services/api';
import './css/JobManagement.css';

const { Title, Text } = Typography;

const JobManagement = () => {
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  useEffect(() => {
    fetchJobs();
  }, [pagination.current, pagination.pageSize]);

  const fetchJobs = async (params = {}) => {
    try {
      setLoading(true);
      const response = await jobsAPI.getAll(true);
      const jobList = response.data || [];
      setJobs(jobList);
      setPagination(prev => ({
        ...prev,
        total: jobList.length
      }));
    } catch (error) {
      console.error('Error fetching jobs:', error);
      message.error('Không thể tải danh sách tin tuyển dụng');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination, filters, sorter) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  const handleDeleteJob = async (jobId) => {
    try {
      await jobsAPI.delete(jobId);
      message.success('Xóa tin tuyển dụng thành công');
      fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
      message.error('Không thể xóa tin tuyển dụng');
    }
  };

  const getMenuItems = (record) => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'Xem Chi Tiết',
      onClick: () => navigate(`/recruiter/jobs/${record.id}`),
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Chỉnh Sửa',
      onClick: () => navigate(`/recruiter/jobs/create?edit=${record.id}`),
    },
    {
      key: 'candidates',
      icon: <EyeOutlined />,
      label: 'Xem Ứng Viên',
      onClick: () => navigate(`/recruiter/jobs/${record.id}/candidates`),
    },
    {
      type: 'divider',
    },
    {
      key: record.status === 'Active' || record.status === 'active' ? 'pause' : 'resume',
      icon: record.status === 'Active' || record.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
      label: record.status === 'Active' || record.status === 'active' ? 'Tạm Dừng' : 'Kích Hoạt Lại',
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Xóa',
      danger: true,
    },
  ];

  const columns = [
    {
      title: 'Vị Trí',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => (a.title || '').localeCompare(b.title || ''),
      render: (text, record) => (
        <div className="job-info-cell">
          <div className="job-title-row">
            <span className="job-title">{text}</span>
            <Badge 
              count={record.applicationCount || record.application?.length || 0} 
              style={{ backgroundColor: '#5D8C3E' }}
              className="applications-badge"
            />
          </div>
          <div className="job-meta-row">
            <Tag className="dept-tag">{record.department || record.departmentName || 'N/A'}</Tag>
            <Text type="secondary" className="location-text">{record.location || record.workLocation || 'N/A'}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Loại Công Việc',
      dataIndex: 'jobType',
      key: 'jobType',
      filters: [
        { text: 'Full-time', value: 'Full-time' },
        { text: 'Part-time', value: 'Part-time' },
        { text: 'Contract', value: 'Contract' },
        { text: 'Internship', value: 'Internship' },
      ],
      onFilter: (value, record) => (record.jobType || '').includes(value),
      render: (type) => <Tag color="blue">{type || 'N/A'}</Tag>,
    },
    {
      title: 'Lương',
      dataIndex: 'salary',
      key: 'salary',
      render: (salary, record) => {
        const salaryText = record.salary || (record.salaryMin && record.salaryMax 
          ? `${formatCurrency(record.salaryMin)} - ${formatCurrency(record.salaryMax)}` 
          : 'Thỏa thuận');
        return <span className="salary-text">{salaryText}</span>;
      },
    },
    {
      title: 'Ngày Đăng',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
      render: (date) => <Text type="secondary">{date ? formatDate(date) : 'N/A'}</Text>,
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Paused', value: 'Paused' },
        { text: 'Closed', value: 'Closed' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={status === 'Active' ? 'success' : status === 'Paused' ? 'warning' : 'default'}>
          {status === 'Active' ? 'Đang tuyển' : status === 'Paused' ? 'Tạm dừng' : 'Đã đóng'}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_, record) => (
        <Dropdown menu={{ items: getMenuItems(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} className="action-btn" />
        </Dropdown>
      ),
    },
  ];

  const formatCurrency = (value) => {
    if (!value) return '';
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  const filteredData = jobs.filter(job => {
    const matchesSearch = (job.title || '').toLowerCase().includes(searchText.toLowerCase()) ||
                         (job.department || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="job-management-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Tin Tuyển Dụng</Title>
          <Text type="secondary">Quản lý tin tuyển dụng và theo dõi ứng viên</Text>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => navigate('/recruiter/jobs/create')}
          className="create-btn"
        >
          Đăng Tin Mới
        </Button>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Input
              placeholder="Tìm kiếm tin tuyển dụng..."
              prefix={<SearchOutlined style={{ color: '#8c8c8b' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className="status-filter"
              options={[
                { value: 'all', label: 'Tất Cả' },
                { value: 'Active', label: 'Đang tuyển' },
                { value: 'Paused', label: 'Tạm dừng' },
                { value: 'Closed', label: 'Đã đóng' },
              ]}
            />
          </div>
          <div className="toolbar-right">
            {selectedRowKeys.length > 0 && (
              <Text type="secondary" className="selected-count">
                Đã chọn {selectedRowKeys.length} tin
              </Text>
            )}
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => fetchJobs()}
              loading={loading}
            >
              Làm Mới
            </Button>
          </div>
        </div>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          className="jobs-table"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} tin tuyển dụng`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            }
          }}
        />
      </Card>
    </div>
  );
};

export default JobManagement;
