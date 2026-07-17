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
  Slider,
  Space,
  message,
  Popconfirm,
  Tooltip,
  Row,
  Col,
  Descriptions,
  Divider,
  Tabs,
  Empty,
  InputNumber,
  Badge,
} from "antd";
import {
  PlusOutlined,
  CheckSquareOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  StarOutlined,
  EyeOutlined,
  SearchOutlined,
  SaveOutlined,
  RestOutlined,
} from "@ant-design/icons";
import { criteriaAPI, jobsAPI } from "../../services/api";
import "./css/Criteria.css";

const { Title, Text } = Typography;

const MATCHA_GREEN = "#5D8C3E";
const DRAFT_KEY = "criteria_template_draft";

// Auto-save hook
const useDraftSave = (storageKey) => {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTime, setDraftTime] = useState(null);
  const draftTimeoutRef = useRef(null);

  useEffect(() => {
    const savedDraft = localStorage.getItem(storageKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed && parsed.values && Object.keys(parsed.values).length > 0) {
          setHasDraft(true);
          setDraftTime(parsed.savedAt ? new Date(parsed.savedAt) : null);
        }
      } catch (e) {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  const saveDraft = useCallback(
    (values) => {
      if (values) {
        const draft = { values, savedAt: new Date().toISOString() };
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setHasDraft(true);
        setDraftTime(new Date());
      }
    },
    [storageKey],
  );

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasDraft(false);
    setDraftTime(null);
  }, [storageKey]);

  const getDraft = useCallback(() => {
    const savedDraft = localStorage.getItem(storageKey);
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft).values || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [storageKey]);

  return { hasDraft, draftTime, saveDraft, clearDraft, getDraft };
};

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

  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Draft auto-save
  const { hasDraft, draftTime, saveDraft, clearDraft, getDraft } =
    useDraftSave(DRAFT_KEY);

  useEffect(() => {
    fetchTemplates();
    fetchJobs();
    if (hasDraft) setShowDraftBanner(true);
  }, []);

  // Auto-save handler
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
    if (selectedJob) {
      fetchJobCriteria(selectedJob);
    } else {
      setJobCriteria([]);
    }
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
      if (!Array.isArray(data) && data.items) {
        data = data.items;
      }
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      message.error("Không thể tải danh sách tiêu chí");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobCriteria = async (jobId) => {
    try {
      const response = await criteriaAPI.getByJob(jobId);
      let data = response.data || [];
      if (!Array.isArray(data)) {
        data = data.criteria || [];
      }
      setJobCriteria(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching job criteria:", error);
      setJobCriteria([]);
    }
  };

  // View detail
  const handleViewDetail = async (record) => {
    try {
      const response = await criteriaAPI.getById(record.id);
      const data = response.data || record;
      setSelectedTemplate({
        id: data.id,
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        criteria: data.criteria || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
      setDetailModalOpen(true);
    } catch (error) {
      console.error("Error fetching template detail:", error);
      setSelectedTemplate({
        id: record.id,
        name: record.name,
        description: record.description,
        isActive: record.isActive,
        criteria: record.criteria || [],
      });
      setDetailModalOpen(true);
    }
  };

  // Edit flow
  const handleEditClick = (record) => {
    setSelectedTemplate(record);
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
      isActive: record.isActive,
    });
    setEditModalOpen(true);
  };

  const handleEditConfirm = () => {
    setEditConfirmModalOpen(true);
  };

  const handleUpdateTemplate = async () => {
    try {
      setSubmitting(true);
      const values = editForm.getFieldsValue();
      await criteriaAPI.updateTemplate(selectedTemplate.id, values);
      message.success("Cập nhật template thành công!");
      setEditModalOpen(false);
      setEditConfirmModalOpen(false);
      editForm.resetFields();
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error("Error updating template:", error);
      message.error("Không thể cập nhật template");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete flow
  const handleDeleteClick = (record) => {
    setSelectedTemplate(record);
    setDeleteConfirmModalOpen(true);
  };

  const handleDeleteTemplate = async () => {
    try {
      setSubmitting(true);
      await criteriaAPI.deleteTemplate(selectedTemplate.id);
      message.success("Xóa template thành công!");
      setDeleteConfirmModalOpen(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      message.error("Không thể xóa template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTemplate = async (values) => {
    try {
      setSubmitting(true);
      await criteriaAPI.createTemplate(values);
      message.success("Tạo template tiêu chí thành công!");
      setCreateModalOpen(false);
      clearDraft(); // Clear draft after success
      form.resetFields();
      fetchTemplates();
    } catch (error) {
      console.error("Error creating template:", error);
      message.error("Không thể tạo template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignToJob = async (values) => {
    try {
      setSubmitting(true);
      await criteriaAPI.addToJob(selectedJob, values);
      message.success("Gán tiêu chí thành công!");
      setAssignModalOpen(false);
      assignForm.resetFields();
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error("Error assigning criteria:", error);
      message.error("Không thể gán tiêu chí");
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

  const templateColumns = [
    {
      title: "Tên template",
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
      key: "criteriaCount",
      width: 120,
      render: (_, record) => (
        <Tag color="blue">{record.criteria?.length || 0} tiêu chí</Tag>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 120,
      render: (_, record) => (
        <Tag color={record.isActive !== false ? "success" : "default"}>
          {record.isActive !== false ? "Hoạt động" : "Tắt"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 200,
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

  const jobCriteriaColumns = [
    {
      title: "Tiêu chí",
      key: "name",
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {record.name || record.criterionName}
          </div>
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
          <Slider
            value={record.weight || 1}
            min={1}
            max={10}
            disabled
            style={{ marginBottom: 4 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Trọng số: {record.weight || 1}
          </Text>
        </div>
      ),
    },
    {
      title: "Điểm tối đa",
      dataIndex: "maxScore",
      key: "maxScore",
      width: 100,
      render: (score) => <Text strong>{score || 100}</Text>,
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
          onConfirm={() => handleRemoveFromJob(record.id)}
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

  // Filter templates by search
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
          <CheckSquareOutlined /> Template tiêu chí
        </span>
      ),
      children: (
        <>
          <div
            style={{
              marginBottom: 16,
              display: "flex",
              gap: 12,
              justifyContent: "flex-end",
            }}
          >
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
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: "Chưa có template tiêu chí nào" }}
          />
        </>
      ),
    },
    {
      key: "job-criteria",
      label: (
        <span>
          <StarOutlined /> Tiêu chí theo vị trí
        </span>
      ),
      children: (
        <>
          <div
            style={{
              marginBottom: 16,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <Select
              placeholder="Chọn vị trí"
              value={selectedJob}
              onChange={(val) => setSelectedJob(val)}
              style={{ width: 280 }}
              showSearch
              filterOption={(input, option) =>
                (option.label || "").toLowerCase().includes(input.toLowerCase())
              }
              options={jobs.map((job) => ({
                value: job.id || job.jobId,
                label: job.title,
              }))}
              allowClear
            />
            {selectedJob && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAssignModalOpen(true)}
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              >
                Gán tiêu chí
              </Button>
            )}
          </div>
          {selectedJob ? (
            <Table
              columns={jobCriteriaColumns}
              dataSource={jobCriteria}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: "Chưa có tiêu chí nào cho vị trí này" }}
            />
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "#8c8c8b" }}>
              Vui lòng chọn vị trí để xem tiêu chí
            </div>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="criteria-page">
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
            <Button
              size="small"
              onClick={handleDiscardDraft}
              icon={<RestOutlined />}
            >
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

      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Tiêu Chí Đánh Giá
          </Title>
          <Text type="secondary">
            Quản lý template và gán tiêu chí đánh giá cho vị trí tuyển dụng
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

      {/* Modal Tạo Template */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlusOutlined style={{ color: MATCHA_GREEN }} />
            Tạo template tiêu chí mới
          </div>
        }
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false); /* keep draft */
        }}
        footer={null}
        width={500}
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
            label="Tên template"
            name="name"
            rules={[{ required: true, message: "Vui lòng nhập tên template" }]}
          >
            <Input placeholder="VD: Template phỏng vấn kỹ thuật" />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} placeholder="Mô tả ngắn về template..." />
          </Form.Item>
          <Form.Item
            label="Trạng thái"
            name="isActive"
            initialValue={true}
            valuePropName="checked"
          >
            <Space>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <Text>Hoạt động</Text>
            </Space>
          </Form.Item>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
              Tạo template
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Xem Chi Tiết */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EyeOutlined style={{ color: MATCHA_GREEN }} />
            Chi tiết template
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
            <Descriptions
              column={1}
              bordered
              size="small"
              style={{ marginTop: 16 }}
            >
              <Descriptions.Item label="Tên template">
                <Text strong>{selectedTemplate.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả">
                {selectedTemplate.description || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag
                  color={
                    selectedTemplate.isActive !== false ? "success" : "default"
                  }
                >
                  {selectedTemplate.isActive !== false ? "Hoạt động" : "Tắt"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Số tiêu chí">
                {selectedTemplate.criteria?.length || 0} tiêu chí
              </Descriptions.Item>
              {selectedTemplate.createdAt && (
                <Descriptions.Item label="Ngày tạo">
                  {new Date(selectedTemplate.createdAt).toLocaleString("vi-VN")}
                </Descriptions.Item>
              )}
              {selectedTemplate.updatedAt && (
                <Descriptions.Item label="Cập nhật lần cuối">
                  {new Date(selectedTemplate.updatedAt).toLocaleString("vi-VN")}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedTemplate.criteria &&
              selectedTemplate.criteria.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>Danh sách tiêu chí:</Text>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    {selectedTemplate.criteria.map((c, idx) => (
                      <li key={idx}>
                        <Text>{c.name || c.criterionName}</Text>
                        <Text type="secondary">
                          {" "}
                          - Điểm tối đa: {c.maxScore || 100}
                        </Text>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </>
        )}
      </Modal>

      {/* Modal Chỉnh sửa */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EditOutlined style={{ color: MATCHA_GREEN }} />
            Chỉnh sửa template
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
        width={500}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item
            label="Tên template"
            name="name"
            rules={[{ required: true, message: "Vui lòng nhập tên template" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Trạng thái" name="isActive" valuePropName="checked">
            <Space>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <Text>Hoạt động</Text>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Xác nhận Chỉnh sửa */}
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
          Bạn có chắc chắn muốn chỉnh sửa template "{selectedTemplate?.name}"
          không?
        </p>
      </Modal>

      {/* Modal Xác nhận Xóa */}
      <Modal
        title="Xác nhận xóa template"
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
          <DeleteOutlined
            style={{ fontSize: 48, color: "#ff4d4f", marginBottom: 16 }}
          />
          <p>Bạn có chắc chắn muốn xóa template này không?</p>
          {selectedTemplate && (
            <div
              style={{
                background: "#f5f5f5",
                padding: 12,
                borderRadius: 8,
                marginTop: 16,
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

      {/* Modal Gán tiêu chí cho vị trí */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlusOutlined style={{ color: MATCHA_GREEN }} />
            Gán tiêu chí cho vị trí
          </div>
        }
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false);
          assignForm.resetFields();
        }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={handleAssignToJob}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            label="Chọn tiêu chí từ template"
            name="templateId"
            rules={[{ required: true, message: "Vui lòng chọn template" }]}
          >
            <Select
              placeholder="-- Chọn template --"
              showSearch
              options={templates
                .filter((t) => t.isActive !== false)
                .map((t) => ({
                  value: t.id,
                  label: `${t.name} (${t.criteria?.length || 0} tiêu chí)`,
                }))}
            />
          </Form.Item>
          <Form.Item label="Trọng số mặc định" name="weight" initialValue={5}>
            <Slider min={1} max={10} marks={{ 1: "1", 5: "5", 10: "10" }} />
          </Form.Item>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => setAssignModalOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            >
              Gán tiêu chí
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Criteria;
