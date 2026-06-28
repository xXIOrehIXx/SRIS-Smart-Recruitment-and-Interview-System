import React from 'react';
import { Card, Typography, List, Avatar, Tag, Button, Tabs } from 'antd';
import { BellOutlined, MailOutlined, CalendarOutlined, UserAddOutlined, CheckCircleOutlined } from '@ant-design/icons';
import './Dashboard.css';

const { Title, Text } = Typography;

const Notifications = () => {
  const notifications = [
    { id: 1, type: 'interview', title: 'Interview Scheduled', description: 'Interview with Alex Morgan scheduled for tomorrow at 2:00 PM', time: '2 hours ago', read: false },
    { id: 2, type: 'application', title: 'New Application', description: 'Sam Smith applied for Senior Frontend Developer', time: '5 hours ago', read: false },
    { id: 3, type: 'offer', title: 'Offer Response', description: 'Sarah Wilson accepted the Product Manager offer', time: '1 day ago', read: true },
    { id: 4, type: 'quiz', title: 'Quiz Completed', description: 'Emily Chen completed the JavaScript Fundamentals quiz', time: '2 days ago', read: true },
  ];

  const getIcon = (type) => {
    const icons = {
      interview: <CalendarOutlined style={{ color: '#1890ff' }} />,
      application: <UserAddOutlined style={{ color: '#5D8C3E' }} />,
      offer: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      quiz: <MailOutlined style={{ color: '#722ed1' }} />,
    };
    return icons[type] || <BellOutlined />;
  };

  const getTag = (type) => {
    const tags = {
      interview: { color: 'blue', text: 'Interview' },
      application: { color: 'green', text: 'Application' },
      offer: { color: 'success', text: 'Offer' },
      quiz: { color: 'purple', text: 'Quiz' },
    };
    return tags[type] || { color: 'default', text: 'Other' };
  };

  return (
    <div className="notifications-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Notifications</Title>
          <Text type="secondary">Stay updated with your recruitment activities</Text>
        </div>
        <Button type="link">Mark all as read</Button>
      </div>

      <Card className="main-card" bordered={false}>
        <Tabs 
          defaultActiveKey="all"
          items={[
            {
              key: 'all',
              label: 'All',
              children: (
                <List
                  itemLayout="horizontal"
                  dataSource={notifications}
                  renderItem={(item) => (
                    <List.Item className={`notification-item ${!item.read ? 'unread' : ''}`}>
                      <List.Item.Meta
                        avatar={
                          <Avatar size={44} style={{ backgroundColor: '#f4f8f2' }}>
                            {getIcon(item.type)}
                          </Avatar>
                        }
                        title={
                          <div className="notification-header">
                            <span>{item.title}</span>
                            <Tag color={getTag(item.type).color}>{getTag(item.type).text}</Tag>
                          </div>
                        }
                        description={
                          <div>
                            <p>{item.description}</p>
                            <Text type="secondary" className="notification-time">{item.time}</Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'unread',
              label: 'Unread',
              children: (
                <List
                  itemLayout="horizontal"
                  dataSource={notifications.filter(n => !n.read)}
                  renderItem={(item) => (
                    <List.Item className="notification-item unread">
                      <List.Item.Meta
                        avatar={
                          <Avatar size={44} style={{ backgroundColor: '#f4f8f2' }}>
                            {getIcon(item.type)}
                          </Avatar>
                        }
                        title={
                          <div className="notification-header">
                            <span>{item.title}</span>
                            <Tag color={getTag(item.type).color}>{getTag(item.type).text}</Tag>
                          </div>
                        }
                        description={
                          <div>
                            <p>{item.description}</p>
                            <Text type="secondary" className="notification-time">{item.time}</Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default Notifications;
