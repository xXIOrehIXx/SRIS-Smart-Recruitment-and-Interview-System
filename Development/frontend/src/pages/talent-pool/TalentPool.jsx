import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Modal, Form, Input, Select, DatePicker, Space, message, Popconfirm, Tooltip, Row, Col, Statistic, Avatar, Descriptions, Tabs } from 'antd';
import {
  PlusOutlined, UserOutlined, MailOutlined, PhoneOutlined, CalendarOutlined,
  StarOutlined, DeleteOutlined, EditOutlined, EyeOutlined, ReloadOutlined,
  TrophyOutlined, ClockCircleOutlined, TeamOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { talentPoolAPI, jobsAPI } from '../../services/api';
import './css/TalentPool.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const TalentPool = () => {
  const [loading, setLoading] = useState(false);
  const [talents, setTalents] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedTalent, setSelectedTalent] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTalentPool();
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchTalentPool = async () => {
    try {
      setLoading(true);
      const response = await talentPoolAPI.getAll();
      const data = response.data || [];
      setTalents(data);
    } catch (error) {
      console.error('Error fetching talent pool:', error);
      setTalents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (values) => {
    try {
      setSubmitting(true);
      message.success('Đã gửi lời mời ứng tuyển!');
      setInviteModalOpen(false);
      form.resetFields();
    } catch (error) {
      message.error('Không thể gửi lời mời');
    } finally {
      setSubmitting(false);
    }
  };

  const getMatchScoreColor = (score) => {
    if (score === null || score === undefined) return '#d9d9d9';
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#f5222d';
  };

  const columns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      width: 260,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={40} style={{ backgroundColor: MATCHA_GREEN, flexShrink: 0 }} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 600 }}>{record.candidateName || record.name || 'N/A'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MailOutlined style={{ fontSize: 11, color: '#8c8c8b' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>{record.email || record.candidateEmail || 'N/A'}</Text>
            </div>
          </div>
        </div>
      ),
      sorter: (a, b) => (a.candidateName || a.name || '').localeCompare(b.candidateName || b.name || ''),
    },
    {
      title: 'Kỹ năng',
      key: 'skills',
      width: 240,
      render: (_, record) => {
        const skills = record.skills || record.matchedSkills || [];
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {skills.slice(0, 3).map((skill, idx) => (
              <Tag key={idx} color="blue">{skill}</Tag>
            ))}
            {skills.length > 3 && <Tag>+{skills.length - 3}</Tag>}
            {skills.length === 0 && <Text type="secondary">--</Text>}
          </div>
        );
      },
    },
    {
      title: 'Điểm phù hợp',
      key: 'matchScore',
      width: 140,
      render: (_, record) => {
        const score = record.matchScore || record.aiScore || record.score;
        const color = getMatchScoreColor(score);
        return (
          <Tooltip title={`Điểm phù hợp: ${score ?? 'N/A'}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrophyOutlined style={{ color }} />
              <span style={{ color, fontWeight: 700, fontSize: 15 }}>
                {score !== null && score !== undefined ? `${score}%` : 'N/A'}
              </span>
            </div>
          </Tooltip>
        );
      },
      sorter: (a, b) => (a.matchScore || a.aiScore || 0) - (b.matchScore || b.aiScore || 0),
    },
    {
      title: 'Vị trí đề xuất',
      key: 'suggestedJob',
      width: 160,
      render: (_, record) => {
        const jobTitle = record.suggestedJob || record.jobTitle || record.job?.title;
        return <Text>{jobTitle || 'N/A'}</Text>;
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      render: (_, record) => {
        const status = record.poolStatus || record.status || 'AVAILABLE';
        const config = {
          AVAILABLE: { color: 'success', label: 'Sẵn sàng' },
          INVITED: { color: 'processing', label: 'Đã mời' },
          NOT_SUITABLE: { color: 'default', label: 'Không phù hợp' },
          HIRED: { color: 'purple', label: 'Đã tuyển' },
        };
        const c = config[status] || { color: 'default', label: status };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedTalent(record);
                setDetailModalOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Mời ứng tuyển">
            <Button
              type="text"
              size="small"
              icon={<TeamOutlined />}
              onClick={() => {
                setSelectedTalent(record);
                setInviteModalOpen(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const filteredData = talents.filter(talent => {
    const searchLower = searchText.toLowerCase();
    return (
      (talent.candidateName || talent.name || '').toLowerCase().includes(searchLower) ||
      (talent.email || talent.candidateEmail || '').toLowerCase().includes(searchLower) ||
      (talent.skills || []).some(s => (s || '').toLowerCase().includes(searchLower))
    );
  });

  const stats = [
    { title: 'Tổng ứng viên', value: talents.length, color: '#1890ff' },
    { title: 'Sẵn sàng', value: talents.filter(t => (t.poolStatus || t.status) === 'AVAILABLE').length, color: '#52c41a' },
    { title: 'Đã mời', value: talents.filter(t => (t.poolStatus || t.status) === 'INVITED').length, color: '#faad14' },
    { title: 'Tuyển thành công', value: talents.filter(t => (t.poolStatus || t.status) === 'HIRED').length, color: MATCHA_GREEN },
  ];

  return (
    <div className="talent-pool-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Talent Pool</Title>
          <Text type="secondary">Gợi ý ứng viên tiềm năng từ các ứng viên đã ứng tuyển trước đó</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchTalentPool} loading={loading}>
          Làm mới
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {stats.map((stat, idx) => (
          <Col xs={12} sm={12} md={6} key={idx}>
            <Card className="stat-card" bordered={false}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>{stat.title}</Text>}
                value={stat.value}
                valueStyle={{ color: stat.color, fontSize: 28, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <Input
            placeholder="Tìm kiếm theo tên, email, kỹ năng..."
            prefix={<TeamOutlined style={{ color: '#8c8c8b' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Text type="secondary" style={{ fontSize: 13 }}>
            {filteredData.length} ứng viên
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} ứng viên`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ color: MATCHA_GREEN }} />
            Chi tiết ứng viên
          </div>
        }
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedTalent(null);
        }}
        footer={null}
        width={560}
      >
        {selectedTalent && (
          <div style={{ marginTop: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar size={72} style={{ backgroundColor: MATCHA_GREEN, marginBottom: 12 }} icon={<UserOutlined />} />
              <Title level={4} style={{ margin: 0 }}>{selectedTalent.candidateName || selectedTalent.name}</Title>
              <Text type="secondary">{selectedTalent.email || selectedTalent.candidateEmail}</Text>
              {selectedTalent.phone && (
                <div style={{ marginTop: 4 }}>
                  <PhoneOutlined style={{ marginRight: 4 }} />
                  <Text type="secondary">{selectedTalent.phone}</Text>
                </div>
              )}
            </div>

            <Descriptions column={1} size="small">
              {selectedTalent.skills && selectedTalent.skills.length > 0 && (
                <Descriptions.Item label="Kỹ năng">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {selectedTalent.skills.map((skill, idx) => (
                      <Tag key={idx} color="blue">{skill}</Tag>
                    ))}
                  </div>
                </Descriptions.Item>
              )}
              {selectedTalent.matchScore && (
                <Descriptions.Item label="Điểm phù hợp">
                  <Tag color={getMatchScoreColor(selectedTalent.matchScore) === '#52c41a' ? 'success' : getMatchScoreColor(selectedTalent.matchScore) === '#faad14' ? 'warning' : 'error'}>
                    <TrophyOutlined /> {selectedTalent.matchScore}%
                  </Tag>
                </Descriptions.Item>
              )}
              {selectedTalent.suggestedJob && (
                <Descriptions.Item label="Vị trí đề xuất">
                  {selectedTalent.suggestedJob}
                </Descriptions.Item>
              )}
              {selectedTalent.experience && (
                <Descriptions.Item label="Kinh nghiệm">
                  {selectedTalent.experience}
                </Descriptions.Item>
              )}
              {selectedTalent.notes && (
                <Descriptions.Item label="Ghi chú">
                  <div style={{ background: '#f5f5f4', padding: 10, borderRadius: 8, fontSize: 13 }}>
                    {selectedTalent.notes}
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ color: MATCHA_GREEN }} />
            Mời ứng tuyển
          </div>
        }
        open={inviteModalOpen}
        onCancel={() => {
          setInviteModalOpen(false);
          setSelectedTalent(null);
          form.resetFields();
        }}
        footer={null}
        width={480}
      >
        {selectedTalent && (
          <Form form={form} layout="vertical" onFinish={handleInvite} style={{ marginTop: 20 }}>
            <div style={{ background: '#f5f5f4', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <Text strong>{selectedTalent.candidateName || selectedTalent.name}</Text>
              <br />
              <Text type="secondary">{selectedTalent.email || selectedTalent.candidateEmail}</Text>
            </div>

            <Form.Item
              label="Vị trí muốn mời"
              name="jobId"
              rules={[{ required: true, message: 'Vui lòng chọn vị trí' }]}
            >
              <Select placeholder="-- Chọn vị trí --">
                {jobs.map(job => (
                  <Select.Option key={job.id} value={job.id}>{job.title}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="Lời nhắn (tùy chọn)"
              name="message"
            >
              <Input.TextArea rows={3} placeholder="Viết lời mời gửi đến ứng viên..." />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setInviteModalOpen(false)}>Hủy</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              >
                {submitting ? 'Đang gửi...' : 'Gửi lời mời'}
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default TalentPool;
