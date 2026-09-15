import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card, Typography, Button, Table, Avatar, Space, Modal, Form,
  Input, Select, DatePicker, InputNumber, message, Popconfirm,
  Descriptions, Divider, Tooltip, Spin
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined,
  FileTextOutlined, EyeOutlined, SendOutlined, ReloadOutlined,
  UserOutlined, MailOutlined
} from '@ant-design/icons';
import { offerAPI, applicationAPI, jobsAPI } from '../../services/api';
import { getStatusTag, getAppStatusTag, formatSalary } from './offerDisplay';
import dayjs from 'dayjs';
import './css/OfferManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Giá trị "Tất cả vị trí" trong ô chọn tin — không trùng được với jobId (số).
const ALL_JOBS = 'all';

/**
 * Quản lý THƯ MỜI NHẬN VIỆC (docs 5.15).
 *
 * Luồng: hồ sơ ở trạng thái OFFER -> Human Resource soạn thư (form điền sẵn từ Job/Company) ->
 * hệ thống gửi email mà THÂN THƯ chính là lá thư mời -> ứng viên trả lời NGOÀI hệ thống
 * (Reply email) -> Human Resource bấm "Đã nhận việc" / "Từ chối" để chốt HIRED/REJECTED.
 *
 * Không có nút mở PDF hay khoe link cho ứng viên: thư nằm sẵn trong email họ nhận được,
 * đưa thêm một bản PDF/một đường link ở đây chỉ khiến người dùng tưởng phải gửi tay.
 */
