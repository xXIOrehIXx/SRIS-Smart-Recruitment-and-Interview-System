import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Table, Tag, Avatar, Space, Modal, Form,
  Input, Select, DatePicker, InputNumber, message, Popconfirm, Drawer,
  Descriptions, Divider, Tooltip, Spin
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined,
  FileTextOutlined, EyeOutlined, SendOutlined, ReloadOutlined,
  UserOutlined, MailOutlined, EditOutlined, StopOutlined, FilePdfOutlined
} from '@ant-design/icons';
import { offerAPI, applicationAPI, jobsAPI } from '../../services/api';
import dayjs from 'dayjs';
import './css/OfferManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Quản lý THƯ MỜI NHẬN VIỆC (docs 5.15).
 *
 * Luồng: hồ sơ ở trạng thái OFFER -> Human Resource soạn thư (form điền sẵn từ Job/Company) ->
 * gửi email kèm link mở PDF -> ứng viên trả lời NGOÀI hệ thống -> Human Resource bấm
 * "Đã nhận việc" / "Từ chối" để chốt HIRED/REJECTED.
 */
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
  const [loadingDefaults, setLoadingDefaults] = useState(false);
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
        // Cả REJECTED: ứng viên từ chối thư mời cũng phải còn thấy được trong danh sách.
        .filter((app) => ['OFFER', 'HIRED', 'REJECTED'].includes(app.status));

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
        .filter((app) => ['OFFER', 'HIRED', 'REJECTED'].includes(app.currentState || app.status))
        .map(async (app) => {
          try {
            const offerRes = await offerAPI.getByApplication(app.applicationId || app.id);
            const offer = offerRes.data;
            return {
              ...offer,
              applicationId: app.applicationId || app.id,
              candidateName: app.candidateName || app.candidate?.fullName || app.candidate?.name || 'N/A',
              candidateEmail: app.candidateEmail || app.candidate?.email || '',
              position: offer?.jobTitle || selectedJob?.title || app.jobTitle || 'N/A',
              jobId: selectedJob?.jobId || selectedJob?.id || app.job?.id || app.jobId || jobId,
              applicationStatus: app.currentState || app.status,
              appliedAt: app.appliedAt || app.createdAt,
            };
          } catch {
            // 404 = hồ sơ chưa gửi thư mời — bình thường, không phải lỗi.
            return null;
          }
        });

      const offersWithData = await Promise.all(offerPromises);
      setOffers(offersWithData.filter(Boolean));
    } catch (error) {
      console.error('Error fetching offers:', error);
      message.error('Không thể tải danh sách thư mời');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (values) => {
    try {
      setSubmitting(true);
      const applicationId = selectedApplication.id || selectedApplication.applicationId;
      // Khớp MakeOfferDto ở BE — ô để trống thì BE tự điền mặc định từ Job/Company.
      const payload = {
        jobTitle: values.jobTitle,
        department: values.department,
        reportingTo: values.reportingTo,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        employmentType: values.employmentType,
        workLocation: values.workLocation,

        salaryAmount: values.salaryAmount,
        currency: values.currency,
        salaryPeriod: values.salaryPeriod,
        bonus: values.bonus,
        benefits: values.benefits,

        terms: values.terms,
        hrContactName: values.hrContactName,
        hrContactEmail: values.hrContactEmail,
        signerName: values.signerName,
        signerTitle: values.signerTitle,
        note: values.note,

        expiresInDays: values.deadline
          ? Math.max(1, values.deadline.diff(dayjs(), 'day'))
          : undefined,
      };
      const res = await offerAPI.create(applicationId, payload);
      message.success('Đã gửi thư mời nhận việc!');
      showOfferLinkModal(
        selectedApplication.candidateName,
        res.data?.magicToken,
        res.data?.tokenExpiresAt,
        applicationId,
      );
      setCreateModalOpen(false);
      form.resetFields();
      setSelectedApplication(null);
      fetchApplications(selectedJobId);
      fetchOffers(selectedJobId);
    } catch (error) {
      console.error('Error creating offer:', error);
      // BE trả ErrorObjectCommon (userMsg/UserMsg), không phải `message`.
      message.error(
        error?.response?.data?.userMsg ||
          error?.response?.data?.UserMsg ||
          'Không thể gửi thư mời',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Hiện link magic (copy tay khi chưa cấu hình SMTP; email vẫn tự gửi nếu có SMTP)
  const showOfferLinkModal = (name, rawToken, expiresAt, applicationId) => {
    if (!rawToken) return;
    const link = `${window.location.origin}/offer?token=${encodeURIComponent(rawToken)}`;
    Modal.success({
      title: `Link xem thư mời — ${name || 'ứng viên'}`,
      width: 620,
      content: (
        <div>
          <p>Email kèm link này đã tự gửi (nếu SMTP đã cấu hình). Bạn cũng có thể copy gửi tay:</p>
          <Typography.Paragraph copyable={{ text: link }} style={{ wordBreak: 'break-all' }}>{link}</Typography.Paragraph>
          {expiresAt && <Text type="secondary">Link hết hạn: {dayjs(expiresAt).format('DD/MM/YYYY HH:mm')}</Text>}
          {applicationId && (
            <div style={{ marginTop: 12 }}>
              <Button icon={<FilePdfOutlined />} onClick={() => openLetterPdf(applicationId)}>
                Xem thử bản PDF
              </Button>
            </div>
          )}
        </div>
      ),
    });
  };

  // Endpoint PDF cần JWT -> tải qua axios rồi mở blob, không mở thẳng URL.
  const openLetterPdf = async (applicationId) => {
    try {
      const res = await offerAPI.getLetterBlob(applicationId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener');
      // Thu hồi sau khi tab mới đã đọc xong blob.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không mở được file PDF thư mời');
    }
  };

  // "Gửi nhắc nhở" = phát lại magic link OFFER_RESPONSE (email tự gửi + link copy tay)
  const handleSendReminder = async (record) => {
    try {
      const res = await applicationAPI.createMagicLink(record.applicationId, 'OFFER_RESPONSE');
      message.success('Đã gửi lại thư mời cho ứng viên.');
      showOfferLinkModal(record.candidateName, res.data?.rawToken, res.data?.expiresAt, record.applicationId);
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể gửi lại thư mời');
    }
  };

  // Ứng viên trả lời ngoài hệ thống -> ghi nhận kết quả -> HIRED / REJECTED.
  const handleRecordOutcome = async (record, accepted) => {
    try {
      await offerAPI.recordOutcome(record.applicationId, accepted, null);
      message.success(accepted
        ? 'Đã ghi nhận ứng viên nhận việc (hồ sơ chuyển sang Trúng tuyển).'
        : 'Đã ghi nhận ứng viên từ chối (hồ sơ chuyển sang Từ chối).');
      setViewDrawerOpen(false);
      fetchApplications(selectedJobId);
      fetchOffers(selectedJobId);
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể ghi nhận kết quả');
    }
  };

  const handleWithdraw = async (applicationId) => {
    try {
      await applicationAPI.reject(applicationId, 'Công ty thu hồi thư mời');
      message.success('Đã thu hồi thư mời (hồ sơ chuyển sang Từ chối)');
      fetchApplications(selectedJobId);
      fetchOffers(selectedJobId);
    } catch (error) {
      console.error('Error withdrawing offer:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể thu hồi thư mời');
    }
  };

  const openCreateModal = async (application) => {
    setSelectedApplication(application);
    setCreateModalOpen(true);
    form.resetFields();

    // Điền sẵn form từ Job + Company + hồ sơ để Human Resource chỉ sửa lại chỗ cần.
    try {
      setLoadingDefaults(true);
      const res = await offerAPI.getDefaults(application.id || application.applicationId);
      const d = res.data || {};
      form.setFieldsValue({
        jobTitle: d.jobTitle,
        department: d.department,
        reportingTo: d.reportingTo,
        employmentType: d.employmentType,
        workLocation: d.workLocation,
        salaryAmount: d.salaryAmount,
        currency: d.currency || 'VND',
        salaryPeriod: d.salaryPeriod || 'THANG',
        benefits: d.benefits,
        terms: d.terms,
        signerName: d.signerName,
        signerTitle: d.signerTitle,
        hrContactName: d.hrContactName,
        hrContactEmail: d.hrContactEmail,
        deadline: dayjs().add(d.expiresInDays || 7, 'day'),
      });
    } catch (error) {
      console.error('Error fetching offer defaults:', error);
      // Không chặn: người dùng vẫn gõ tay được.
      form.setFieldsValue({ currency: 'VND', salaryPeriod: 'THANG', deadline: dayjs().add(7, 'day') });
    } finally {
      setLoadingDefaults(false);
    }
  };

  const getStatusTag = (status) => {
    const config = {
      PENDING: { color: 'processing', label: 'Đã gửi thư', icon: <SendOutlined /> },
      ACCEPTED: { color: 'success', label: 'Đã nhận việc', icon: <CheckCircleOutlined /> },
      DECLINED: { color: 'error', label: 'Đã từ chối', icon: <CloseCircleOutlined /> },
      DRAFT: { color: 'default', label: 'Nháp', icon: <EditOutlined /> },
    };
    const c = config[status] || { color: 'default', label: status, icon: null };
    return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>;
  };

  const getAppStatusTag = (status) => {
    const normalizedStatus = (status || '').toUpperCase();
    const labels = {
      NEW: 'Hồ sơ mới', SCREENING: 'Sàng lọc', INTERVIEW: 'Phỏng vấn',
      OFFER: 'Chờ gửi thư mời', HIRED: 'Trúng tuyển', REJECTED: 'Từ chối',
    };
    const colors = {
      NEW: 'default', SCREENING: 'processing', INTERVIEW: 'processing',
      OFFER: 'warning', HIRED: 'success', REJECTED: 'error',
    };
    return <Tag color={colors[normalizedStatus] || 'default'}>{labels[normalizedStatus] || status || 'N/A'}</Tag>;
  };

  const formatSalary = (record) => {
    if (!record.salaryAmount) return 'Thỏa thuận';
    const period = record.salaryPeriod === 'NAM' ? '/năm' : '/tháng';
    return `${Number(record.salaryAmount).toLocaleString('vi-VN')} ${record.currency || 'VND'}${period}`;
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
      key: 'salary',
      width: 170,
      render: (_, record) => (
        <Text style={{ color: '#5D8C3E', fontWeight: 600 }}>{formatSalary(record)}</Text>
      ),
      sorter: (a, b) => (a.salaryAmount || 0) - (b.salaryAmount || 0),
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 130,
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '—',
      sorter: (a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0),
    },
    {
      title: 'Hạn phản hồi',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 140,
      render: (date, record) => {
        if (!date) return '—';
        // Hết hạn chỉ đáng cảnh báo khi còn đang chờ trả lời.
        const isExpired = record.status === 'PENDING' && dayjs(date).isBefore(dayjs(), 'day');
        return (
          <Text type={isExpired ? 'danger' : 'secondary'}>
            {dayjs(date).format('DD/MM/YYYY')}
            {isExpired && ' (Hết hạn)'}
          </Text>
        );
      },
      sorter: (a, b) => new Date(a.expiresAt || 0) - new Date(b.expiresAt || 0),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status, record) => status ? getStatusTag(status) : getAppStatusTag(record.applicationStatus),
      filters: [
        { text: 'Đã gửi thư', value: 'PENDING' },
        { text: 'Đã nhận việc', value: 'ACCEPTED' },
        { text: 'Đã từ chối', value: 'DECLINED' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status && (
            <>
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
              <Tooltip title="Mở bản PDF thư mời">
                <Button
                  type="text"
                  size="small"
                  icon={<FilePdfOutlined />}
                  onClick={() => openLetterPdf(record.applicationId)}
                />
              </Tooltip>
            </>
          )}
          {record.status === 'PENDING' && (
            <>
              <Tooltip title="Gửi lại thư mời cho ứng viên">
                <Button type="text" size="small" icon={<SendOutlined />} onClick={() => handleSendReminder(record)} />
              </Tooltip>
              <Popconfirm
                title="Ứng viên đã nhận việc?"
                description="Hồ sơ sẽ chuyển sang Trúng tuyển."
                onConfirm={() => handleRecordOutcome(record, true)}
                okText="Xác nhận"
                cancelText="Hủy"
              >
                <Tooltip title="Ghi nhận: đã nhận việc">
                  <Button type="text" size="small" style={{ color: '#5D8C3E' }} icon={<CheckCircleOutlined />} />
                </Tooltip>
              </Popconfirm>
              <Popconfirm
                title="Ứng viên từ chối thư mời?"
                description="Hồ sơ sẽ chuyển sang Từ chối."
                onConfirm={() => handleRecordOutcome(record, false)}
                okText="Xác nhận"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Ghi nhận: từ chối">
                  <Button type="text" size="small" danger icon={<CloseCircleOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          {record.applicationStatus === 'OFFER' && !record.status && (
            <Button type="primary" size="small" onClick={() => openCreateModal(record)}>
              Soạn thư mời
            </Button>
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
      position: matchedOffer?.jobTitle || selectedJob?.title || app.job?.title || app.jobTitle || 'N/A',
      jobId: app.jobId || selectedJobId,
      status: matchedOffer ? matchedOffer.status : null,
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
          <Title level={3} className="page-title">Thư mời nhận việc</Title>
          <Text type="secondary">Soạn, gửi và theo dõi thư mời nhận việc cho ứng viên</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchApplications(selectedJobId); fetchOffers(selectedJobId); }} loading={loading}>
            Làm mới
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
              style={{ width: 170 }}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'PENDING', label: 'Đã gửi thư' },
                { value: 'ACCEPTED', label: 'Đã nhận việc' },
                { value: 'DECLINED', label: 'Đã từ chối' },
              ]}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {filteredData.length} hồ sơ
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
            showTotal: (total) => `Tổng ${total} hồ sơ`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Soạn thư mời nhận việc */}
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
              <div style={{ fontWeight: 600, fontSize: 16 }}>Soạn thư mời nhận việc</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Gửi email kèm link mở bản PDF cho ứng viên
              </Text>
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
        width={760}
        destroyOnClose
      >
        <Spin spinning={loadingDefaults} tip="Đang lấy thông tin từ tin tuyển dụng...">
          <Form form={form} layout="vertical" onFinish={handleCreateOffer} style={{ marginTop: 16 }}>
            {selectedApplication && (
              <div style={{
                background: '#fafafa', borderRadius: 10, padding: 16,
                marginBottom: 20, border: '1px solid #f0f0f0'
              }}>
                <Text strong style={{ fontSize: 13, color: '#8c8c8b', marginBottom: 12, display: 'block' }}>
                  NGƯỜI NHẬN
                </Text>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Ứng viên">{selectedApplication.candidateName || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="Email">{selectedApplication.candidateEmail || 'N/A'}</Descriptions.Item>
                </Descriptions>
              </div>
            )}

            <Divider orientation="left" plain style={{ marginTop: 4 }}>Thông tin vị trí</Divider>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item label="Vị trí công việc" name="jobTitle"
                rules={[{ required: true, message: 'Vui lòng nhập tên vị trí' }]}>
                <Input placeholder="VD: Kế toán tổng hợp" maxLength={200} />
              </Form.Item>

              <Form.Item label="Phòng ban" name="department">
                <Input placeholder="VD: Tài chính - Kế toán" maxLength={100} />
              </Form.Item>

              <Form.Item label="Báo cáo cho" name="reportingTo">
                <Input placeholder="VD: Trưởng phòng Nguyễn Văn B" maxLength={200} />
              </Form.Item>

              <Form.Item label="Ngày bắt đầu" name="startDate"
                rules={[{ required: true, message: 'Vui lòng chọn ngày bắt đầu' }]}>
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Chọn ngày bắt đầu"
                  format="DD/MM/YYYY"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>

              <Form.Item label="Hình thức làm việc" name="employmentType">
                <Input placeholder="VD: Toàn thời gian" maxLength={100} />
              </Form.Item>

              <Form.Item label="Địa điểm làm việc" name="workLocation">
                <Input placeholder="VD: Văn phòng Hà Nội / Làm việc từ xa" maxLength={300} />
              </Form.Item>
            </div>

            <Divider orientation="left" plain>Lương &amp; phúc lợi</Divider>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
              <Form.Item label="Mức lương" name="salaryAmount">
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Bỏ trống = Thỏa thuận"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/,/g, '')}
                  min={0}
                />
              </Form.Item>

              <Form.Item label="Tiền tệ" name="currency">
                <Select options={[
                  { value: 'VND', label: 'VND' },
                  { value: 'USD', label: 'USD' },
                ]} />
              </Form.Item>

              <Form.Item label="Kỳ lương" name="salaryPeriod">
                <Select options={[
                  { value: 'THANG', label: 'Theo tháng' },
                  { value: 'NAM', label: 'Theo năm' },
                ]} />
              </Form.Item>
            </div>

            <Form.Item label="Thưởng / Ưu đãi (nếu có)" name="bonus">
              <Input placeholder="VD: Lương tháng 13, thưởng theo hiệu quả công việc" maxLength={500} />
            </Form.Item>

            <Form.Item label="Các phúc lợi khác" name="benefits">
              <TextArea rows={2} placeholder="VD: Bảo hiểm y tế, nghỉ phép 12 ngày/năm, du lịch hằng năm"
                maxLength={1000} showCount />
            </Form.Item>

            <Divider orientation="left" plain>Điều khoản &amp; chân thư</Divider>

            <Form.Item
              label="Điều khoản & điều kiện"
              name="terms"
              extra="Mỗi dòng là một gạch đầu dòng trên thư."
            >
              <TextArea rows={4} maxLength={2000} showCount />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item label="Người ký" name="signerName">
                <Input placeholder="VD: Trần Thị C" maxLength={200} />
              </Form.Item>

              <Form.Item label="Chức danh người ký" name="signerTitle">
                <Input placeholder="VD: Trưởng phòng Nhân sự" maxLength={200} />
              </Form.Item>

              <Form.Item label="HR liên hệ" name="hrContactName">
                <Input placeholder="Người ứng viên hỏi khi có thắc mắc" maxLength={200} />
              </Form.Item>

              <Form.Item label="Email HR" name="hrContactEmail"
                rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
                <Input placeholder="hr@congty.vn" maxLength={256} />
              </Form.Item>
            </div>

            <Form.Item
              label="Hạn mong nhận phản hồi"
              name="deadline"
              rules={[{ required: true, message: 'Vui lòng chọn hạn phản hồi' }]}
              extra="Cũng là hạn hiệu lực của link xem thư."
            >
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
              />
            </Form.Item>

            <Form.Item label="Lời nhắn thêm cho ứng viên" name="note">
              <TextArea rows={2} placeholder="In ở cuối thư, trước phần xác nhận" maxLength={1000} showCount />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
                icon={<SendOutlined />}
                style={{ background: '#5D8C3E', borderColor: '#5D8C3E' }}
              >
                {submitting ? 'Đang gửi...' : 'Gửi thư mời'}
              </Button>
            </div>
          </Form>
        </Spin>
      </Modal>

      {/* Chi tiết thư mời đã gửi */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: '#5D8C3E' }} />
            Chi tiết thư mời
          </div>
        }
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false);
          setSelectedOffer(null);
        }}
        width={520}
        footer={
          selectedOffer?.status === 'PENDING' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Popconfirm
                title="Thu hồi thư mời này?"
                description="Hồ sơ sẽ chuyển sang Từ chối."
                onConfirm={() => {
                  handleWithdraw(selectedOffer.applicationId);
                  setViewDrawerOpen(false);
                }}
                okText="Thu hồi"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<StopOutlined />}>Thu hồi</Button>
              </Popconfirm>
              <Space>
                <Popconfirm
                  title="Ứng viên từ chối?"
                  onConfirm={() => handleRecordOutcome(selectedOffer, false)}
                  okText="Xác nhận" cancelText="Hủy" okButtonProps={{ danger: true }}
                >
                  <Button icon={<CloseCircleOutlined />}>Từ chối</Button>
                </Popconfirm>
                <Popconfirm
                  title="Ứng viên đã nhận việc?"
                  onConfirm={() => handleRecordOutcome(selectedOffer, true)}
                  okText="Xác nhận" cancelText="Hủy"
                >
                  <Button type="primary" icon={<CheckCircleOutlined />}
                    style={{ background: '#5D8C3E', borderColor: '#5D8C3E' }}>
                    Đã nhận việc
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          )
        }
      >
        {selectedOffer && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {getStatusTag(selectedOffer.status)}
              <Button size="small" icon={<FilePdfOutlined />}
                onClick={() => openLetterPdf(selectedOffer.applicationId)}>
                Mở bản PDF
              </Button>
            </div>

            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Ứng viên">
                <Space>
                  <Avatar size="small" style={{ backgroundColor: '#5D8C3E' }} icon={<UserOutlined />} />
                  <Text strong>{selectedOffer.candidateName}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Email">{selectedOffer.candidateEmail || '—'}</Descriptions.Item>
              <Descriptions.Item label="Vị trí">{selectedOffer.jobTitle || selectedOffer.position || '—'}</Descriptions.Item>
              <Descriptions.Item label="Phòng ban">{selectedOffer.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Báo cáo cho">{selectedOffer.reportingTo || '—'}</Descriptions.Item>
              <Descriptions.Item label="Hình thức">{selectedOffer.employmentType || '—'}</Descriptions.Item>
              <Descriptions.Item label="Địa điểm">{selectedOffer.workLocation || '—'}</Descriptions.Item>
              <Descriptions.Item label="Mức lương">
                <Text strong style={{ color: '#5D8C3E' }}>{formatSalary(selectedOffer)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Thưởng/Ưu đãi">{selectedOffer.bonus || '—'}</Descriptions.Item>
              <Descriptions.Item label="Phúc lợi">{selectedOffer.benefits || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ngày bắt đầu">
                {selectedOffer.startDate ? dayjs(selectedOffer.startDate).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Đã gửi lúc">
                {selectedOffer.sentAt ? dayjs(selectedOffer.sentAt).format('DD/MM/YYYY HH:mm') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Hạn phản hồi">
                {selectedOffer.expiresAt ? dayjs(selectedOffer.expiresAt).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Người ký">
                {selectedOffer.signerName
                  ? `${selectedOffer.signerName}${selectedOffer.signerTitle ? ` — ${selectedOffer.signerTitle}` : ''}`
                  : '—'}
              </Descriptions.Item>
            </Descriptions>

            {selectedOffer.note && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <Title level={5} style={{ marginBottom: 8 }}>Lời nhắn kèm thư</Title>
                <div style={{
                  background: '#f5f5f4', padding: 12, borderRadius: 8,
                  whiteSpace: 'pre-wrap', fontSize: 13
                }}>
                  {selectedOffer.note}
                </div>
              </>
            )}

            {selectedOffer.respondedAt && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Title level={5} style={{ marginBottom: 12 }}>Kết quả đã ghi nhận</Title>
                <Space direction="vertical" size={6}>
                  {getStatusTag(selectedOffer.status)}
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Ghi nhận lúc {dayjs(selectedOffer.respondedAt).format('DD/MM/YYYY HH:mm')}
                  </Text>
                  {selectedOffer.outcomeNote && (
                    <div style={{
                      background: '#f5f5f4', padding: 12, borderRadius: 8,
                      fontSize: 13, whiteSpace: 'pre-wrap'
                    }}>
                      {selectedOffer.outcomeNote}
                    </div>
                  )}
                </Space>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default OfferManagement;
