import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Table, Tag, Select, Space, Button, Tooltip, message } from 'antd';
import { CalendarOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { interviewAPI, jobsAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

const apiMessage = (error, fallback) =>
  error?.response?.data?.userMsg || error?.response?.data?.UserMsg || fallback;

/**
 * Trưởng bộ phận theo dõi lịch phỏng vấn (CHỈ XEM — bộ phận nhân sự mới đặt/hủy buổi).
 * Buổi đã diễn ra có nút xem tổng hợp điểm panel (chỉ phiếu đã nộp — blind review 5.7).
 */
const DeptInterviewSchedule = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [sessions, setSessions] = useState([]);
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
      const res = await interviewAPI.getJobInterviews(jobId);
      setSessions(res.data || []);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      message.error(apiMessage(error, 'Không thể tải lịch phỏng vấn'));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobData(selectedJobId);
  }, [selectedJobId, fetchJobData]);

  const columns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, s) => (
        <div>
          <Text strong>{s.candidateName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{s.candidateEmail}</Text>
        </div>
      ),
    },
    {
      title: 'Vòng',
      key: 'round',
      width: 200,
      render: (_, s) => (
        <Tag color="blue">Vòng {s.roundNumber}{s.roundName ? ` · ${s.roundName}` : ''}</Tag>
      ),
    },
    {
      title: 'Thời gian',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 190,
      render: (t) => <span><CalendarOutlined /> {dayjs(t).format('HH:mm - DD/MM/YYYY')}</span>,
    },
    {
      title: 'Người phỏng vấn',
      dataIndex: 'interviewers',
      key: 'interviewers',
      render: (list) => (list?.length
        ? list.map((i) => <Tag key={i.interviewerId}>{i.fullName || i.email}</Tag>)
        : <Text type="secondary">—</Text>),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => {
        const config = {
          CONFIRMED: { color: 'success', label: 'Đã chốt' },
          CANCELLED: { color: 'default', label: 'Đã hủy' },
        };
        const c = config[status] || { color: 'default', label: status };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: 'Điểm panel',
      key: 'aggregate',
      width: 150,
      render: (_, s) => (
        <Tooltip title="Tổng hợp điểm của hội đồng phỏng vấn (chỉ hiện phiếu đã nộp, để người chấm không nhìn điểm của nhau)">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/dept/interview/${s.scheduleId}`)}
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
          <Text type="secondary">
            Theo dõi các buổi phỏng vấn của vị trí bạn phụ trách (chỉ xem — nhân sự đặt lịch)
          </Text>
        </div>
        <Space>
          <Select
            placeholder="Chọn vị trí"
            value={selectedJobId}
            onChange={setSelectedJobId}
            style={{ width: 260 }}
            showSearch
            optionFilterProp="label"
            options={jobs.map((job) => ({ value: job.jobId, label: job.title }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchJobData(selectedJobId)} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </div>

      <Card className="main-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={sessions}
          rowKey="scheduleId"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Vị trí này chưa có buổi phỏng vấn nào' }}
        />
      </Card>
    </div>
  );
};

export default DeptInterviewSchedule;