const OfferManagement = () => {
  const navigate = useNavigate();

  // Tin tuyển dụng đang lọc nằm trên URL (?jobId=), không giấu trong state: đi vào trang chi
  // tiết một thư mời rồi bấm Back mà state nằm trong bộ nhớ thì component dựng lại từ đầu —
  // người dùng mất đúng chỗ họ đang đứng. Không có ?jobId= = xem TẤT CẢ vị trí (mặc định):
  // nhân sự cần thấy mọi hồ sơ chờ soạn thư, không phải lần lượt mở từng tin để tìm.
  const [searchParams, setSearchParams] = useSearchParams();
  const jobIdParam = Number(searchParams.get('jobId')) || null;

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(jobIdParam);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  // Hồ sơ này đã qua đề xuất tuyển và Giám đốc chốt mức lương -> ô lương khoá lại (24/08/2026).
  const [salaryFromDirector, setSalaryFromDirector] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    fetchList(selectedJobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  /** Đổi tin đang lọc (null = tất cả): cập nhật cả state lẫn URL. replace để Back không phải bấm qua từng tin đã chọn. */
  const selectJob = (jobId) => {
    setSelectedJobId(jobId);
    setSearchParams(jobId ? { jobId: String(jobId) } : {}, { replace: true });
  };

  // Giữ bộ lọc khi đi sang trang chi tiết rồi quay lại.
  const listQuery = selectedJobId ? `?jobId=${selectedJobId}` : '';

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      message.error('Không thể tải danh sách công việc');
    }
  };

  /**
   * MỘT lời gọi cho cả danh sách (GET /api/offers). Bản trước tải hồ sơ theo từng tin rồi gọi
   * thêm GET .../offer cho TỪNG hồ sơ — không xem được nhiều tin cùng lúc, và mỗi lần mở trang
   * là N+1 lời gọi. Backend chỉ trả hồ sơ đã tới bước thư mời, không kéo theo mọi hồ sơ bị loại.
   */
  const fetchList = async (jobId = selectedJobId) => {
    try {
      setLoading(true);
      const res = await offerAPI.getList(jobId);
      setRows((res.data || []).map((r) => ({
        ...(r.offer || {}),
        id: r.applicationId,
        applicationId: r.applicationId,
        jobId: r.jobId,
        candidateName: r.candidateName,
        candidateEmail: r.candidateEmail,
        position: r.offer?.jobTitle || r.jobTitle,
        // status = trạng thái THƯ (null = chưa soạn); applicationStatus = pha của hồ sơ.
        status: r.offer?.status ?? null,
        applicationStatus: r.applicationState,
      })));
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
      await offerAPI.create(applicationId, payload);
      message.success(`Đã gửi thư mời tới ${selectedApplication.candidateEmail || 'ứng viên'}.`);
      setCreateModalOpen(false);
      form.resetFields();
      setSelectedApplication(null);
      // Gửi xong thì mở luôn TRANG chi tiết lá thư vừa gửi — người dùng cần đọc lại xem đã
      // gửi đi cái gì, và các nút chốt kết quả cũng nằm ở đó.
      navigate(`/offers/${applicationId}${listQuery}`);
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

  // "Gửi nhắc nhở" = gửi lại chính lá thư mời qua email cho ứng viên.
  const handleSendReminder = async (record) => {
    try {
      await applicationAPI.createMagicLink(record.applicationId, 'OFFER_RESPONSE');
      message.success(`Đã gửi lại thư mời tới ${record.candidateEmail || 'ứng viên'}.`);
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
      fetchList();
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể ghi nhận kết quả');
    }
  };

  const openCreateModal = async (application) => {
    setSelectedApplication(application);
    setCreateModalOpen(true);
    form.resetFields();
    setSalaryFromDirector(false);

    // Điền sẵn form từ Job + Company + hồ sơ để Human Resource chỉ sửa lại chỗ cần.
    try {
      setLoadingDefaults(true);
      const res = await offerAPI.getDefaults(application.id || application.applicationId);
      const d = res.data || {};
      // Mức lương là điều khoản GIÁM ĐỐC đã chốt khi duyệt đề xuất tuyển (V043) — nhân sự soạn
      // thư chứ không mặc cả lại, nên khoá ô lại. Backend cũng ép cùng số đó khi lưu.
      setSalaryFromDirector(!!d.termsFromDirector);
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
      setSalaryFromDirector(false);
      // Không chặn: người dùng vẫn gõ tay được.
      form.setFieldsValue({ currency: 'VND', salaryPeriod: 'THANG', deadline: dayjs().add(7, 'day') });
    } finally {
      setLoadingDefaults(false);
    }
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
            <Tooltip title="Mở trang chi tiết thư mời">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/offers/${record.applicationId}${listQuery}`)}
              />
            </Tooltip>
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

  const filteredData = rows.filter((row) => {
    const matchesSearch =
      (row.candidateName || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (row.position || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (row.candidateEmail || '').toLowerCase().includes(searchText.toLowerCase());
    // "Chờ gửi thư" = đã duyệt tuyển mà chưa có thư — đúng danh sách việc nhân sự phải làm.
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'TO_SEND'
        ? !row.status && row.applicationStatus === 'OFFER'
        : row.status === statusFilter);
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
          <Button icon={<ReloadOutlined />} onClick={() => fetchList()} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Select
              value={selectedJobId ?? ALL_JOBS}
              onChange={(v) => selectJob(v === ALL_JOBS ? null : v)}
              style={{ width: 260 }}
              options={[
                { value: ALL_JOBS, label: 'Tất cả vị trí' },
                ...jobs.map((job) => ({
                  value: job.jobId || job.id,
                  label: `${job.title} (${job.jobId || job.id})`,
                })),
              ]}
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
                { value: 'TO_SEND', label: 'Chờ gửi thư' },
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
                Ứng viên nhận nguyên lá thư ngay trong email
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

              {/* CỐ Ý không điền sẵn (V051, 24/08/2026): ngày đi làm là kết quả cuộc gọi giữa bạn
                  và ứng viên — họ còn phải báo trước cho chỗ làm cũ. Giám đốc duyệt tuyển chỉ chốt
                  TIỀN, không chốt NGÀY, nên hệ thống không có số nào để đoán mà không đoán sai. */}
              <Form.Item label="Ngày bắt đầu" name="startDate"
                extra="Hỏi ứng viên qua điện thoại rồi điền — hệ thống không điền sẵn ô này."
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

            {/* Không còn ô "địa chỉ ứng viên" (V054, 25/08/2026): thư mời đi bằng EMAIL nên
                địa chỉ nhà chẳng dùng vào việc gì, mà CV không lưu nên nhân sự phải gõ tay. */}

            <Divider orientation="left" plain>Lương &amp; phúc lợi</Divider>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
              <Form.Item
                label="Mức lương"
                name="salaryAmount"
                tooltip={salaryFromDirector
                  ? 'Mức Giám đốc đã chốt khi duyệt đề xuất tuyển — bộ phận nhân sự không sửa.'
                  : undefined}
                extra={salaryFromDirector
                  ? 'Giám đốc đã chốt mức này. Cần đổi thì đề nghị Giám đốc quyết lại.'
                  : undefined}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Bỏ trống = Thỏa thuận"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/,/g, '')}
                  min={0}
                  disabled={salaryFromDirector}
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

            <Divider />

            <Form.Item
              label="Điều khoản & điều kiện"
              name="terms"
              extra="Mỗi dòng là một gạch đầu dòng trên thư."
            >
              <TextArea rows={4} maxLength={2000} showCount />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Mặc định là Giám đốc đã duyệt tuyển (V047) — người chốt lương/ngày vào làm
                  đứng tên thư, nhân sự chỉ soạn hộ. Vẫn sửa tay được. */}
              <Form.Item
                label="Người ký"
                name="signerName"
                extra="Mặc định là Giám đốc đã duyệt tuyển hồ sơ này."
              >
                <Input placeholder="VD: Trần Thị C" maxLength={200} />
              </Form.Item>

              <Form.Item label="Chức danh người ký" name="signerTitle">
                <Input placeholder="VD: Giám đốc" maxLength={200} />
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

    </div>
  );
};

export default OfferManagement;
