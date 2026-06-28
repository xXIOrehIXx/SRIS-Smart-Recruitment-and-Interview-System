import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Avatar, Tag, Button, Badge, Dropdown, Input, Space, Modal } from 'antd';
import { 
  SearchOutlined, 
  MoreOutlined,
  UserOutlined,
  MailOutlined,
  CalendarOutlined,
  EyeOutlined,
  FileTextOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import './css/CandidatePipeline.css';

const { Title, Text } = Typography;

const CandidatePipeline = () => {
  const navigate = useNavigate();
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const columns = [
    { 
      id: 'applied', 
      title: 'Applied', 
      color: '#1890ff',
      candidates: [
        { id: 1, name: 'Alex Morgan', email: 'alex@email.com', applied: '2 hours ago', avatar: null, score: null },
        { id: 2, name: 'Sam Smith', email: 'sam@email.com', applied: '1 day ago', avatar: null, score: null },
        { id: 3, name: 'Emily Chen', email: 'emily@email.com', applied: '3 days ago', avatar: null, score: null },
      ]
    },
    { 
      id: 'screening', 
      title: 'Screening', 
      color: '#722ed1',
      candidates: [
        { id: 4, name: 'James Wilson', email: 'james@email.com', applied: '4 days ago', avatar: null, score: 65 },
      ]
    },
    { 
      id: 'interview', 
      title: 'Interview', 
      color: '#faad14',
      candidates: [
        { id: 5, name: 'Sarah Johnson', email: 'sarah@email.com', applied: '1 week ago', avatar: null, score: 78, interview: 'Tomorrow, 10:00 AM' },
        { id: 6, name: 'Mike Brown', email: 'mike@email.com', applied: '5 days ago', avatar: null, score: 82, interview: 'Jun 26, 2:00 PM' },
      ]
    },
    { 
      id: 'offer', 
      title: 'Offer', 
      color: '#52c41a',
      candidates: [
        { id: 7, name: 'John Doe', email: 'john@email.com', applied: '2 weeks ago', avatar: null, score: 95 },
      ]
    },
  ];

  const handleCandidateClick = (candidate) => {
    setSelectedCandidate(candidate);
    setIsDetailModalOpen(true);
  };

  const getMenuItems = (candidate) => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'View Profile',
      onClick: () => handleCandidateClick(candidate),
    },
    {
      key: 'email',
      icon: <MailOutlined />,
      label: 'Send Email',
    },
    {
      key: 'schedule',
      icon: <CalendarOutlined />,
      label: 'Schedule Interview',
    },
    {
      type: 'divider',
    },
    {
      key: 'move',
      icon: <ArrowRightOutlined />,
      label: 'Move to...',
      children: [
        { key: 'applied', label: 'Applied' },
        { key: 'screening', label: 'Screening' },
        { key: 'interview', label: 'Interview' },
        { key: 'offer', label: 'Offer' },
      ],
    },
    {
      key: 'reject',
      label: 'Reject',
      danger: true,
    },
  ];

  return (
    <div className="candidate-pipeline-page">
      <div className="page-header">
        <div>
          <Button onClick={() => navigate('/recruiter/jobs')} className="back-btn">
            ← Back to Jobs
          </Button>
          <Title level={3} className="page-title">Senior Frontend Developer</Title>
          <Text type="secondary">Manage candidates for this position</Text>
        </div>
        <div className="header-actions">
          <Input
            placeholder="Search candidates..."
            prefix={<SearchOutlined style={{ color: '#8c8c8b' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="search-input"
          />
          <Button icon={<FileTextOutlined />}>Filter</Button>
        </div>
      </div>

      <div className="kanban-board">
        {columns.map((col) => (
          <div key={col.id} className="kanban-column">
            <div className="column-header">
              <div className="column-title">
                <span className="column-dot" style={{ backgroundColor: col.color }}></span>
                <span>{col.title}</span>
                <span className="column-count">({col.candidates.length})</span>
              </div>
            </div>
            
            <div className="column-content">
              {col.candidates.map((candidate) => (
                <Card 
                  key={candidate.id} 
                  className="candidate-card"
                  bordered={false}
                  onClick={() => handleCandidateClick(candidate)}
                  hoverable
                >
                  <div className="card-header">
                    <Avatar 
                      size={40} 
                      style={{ backgroundColor: '#5D8C3E' }}
                      icon={<UserOutlined />}
                    />
                    <Dropdown 
                      menu={{ items: getMenuItems(candidate) }} 
                      trigger={['click']}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<MoreOutlined />} 
                        className="card-menu-btn"
                      />
                    </Dropdown>
                  </div>
                  
                  <div className="card-body">
                    <h4 className="candidate-name">{candidate.name}</h4>
                    <p className="candidate-email">{candidate.email}</p>
                    
                    <div className="card-meta">
                      <span className="meta-item">
                        <FileTextOutlined /> {candidate.applied}
                      </span>
                      {candidate.score && (
                        <span className="meta-item score">
                          Score: {candidate.score}%
                        </span>
                      )}
                      {candidate.interview && (
                        <span className="meta-item interview">
                          <CalendarOutlined /> {candidate.interview}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="card-footer">
                    <Button type="text" size="small" icon={<EyeOutlined />}>
                      View
                    </Button>
                    <Button type="text" size="small" icon={<CalendarOutlined />}>
                      Schedule
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal
        title={null}
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={null}
        width={700}
        className="candidate-modal"
      >
        {selectedCandidate && (
          <div className="candidate-detail">
            <div className="detail-header">
              <Avatar size={72} style={{ backgroundColor: '#5D8C3E' }}>
                {selectedCandidate.name[0]}
              </Avatar>
              <div className="detail-info">
                <h2>{selectedCandidate.name}</h2>
                <p>{selectedCandidate.email}</p>
                <div className="detail-tags">
                  <Tag color="blue">Applied</Tag>
                  <Tag color="green">Score: {selectedCandidate.score || 'N/A'}</Tag>
                </div>
              </div>
            </div>
            
            <div className="detail-tabs">
              <Button type="text" className="tab-btn active">Profile</Button>
              <Button type="text" className="tab-btn">Resume</Button>
              <Button type="text" className="tab-btn">Interviews</Button>
              <Button type="text" className="tab-btn">Notes</Button>
            </div>
            
            <div className="detail-content">
              <div className="info-section">
                <h4>Contact Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <MailOutlined />
                    <span>{selectedCandidate.email}</span>
                  </div>
                  <div className="info-item">
                    <CalendarOutlined />
                    <span>+1 234 567 890</span>
                  </div>
                </div>
              </div>
              
              <div className="info-section">
                <h4>Application Details</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <FileTextOutlined />
                    <span>Applied: {selectedCandidate.applied}</span>
                  </div>
                  <div className="info-item">
                    <CalendarOutlined />
                    <span>Position: Senior Frontend Developer</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="detail-actions">
              <Space>
                <Button icon={<MailOutlined />}>Send Email</Button>
                <Button icon={<CalendarOutlined />}>Schedule Interview</Button>
              </Space>
              <Button type="primary" className="move-btn">
                Move to Next Stage
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CandidatePipeline;
