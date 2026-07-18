import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Table, Tag, Select, Space, Button, Empty, Divider, Tooltip, Badge, message } from 'antd';
import { CalendarOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { interviewAPI, jobsAPI, applicationAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

/**
 * DM theo dõi lịch phỏng vấn (READ-ONLY — Recruiter mới thao tác mở pool/mời):
 * chọn job → xem pool khung giờ + ứng viên đã mời; buổi ĐÃ CHỐT có nút xem
 * tổng hợp điểm panel (chỉ phiếu đã nộp — blind review 5.7).
 */
const DeptInterviewSchedule = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [pools, setPools] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await jobsAPI.getAll();
        const jobList = response.data || [];
        setJobs(jobList);
        if (jobList.length > 0) setSelectedJobId(jobList[0].jobId);
      } catch (error) {
        console.error('Error fetching jobs:', error);
        message.error('Không thể tải danh sách vị trí');
      }
    })();
  }, []);

  const fetchJobData = useCallback(async (jobId) => {
    if (!jobId) return;
    setLoading(true);
    try {
      const [poolsRes, appsRes] = await Promise.all([
        interviewAPI.getInterviewPools(jobId),
        applicationAPI.getAll(jobId),
      ]);
      setPools(poolsRes.data || []);
      setApplications(appsRes.data?.applications || []);
    } catch (error) {
      console.error('Error fetching pools:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể tải lịch phỏng vấn');
      setPools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobData(selectedJobId);
  }, [selectedJobId, fetchJobData]);

  const candidateLabel = (applicationId) => {
    const app = applications.find(a => a.applicationId === applicationId);
    return app ? app.candidateName : `Hồ sơ #${applicationId}`;
  };

  const slotColumns = [
    {
      title: 'Thời gian',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (t) => <span><CalendarOutlined /> {dayjs(t).format('DD/MM/YYYY - HH:mm')}</span>,
    },
    {
      title: 'Panel interviewer',
      dataIndex: 'interviewers',
      key: 'interviewers',
      render: (list) => (list?.length
        ? list.map(i => <Tag key={i.interviewerId}>{i.fullName || i.email}</Tag>)
        : <Text type="secondary">—</Text>),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = {
          OPEN: { color: 'success', label: 'Còn trống' },
          BOOKED: { color: 'processing', label: 'Đã được đặt' },
          LOCKED: { color: 'default', label: 'Đã khóa' },
        };
        const c = config[status] || { color: 'default', label: status };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: 'Ứng viên đã đặt',
      dataIndex: 'bookedApplicationId',
      key: 'bookedApplicationId',
      render: (appId) => appId ? candidateLabel(appId) : <Text type="secondary">—</Text>,
    },
  ];

  const invitedColumns = [
    {
      title: 'Ứng viên',
      dataIndex: 'applicationId',
      key: 'applicationId',
      render: (appId) => candidateLabel(appId),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = {
          PENDING: { color: 'warning', label: 'Chờ chọn lịch' },
          CONFIRMED: { color: 'success', label: 'Đã chốt lịch' },
          NO_SLOT_FITS: { color: 'orange', label: 'Báo bận' },
          CANCELLED: { color: 'error', label: 'Đã hủy' },
        };
        const c = config[status] || { color: 'default', label: status };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: 'Cờ nhắc',
      dataIndex: 'flag',
      key: 'flag',
      render: (flag, record) => {
        if (flag === 'RED') return <Badge color="red" text={<Text type="danger">Bận {record.noSlotFitsCount} lần</Text>} />;
        if (flag === 'YELLOW') return <Badge color="gold" text={`Bận ${record.noSlotFitsCount} lần`} />;
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Điểm panel',
      key: 'aggregate',
      render: (_, record) => (
        <Tooltip title="Tổng hợp điểm panel (chỉ hiện phiếu ĐÃ NỘP — blind review)">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/dept/interview/${record.scheduleId}`)}
          >
            Xem tổng hợp
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="dept-interview-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Lịch Phỏng Vấn</Title>
          <Text type="secondary">Theo dõi pool khung giờ + tiến độ chọn lịch của ứng viên (chỉ xem)</Text>
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
          <Button icon={<ReloadOutlined />} onClick={() => fetchJobData(selectedJobId)} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </div>

      {pools.length === 0 && !loading && (
        <Card className="main-card" bordered={false}>
          <Empty description="Chưa có pool khung giờ nào cho vị trí này (Recruiter mở pool ở trang Lịch phỏng vấn)" />
        </Card>
      )}

      {pools.map((pool) => (
        <Card
          key={pool.poolId}
          className="main-card"
          bordered={false}
          style={{ marginBottom: 16 }}
          title={
            <Space>
              <Text strong>Vòng {pool.roundNumber}</Text>
              <Tag color={pool.status === 'OPEN' ? 'success' : pool.status === 'CANCELLED' ? 'error' : 'default'}>
                {pool.status === 'OPEN' ? 'Đang mở' : pool.status === 'CANCELLED' ? 'Đã hủy' : pool.status}
              </Tag>
            </Space>
          }
        >
          <Table columns={slotColumns} dataSource={pool.slots} rowKey="slotId" pagination={false} size="small" />
          {pool.invitedCandidates.length > 0 && (
            <>
              <Divider orientation="left" plain style={{ margin: '16px 0 8px' }}>
                Ứng viên đã mời ({pool.invitedCandidates.length})
              </Divider>
              <Table
                columns={invitedColumns}
                dataSource={pool.invitedCandidates}
                rowKey="scheduleId"
                pagination={false}
                size="small"
              />
            </>
          )}
        </Card>
      ))}
    </div>
  );
};

export default DeptInterviewSchedule;
