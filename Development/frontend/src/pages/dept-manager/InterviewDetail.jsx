import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Space, Table, Statistic, Row, Col,
  Empty, Spin, Tooltip, Progress, message
} from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, WarningOutlined, TeamOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { interviewAPI } from '../../services/api';
import ConsensusTag from '../../components/ConsensusTag';
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
      // Cờ "lệch nhiều" nằm ở cột Đồng thuận — không lặp lại ở đây nữa.
      render: (name) => <Text strong>{name}</Text>,
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
      title: 'Đồng thuận',
      key: 'consensus',
      width: 130,
      render: (_, record) => (
        <ConsensusTag
          stdDev={record.stdDev}
          needsDiscussion={record.needsDiscussion}
          scoreCount={(record.scores || []).filter((s) => s.score !== null && s.score !== undefined).length}
        />
      ),
    },
    {
      title: (
        <Tooltip title="Tiêu chí quan trọng hơn thì trọng số cao hơn và tính nặng hơn khi ra điểm tổng">
          <span>Trọng số</span>
        </Tooltip>
      ),
      dataIndex: 'weight',
      key: 'weight',
      width: 90,
    },
    {
      title: 'Điểm & note từng interviewer',
      dataIndex: 'scores',
      key: 'scores',
      render: (scores) => (
        <Space direction="vertical" size={2}>
          {(scores || []).map((s) => (
            <Text key={s.interviewerId} style={{ fontSize: 13 }}>
              {/* BE trả sẵn interviewerName (blind đã mở) — hiện tên, id chỉ để dự phòng */}
              {s.interviewerName || `#${s.interviewerId}`}: <Text strong>{s.score ?? '—'}</Text>
              {s.note && <Text type="secondary" italic> — "{s.note}"</Text>}
            </Text>
          ))}
        </Space>
      ),
    },
  ];

  const totalColumns = [
    {
      title: 'Interviewer',
      dataIndex: 'interviewerName',
      key: 'interviewerName',
      render: (name, record) => name || `#${record.interviewerId}`,
    },
    {
      // % có trọng số (điểm đạt / điểm tối đa có trọng số) — không phải điểm thô.
      title: (
        <Tooltip title="Điểm của cả phiếu quy về thang 100. Tiêu chí trọng số cao ảnh hưởng nhiều hơn, nên đây không phải trung bình cộng của các điểm ở trên.">
          <span>Điểm tổng (thang 100)</span>
        </Tooltip>
      ),
      dataIndex: 'weightedPercent',
      key: 'weightedPercent',
      render: (p) => <Text strong style={{ color: MATCHA_GREEN }}>{p}%</Text>,
      sorter: (a, b) => a.weightedPercent - b.weightedPercent,
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
                  title="Điểm trung bình hội đồng (thang 100)"
                  value={aggregate.panelWeightedPercent}
                  suffix="%"
                  valueStyle={{ color: MATCHA_GREEN }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card className="stat-card" bordered={false}>
                <Statistic
                  title="Tiêu chí hội đồng chấm lệch nhau"
                  value={needsDiscussionCount}
                  valueStyle={{ color: needsDiscussionCount > 0 ? '#faad14' : '#52c41a' }}
                  prefix={<WarningOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card
            className="main-card"
            bordered={false}
            title="Điểm theo từng tiêu chí"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Cột "Đồng thuận" cho biết những người chấm có cùng ý hay không
              </Text>
            }
            style={{ marginBottom: 16 }}
          >
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
