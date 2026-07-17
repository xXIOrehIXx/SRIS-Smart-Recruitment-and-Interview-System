import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  Typography,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Popconfirm,
  Tooltip,
  Divider,
  Tabs,
  InputNumber,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
  SaveOutlined,
  RestOutlined,
  CheckCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { criteriaAPI, jobsAPI } from "../../services/api";
import "./css/Criteria.css";

const { Title, Text } = Typography;
const MATCHA_GREEN = "#5D8C3E";
const DRAFT_KEY = "criteria_template_draft";

const Criteria = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [jobCriteria, setJobCriteria] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchText, setSearchText] = useState("");

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editConfirmModalOpen, setEditConfirmModalOpen] = useState(false);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftTimeoutRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Draft auto-save
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTime, setDraftTime] = useState(null);

  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed && parsed.values && Object.keys(parsed.values).length > 0) {
          setHasDraft(true);
          setDraftTime(parsed.savedAt ? new Date(parsed.savedAt) : null);
        }
      } catch (e) {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  const saveDraft = useCallback((values) => {
    if (values) {
      const draft = { values, savedAt: new Date().toISOString() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setHasDraft(true);
      setDraftTime(new Date());
    }
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
    setDraftTime(null);
  }, []);

  const getDraft = useCallback(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft).values || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchJobs();
    if (hasDraft) setShowDraftBanner(true);
  }, []);

  const handleDraftAutoSave = useCallback(
    (changedValues, allValues) => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
      draftTimeoutRef.current = setTimeout(() => saveDraft(allValues), 1500);
    },
    [saveDraft],
  );

  const handleRestoreDraft = () => {
    const savedValues = getDraft();
    if (savedValues) {
      form.setFieldsValue(savedValues);
      message.success("Đã khôi phục dữ liệu đã lưu tạm");
    }
    setShowDraftBanner(false);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    message.info("Đã xóa dữ liệu tạm");
    setShowDraftBanner(false);
  };

  useEffect(() => {
    if (selectedJob) fetchJobCriteria(selectedJob);
    else setJobCriteria([]);
  }, [selectedJob]);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await criteriaAPI.getTemplates();
      let data = response.data || [];
      // Map templateId -> id for AntD Table rowKey compatibility
      const mapped = Array.isArray(data)
        ? data.map((t) => ({
            ...t,
            id: t.templateId,
            items: t.items || [],
            active: t.active !== undefined ? t.active : t.active,
          }))
        : [];
      setTemplates(mapped);
    } catch (error) {
      console.error("Error fetching templates:", error);
      message.error("Không thể tải danh sách khuôn tiêu chí");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobCriteria = async (jobId) => {
    try {
      const response = await criteriaAPI.getByJob(jobId);
      let data = response.data || [];
      if (!Array.isArray(data)) data = data.criteria || [];
      setJobCriteria(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching job criteria:", error);
      setJobCriteria([]);
    }
  };

  // View detail — BE trả: templateId, name, description, active, items:[{itemId, name, weight, maxScore, displayOrder}]
  const handleViewDetail = async (record) => {
    try {
      const response = await criteriaAPI.getById(record.templateId);
      const data = response.data || record;
      setSelectedTemplate({
        templateId: data.templateId,
        name: data.name,
        description: data.description,
        active: data.active,
        items: data.items || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
      setDetailModalOpen(true);
    } catch (error) {
      console.error("Error fetching template detail:", error);
      setSelectedTemplate({
        templateId: record.templateId,
        name: record.name,
        description: record.description,
        active: record.active,
        items: record.items || [],
      });
      setDetailModalOpen(true);
    }
  };

  // Edit click — map items sang form field name
  const handleEditClick = (record) => {
    setSelectedTemplate(record);
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
      active: record.active !== false,
      items: (record.items || []).map((it) => ({
        name: it.name,
        weight: it.weight || 1,
        maxScore: it.maxScore || 10,
      })),
    });
    setEditModalOpen(true);
  };

  const handleEditConfirm = () => setEditConfirmModalOpen(true);

  // Update template — DTO: CriteriaTemplateUpdateDto { name, description, active, items }
  const handleUpdateTemplate = async () => {
    try {
      setSubmitting(true);
      const values = editForm.getFieldsValue();
      const payload = {
        name: values.name,
        description: values.description,
        active: values.active !== false,
        items: (values.items || []).map((it, idx) => ({
          name: it.name,
          weight: it.weight || 1,
          maxScore: it.maxScore || 10,
        })),
      };
      await criteriaAPI.updateTemplate(selectedTemplate.templateId, payload);
      message.success("Cập nhật khuôn tiêu chí thành công!");
      setEditModalOpen(false);
      setEditConfirmModalOpen(false);
      editForm.resetFields();
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error("Error updating template:", error);
      message.error("Không thể cập nhật khuôn tiêu chí");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete — soft delete (deactivate)
  const handleDeleteClick = (record) => {
    setSelectedTemplate(record);
    setDeleteConfirmModalOpen(true);
  };

  const handleDeleteTemplate = async () => {
    try {
      setSubmitting(true);
      await criteriaAPI.deleteTemplate(selectedTemplate.templateId);
      message.success("Xóa khuôn tiêu chí thành công!");
      setDeleteConfirmModalOpen(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      message.error("Không thể xóa khuôn tiêu chí");
    } finally {
      setSubmitting(false);
    }
  };

  // Create template — DTO: CriteriaTemplateInputDto { name, description, items }
  const handleCreateTemplate = async (values) => {
    try {
      setSubmitting(true);
      const payload = {
        name: values.name,
        description: values.description,
        items: (values.items || []).map((it) => ({
          name: it.name,
          weight: it.weight || 1,
          maxScore: it.maxScore || 10,
        })),
      };
      await criteriaAPI.createTemplate(payload);
      message.success("Tạo khuôn tiêu chí thành công!");
      setCreateModalOpen(false);
      clearDraft();
      form.resetFields();
      fetchTemplates();
    } catch (error) {
      console.error("Error creating template:", error);
      const errMsg =
        error.response?.data?.errorMessage ||
        error.response?.data?.DevMsg ||
        error.response?.data?.message ||
        "Không thể tạo khuôn tiêu chí";
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Assign template to job — POST /criteria-templates/{templateId}/apply/{jobId}
  const handleAssignToJob = async (values) => {
    try {
      setSubmitting(true);
      await criteriaAPI.applyToJob(values.templateId, selectedJob);
      message.success("Áp dụng khuôn tiêu chí vào vị trí thành công!");
      setAssignModalOpen(false);
      assignForm.resetFields();
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error("Error assigning template:", error);
      const errMsg =
        error.response?.data?.errorMessage ||
        error.response?.data?.DevMsg ||
        error.response?.data?.message ||
        "Không thể áp dụng khuôn tiêu chí";
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveFromJob = async (criteriaId) => {
    try {
      await criteriaAPI.removeFromJob(criteriaId);
      message.success("Đã xóa tiêu chí khỏi vị trí");
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error("Error removing criteria:", error);
      message.error("Không thể xóa tiêu chí");
    }
  };

  // Table columns — templates list (CriteriaTemplateSummaryDto: templateId, name, description, active, itemCount)
  const templateColumns = [
    {
      title: "Tên khuôn",
      key: "name",
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description}
          </Text>
        </div>
      ),
    },
    {
      title: "Số tiêu chí",
      key: "itemCount",
      width: 120,
      render: (_, record) => (
        <Tag color="blue">{record.itemCount || record.items?.length || 0} tiêu chí</Tag>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 120,
      render: (_, record) => (
        <Tag color={record.active !== false ? "success" : "default"}>
          {record.active !== false ? "Hoạt động" : "Tắt"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteClick(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Table columns — job criteria (CriteriaDto: criteriaId, jobId, name, weight, maxScore, active)
  const jobCriteriaColumns = [
    {
      title: "Tiêu chí",
      key: "name",
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description}
          </Text>
        </div>
      ),
    },
    {
      title: "Trọng số",
      key: "weight",
      width: 160,
      render: (_, record) => (
        <div>
          <Space direction="vertical" size={0}>
            <Text strong>{record.weight || 1}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              / 10
            </Text>
          </Space>
        </div>
      ),
    },
    {
      title: "Điểm tối đa",
      dataIndex: "maxScore",
      key: "maxScore",
      width: 100,
      render: (score) => <Text strong>{score || 10}</Text>,
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      width: 200,
      ellipsis: true,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="Xóa tiêu chí này?"
          onConfirm={() => handleRemoveFromJob(record.criteriaId)}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />}>
            Xóa
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const filteredTemplates = templates.filter(
    (t) =>
      !searchText ||
      (t.name || "").toLowerCase().includes(searchText.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(searchText.toLowerCase()),
  );

  const tabItems = [
    {
      key: "templates",
      label: (
        <span>
          <CheckCircleOutlined /> Khuôn tiêu chí
        </span>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Input
              placeholder="Tìm kiếm khuôn..."
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
              Tạo khuôn mới
            </Button>
          </div>
          <Table
            columns={templateColumns}
            dataSource={filteredTemplates}
            rowKey="templateId"
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: "Chưa có khuôn tiêu chí nào" }}
          />
        </>
      ),
    },
    {
      key: "job-criteria",
      label: (
        <span>
          <CheckCircleOutlined /> Tiêu chí theo vị trí
        </span>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
            <Select
              placeholder="Chọn vị trí"
              value={selectedJob}
              onChange={(val) => setSelectedJob(val)}
              style={{ width: 280 }}
              showSearch
              allowClear
              filterOption={(input, option) =>
                (option.label || "").toLowerCase().includes(input.toLowerCase())
              }
              options={jobs.map((job) => ({
                value: job.jobId || job.id,
                label: job.title,
              }))}
            />
            {selectedJob && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAssignModalOpen(true)}
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              >
                Áp khuôn tiêu chí
              </Button>
            )}
          </div>
          {selectedJob ? (
            <Table
              columns={jobCriteriaColumns}
              dataSource={jobCriteria}
              rowKey="criteriaId"
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: "Chưa có tiêu chí nào cho vị trí này" }}
            />
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "#8c8c8c" }}>
              Vui lòng chọn vị trí để xem tiêu chí
            </div>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="criteria-page">
      {/* Draft banner */}
      {showDraftBanner && (
        <div
          style={{
            background: "#fffbe6",
            border: "1px solid #ffe58f",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <Text strong style={{ color: "#ad6800" }}>
              <SaveOutlined style={{ marginRight: 8 }} />
              Dữ liệu đã được lưu tạm{" "}
              {draftTime && `lúc ${draftTime.toLocaleTimeString("vi-VN")}`}
            </Text>
          </div>
          <Space>
            <Button size="small" onClick={handleDiscardDraft} icon={<RestOutlined />}>
              Bỏ qua
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={handleRestoreDraft}
              icon={<CheckCircleOutlined />}
              style={{ background: "#faad14", borderColor: "#faad14" }}
            >
              Khôi phục
            </Button>
          </Space>
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Tiêu Chí Đánh Giá
          </Title>
          <Text type="secondary">
            Quản lý khuôn tiêu chí và áp dụng cho vị trí tuyển dụng
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            fetchTemplates();
            if (selectedJob) fetchJobCriteria(selectedJob);
          }}
          loading={loading}
        >
          Làm mới
        </Button>
      </div>

      <Card className="main-card" bordered={false}>
        <Tabs items={tabItems} />
      </Card>

      {/* ===== Modal Tạo Khuôn ===== */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlusOutlined style={{ color: MATCHA_GREEN }} />
            Tạo khuôn tiêu chí mới
          </div>
        }
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {hasDraft && (
          <div
            style={{
              background: "#fffbe6",
              border: "1px solid #ffe58f",
              borderRadius: 6,
              padding: "8px 12px",
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              <SaveOutlined style={{ color: "#faad14", marginRight: 6 }} />
              Có dữ liệu được lưu tạm
            </Text>
            <Space size={4}>
              <Button size="small" onClick={handleDiscardDraft}>
                Xóa
              </Button>
              <Button size="small" type="primary" onClick={handleRestoreDraft}>
                Khôi phục
              </Button>
            </Space>
          </div>
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTemplate}
          onValuesChange={handleDraftAutoSave}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="Tên khuôn"
            name="name"
            rules={[{ required: true, message: "Vui lòng nhập tên khuôn" }]}
          >
            <Input placeholder="VD: Khung phỏng vấn kỹ thuật" />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} placeholder="Mô tả ngắn về khuôn tiêu chí..." />
          </Form.Item>

          <Divider orientation="left" plain style={{ fontSize: 13 }}>
            Danh sách tiêu chí
          </Divider>

          <Form.List name="items" initialValue={[{ name: "", weight: 1, maxScore: 10 }]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }, index) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      marginBottom: 8,
                      padding: "8px 12px",
                      background: "#fafafa",
                      borderRadius: 8,
                      border: "1px solid #f0f0f0",
                    }}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, "name"]}
                      style={{ flex: 2, marginBottom: 0 }}
                      rules={[{ required: true, message: "Tên tiêu chí" }]}
                    >
                      <Input placeholder="Tên tiêu chí (VD: Kiến thức chuyên môn)" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, "weight"]}
                      initialValue={1}
                      style={{ flex: 1, marginBottom: 0 }}
                    >
                      <InputNumber min={1} max={10} placeholder="Trọng số" style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, "maxScore"]}
                      initialValue={10}
                      style={{ flex: 1, marginBottom: 0 }}
                    >
                      <InputNumber min={1} max={100} placeholder="Điểm tối đa" style={{ width: "100%" }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                        style={{ marginTop: 2 }}
                      />
                    )}
                  </div>
                ))}
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button
                    type="dashed"
                    onClick={() => add({ name: "", weight: 1, maxScore: 10 })}
                    block
                    icon={<PlusOutlined />}
                  >
                    Thêm tiêu chí
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
            <Button
              onClick={() => {
                clearDraft();
                setCreateModalOpen(false);
                form.resetFields();
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            >
              Tạo khuôn
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ===== Modal Chi tiết ===== */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EyeOutlined style={{ color: MATCHA_GREEN }} />
            Chi tiết khuôn tiêu chí
          </div>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setDetailModalOpen(false);
              setTimeout(() => handleEditClick(selectedTemplate), 100);
            }}
          >
            Chỉnh sửa
          </Button>,
        ]}
        width={600}
      >
        {selectedTemplate && (
          <>
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 15 }}>{selectedTemplate.name}</Text>
                <Tag
                  color={selectedTemplate.active !== false ? "success" : "default"}
                  style={{ marginLeft: 8 }}
                >
                  {selectedTemplate.active !== false ? "Hoạt động" : "Tắt"}
                </Tag>
              </div>
              {selectedTemplate.description && (
                <Text type="secondary">{selectedTemplate.description}</Text>
              )}
            </div>

            <Divider />

            <Text strong>Danh sách tiêu chí ({selectedTemplate.items?.length || 0})</Text>
            {selectedTemplate.items && selectedTemplate.items.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                {selectedTemplate.items
                  .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                  .map((item, idx) => (
                    <div
                      key={item.itemId || idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: idx % 2 === 0 ? "#fafafa" : "#fff",
                        borderRadius: 6,
                        marginBottom: 4,
                      }}
                    >
                      <div>
                        <Text strong>{item.name}</Text>
                      </div>
                      <Space size={16}>
                        <Text type="secondary">
                          Trọng số: <Text strong>{item.weight || 1}</Text>
                        </Text>
                        <Text type="secondary">
                          Điểm tối đa: <Text strong>{item.maxScore || 10}</Text>
                        </Text>
                      </Space>
                    </div>
                  ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 20, color: "#bfbfbf" }}>
                Chưa có tiêu chí nào
              </div>
            )}

            {(selectedTemplate.createdAt || selectedTemplate.updatedAt) && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedTemplate.createdAt && `Tạo: ${new Date(selectedTemplate.createdAt).toLocaleString("vi-VN")}`}
                  {selectedTemplate.createdAt && selectedTemplate.updatedAt && " · "}
                  {selectedTemplate.updatedAt && `Cập nhật: ${new Date(selectedTemplate.updatedAt).toLocaleString("vi-VN")}`}
                </Text>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ===== Modal Chỉnh sửa ===== */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EditOutlined style={{ color: MATCHA_GREEN }} />
            Chỉnh sửa khuôn tiêu chí
          </div>
        }
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => setEditModalOpen(false)}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={submitting}
            onClick={handleEditConfirm}
          >
            Lưu thay đổi
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item
            label="Tên khuôn"
            name="name"
            rules={[{ required: true, message: "Vui lòng nhập tên khuôn" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Trạng thái" name="active" valuePropName="checked" initialValue={true}>
            <Space>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <Text>Hoạt động</Text>
            </Space>
          </Form.Item>

          <Divider orientation="left" plain style={{ fontSize: 13 }}>
            Danh sách tiêu chí
          </Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      marginBottom: 8,
                      padding: "8px 12px",
                      background: "#fafafa",
                      borderRadius: 8,
                      border: "1px solid #f0f0f0",
                    }}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, "name"]}
                      style={{ flex: 2, marginBottom: 0 }}
                      rules={[{ required: true, message: "Tên tiêu chí" }]}
                    >
                      <Input placeholder="Tên tiêu chí" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, "weight"]}
                      style={{ flex: 1, marginBottom: 0 }}
                    >
                      <InputNumber min={1} max={10} placeholder="Trọng số" style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, "maxScore"]}
                      style={{ flex: 1, marginBottom: 0 }}
                    >
                      <InputNumber min={1} max={100} placeholder="Điểm tối đa" style={{ width: "100%" }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                        style={{ marginTop: 2 }}
                      />
                    )}
                  </div>
                ))}
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button
                    type="dashed"
                    onClick={() => add({ name: "", weight: 1, maxScore: 10 })}
                    block
                    icon={<PlusOutlined />}
                  >
                    Thêm tiêu chí
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* ===== Modal Xác nhận chỉnh sửa ===== */}
      <Modal
        title="Xác nhận chỉnh sửa"
        open={editConfirmModalOpen}
        onCancel={() => setEditConfirmModalOpen(false)}
        onOk={handleUpdateTemplate}
        okText="Xác nhận"
        cancelText="Hủy"
        okButtonProps={{ loading: submitting }}
      >
        <p>
          Bạn có chắc chắn muốn lưu thay đổi cho khuôn "
          <strong>{selectedTemplate?.name}</strong>"?
        </p>
      </Modal>

      {/* ===== Modal Xác nhận xóa ===== */}
      <Modal
        title="Xác nhận xóa khuôn tiêu chí"
        open={deleteConfirmModalOpen}
        onCancel={() => setDeleteConfirmModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setDeleteConfirmModalOpen(false)}>
            Hủy
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            loading={submitting}
            onClick={handleDeleteTemplate}
          >
            Xóa
          </Button>,
        ]}
      >
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <DeleteOutlined style={{ fontSize: 48, color: "#ff4d4f", marginBottom: 16 }} />
          <p>Bạn có chắc chắn muốn xóa khuôn tiêu chí này không?</p>
          {selectedTemplate && (
            <div
              style={{
                background: "#f5f5f5",
                padding: 12,
                borderRadius: 8,
                marginTop: 16,
                textAlign: "left",
              }}
            >
              <p>
                <strong>Tên:</strong> {selectedTemplate.name}
              </p>
              <p>
                <strong>Mô tả:</strong> {selectedTemplate.description || "-"}
              </p>
            </div>
          )}
          <p style={{ color: "#ff4d4f", marginTop: 16 }}>
            Hành động này không thể hoàn tác.
          </p>
        </div>
      </Modal>

      {/* ===== Modal Áp khuôn tiêu chí vào vị trí ===== */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlusOutlined style={{ color: MATCHA_GREEN }} />
            Áp khuôn tiêu chí vào vị trí
          </div>
        }
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false);
          assignForm.resetFields();
        }}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={handleAssignToJob}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            label="Chọn khuôn tiêu chí"
            name="templateId"
            rules={[{ required: true, message: "Vui lòng chọn khuôn tiêu chí" }]}
          >
            <Select
              placeholder="-- Chọn khuôn --"
              showSearch
              options={templates
                .filter((t) => t.active !== false)
                .map((t) => ({
                  value: t.templateId,
                  label: `${t.name} (${t.itemCount || t.items?.length || 0} tiêu chí)`,
                }))}
            />
          </Form.Item>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => setAssignModalOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            >
              Áp dụng
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Criteria;
