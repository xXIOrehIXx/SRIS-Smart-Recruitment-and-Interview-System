import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Table, Tag, Space, Modal, Form, DatePicker, Select,
  Input, message, Empty, Badge, Popconfirm, Divider, Alert, Tooltip
} from 'antd';
import {
  PlusOutlined, CalendarOutlined, ReloadOutlined, DeleteOutlined,
  UserAddOutlined, PhoneOutlined, MinusCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { interviewAPI, jobsAPI, applicationAPI, usersAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

/**
 * Đặt lịch phỏng vấn theo POOL dùng chung (docs Section 15):
 * Recruiter mở 1 pool khung giờ cho job + vòng → mời nhiều ứng viên (mỗi người nhận
 * 1 magic link SCHEDULE qua email) → ai chốt slot trước lấy trước.
 * Ứng viên báo bận nhiều lần (cờ vàng/đỏ) → Recruiter gọi điện rồi "Chốt lịch tay".
 */
const InterviewScheduleRecruit = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [pools, setPools] = useState([]);
  const [applications, setApplications] = useState([]); // mọi hồ sơ của job (map tên + lọc INTERVIEW)
  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inviteModal, setInviteModal] = useState(null);   // pool đang mời
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [createForm] = Form.useForm();
  const [inviteForm] = Form.useForm();
  const [manualForm] = Form.useForm();

  useEffect(() => {
    fetchJobs();
    fetchInterviewers();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      const jobList = response.data || [];
      setJobs(jobList);
      if (jobList.length > 0) setSelectedJobId(jobList[0].jobId);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      message.error('Không thể tải danh sách vị trí');
    }
  };

  // Dropdown Interviewer qua /users/options (Recruiter gọi được, khác /users chỉ Admin)
  const fetchInterviewers = async () => {
    try {
      const response = await usersAPI.getOptions('Interviewer');
      setInterviewers(response.data || []);
    } catch (error) {
      console.error('Error fetching interviewers:', error);
      setInterviewers([]);
    }
  };

  const fetchJobData = useCallback(async (jobId) => {
    if (!jobId) {
      setPools([]);
      setApplications([]);
      return;
    }
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
      message.error('Không thể tải lịch phỏng vấn của vị trí này');
      setPools([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobData(selectedJobId);
  }, [selectedJobId, fetchJobData]);

  // ===== Helpers =====

  const interviewerName = (id) => {
    const found = interviewers.find(i => i.userId === id);
    return found ? (found.fullName || found.email) : `#${id}`;
  };

  const appById = (applicationId) =>
    applications.find(a => a.applicationId === applicationId);

  const candidateLabel = (applicationId) => {
    const app = appById(applicationId);
    return app ? `${app.candidateName}${app.candidateEmail ? ` — ${app.candidateEmail}` : ''}` : `Hồ sơ #${applicationId}`;
  };

  // Ứng viên đang ở state INTERVIEW — đối tượng được mời vào pool / chốt tay
  const interviewStageApps = applications.filter(a => a.currentState === 'INTERVIEW');

  // ===== Actions =====

  const handleCreatePool = async (values) => {
    const slots = (values.slots || []).filter(s => s && s.interviewerIds?.length && s.startTime);
    if (slots.length === 0) {
      message.error('Cần ít nhất 1 khung giờ (interviewer + thời gian)');
      return;
    }
    setSubmitting(true);
    try {
      await interviewAPI.createPool(selectedJobId, {
        roundNumber: values.roundNumber || undefined,
        slots: slots.map(s => ({
          interviewerIds: s.interviewerIds,
          startTime: s.startTime.toISOString(),
        })),
      });
      message.success('Đã mở pool khung giờ phỏng vấn!');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error('Error creating pool:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể mở pool. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async (values) => {
    const applicationIds = values.applicationIds || [];
    if (applicationIds.length === 0) {
      message.error('Chọn ít nhất 1 ứng viên');
      return;
    }
    setSubmitting(true);
    try {
      const response = await interviewAPI.invite(inviteModal.poolId, applicationIds);
      const { invited = [], skipped = [] } = response.data || {};
      if (invited.length > 0) {
        message.success(`Đã mời ${invited.length} ứng viên — mỗi người nhận 1 email chọn lịch.`);
      }
      if (skipped.length > 0) {
        Modal.warning({
          title: `${skipped.length} ứng viên bị bỏ qua`,
          content: (
            <ul style={{ paddingLeft: 18 }}>
              {skipped.map(s => (
                <li key={s.applicationId}>{candidateLabel(s.applicationId)}: {s.reason}</li>
              ))}
            </ul>
          ),
        });
      }
      setInviteModal(null);
      inviteForm.resetFields();
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error('Error inviting:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể mời ứng viên.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPool = async (poolId) => {
    try {
      await interviewAPI.cancelPool(poolId, 'Hủy bởi recruiter');
      message.success('Đã hủy pool (ứng viên đã chốt sẽ nhận email báo).');
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error('Error canceling pool:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể hủy pool.');
    }
  };

  const handleManualConfirm = async (values) => {
    setSubmitting(true);
    try {
      await interviewAPI.manualConfirm(values.applicationId, {
        interviewerIds: values.interviewerIds,
        startTime: values.startTime.toISOString(),
        roundNumber: values.roundNumber || undefined,
      });
      message.success('Đã chốt lịch tay cho ứng viên!');
      setManualModalOpen(false);
      manualForm.resetFields();
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error('Error manual confirm:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể chốt lịch.');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Render =====

  const slotColumns = [
    {
      title: 'Thời gian',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (t) => (
        <span><CalendarOutlined /> {dayjs(t).format('DD/MM/YYYY - HH:mm')}</span>
      ),
    },
    {
      title: 'Panel interviewer',
      dataIndex: 'interviewers',
      key: 'interviewers',
      render: (list, record) => (list?.length
        ? list.map(i => <Tag key={i.interviewerId}>{i.fullName || i.email}</Tag>)
        : <Tag>{interviewerName(record.interviewerId)}</Tag>),
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
        if (flag === 'RED') {
          return (
            <Tooltip title={`Báo bận ${record.noSlotFitsCount} lần — gọi điện chốt tay ngay`}>
              <Badge color="red" text={<Text type="danger">Gọi điện gấp</Text>} />
            </Tooltip>
          );
        }
        if (flag === 'YELLOW') {
          return (
            <Tooltip title={`Báo bận ${record.noSlotFitsCount} lần — cân nhắc gọi điện`}>
              <Badge color="gold" text="Nên gọi điện" />
            </Tooltip>
          );
        }
        return <Text type="secondary">—</Text>;
      },
    },
  ];

  return (
    <div className="interview-schedule-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Lịch phỏng vấn</Title>
          <Text type="secondary">
            Mở pool khung giờ dùng chung → mời ứng viên chọn lịch qua email → ai chốt trước lấy trước
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
            options={jobs.map(job => ({ value: job.jobId, label: job.title }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchJobData(selectedJobId)} loading={loading}>
            Làm mới
          </Button>
          <Button icon={<PhoneOutlined />} onClick={() => setManualModalOpen(true)} disabled={!selectedJobId}>
            Chốt lịch tay
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)} disabled={!selectedJobId}>
            Mở pool khung giờ
          </Button>
        </Space>
      </div>

      {!selectedJobId && (
        <Card className="main-card" bordered={false}>
          <Empty description="Chọn một vị trí để xem lịch phỏng vấn" />
        </Card>
      )}

      {selectedJobId && pools.length === 0 && !loading && (
        <Card className="main-card" bordered={false}>
          <Empty description={
            <div>
              <Text>Chưa có pool khung giờ nào cho vị trí này</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Bấm "Mở pool khung giờ" để tạo bộ khung, sau đó mời các ứng viên đang ở bước Phỏng vấn
              </Text>
            </div>
          } />
        </Card>
      )}

      {selectedJobId && pools.map((pool) => (
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
              <Text type="secondary" style={{ fontSize: 12 }}>
                {pool.slots.filter(s => s.status === 'BOOKED').length}/{pool.slots.length} khung đã được đặt
              </Text>
            </Space>
          }
          extra={
            pool.status === 'OPEN' && (
              <Space>
                <Button
                  size="small"
                  icon={<UserAddOutlined />}
                  onClick={() => setInviteModal(pool)}
                >
                  Mời ứng viên
                </Button>
                <Popconfirm
                  title="Hủy pool này?"
                  description="Khung giờ sẽ khóa, lời mời chờ sẽ hủy, ứng viên đã chốt được email báo."
                  onConfirm={() => handleCancelPool(pool.poolId)}
                  okText="Hủy pool"
                  cancelText="Không"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>Hủy pool</Button>
                </Popconfirm>
              </Space>
            )
          }
        >
          <Table
            columns={slotColumns}
            dataSource={pool.slots}
            rowKey="slotId"
            pagination={false}
            size="small"
          />
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

      {/* Modal: mở pool mới */}
      <Modal
        title="Mở pool khung giờ phỏng vấn"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Một pool dùng chung cho cả vòng: mở khung giờ 1 lần, mời nhiều ứng viên, ai chốt trước lấy trước."
        />
        <Form form={createForm} layout="vertical" onFinish={handleCreatePool}>
          <Form.Item name="roundNumber" label="Vòng phỏng vấn (bỏ trống = vòng 1)">
            <Select
              allowClear
              placeholder="Vòng 1"
              options={[1, 2, 3, 4, 5].map(n => ({ value: n, label: `Vòng ${n}` }))}
            />
          </Form.Item>

          <Form.List name="slots" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                <Text strong>Khung giờ:</Text>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginTop: 8 }}>
                    <Form.Item
                      name={[field.name, 'interviewerIds']}
                      rules={[{ required: true, message: 'Chọn ít nhất 1 interviewer' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <Select
                        mode="multiple"
                        maxTagCount={2}
                        maxCount={5}
                        placeholder="Panel interviewer (1-5 người)"
                        style={{ width: 240 }}
                        showSearch
                        optionFilterProp="label"
                        options={interviewers.map(i => ({
                          value: i.userId,
                          label: i.fullName || i.email,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'startTime']}
                      rules={[{ required: true, message: 'Chọn thời gian' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <DatePicker
                        showTime={{ format: 'HH:mm' }}
                        format="DD/MM/YYYY HH:mm"
                        placeholder="Ngày & giờ"
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                        style={{ width: 200 }}
                      />
                    </Form.Item>
                    {fields.length > 1 && (
                      <MinusCircleOutlined onClick={() => remove(field.name)} />
                    )}
                  </Space>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block style={{ marginTop: 8 }}>
                  Thêm khung giờ
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => { setCreateModalOpen(false); createForm.resetFields(); }}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>Mở pool</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: mời ứng viên vào pool */}
      <Modal
        title={inviteModal ? `Mời ứng viên — Vòng ${inviteModal.roundNumber}` : ''}
        open={!!inviteModal}
        onCancel={() => { setInviteModal(null); inviteForm.resetFields(); }}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Mỗi ứng viên được mời sẽ nhận email kèm magic link để tự chọn khung giờ. Chỉ mời được hồ sơ đang ở bước Phỏng vấn."
        />
        <Form form={inviteForm} layout="vertical" onFinish={handleInvite}>
          <Form.Item
            name="applicationIds"
            label={`Ứng viên đang ở bước Phỏng vấn (${interviewStageApps.length})`}
            rules={[{ required: true, message: 'Chọn ít nhất 1 ứng viên' }]}
          >
            <Select
              mode="multiple"
              placeholder="Chọn ứng viên"
              showSearch
              optionFilterProp="label"
              options={interviewStageApps.map(a => ({
                value: a.applicationId,
                label: `${a.candidateName}${a.candidateEmail ? ` — ${a.candidateEmail}` : ''}`,
              }))}
              notFoundContent={<Text type="secondary">Không có hồ sơ nào ở bước Phỏng vấn — kéo card sang cột Phỏng vấn trước</Text>}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setInviteModal(null); inviteForm.resetFields(); }}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>Gửi lời mời</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: chốt lịch tay (nhánh gọi điện) */}
      <Modal
        title="Chốt lịch tay (đã gọi điện thống nhất với ứng viên)"
        open={manualModalOpen}
        onCancel={() => { setManualModalOpen(false); manualForm.resetFields(); }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={manualForm} layout="vertical" onFinish={handleManualConfirm}>
          <Form.Item
            name="applicationId"
            label="Ứng viên (đang ở bước Phỏng vấn)"
            rules={[{ required: true, message: 'Chọn ứng viên' }]}
          >
            <Select
              placeholder="Chọn ứng viên"
              showSearch
              optionFilterProp="label"
              options={interviewStageApps.map(a => ({
                value: a.applicationId,
                label: `${a.candidateName}${a.candidateEmail ? ` — ${a.candidateEmail}` : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="interviewerIds"
            label="Panel interviewer (1-5 người)"
            rules={[{ required: true, message: 'Chọn ít nhất 1 interviewer' }]}
          >
            <Select
              mode="multiple"
              maxCount={5}
              placeholder="Chọn interviewer"
              showSearch
              optionFilterProp="label"
              options={interviewers.map(i => ({ value: i.userId, label: i.fullName || i.email }))}
            />
          </Form.Item>
          <Form.Item
            name="startTime"
            label="Thời gian phỏng vấn"
            rules={[{ required: true, message: 'Chọn thời gian' }]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="DD/MM/YYYY HH:mm"
              placeholder="Ngày & giờ"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="roundNumber" label="Vòng (bỏ trống = tự đánh vòng kế tiếp)">
            <Select
              allowClear
              placeholder="Tự động"
              options={[1, 2, 3, 4, 5].map(n => ({ value: n, label: `Vòng ${n}` }))}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setManualModalOpen(false); manualForm.resetFields(); }}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>Chốt lịch</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InterviewScheduleRecruit;
