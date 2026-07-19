import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Button, Table, Tag, Select, Input, Space, Tooltip, Row, Col, Statistic, Avatar, Empty } from 'antd';
import { message } from 'antd';
import {
  UserOutlined, ReloadOutlined, TrophyOutlined, ClockCircleOutlined,
  TeamOutlined, FileTextOutlined, SearchOutlined
} from '@ant-design/icons';
import { talentPoolAPI, jobsAPI, cvScoringAPI } from '../../services/api';
import './css/TalentPool.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

/**
 * Talent Pool = reverse matching: JD của job đang chọn → quét kho CV cũ cùng công ty.
 * Backend chỉ có API theo TỪNG job: GET /jobs/{id}/talent-pool
 * → { jobId, withinMonths, count, suggestions: [{ cvId, candidateId, candidateName,
 *      score, cosineDistance, uploadedAt, ageDays, ageText }] }
 */
const TalentPool = () => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [result, setResult] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchSuggestions = useCallback(async (jobId) => {
    if (!jobId) {
      setResult(null);
      return;
    }
    try {
      setLoading(true);
      const response = await talentPoolAPI.getSuggestions(jobId);
      setResult(response.data || null);
    } catch (error) {
      console.error('Error fetching talent pool:', error);
      message.error('Không thể tải gợi ý Talent Pool');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions(selectedJobId);
  }, [selectedJobId, fetchSuggestions]);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      const jobList = response.data || [];
      setJobs(jobList);
      if (jobList.length > 0) {
        setSelectedJobId(jobList[0].jobId);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      message.error('Không thể tải danh sách vị trí');
    }
  };

  const handleOpenCv = async (cvId) => {
    try {
      const response = await cvScoringAPI.getCvFileUrl(cvId);
      const url = response.data?.url;
      if (url) window.open(url, '_blank', 'noopener');
      else message.error('CV không có file gốc');
    } catch (error) {
      console.error('Error opening CV:', error);
      message.error('Không thể mở file CV');
    }
  };

  const getMatchScoreColor = (score) => {
    if (score === null || score === undefined) return '#d9d9d9';
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#f5222d';
  };

  const suggestions = result?.suggestions || [];
  const filteredData = suggestions.filter(s =>
    (s.candidateName || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={40} style={{ backgroundColor: MATCHA_GREEN, flexShrink: 0 }} icon={<UserOutlined />} />
          <div style={{ fontWeight: 600 }}>{record.candidateName || 'N/A'}</div>
        </div>
      ),
      sorter: (a, b) => (a.candidateName || '').localeCompare(b.candidateName || ''),
    },
    {
      title: 'Điểm phù hợp',
      key: 'score',
      width: 150,
      render: (_, record) => {
        const color = getMatchScoreColor(record.score);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrophyOutlined style={{ color }} />
            <span style={{ color, fontWeight: 700, fontSize: 15 }}>
              {record.score !== null && record.score !== undefined ? `${record.score}%` : 'N/A'}
            </span>
          </div>
        );
      },
      sorter: (a, b) => (a.score || 0) - (b.score || 0),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Độ tươi CV',
      key: 'age',
      width: 180,
      render: (_, record) => (
        <Space size={6}>
          <ClockCircleOutlined style={{ color: '#8c8c8b' }} />
          <Text type="secondary">{record.ageText || (record.uploadedAt ? new Date(record.uploadedAt).toLocaleDateString('vi-VN') : 'N/A')}</Text>
        </Space>
      ),
      sorter: (a, b) => (a.ageDays ?? 9999) - (b.ageDays ?? 9999),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Tooltip title="Mở file CV gốc">
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleOpenCv(record.cvId)}
          >
            Mở CV
          </Button>
        </Tooltip>
      ),
    },
  ];

  const stats = [
    { title: 'Tổng gợi ý', value: suggestions.length, color: '#1890ff' },
    { title: 'Điểm ≥ 80', value: suggestions.filter(s => (s.score ?? 0) >= 80).length, color: '#52c41a' },
    { title: 'Điểm 60–79', value: suggestions.filter(s => (s.score ?? 0) >= 60 && (s.score ?? 0) < 80).length, color: '#faad14' },
    { title: 'Quét CV trong', value: result?.withinMonths ? `${result.withinMonths} tháng` : '--', color: MATCHA_GREEN },
  ];

  return (
    <div className="talent-pool-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Talent Pool</Title>
          <Text type="secondary">Gợi ý ứng viên tiềm năng từ kho CV cũ, khớp với JD của vị trí đang chọn</Text>
        </div>
        <Space>
          <Select
            placeholder="Chọn vị trí"
            value={selectedJobId}
            onChange={setSelectedJobId}
            style={{ width: 260 }}
            showSearch
            optionFilterProp="label"
            options={jobs.map(job => ({ value: job.jobId, label: job.title }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchSuggestions(selectedJobId)} loading={loading}>
            Làm mới
          </Button>
        </Space>
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
            placeholder="Tìm kiếm theo tên ứng viên..."
            prefix={<SearchOutlined style={{ color: '#8c8c8b' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Text type="secondary" style={{ fontSize: 13 }}>
            <TeamOutlined /> {filteredData.length} gợi ý
          </Text>
        </div>

        {selectedJobId ? (
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="cvId"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} gợi ý`,
            }}
            locale={{ emptyText: 'Chưa có CV cũ nào đủ khớp với JD này' }}
          />
        ) : (
          <Empty description="Chọn một vị trí để xem gợi ý từ Talent Pool" />
        )}
      </Card>
    </div>
  );
};

export default TalentPool;
