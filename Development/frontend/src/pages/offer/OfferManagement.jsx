import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Table, Tag, Avatar, Space, Modal, Form,
  Input, Select, DatePicker, InputNumber, message, Popconfirm, Drawer,
  Descriptions, Divider, Tooltip
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FileTextOutlined, EyeOutlined, SendOutlined, ReloadOutlined,
  DollarOutlined, CalendarOutlined, UserOutlined, MailOutlined,
  EditOutlined, StopOutlined, LoadingOutlined
} from '@ant-design/icons';
import { offerAPI, applicationAPI, jobsAPI } from '../../services/api';
import dayjs from 'dayjs';
import './css/OfferManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const OfferManagement = () => {
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      fetchApplications(selectedJobId);
      fetchOffers(selectedJobId);
    } else {
      setApplications([]);
      setOffers([]);
    }
  }, [selectedJobId]);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      const jobList = response.data || [];
      setJobs(jobList);

      if (!selectedJobId && jobList.length > 0) {
        setSelectedJobId(jobList[0].jobId || jobList[0].id);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      message.error('Không thể tải danh sách công việc');
    }
  };

  const fetchApplications = async (jobId = selectedJobId) => {
    if (!jobId) {
      setApplications([]);
      return;
    }

    try {
      const response = await applicationAPI.getAll(jobId);
      const payload = response.data || {};
      const apps = Array.isArray(payload) ? payload : payload.applications || [];
      const selectedJob = jobs.find((job) => (job.jobId || job.id) === jobId) || null;

      const offerableApps = apps
        .map((app) => ({
          ...app,
          id: app.applicationId || app.id,
          status: app.currentState || app.status,
          candidateName: app.candidateName || app.candidate?.fullName || app.candidate?.name || 'N/A',
          candidateEmail: app.candidateEmail || app.candidate?.email || '',
          jobId: app.jobId || payload.jobId || jobId,
          job: {
            id: selectedJob?.jobId || selectedJob?.id || app.jobId || jobId,
            title: selectedJob?.title || app.job?.title || app.jobTitle || 'N/A',
          },
          applicationStatus: app.currentState || app.status,
          appliedAt: app.appliedAt || app.createdAt,
        }))
        .filter((app) => ['NEW', 'SCREENING', 'INTERVIEW', 'INTERVIEWING', 'OFFER'].includes(app.status));

      setApplications(offerableApps);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  const fetchOffers = async (jobId = selectedJobId) => {
    if (!jobId) {
      setOffers([]);
      return;
    }

    try {
      setLoading(true);
      const appsResponse = await applicationAPI.getAll(jobId);
      const payload = appsResponse.data || {};
      const apps = Array.isArray(payload) ? payload : payload.applications || [];
      const selectedJob = jobs.find((job) => (job.jobId || job.id) === jobId) || null;

      const offerPromises = apps
        .filter((app) => app.offer || app.status === 'OFFER' || app.currentState === 'OFFER')
        .map(async (app) => {
          try {
            const offerRes = await offerAPI.getByApplication(app.applicationId || app.id);
            const offer = offerRes.data;
            return {
              ...offer,
              applicationId: app.applicationId || app.id,
              candidateName: app.candidateName || app.candidate?.fullName || app.candidate?.name || 'N/A',
              candidateEmail: app.candidateEmail || app.candidate?.email || '',
              position: selectedJob?.title || app.job?.title || app.jobTitle || 'N/A',
              jobId: selectedJob?.jobId || selectedJob?.id || app.job?.id || app.jobId || jobId,
              applicationStatus: app.currentState || app.status,
              appliedAt: app.appliedAt || app.createdAt,
            };
          } catch {
            return null;
          }
        });

      const offersWithData = await Promise.all(offerPromises);
      setOffers(offersWithData.filter(Boolean));
    } catch (error) {
      console.error('Error fetching offers:', error);
      message.error('Không thể tải danh sách offer');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (values) => {
    try {
      setSubmitting(true);
      // MakeOfferDto: { salaryAmount?, currency?, startDate?, note?, expiresInDays? }
      const payload = {
        salaryAmount: values.salary,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        expiresInDays: values.deadline
          ? Math.max(1, values.deadline.diff(dayjs(), 'day'))
          : undefined,
        note: values.notes,
      };
      const res = await offerAPI.create(selectedApplication.id || selectedApplication.applicationId, payload);
      message.success('Tạo offer thành công!');
      showOfferLinkModal(
        selectedApplication.candidateName,
        res.data?.magicToken,
        res.data?.tokenExpiresAt,
      );
      setCreateModalOpen(false);
      form.resetFields();
      setSelectedApplication(null);
      fetchApplications(selectedJobId);
      fetchOffers(selectedJobId);
    } catch (error) {
      console.error('Error creating offer:', error);
      message.error(error?.response?.data?.message || 'Không thể tạo offer');
    } finally {
      setSubmitting(false);
    }
  };

  // Không có endpoint withdraw riêng — thu hồi offer = reject application
  // (bắt buộc reason theo docs 5.7).
  // Hiện link magic (copy tay khi chưa cấu hình SMTP; email vẫn tự gửi nếu có SMTP)
  const showOfferLinkModal = (name, rawToken, expiresAt) => {
    if (!rawToken) return;
    const link = `${window.location.origin}/offer?token=${encodeURIComponent(rawToken)}`;
    Modal.success({
      title: `Link phản hồi offer — ${name || 'ứng viên'}`,
      width: 600,
      content: (
        <div>
          <p>Email đã tự gửi kèm link này (nếu SMTP đã cấu hình). Bạn cũng có thể copy gửi tay:</p>
          <Typography.Paragraph copyable={{ text: link }} style={{ wordBreak: 'break-all' }}>{link}</Typography.Paragraph>
          {expiresAt && <Text type="secondary">Hết hạn: {dayjs(expiresAt).format('DD/MM/YYYY HH:mm')}</Text>}
        </div>
      ),
    });
  };

  // "Gửi nhắc nhở" = phát lại magic link OFFER_RESPONSE (email tự gửi + link copy tay)
  const handleSendReminder = async (record) => {
    try {
      const res = await applicationAPI.createMagicLink(record.applicationId, 'OFFER_RESPONSE');
      message.success('Đã phát lại link phản hồi offer.');
      showOfferLinkModal(record.candidateName, res.data?.rawToken, res.data?.expiresAt);
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể gửi nhắc nhở');
    }
  };

  const handleWithdraw = async (applicationId) => {
    try {
      await applicationAPI.reject(applicationId, 'Công ty thu hồi offer');
      message.success('Đã thu hồi offer (hồ sơ chuyển sang Từ chối)');
      fetchOffers();
    } catch (error) {
      console.error('Error withdrawing offer:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể thu hồi offer');
    }
  };

  const openCreateModal = (application) => {
    setSelectedApplication(application);
    form.setFieldsValue({
      candidate: application.candidateName || application.candidate?.fullName || 'N/A',
      position: application.job?.title || application.jobTitle,
      jobId: application.jobId || application.job?.id,
    });
    setCreateModalOpen(true);
  };

  const getStatusTag = (status) => {
    const config = {
      PENDING: { color: 'warning', label: 'Chờ phản hồi', icon: null },
      ACCEPTED: { color: 'success', label: 'Đồng ý', icon: <CheckCircleOutlined /> },
      DECLINED: { color: 'error', label: 'Từ chối', icon: <CloseCircleOutlined /> },
      WITHDRAWN: { color: 'default', label: 'Đã thu hồi', icon: <StopOutlined /> },
      EXPIRED: { color: 'default', label: 'Hết hạn', icon: <CloseCircleOutlined /> },
      DRAFT: { color: 'default', label: 'Nháp', icon: <EditOutlined /> },
      SENT: { color: 'processing', label: 'Đã gửi', icon: <SendOutlined /> },
    };
    const c = config[status] || { color: 'default', label: status, icon: null };
    return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>;
  };

  const getAppStatusTag = (status) => {
    const normalizedStatus = (status || '').toUpperCase();
    const colors = {
      NEW: 'default',
      SCREENING: 'processing',
      INTERVIEW: 'processing',
      INTERVIEWING: 'processing',
      OFFER: 'success',
      HIRED: 'success',
    };
    return <Tag color={colors[normalizedStatus] || 'default'}>{status || 'N/A'}</Tag>;
  };

  const columns = [
    {
      title: 'Ứng viên',
      key: 'candidate',
      width: 220,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ backgroundColor: '#5D8C3E', flexShrink: 0 }} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{record.candidateName}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <MailOutlined /> {record.candidateEmail || 'N/A'}
            </Text>
          </div>
        </div>
      ),
      sorter: (a, b) => (a.candidateName || '').localeCompare(b.candidateName || ''),
    },
    {
      title: 'Vị trí',
      dataIndex: 'position',
      key: 'position',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>ID: {record.applicationId}</Text>
        </div>
      ),
      sorter: (a, b) => (a.position || '').localeCompare(b.position || ''),
    },
    {
      title: 'Mức lương',
      dataIndex: 'salary',
      key: 'salary',
      width: 150,
      render: (salary) => (
        <Text style={{ color: '#5D8C3E', fontWeight: 600 }}>
          {salary ? `${Number(salary).toLocaleString('vi-VN')} VNĐ` : 'Thỏa thuận'}
        </Text>
      ),
      sorter: (a, b) => (a.salary || 0) - (b.salary || 0),
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 130,
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : 'N/A',
      sorter: (a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0),
    },
    {
      title: 'Hạn phản hồi',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 130,
      render: (date) => {
        if (!date) return 'N/A';
        const isExpired = dayjs(date).isBefore(dayjs(), 'day');
        return (
          <Text type={isExpired ? 'danger' : 'secondary'}>
            {dayjs(date).format('DD/MM/YYYY')}
            {isExpired && ' (Hết hạn)'}
          </Text>
        );
      },
      sorter: (a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status, record) => {
        if (record.applicationStatus) {
          return getAppStatusTag(record.applicationStatus);
        }
        return getStatusTag(status);
      },
      filters: [
        { text: 'Chờ phản hồi', value: 'PENDING' },
        { text: 'Đồng ý', value: 'ACCEPTED' },
        { text: 'Từ chối', value: 'DECLINED' },
        { text: 'Đã thu hồi', value: 'WITHDRAWN' },
        { text: 'Hết hạn', value: 'EXPIRED' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedOffer(record);
                setViewDrawerOpen(true);
              }}
            />
          </Tooltip>
          {record.status === 'PENDING' && (
            <>
              <Tooltip title="Gửi nhắc nhở (phát lại link phản hồi offer)">
                <Button type="text" size="small" icon={<SendOutlined />} onClick={() => handleSendReminder(record)} />
              </Tooltip>
              <Popconfirm
                title="Thu hồi offer này?"
                description="Hành động này không thể hoàn tác."
                onConfirm={() => handleWithdraw(record.applicationId)}
                okText="Thu hồi"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Thu hồi">
                  <Button type="text" size="small" danger icon={<StopOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const selectedJob = jobs.find((job) => (job.jobId || job.id) === selectedJobId) || null;

  const tableData = applications.map((app) => {
    const matchedOffer = offers.find((offer) => (offer.applicationId || offer.id) === (app.id || app.applicationId));
    return {
      ...app,
      ...(matchedOffer || {}),
      id: app.id,
      applicationId: app.id,
      candidateName: app.candidateName || app.candidate?.fullName || app.candidate?.name || 'N/A',
      candidateEmail: app.candidateEmail || app.candidate?.email || '',
      position: selectedJob?.title || app.job?.title || app.jobTitle || 'N/A',
      jobId: app.jobId || selectedJobId,
      status: matchedOffer?.status || 'PENDING',
      salary: matchedOffer?.salary ?? null,
      startDate: matchedOffer?.startDate ?? null,
      deadline: matchedOffer?.deadline ?? null,
      notes: matchedOffer?.notes ?? null,
      applicationStatus: app.status,
    };
  });

  const filteredData = tableData.filter((row) => {
    const matchesSearch =
      (row.candidateName || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (row.position || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (row.candidateEmail || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="offer-management-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Quản lý Offer</Title>
          <Text type="secondary">Tạo và theo dõi các offer cho ứng viên</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchApplications(selectedJobId); fetchOffers(selectedJobId); }} loading={loading}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            disabled={!selectedJobId}
          >
            Tạo Offer Mới
          </Button>
        </Space>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Select
              placeholder="Chọn công việc"
              value={selectedJobId}
              onChange={(value) => setSelectedJobId(value)}
              style={{ width: 260 }}
              options={jobs.map((job) => ({
                value: job.jobId || job.id,
                label: `${job.title} (${job.jobId || job.id})`,
              }))}
              showSearch
              optionFilterProp="label"
            />
            <Input
              placeholder="Tìm kiếm ứng viên, vị trí..."
              prefix={<FileTextOutlined style={{ color: '#8c8c8b' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 160 }}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'PENDING', label: 'Chờ phản hồi' },
                { value: 'ACCEPTED', label: 'Đồng ý' },
                { value: 'DECLINED', label: 'Từ chối' },
                { value: 'WITHDRAWN', label: 'Đã thu hồi' },
                { value: 'EXPIRED', label: 'Hết hạn' },
              ]}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {filteredData.length} offer
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
            showTotal: (total) => `Tổng ${total} offer`,
          }}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* Create Offer Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'linear-gradient(135deg, #5D8C3E, #7ab356)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileTextOutlined style={{ color: '#fff', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Tạo Offer Mới</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Gửi offer cho ứng viên đã phỏng vấn</Text>
            </div>
          </div>
        }
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
          setSelectedApplication(null);
        }}
        footer={null}
        width={600}
        destroyOnClose
      >
        {applications.length === 0 && !selectedApplication ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">Không có ứng viên nào đủ điều kiện để tạo offer.</Text>
            <br />
            <Text type="secondary">Ứng viên cần hoàn thành phỏng vấn trước khi nhận offer.</Text>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateOffer}
            style={{ marginTop: 20 }}
          >
            {!selectedApplication ? (
              <Form.Item
                label="Chọn ứng viên"
                name="applicationId"
                rules={[{ required: true, message: 'Vui lòng chọn ứng viên' }]}
              >
                <Select
                  placeholder="-- Chọn ứng viên --"
                  showSearch
                  filterOption={(input, option) =>
                    (option.label || '').toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={(value) => {
                    const app = applications.find(a => a.id === value);
                    setSelectedApplication(app);
                    if (app) {
                      form.setFieldsValue({
                        candidate: app.candidateName || app.candidate?.fullName,
                        position: app.job?.title || app.jobTitle,
                      });
                    }
                  }}
                  options={applications.map(app => ({
                    value: app.id,
                    label: `${app.candidateName || app.candidate?.fullName || 'N/A'} - ${app.job?.title || app.jobTitle || 'N/A'}`,
                  }))}
                />
              </Form.Item>
            ) : (
              <>
                <div style={{
                  background: '#fafafa',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 20,
                  border: '1px solid #f0f0f0'
                }}>
                  <Text strong style={{ fontSize: 13, color: '#8c8c8b', marginBottom: 12, display: 'block' }}>
                    THÔNG TIN ỨNG VIÊN
                  </Text>
                  <Descriptions column={2} size="small" style={{ marginBottom: 0 }}>
                    <Descriptions.Item label="Ứng viên">
                      {selectedApplication.candidateName || selectedApplication.candidate?.fullName || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      {selectedApplication.candidateEmail || selectedApplication.candidate?.email || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Vị trí ứng tuyển">
                      {selectedApplication.job?.title || selectedApplication.jobTitle || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">
                      {getAppStatusTag(selectedApplication.status)}
                    </Descriptions.Item>
                  </Descriptions>
                </div>

                <Divider style={{ margin: '0 0 20 0' }} />

                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 13, color: '#8c8c8b', marginBottom: 12, display: 'block' }}>
                    THÔNG TIN OFFER
                  </Text>
                </div>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item
                label="Mức lương (VNĐ)"
                name="salary"
                rules={[{ required: true, message: 'Vui lòng nhập mức lương' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="VD: 15,000,000"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/,/g, '')}
                  min={0}
                  addonAfter="VNĐ"
                />
              </Form.Item>

              <Form.Item
                label="Ngày bắt đầu"
                name="startDate"
                rules={[{ required: true, message: 'Vui lòng chọn ngày bắt đầu' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Chọn ngày bắt đầu"
                  format="DD/MM/YYYY"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </div>

            <Form.Item
              label="Hạn phản hồi"
              name="deadline"
              rules={[{ required: true, message: 'Vui lòng chọn hạn phản hồi' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                placeholder="Chọn hạn phản hồi"
                format="DD/MM/YYYY"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
              />
            </Form.Item>

            <Form.Item
              label="Ghi chú cho ứng viên"
              name="notes"
            >
              <TextArea
                rows={3}
                placeholder="VD: Thông tin về phúc lợi, văn hóa công ty, v.v."
                maxLength={1000}
                showCount
              />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button onClick={() => {
                setCreateModalOpen(false);
                form.resetFields();
                setSelectedApplication(null);
              }}>
                Hủy
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                style={{ background: '#5D8C3E', borderColor: '#5D8C3E' }}
              >
                {submitting ? 'Đang tạo...' : 'Tạo Offer'}
              </Button>
            </div>
          </Form>
        )}
      </Modal>

      {/* View Offer Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: '#5D8C3E' }} />
            Chi tiết Offer
          </div>
        }
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false);
          setSelectedOffer(null);
        }}
        width={480}
        footer={
          selectedOffer?.status === 'PENDING' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Popconfirm
                title="Thu hồi offer này?"
                onConfirm={() => {
                  handleWithdraw(selectedOffer.applicationId);
                  setViewDrawerOpen(false);
                }}
                okText="Thu hồi"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<StopOutlined />}>
                  Thu hồi Offer
                </Button>
              </Popconfirm>
            </div>
          )
        }
      >
        {selectedOffer && (
          <div>
            <div style={{ marginBottom: 24 }}>
              {getStatusTag(selectedOffer.status)}
            </div>

            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Ứng viên">
                <Space>
                  <Avatar size="small" style={{ backgroundColor: '#5D8C3E' }} icon={<UserOutlined />} />
                  <Text strong>{selectedOffer.candidateName}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {selectedOffer.candidateEmail || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Vị trí">
                {selectedOffer.position || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Mức lương">
                <Text strong style={{ color: '#5D8C3E' }}>
                  {selectedOffer.salary ? `${Number(selectedOffer.salary).toLocaleString('vi-VN')} VNĐ` : 'Thỏa thuận'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày bắt đầu">
                {selectedOffer.startDate ? dayjs(selectedOffer.startDate).format('DD/MM/YYYY') : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Hạn phản hồi">
                {selectedOffer.deadline ? (
                  <Text type={dayjs(selectedOffer.deadline).isBefore(dayjs(), 'day') ? 'danger' : undefined}>
                    {dayjs(selectedOffer.deadline).format('DD/MM/YYYY')}
                  </Text>
                ) : 'N/A'}
              </Descriptions.Item>
              {selectedOffer.notes && (
                <Descriptions.Item label="Ghi chú">
                  <div style={{
                    background: '#f5f5f4',
                    padding: 12,
                    borderRadius: 8,
                    whiteSpace: 'pre-wrap',
                    fontSize: 13
                  }}>
                    {selectedOffer.notes}
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedOffer.candidateResponse && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Title level={5} style={{ marginBottom: 12 }}>Phản hồi của ứng viên</Title>
                <Tag color={selectedOffer.candidateResponse === 'ACCEPTED' ? 'success' : 'error'}>
                  {selectedOffer.candidateResponse === 'ACCEPTED' ? 'Đồng ý' : 'Từ chối'}
                </Tag>
                {selectedOffer.candidateResponseNote && (
                  <div style={{
                    background: '#f5f5f4',
                    padding: 12,
                    borderRadius: 8,
                    marginTop: 8,
                    fontSize: 13,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {selectedOffer.candidateResponseNote}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default OfferManagement;
