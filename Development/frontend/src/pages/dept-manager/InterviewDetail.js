import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Tag, Space, Table, Statistic, Row, Col,
  Empty, Spin, Tooltip, Progress, message
} from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, WarningOutlined, TeamOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { interviewAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

/**
 * DM xem tổng hợp điểm panel của 1 buổi phỏng vấn (docs 5.7 — sau khi mở blind):
 * trung bình từng tiêu chí + độ lệch chuẩn (đo đồng thuận, cờ "cần bàn") +
 * điểm tổng có trọng số của từng interviewer. CHỈ tính phiếu ĐÃ NỘP.
 */
const DeptInterviewDetail = () => {
  const { id: scheduleId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [aggregate, setAggregate] = useState(null);

  const fetchAggregate = useCallback(async () => {
    try {
      setLoading(true);
      const response = await interviewAPI.getAggregate(scheduleId);
      setAggregate(response.data);
    } catch (error) {
      console.error('Error fetching aggregate:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể tải tổng hợp điểm');
      setAggregate(null);
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    if (scheduleId) fetchAggregate();
  }, [scheduleId, fetchAggregate]);

  const criteria = aggregate?.criteria || [];
  const needsDiscussionCount = criteria.filter(c => c.needsDiscussion).length;

  const criteriaColumns = [
    {
      title: 'Tiêu chí',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space size={6}>
          <Text strong>{name}</Text>
          {record.needsDiscussion && (
            <Tooltip title="Panel bất đồng (độ lệch chuẩn cao) — nên trao đổi trước khi quyết">
              <Tag icon={<WarningOutlined />} color="orange">Cần bàn</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Điểm trung bình',
      dataIndex: 'average',
      key: 'average',
      width: 220,
      render: (avg, record) => (
        <Space>
          <Progress
            percent={record.maxScore > 0 ? Math.round((avg / record.maxScore) * 100) : 0}
            size="small"
            strokeColor={MATCHA_GREEN}
            style={{ width: 120 }}
            format={() => `${avg}/${record.maxScore}`}
          />
        </Space>
      ),
      sorter: (a, b) => a.average - b.average,
    },
    {
      title: 'Độ lệch chuẩn',
      dataIndex: 'stdDev',
      key: 'stdDev',
      width: 130,
      render: (sd, record) => (
        <Text type={record.needsDiscussion ? 'danger' : 'secondary'}>{sd}</Text>
      ),
    },
    { title: 'Trọng số', dataIndex: 'weight', key: 'weight', width: 90 },
    {
      title: 'Điểm & note từng interviewer',
      dataIndex: 'scores',
      key: 'scores',
      render: (scores) => (
        <Space direction="vertical" size={2}>
          {(scores || []).map((s) => (
            <Text key={s.interviewerId} style={{ fontSize: 13 }}>
              #{s.interviewerId}: <Text strong>{s.score ?? '—'}</Text>
              {s.note && <Text type="secondary" italic> — "{s.note}"</Text>}
            </Text>
          ))}
        </Space>
      ),
    },
  ];

  const totalColumns = [
    { title: 'Interviewer', dataIndex: 'interviewerId', key: 'interviewerId', render: (id) => `#${id}` },
    {
      title: 'Điểm tổng có trọng số',
      dataIndex: 'weightedTotal',
      key: 'weightedTotal',
      render: (t) => <Text strong style={{ color: MATCHA_GREEN }}>{t}</Text>,
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="dept-interview-detail-page">
      <div className="page-header">
        <div>
          <Button onClick={() => navigate(-1)} className="back-btn" icon={<ArrowLeftOutlined />}>
            Quay Lại
          </Button>
          <Title level={3} className="page-title">Tổng hợp điểm panel — Buổi #{scheduleId}</Title>
          <Text type="secondary">Chỉ tính phiếu ĐÃ NỘP (blind review 5.7) — điểm nháp của interviewer không hiển thị</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchAggregate} loading={loading}>Làm mới</Button>
      </div>

      {!aggregate || aggregate.submittedInterviewers === 0 ? (
        <Card className="main-card" bordered={false}>
          <Empty description={
            <div>
              <Text>Chưa có phiếu chấm nào được nộp cho buổi này</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Điểm chỉ hiện sau khi interviewer bấm Nộp phiếu (mở blind)
              </Text>
            </div>
          } />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={12} sm={8}>
              <Card className="stat-card" bordered={false}>
                <Statistic
                  title="Phiếu đã nộp"
                  value={aggregate.submittedInterviewers}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card className="stat-card" bordered={false}>
                <Statistic
                  title="Điểm panel (trung bình có trọng số)"
                  value={aggregate.panelWeightedAverage}
                  valueStyle={{ color: MATCHA_GREEN }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card className="stat-card" bordered={false}>
                <Statistic
                  title="Tiêu chí cần bàn"
                  value={needsDiscussionCount}
                  valueStyle={{ color: needsDiscussionCount > 0 ? '#faad14' : '#52c41a' }}
                  prefix={<WarningOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card className="main-card" bordered={false} title="Điểm theo từng tiêu chí" style={{ marginBottom: 16 }}>
            <Table
              columns={criteriaColumns}
              dataSource={criteria}
              rowKey="criteriaId"
              pagination={false}
              size="small"
            />
          </Card>

          <Card className="main-card" bordered={false} title="Điểm tổng của từng interviewer">
            <Table
              columns={totalColumns}
              dataSource={aggregate.interviewerTotals || []}
              rowKey="interviewerId"
              pagination={false}
              size="small"
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default DeptInterviewDetail;
