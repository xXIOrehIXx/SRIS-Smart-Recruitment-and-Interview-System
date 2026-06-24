import React, { useState } from 'react';
import { Card, Table, Tag, Button, Input, Select, Space, Dropdown, Modal, Typography, Avatar, Badge } from 'antd';
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
  ExportOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './css/JobManagement.css';

const { Title, Text } = Typography;

const JobManagement = () => {
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const jobsData = [
    { 
      id: 1, 
      title: 'Senior Frontend Developer', 
      department: 'Engineering',
      location: 'Hanoi, Vietnam',
      type: 'Full-time',
      applications: 45,
      postedDate: '2026-06-15',
      status: 'active',
      salary: '$2,000 - $3,500'
    },
    { 
      id: 2, 
      title: 'Product Manager', 
      department: 'Product',
      location: 'Ho Chi Minh City',
      type: 'Full-time',
      applications: 32,
      postedDate: '2026-06-12',
      status: 'active',
      salary: '$2,500 - $4,000'
    },
    { 
      id: 3, 
      title: 'UX Designer', 
      department: 'Design',
      location: 'Remote',
      type: 'Contract',
      applications: 28,
      postedDate: '2026-06-10',
      status: 'paused',
      salary: '$1,500 - $2,500'
    },
    { 
      id: 4, 
      title: 'Backend Engineer', 
      department: 'Engineering',
      location: 'Hanoi, Vietnam',
      type: 'Full-time',
      applications: 38,
      postedDate: '2026-06-08',
      status: 'active',
      salary: '$2,000 - $3,500'
    },
    { 
      id: 5, 
      title: 'Marketing Manager', 
      department: 'Marketing',
      location: 'Hanoi, Vietnam',
      type: 'Full-time',
      applications: 22,
      postedDate: '2026-06-05',
      status: 'closed',
      salary: '$1,800 - $3,000'
    },
    { 
      id: 6, 
      title: 'Data Analyst', 
      department: 'Data',
      location: 'Remote',
      type: 'Full-time',
      applications: 15,
      postedDate: '2026-06-01',
      status: 'active',
      salary: '$1,200 - $2,000'
    },
  ];

  const getMenuItems = (record) => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'View Details',
      onClick: () => navigate(`/recruiter/jobs/${record.id}`),
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit Job',
      onClick: () => navigate(`/recruiter/jobs/create?edit=${record.id}`),
    },
    {
      key: 'candidates',
      icon: <EyeOutlined />,
      label: 'View Candidates',
      onClick: () => navigate(`/recruiter/jobs/${record.id}/candidates`),
    },
    {
      type: 'divider',
    },
    {
      key: record.status === 'active' ? 'pause' : 'resume',
      icon: record.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
      label: record.status === 'active' ? 'Pause Job' : 'Resume Job',
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete',
      danger: true,
    },
  ];

  const columns = [
    {
      title: 'Job Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (text, record) => (
        <div className="job-info-cell">
          <div className="job-title-row">
            <span className="job-title">{text}</span>
            <Badge 
              count={record.applications} 
              style={{ backgroundColor: '#5D8C3E' }}
              className="applications-badge"
            />
          </div>
          <div className="job-meta-row">
            <Tag className="dept-tag">{record.department}</Tag>
            <Text type="secondary" className="location-text">{record.location}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      filters: [
        { text: 'Full-time', value: 'Full-time' },
        { text: 'Part-time', value: 'Part-time' },
        { text: 'Contract', value: 'Contract' },
        { text: 'Remote', value: 'Remote' },
      ],
      onFilter: (value, record) => record.type.includes(value),
      render: (type) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'Salary',
      dataIndex: 'salary',
      key: 'salary',
      render: (salary) => <span className="salary-text">{salary}</span>,
    },
    {
      title: 'Posted Date',
      dataIndex: 'postedDate',
      key: 'postedDate',
      sorter: (a, b) => new Date(a.postedDate) - new Date(b.postedDate),
      render: (date) => <Text type="secondary">{date}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Paused', value: 'paused' },
        { text: 'Closed', value: 'closed' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : status === 'paused' ? 'warning' : 'default'}>
          {status === 'active' ? 'Active' : status === 'paused' ? 'Paused' : 'Closed'}
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

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  const filteredData = jobsData.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchText.toLowerCase()) ||
                         job.department.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="job-management-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Job Posts</Title>
          <Text type="secondary">Manage your job postings and track applications</Text>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => navigate('/recruiter/jobs/create')}
          className="create-btn"
        >
          Post New Job
        </Button>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Input
              placeholder="Search jobs..."
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
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
                { value: 'closed', label: 'Closed' },
              ]}
            />
          </div>
          <div className="toolbar-right">
            {selectedRowKeys.length > 0 && (
              <Text type="secondary" className="selected-count">
                {selectedRowKeys.length} selected
              </Text>
            )}
            <Button icon={<ExportOutlined />}>Export</Button>
            <Button icon={<FilterOutlined />}>Filter</Button>
          </div>
        </div>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          className="jobs-table"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} jobs`,
          }}
        />
      </Card>
    </div>
  );
};

export default JobManagement;
