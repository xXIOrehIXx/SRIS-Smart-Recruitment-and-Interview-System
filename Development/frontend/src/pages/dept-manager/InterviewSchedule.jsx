import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Table, Tag, Select, Space, Button, Tooltip, Modal, Alert, message,
} from 'antd';
import {
  CalendarOutlined, ReloadOutlined, EyeOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { interviewAPI, jobsAPI, applicationAPI, usersAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

const apiMessage = (error, fallback) =>
  error?.response?.data?.userMsg || error?.response?.data?.UserMsg || fallback;

/** Số người phỏng vấn tối đa cho một ứng viên — khớp InterviewPanel.MaxSize ở BE (V045). */
const MAX_PANEL_SIZE = 5;

/**
 * Trưởng bộ phận theo dõi lịch phỏng vấn (CHỈ XEM — bộ phận nhân sự mới đặt/hủy buổi).
 * Buổi đã diễn ra có nút xem tổng hợp điểm panel (chỉ phiếu đã nộp — blind review 5.7).
 *
 * V045 (16/08/2026): thêm bảng "Người phỏng vấn bạn chỉ định". Chỉ định LẦN ĐẦU nằm ở nút
 * duyệt (màn Duyệt Ứng Viên Vào Phỏng Vấn) — đây là nơi SỬA sau đó: vòng 2 cần người khác,
 * hoặc người được chỉ định nghỉ việc. Đổi danh sách KHÔNG đụng buổi đã hẹn, chỉ đổi những ai
 * nhân sự được chọn cho buổi sau.
 */
const DeptInterviewSchedule = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Ứng viên đang ở vòng phỏng vấn của vị trí này + nhóm người phỏng vấn đã chỉ định cho từng người.
  const [panelRows, setPanelRows] = useState([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [interviewers, setInterviewers] = useState([]);

  const [editRow, setEditRow] = useState(null);
  const [editIds, setEditIds] = useState([]);
  const [saving, setSaving] = useState(false);

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

    // /users/options mở cho cả DM; công ty chưa có tài khoản Interviewer nào thì BE rơi về
    // Admin — đúng đường công ty nhỏ chạy bằng 1 tài khoản.
    (async () => {
      try {
        const res = await usersAPI.getOptions('Interviewer');
        setInterviewers(res.data || []);
      } catch (error) {
        console.error('Error fetching interviewers:', error);
        setInterviewers([]);
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

  const fetchPanels = useCallback(async (jobId) => {
    if (!jobId) return;
    setPanelLoading(true);
    try {
      const appsRes = await applicationAPI.getAll(jobId);
      const apps = (appsRes.data?.applications || []).filter((a) => a.currentState === 'INTERVIEW');

      // Một lượt gọi cho mỗi ứng viên: danh sách này chỉ vài người (số hồ sơ đang phỏng vấn
      // của MỘT vị trí), không đáng làm endpoint gộp riêng.
      const panels = await Promise.all(
        apps.map((a) => interviewAPI.getAssignedInterviewers(a.applicationId)
          .then((r) => r.data || [])
          .catch(() => []))
      );

      setPanelRows(apps.map((a, i) => ({
        applicationId: a.applicationId,
        candidateName: a.candidateName,
        candidateEmail: a.candidateEmail,
        interviewers: panels[i],
      })));
    } catch (error) {
      console.error('Error fetching assigned panels:', error);
      setPanelRows([]);
    } finally {
      setPanelLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobData(selectedJobId);
    fetchPanels(selectedJobId);
  }, [selectedJobId, fetchJobData, fetchPanels]);

  const openEdit = (row) => {
    setEditRow(row);
    setEditIds(row.interviewers.map((i) => i.interviewerId));
  };

  const handleSavePanel = async () => {
    try {
      setSaving(true);
      await interviewAPI.assignInterviewers(editRow.applicationId, editIds);
      message.success(editIds.length === 0
        ? `Đã gỡ chỉ định — nhân sự sẽ không xếp lịch được cho ${editRow.candidateName} tới khi bạn chọn lại.`
        : `Đã cập nhật người phỏng vấn cho ${editRow.candidateName}.`);
      setEditRow(null);
      fetchPanels(selectedJobId);
    } catch (error) {
      console.error(error);
      message.error(apiMessage(error, 'Không lưu được danh sách người phỏng vấn'));
    } finally {
      setSaving(false);
    }
  };

  const panelColumns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      render: (_, r) => (
        <div>
          <Text strong>{r.candidateName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.candidateEmail}</Text>
        </div>
      ),
    },
    {
      title: 'Người phỏng vấn bạn chỉ định',
      key: 'interviewers',
      render: (_, r) => (r.interviewers.length
        ? r.interviewers.map((i) => <Tag key={i.interviewerId}>{i.fullName || i.email}</Tag>)
        : <Tag color="warning">Chưa chỉ định — nhân sự chưa xếp lịch được</Tag>),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      render: (_, r) => (
        <Button size="small" icon={<TeamOutlined />} onClick={() => openEdit(r)}>
          Đổi người
        </Button>
      ),
    },
  ];

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

  const refreshAll = () => {
    fetchJobData(selectedJobId);
    fetchPanels(selectedJobId);
  };

  return (
    <div className="dept-interview-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Lịch Phỏng Vấn</Title>
          <Text type="secondary">
            Bạn chỉ định người phỏng vấn; bộ phận nhân sự chốt giờ và đặt buổi
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
          <Button icon={<ReloadOutlined />} onClick={refreshAll} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </div>

      <Card
        className="main-card"
        bordered={false}
        style={{ marginBottom: 16 }}
        title="Người phỏng vấn bạn chỉ định"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Ứng viên đang ở vòng phỏng vấn của vị trí này. Nhân sự chỉ xếp lịch được với những
          người có tên ở đây — đổi ở đây không đụng buổi đã hẹn, chỉ áp cho buổi đặt sau.
        </Text>
        <Table
          columns={panelColumns}
          dataSource={panelRows}
          rowKey="applicationId"
          loading={panelLoading}
          pagination={false}
          size="small"
          locale={{ emptyText: 'Chưa có ứng viên nào ở vòng phỏng vấn cho vị trí này' }}
        />
      </Card>

      <Card className="main-card" bordered={false} title="Các buổi đã đặt">
        <Table
          columns={columns}
          dataSource={sessions}
          rowKey="scheduleId"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Vị trí này chưa có buổi phỏng vấn nào' }}
        />
      </Card>

      <Modal
        title={`Người phỏng vấn — ${editRow?.candidateName || ''}`}
        open={!!editRow}
        onOk={handleSavePanel}
        confirmLoading={saving}
        onCancel={() => setEditRow(null)}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Buổi đã hẹn giữ nguyên"
          description="Danh sách này quyết định nhân sự được chọn ai cho buổi TIẾP THEO. Người đã có buổi hẹn không bị rút khỏi buổi đó."
        />
        <Text strong>Chọn tối đa {MAX_PANEL_SIZE} người:</Text>
        <Select
          mode="multiple"
          maxCount={MAX_PANEL_SIZE}
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Chọn người phỏng vấn"
          showSearch
          optionFilterProp="label"
          value={editIds}
          onChange={setEditIds}
          options={interviewers.map((i) => ({
            value: i.userId,
            label: i.fullName || i.email,
          }))}
          notFoundContent={
            <Text type="secondary">Chưa có tài khoản người phỏng vấn — nhờ Admin tạo</Text>
          }
        />
      </Modal>
    </div>
  );
};

export default DeptInterviewSchedule;
