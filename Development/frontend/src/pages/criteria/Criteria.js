import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Table, Tag, Modal, Form, Input, Select,
  Space, message, Popconfirm, Tooltip, Descriptions,
  Tabs, InputNumber, Switch, Alert
} from 'antd';
import {
  PlusOutlined, CheckSquareOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, CheckCircleOutlined, StarOutlined,
  EyeOutlined, SearchOutlined, RobotOutlined, MinusCircleOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { criteriaAPI, jobsAPI } from '../../services/api';
import './css/Criteria.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

/**
 * Trục tiêu chí (docs 5.17/5.18):
 * AI bóc tiêu chí từ JD → DRAFT → người duyệt rà + sửa → APPROVED → mới dùng để chấm CV
 * (HARD lọc rule/keyword, SOFT so vector; chỉ tiêu chí CvMatchable mới tính khi chấm CV).
 * Tab 2: thư viện template cấp company — áp vào job sẽ clone thành tiêu chí APPROVED của job.
 */
const Criteria = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [jobCriteria, setJobCriteria] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchText, setSearchText] = useState('');

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [addCriterionModalOpen, setAddCriterionModalOpen] = useState(false);
  const [editCriterionModalOpen, setEditCriterionModalOpen] = useState(false);
  const [selectedCriterion, setSelectedCriterion] = useState(null);

  const [templateForm] = Form.useForm();
  const [editTemplateForm] = Form.useForm();
  const [applyForm] = Form.useForm();
  const [criterionForm] = Form.useForm();
  const [editCriterionForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchJobs();
  }, []);

  const fetchJobCriteria = useCallback(async (jobId) => {
    try {
      const response = await criteriaAPI.getByJob(jobId);
      setJobCriteria(response.data || []);
    } catch (error) {
      console.error('Error fetching job criteria:', error);
      setJobCriteria([]);
    }
  }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchJobCriteria(selectedJob);
    } else {
      setJobCriteria([]);
    }
  }, [selectedJob, fetchJobCriteria]);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      // Trả CriteriaTemplateSummaryDto[]: { templateId, name, description, active, itemCount }
      const response = await criteriaAPI.getTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      message.error('Không thể tải danh sách template');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  // ===== Luồng AI: bóc DRAFT → duyệt =====

  const draftCount = jobCriteria.filter(c => c.status === 'DRAFT').length;

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const response = await criteriaAPI.extractFromJd(selectedJob);
      const drafts = response.data || [];
      message.success(`AI đã bóc ${drafts.length} tiêu chí (DRAFT) — rà lại rồi bấm Duyệt.`);
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error('Error extracting criteria:', error);
      if (error?.response?.status === 502) {
        message.warning('AI service chưa sẵn sàng — bạn có thể thêm tiêu chí thủ công hoặc áp template.', 6);
      } else {
        message.error(error?.response?.data?.userMsg || 'Không thể bóc tiêu chí từ JD.');
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      const response = await criteriaAPI.approve(selectedJob);
      message.success(`Đã duyệt ${response.data?.approved ?? draftCount} tiêu chí — bộ tiêu chí sẵn sàng chấm CV.`);
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error('Error approving criteria:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể duyệt bộ tiêu chí.');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== CRUD tiêu chí per-job =====

  const handleAddCriterion = async (values) => {
    try {
      setSubmitting(true);
      await criteriaAPI.addToJob(selectedJob, {
        name: values.name,
        weight: values.weight ?? 1,
        maxScore: values.maxScore ?? 10,
        criteriaType: values.criteriaType || 'SOFT',
        cvMatchable: values.cvMatchable !== false,
        keywords: values.keywords || null,
      });
      message.success('Đã thêm tiêu chí (APPROVED — nhập tay không cần duyệt).');
      setAddCriterionModalOpen(false);
      criterionForm.resetFields();
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error('Error adding criterion:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể thêm tiêu chí.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditCriterion = (record) => {
    setSelectedCriterion(record);
    editCriterionForm.setFieldsValue({
      name: record.name,
      weight: record.weight,
      maxScore: record.maxScore,
      criteriaType: record.criteriaType,
      cvMatchable: record.cvMatchable,
      keywords: record.keywords,
      active: record.active,
    });
    setEditCriterionModalOpen(true);
  };

  const handleUpdateCriterion = async (values) => {
    try {
      setSubmitting(true);
      await criteriaAPI.updateJobCriteria(selectedCriterion.criteriaId, {
        name: values.name,
        weight: values.weight ?? 1,
        maxScore: values.maxScore ?? 10,
        active: values.active !== false,
        criteriaType: values.criteriaType || 'SOFT',
        cvMatchable: values.cvMatchable !== false,
        keywords: values.keywords || null,
      });
      message.success('Đã cập nhật tiêu chí.');
      setEditCriterionModalOpen(false);
      setSelectedCriterion(null);
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error('Error updating criterion:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể cập nhật tiêu chí.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveFromJob = async (criteriaId) => {
    try {
      await criteriaAPI.removeFromJob(criteriaId);
      message.success('Đã gỡ tiêu chí khỏi vị trí');
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error('Error removing criteria:', error);
      message.error('Không thể gỡ tiêu chí');
    }
  };

  const handleApplyTemplate = async (values) => {
    try {
      setSubmitting(true);
      const response = await criteriaAPI.applyTemplateToJob(values.templateId, selectedJob);
      message.success(`Đã áp template — thêm ${response.data?.length ?? ''} tiêu chí cho vị trí.`);
      setApplyModalOpen(false);
      applyForm.resetFields();
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error('Error applying template:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể áp template.');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== CRUD template =====

  const handleCreateTemplate = async (values) => {
    try {
      setSubmitting(true);
      await criteriaAPI.createTemplate({
        name: values.name,
        description: values.description,
        items: (values.items || []).map(i => ({
          name: i.name,
          weight: i.weight ?? 1,
          maxScore: i.maxScore ?? 10,
        })),
      });
      message.success('Tạo template tiêu chí thành công!');
      setCreateModalOpen(false);
      templateForm.resetFields();
      fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể tạo template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetail = async (record) => {
    try {
      const response = await criteriaAPI.getById(record.templateId);
      setSelectedTemplate(response.data);
      setDetailModalOpen(true);
    } catch (error) {
      console.error('Error fetching template detail:', error);
      message.error('Không thể tải chi tiết template');
    }
  };

  const openEditTemplate = async (record) => {
    try {
      // Update thay TOÀN BỘ dòng -> phải nạp items hiện có vào form trước
      const response = await criteriaAPI.getById(record.templateId);
      const detail = response.data;
      setSelectedTemplate(detail);
      editTemplateForm.setFieldsValue({
        name: detail.name,
        description: detail.description,
        active: detail.active,
        items: (detail.items || []).map(i => ({
          name: i.name, weight: i.weight, maxScore: i.maxScore,
        })),
      });
      setEditTemplateModalOpen(true);
    } catch (error) {
      console.error('Error loading template:', error);
      message.error('Không thể tải template để sửa');
    }
  };

  const handleUpdateTemplate = async (values) => {
    try {
      setSubmitting(true);
      await criteriaAPI.updateTemplate(selectedTemplate.templateId, {
        name: values.name,
        description: values.description,
        active: values.active !== false,
        items: (values.items || []).map(i => ({
          name: i.name,
          weight: i.weight ?? 1,
          maxScore: i.maxScore ?? 10,
        })),
      });
      message.success('Cập nhật template thành công!');
      setEditTemplateModalOpen(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể cập nhật template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (record) => {
    try {
      await criteriaAPI.deleteTemplate(record.templateId);
      message.success('Đã ẩn template.');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      message.error('Không thể ẩn template');
    }
  };

  // ===== Render helpers =====

  const typeTag = (type) =>
    type === 'HARD'
      ? <Tooltip title="Yêu cầu cứng — lọc bằng rule/keyword"><Tag color="volcano">HARD</Tag></Tooltip>
      : <Tooltip title="Kỹ năng — so khớp ngữ nghĩa bằng vector"><Tag color="geekblue">SOFT</Tag></Tooltip>;

  const jobCriteriaColumns = [
    {
      title: 'Tiêu chí',
      key: 'name',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name}</div>
          {record.keywords && (
            <Text type="secondary" style={{ fontSize: 12 }}>Từ khóa: {record.keywords}</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Loại',
      key: 'type',
      width: 90,
      render: (_, record) => typeTag(record.criteriaType),
      filters: [{ text: 'HARD', value: 'HARD' }, { text: 'SOFT', value: 'SOFT' }],
      onFilter: (value, record) => record.criteriaType === value,
    },
    {
      title: 'Chấm CV',
      key: 'cvMatchable',
      width: 110,
      render: (_, record) =>
        record.cvMatchable
          ? <Tag color="cyan">Có</Tag>
          : <Tooltip title="Chỉ đánh giá khi phỏng vấn — chấm CV bỏ qua"><Tag>Chỉ PV</Tag></Tooltip>,
    },
    {
      title: 'Trọng số',
      dataIndex: 'weight',
      key: 'weight',
      width: 90,
      render: (w) => <Text strong>{w}</Text>,
    },
    {
      title: 'Điểm tối đa',
      dataIndex: 'maxScore',
      key: 'maxScore',
      width: 100,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          {record.status === 'DRAFT'
            ? <Tag color="gold">DRAFT — chờ duyệt</Tag>
            : <Tag color="success">Đã duyệt</Tag>}
          {record.source === 'AI_EXTRACTED' && (
            <Tag icon={<RobotOutlined />} color="purple" style={{ fontSize: 11 }}>AI bóc</Tag>
          )}
        </Space>
      ),
      filters: [{ text: 'DRAFT', value: 'DRAFT' }, { text: 'Đã duyệt', value: 'APPROVED' }],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Sửa">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditCriterion(record)} />
          </Tooltip>
          <Popconfirm
            title="Gỡ tiêu chí này khỏi vị trí?"
            onConfirm={() => handleRemoveFromJob(record.criteriaId)}
            okText="Gỡ"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const templateColumns = [
    {
      title: 'Tên template',
      key: 'name',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
        </div>
      ),
    },
    {
      title: 'Số tiêu chí',
      key: 'itemCount',
      width: 120,
      render: (_, record) => <Tag color="blue">{record.itemCount ?? record.items?.length ?? 0} tiêu chí</Tag>,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      render: (_, record) => (
        <Tag color={record.active !== false ? 'success' : 'default'}>
          {record.active !== false ? 'Hoạt động' : 'Đã ẩn'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditTemplate(record)} />
          </Tooltip>
          <Popconfirm
            title="Ẩn template này?"
            description="Template bị ẩn khỏi danh sách chọn (không xóa cứng)."
            onConfirm={() => handleDeleteTemplate(record)}
            okText="Ẩn"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredTemplates = templates.filter(t =>
    !searchText ||
    (t.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(searchText.toLowerCase())
  );

  // Form.List dòng tiêu chí dùng chung cho tạo/sửa template
  const templateItemsList = (
    <Form.List name="items" initialValue={[{}]}>
      {(fields, { add, remove }) => (
        <>
          <Text strong>Các tiêu chí trong template:</Text>
          {fields.map((field) => (
            <Space key={field.key} align="baseline" style={{ display: 'flex', marginTop: 8 }}>
              <Form.Item
                name={[field.name, 'name']}
                rules={[{ required: true, message: 'Nhập tên tiêu chí' }]}
                style={{ marginBottom: 8 }}
              >
                <Input placeholder="Tên tiêu chí" style={{ width: 240 }} />
              </Form.Item>
              <Form.Item name={[field.name, 'weight']} initialValue={1} style={{ marginBottom: 8 }}>
                <InputNumber min={0.5} max={10} step={0.5} placeholder="Trọng số" style={{ width: 100 }} />
              </Form.Item>
              <Form.Item name={[field.name, 'maxScore']} initialValue={10} style={{ marginBottom: 8 }}>
                <InputNumber min={1} max={100} placeholder="Điểm max" style={{ width: 100 }} />
              </Form.Item>
              {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(field.name)} />}
            </Space>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block style={{ marginTop: 8 }}>
            Thêm dòng tiêu chí
          </Button>
        </>
      )}
    </Form.List>
  );

  // Form fields dùng chung cho thêm/sửa tiêu chí per-job
  const criterionFormFields = (isEdit) => (
    <>
      <Form.Item
        label="Tên tiêu chí"
        name="name"
        rules={[{ required: true, message: 'Vui lòng nhập tên tiêu chí' }]}
      >
        <Input placeholder="VD: 2 năm kinh nghiệm Java" />
      </Form.Item>
      <Space size={16} style={{ display: 'flex' }}>
        <Form.Item label="Loại" name="criteriaType" initialValue="SOFT" style={{ width: 160 }}>
          <Select
            options={[
              { value: 'SOFT', label: 'SOFT — so vector' },
              { value: 'HARD', label: 'HARD — lọc rule' },
            ]}
          />
        </Form.Item>
        <Form.Item label="Trọng số" name="weight" initialValue={1}>
          <InputNumber min={0.5} max={10} step={0.5} style={{ width: 100 }} />
        </Form.Item>
        <Form.Item label="Điểm tối đa" name="maxScore" initialValue={10}>
          <InputNumber min={1} max={100} style={{ width: 100 }} />
        </Form.Item>
      </Space>
      <Form.Item
        label="Từ khóa nhận diện (chỉ dùng cho HARD, phân tách bằng ';')"
        name="keywords"
      >
        <Input placeholder="VD: java; spring boot; jpa (trống = dùng tên tiêu chí)" />
      </Form.Item>
      <Space size={24}>
        <Form.Item
          label="Thấy được trong CV"
          name="cvMatchable"
          valuePropName="checked"
          initialValue={true}
          tooltip="Tắt = chỉ đánh giá khi phỏng vấn, chấm CV bỏ qua tiêu chí này"
        >
          <Switch checkedChildren="Có" unCheckedChildren="Chỉ PV" />
        </Form.Item>
        {isEdit && (
          <Form.Item label="Đang dùng" name="active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
          </Form.Item>
        )}
      </Space>
    </>
  );

  const tabItems = [
    {
      key: 'job-criteria',
      label: <span><StarOutlined /> Tiêu chí theo vị trí</span>,
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Select
              placeholder="Chọn vị trí"
              value={selectedJob}
              onChange={(val) => setSelectedJob(val)}
              style={{ width: 280 }}
              showSearch
              optionFilterProp="label"
              options={jobs.map(job => ({ value: job.jobId, label: job.title }))}
              allowClear
            />
            {selectedJob && (
              <>
                <Tooltip title="AI đọc JD của vị trí và đề xuất bộ tiêu chí (DRAFT — cần duyệt trước khi dùng)">
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={handleExtract}
                    loading={extracting}
                    style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                  >
                    AI bóc tiêu chí từ JD
                  </Button>
                </Tooltip>
                <Button icon={<PlusOutlined />} onClick={() => setAddCriterionModalOpen(true)}>
                  Thêm thủ công
                </Button>
                <Button icon={<CheckSquareOutlined />} onClick={() => setApplyModalOpen(true)}>
                  Áp template
                </Button>
              </>
            )}
          </div>

          {selectedJob && draftCount > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<RobotOutlined />}
              style={{ marginBottom: 16 }}
              message={`AI đã bóc ${draftCount} tiêu chí đang chờ duyệt (DRAFT)`}
              description="Rà lại từng dòng (sửa/gỡ nếu cần) rồi bấm Duyệt. Chỉ tiêu chí ĐÃ DUYỆT mới được dùng để chấm CV — AI không tự quyết."
              action={
                <Popconfirm
                  title={`Duyệt toàn bộ ${draftCount} tiêu chí DRAFT?`}
                  description="Sau khi duyệt, bộ tiêu chí sẽ dùng để chấm CV và làm phiếu chấm phỏng vấn."
                  onConfirm={handleApprove}
                  okText="Duyệt"
                  cancelText="Để sau"
                >
                  <Button type="primary" icon={<CheckCircleOutlined />} loading={submitting}>
                    Duyệt {draftCount} tiêu chí
                  </Button>
                </Popconfirm>
              }
            />
          )}

          {selectedJob ? (
            <Table
              columns={jobCriteriaColumns}
              dataSource={jobCriteria}
              rowKey="criteriaId"
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: 'Chưa có tiêu chí — bấm "AI bóc tiêu chí từ JD" để bắt đầu, hoặc thêm thủ công / áp template',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8b' }}>
              Chọn vị trí để quản lý bộ tiêu chí đánh giá
            </div>
          )}
        </>
      ),
    },
    {
      key: 'templates',
      label: <span><CheckSquareOutlined /> Template tiêu chí</span>,
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Input
              placeholder="Tìm kiếm template..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            >
              Tạo Template Mới
            </Button>
          </div>
          <Table
            columns={templateColumns}
            dataSource={filteredTemplates}
            rowKey="templateId"
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: 'Chưa có template tiêu chí nào' }}
          />
        </>
      ),
    },
  ];

  return (
    <div className="criteria-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Tiêu Chí Đánh Giá</Title>
          <Text type="secondary">
            AI bóc tiêu chí từ JD → người duyệt chốt → cùng bộ tiêu chí dùng cho chấm CV và phỏng vấn
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => { fetchTemplates(); if (selectedJob) fetchJobCriteria(selectedJob); }}
          loading={loading}
        >
          Làm mới
        </Button>
      </div>

      <Card className="main-card" bordered={false}>
        <Tabs items={tabItems} />
      </Card>

      {/* Modal: thêm tiêu chí thủ công cho vị trí */}
      <Modal
        title={<span><PlusOutlined style={{ color: MATCHA_GREEN, marginRight: 8 }} />Thêm tiêu chí cho vị trí</span>}
        open={addCriterionModalOpen}
        onCancel={() => { setAddCriterionModalOpen(false); criterionForm.resetFields(); }}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Form form={criterionForm} layout="vertical" onFinish={handleAddCriterion} style={{ marginTop: 16 }}>
          {criterionFormFields(false)}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setAddCriterionModalOpen(false); criterionForm.resetFields(); }}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={submitting}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}>
              Thêm tiêu chí
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: sửa 1 tiêu chí của vị trí */}
      <Modal
        title={<span><EditOutlined style={{ color: MATCHA_GREEN, marginRight: 8 }} />Sửa tiêu chí</span>}
        open={editCriterionModalOpen}
        onCancel={() => { setEditCriterionModalOpen(false); setSelectedCriterion(null); }}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Form form={editCriterionForm} layout="vertical" onFinish={handleUpdateCriterion} style={{ marginTop: 16 }}>
          {criterionFormFields(true)}
          {selectedCriterion?.status === 'DRAFT' && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Tiêu chí này đang DRAFT — sửa xong vẫn cần bấm Duyệt ở ngoài danh sách."
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setEditCriterionModalOpen(false); setSelectedCriterion(null); }}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>Lưu</Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: áp template vào vị trí */}
      <Modal
        title={<span><CheckSquareOutlined style={{ color: MATCHA_GREEN, marginRight: 8 }} />Áp template vào vị trí</span>}
        open={applyModalOpen}
        onCancel={() => { setApplyModalOpen(false); applyForm.resetFields(); }}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ margin: '16px 0' }}
          message="Từng dòng của template sẽ được sao chép thành tiêu chí APPROVED của vị trí (sửa per-job không ảnh hưởng template gốc)."
        />
        <Form form={applyForm} layout="vertical" onFinish={handleApplyTemplate}>
          <Form.Item
            label="Chọn template"
            name="templateId"
            rules={[{ required: true, message: 'Vui lòng chọn template' }]}
          >
            <Select
              placeholder="-- Chọn template --"
              showSearch
              optionFilterProp="label"
              options={templates
                .filter(t => t.active !== false)
                .map(t => ({ value: t.templateId, label: `${t.name} (${t.itemCount ?? 0} tiêu chí)` }))}
            />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setApplyModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={submitting}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}>
              Áp template
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: tạo template */}
      <Modal
        title={<span><PlusOutlined style={{ color: MATCHA_GREEN, marginRight: 8 }} />Tạo template tiêu chí mới</span>}
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); templateForm.resetFields(); }}
        footer={null}
        width={620}
        destroyOnClose
      >
        <Form form={templateForm} layout="vertical" onFinish={handleCreateTemplate} style={{ marginTop: 16 }}>
          <Form.Item
            label="Tên template"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên template' }]}
          >
            <Input placeholder="VD: Bộ tiêu chí Kế toán tổng hợp" />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} placeholder="Mô tả ngắn về template..." />
          </Form.Item>
          {templateItemsList}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={() => { setCreateModalOpen(false); templateForm.resetFields(); }}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={submitting}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}>
              Tạo template
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: sửa template */}
      <Modal
        title={<span><EditOutlined style={{ color: MATCHA_GREEN, marginRight: 8 }} />Chỉnh sửa template</span>}
        open={editTemplateModalOpen}
        onCancel={() => { setEditTemplateModalOpen(false); setSelectedTemplate(null); }}
        footer={null}
        width={620}
        destroyOnClose
      >
        <Form form={editTemplateForm} layout="vertical" onFinish={handleUpdateTemplate} style={{ marginTop: 16 }}>
          <Form.Item
            label="Tên template"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên template' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Đang hoạt động" name="active" valuePropName="checked">
            <Switch checkedChildren="Bật" unCheckedChildren="Ẩn" />
          </Form.Item>
          {templateItemsList}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={() => { setEditTemplateModalOpen(false); setSelectedTemplate(null); }}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>Lưu thay đổi</Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: chi tiết template */}
      <Modal
        title={<span><EyeOutlined style={{ color: MATCHA_GREEN, marginRight: 8 }} />Chi tiết template</span>}
        open={detailModalOpen}
        onCancel={() => { setDetailModalOpen(false); setSelectedTemplate(null); }}
        footer={[
          <Button key="close" onClick={() => { setDetailModalOpen(false); setSelectedTemplate(null); }}>Đóng</Button>,
        ]}
        width={560}
      >
        {selectedTemplate && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="Tên template">
                <Text strong>{selectedTemplate.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả">{selectedTemplate.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={selectedTemplate.active !== false ? 'success' : 'default'}>
                  {selectedTemplate.active !== false ? 'Hoạt động' : 'Đã ẩn'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
            {selectedTemplate.items?.length > 0 && (
              <Table
                style={{ marginTop: 16 }}
                size="small"
                pagination={false}
                rowKey="itemId"
                dataSource={selectedTemplate.items}
                columns={[
                  { title: 'Tiêu chí', dataIndex: 'name', key: 'name' },
                  { title: 'Trọng số', dataIndex: 'weight', key: 'weight', width: 90 },
                  { title: 'Điểm max', dataIndex: 'maxScore', key: 'maxScore', width: 90 },
                ]}
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default Criteria;
