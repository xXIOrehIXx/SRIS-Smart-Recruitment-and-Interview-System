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
  Tooltip,
  Row,
  Col,
  Statistic,
  Descriptions,
  InputNumber,
  Divider,
  Popconfirm,
  Badge,
} from "antd";
import {
  PlusOutlined,
  MailOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  CopyOutlined,
  FileTextOutlined,
  SearchOutlined,
  SaveOutlined,
  RestOutlined,
} from "@ant-design/icons";
import { mailTemplateAPI } from "../../services/api";
import "./css/MailTemplates.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = "#5D8C3E";
const DRAFT_KEY = "mail_template_draft";

// Custom hook for draft auto-save
const useDraftSave = (storageKey) => {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState(null);

  useEffect(() => {
    const savedDraft = localStorage.getItem(storageKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed && Object.keys(parsed).length > 0) {
          setHasDraft(true);
          setDraftData(parsed);
        }
      } catch (e) {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  const saveDraft = useCallback(
    (values) => {
      if (values) {
        localStorage.setItem(storageKey, JSON.stringify(values));
        setHasDraft(true);
        setDraftData(values);
      }
    },
    [storageKey],
  );

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasDraft(false);
    setDraftData(null);
  }, [storageKey]);

  const getDraft = useCallback(() => {
    const savedDraft = localStorage.getItem(storageKey);
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [storageKey]);

  return { hasDraft, draftData, saveDraft, clearDraft, getDraft };
};

const MailTemplates = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editConfirmModalOpen, setEditConfirmModalOpen] = useState(false);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // Draft auto-save hook
  const { hasDraft, draftData, saveDraft, clearDraft, getDraft } =
    useDraftSave(DRAFT_KEY);
  const draftTimeoutRef = useRef(null);

  const previewData = {
    candidateName: "Nguyễn Văn A",
    jobTitle: "Frontend Developer",
    companyName: "SRIS",
  };

  useEffect(() => {
    // Check for draft on mount
    if (hasDraft) {
      setShowDraftModal(true);
    }
    fetchTemplates();
  }, []);

  // Auto-save draft when form values change
  const handleDraftAutoSave = useCallback(
    (changedValues, allValues) => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
      draftTimeoutRef.current = setTimeout(() => {
        saveDraft(allValues);
      }, 1000);
    },
    [saveDraft],
  );

  // Restore draft into form
  const handleRestoreDraft = () => {
    const savedValues = getDraft();
    if (savedValues) {
      form.setFieldsValue(savedValues);
      message.success("Đã khôi phục dữ liệu đã lưu tạm");
    }
    setShowDraftModal(false);
  };

  // Discard draft and start fresh
  const handleDiscardDraft = () => {
    clearDraft();
    form.resetFields();
    message.info("Đã xóa dữ liệu tạm. Bắt đầu nhập mới.");
    setShowDraftModal(false);
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await mailTemplateAPI.getAll();
      let data = response.data || [];
      if (!Array.isArray(data) && data.items) {
        data = data.items;
      }
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      message.error("Không thể tải danh sách mẫu email");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  // View detail
  const handleViewDetail = async (record) => {
    try {
      const response = await mailTemplateAPI.getById(record.templateId || record.id);
      const data = response.data || record;
      setSelectedTemplate({
        id: data.templateId,
        name: data.name,
        subject: data.subject,
        type: data.type,
        body: data.body,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
      setDetailModalOpen(true);
    } catch (error) {
      console.error("Error fetching template detail:", error);
      setSelectedTemplate(record);
      setDetailModalOpen(true);
    }
  };

  // Edit flow
  const handleEditClick = (record) => {
    setSelectedTemplate(record);
    editForm.setFieldsValue({
      name: record.name,
      subject: record.subject,
      type: record.type,
      body: record.body,
    });
    setEditModalOpen(true);
  };

  const handleEditConfirm = () => {
    setEditConfirmModalOpen(true);
  };

  const handleUpdate = async () => {
    try {
      setSubmitting(true);
      const values = editForm.getFieldsValue();
      const payload = { ...values, isActive: true };
      await mailTemplateAPI.update(selectedTemplate.templateId || selectedTemplate.id, payload);
      message.success("Cập nhật mẫu email thành công!");
      setEditModalOpen(false);
      setEditConfirmModalOpen(false);
      editForm.resetFields();
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error("Error updating template:", error);
      const errMsg =
        error.response?.data?.errorMessage ||
        error.response?.data?.DevMsg ||
        error.response?.data?.message ||
        "Không thể cập nhật mẫu email";
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete flow
  const handleDeleteClick = (record) => {
    setSelectedTemplate(record);
    setDeleteConfirmModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      setSubmitting(true);
      await mailTemplateAPI.delete(selectedTemplate.templateId || selectedTemplate.id);
      message.success("Xóa mẫu email thành công!");
      setDeleteConfirmModalOpen(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      message.error("Không thể xóa mẫu email");
    } finally {
      setSubmitting(false);
    }
  };

  // Create — Form.Item đã đặt name="type"/"body" khớp DTO EmailTemplateUpsertDto,
  // nên gửi thẳng `values` lên BE. isActive luôn true.
  const handleCreate = async (values) => {
    try {
      setSubmitting(true);
      const payload = { ...values, isActive: true };
      await mailTemplateAPI.create(payload);
      message.success("Tạo mẫu email thành công!");
      setCreateModalOpen(false);
      clearDraft(); // Clear draft after successful submission
      form.resetFields();
      fetchTemplates();
    } catch (error) {
      console.error("Error creating template:", error);
      const errMsg =
        error.response?.data?.errorMessage ||
        error.response?.data?.DevMsg ||
        error.response?.data?.message ||
        "Không thể tạo mẫu email";
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Duplicate
  const handleDuplicate = (record) => {
    clearDraft(); // Clear old draft when duplicating
    form.setFieldsValue({
      name: `${record.name || ""} (Copy)`,
      subject: record.subject,
      type: record.type,
      body: record.body,
    });
    setCreateModalOpen(true);
  };

  const filteredTemplates = templates.filter(
    (t) =>
      !searchText ||
      (t.name || "").toLowerCase().includes(searchText.toLowerCase()) ||
      (t.subject || "").toLowerCase().includes(searchText.toLowerCase()),
  );

  const renderPreview = (body) => {
    let preview = body || "";
    Object.entries(previewData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, "g"), value);
    });
    return preview;
  };

  const templateCategories = [
    { value: "SCHEDULE", label: "Mời chọn lịch phỏng vấn", color: "blue" },
    { value: "OFFER_RESPONSE", label: "Phản hồi offer", color: "green" },
    { value: "STATUS", label: "Trạng thái hồ sơ", color: "cyan" },
    { value: "REJECTED", label: "Thông báo từ chối", color: "red" },
    {
      value: "HIRED",
      label: "Thông báo nhận việc",
      color: "gold",
    },
    {
      value: "INTERVIEW_CONFIRMED",
      label: "Xác nhận lịch phỏng vấn",
      color: "orange",
    },
    {
      value: "INTERVIEW_CANCELLED",
      label: "Hủy lịch phỏng vấn",
      color: "volcano",
    },
  ];

  const getCategoryTag = (category) => {
    const cat = templateCategories.find((c) => c.value === category);
    return <Tag color={cat?.color || "default"}>{cat?.label || category}</Tag>;
  };

  const columns = [
    {
      title: "Tên mẫu",
      key: "name",
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.subject}
          </Text>
        </div>
      ),
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 180,
      render: (category) => getCategoryTag(category),
      filters: templateCategories.map((c) => ({
        text: c.label,
        value: c.value,
      })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 130,
      render: (date) =>
        date ? new Date(date).toLocaleDateString("vi-VN") : "N/A",
      sorter: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
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
          <Tooltip title="Sao chép">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleDuplicate(record)}
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

  return (
    <div className="mail-templates-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Mẫu Email
          </Title>
          <Text type="secondary">Quản lý các mẫu email gửi cho ứng viên</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchTemplates}
            loading={loading}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={hasDraft ? <SaveOutlined /> : <PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
          >
            Tạo Mẫu Mới {hasDraft && <Badge status="warning" />}
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {templateCategories.slice(0, 4).map((cat, idx) => {
          const count = templates.filter(
            (t) => t.type === cat.value,
          ).length;
          return (
            <Col xs={12} sm={6} key={idx}>
              <Card className="stat-card" bordered={false}>
                <Statistic
                  title={
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {cat.label}
                    </Text>
                  }
                  value={count}
                  valueStyle={{
                    color: cat.color === "default" ? "#8c8c8b" : "#1a1a1a",
                    fontWeight: 700,
                  }}
                  prefix={<MailOutlined style={{ color: MATCHA_GREEN }} />}
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card className="main-card" bordered={false}>
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Input
            placeholder="Tìm kiếm mẫu email..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredTemplates}
          rowKey="templateId"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} mẫu`,
          }}
          locale={{ emptyText: "Chưa có mẫu email nào" }}
        />
      </Card>

      {/* Modal Tạo Mẫu Email */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlusOutlined style={{ color: MATCHA_GREEN }} />
            Tạo mẫu email mới
          </div>
        }
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          // Don't clear form - keep draft
        }}
        footer={null}
        width={640}
      >
        {hasDraft && (
          <div
            style={{
              background: "#fffbe6",
              border: "1px solid #ffe58f",
              borderRadius: 6,
              padding: "10px 12px",
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text type="secondary">
              <SaveOutlined style={{ color: "#faad14", marginRight: 8 }} />
              Có dữ liệu được lưu tạm
            </Text>
            <Space>
              <Button
                size="small"
                onClick={handleDiscardDraft}
                icon={<RestOutlined />}
              >
                Xóa
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={handleRestoreDraft}
                icon={<SaveOutlined />}
              >
                Khôi phục
              </Button>
            </Space>
          </div>
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          onValuesChange={handleDraftAutoSave}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="Tên mẫu"
            name="name"
            rules={[{ required: true, message: "Vui lòng nhập tên mẫu" }]}
          >
            <Input placeholder="VD: Email mời phỏng vấn" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Chủ đề email"
                name="subject"
                rules={[{ required: true, message: "Vui lòng nhập chủ đề" }]}
              >
                <Input placeholder="VD: Lời mời phỏng vấn tại SRIS" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Loại mẫu"
                name="type"
                rules={[{ required: true, message: "Vui lòng chọn loại mẫu" }]}
              >
                <Select placeholder="-- Chọn loại --">
                  {templateCategories.map((cat) => (
                    <Select.Option key={cat.value} value={cat.value}>
                      {cat.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Nội dung email"
            name="body"
            rules={[{ required: true, message: "Vui lòng nhập nội dung" }]}
          >
            <TextArea rows={12} placeholder="Nhập nội dung email..." />
          </Form.Item>

          <div
            style={{
              background: "#f5f5f4",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              <b>Biến sử dụng:</b> {"{{candidateName}}"} - Tên ứng viên,{" "}
              {"{{jobTitle}}"} - Vị trí ứng tuyển, {"{{companyName}}"} - Tên
              công ty, {"{{interviewDate}}"} - Ngày phỏng vấn,{" "}
              {"{{interviewTime}}"} - Giờ phỏng vấn
            </Text>
          </div>

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
              {submitting ? "Đang tạo..." : "Tạo mẫu"}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Xem Chi Tiết */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EyeOutlined style={{ color: MATCHA_GREEN }} />
            Chi tiết mẫu email
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
        width={640}
      >
        {selectedTemplate && (
          <>
            <Descriptions
              column={1}
              bordered
              size="small"
              style={{ marginTop: 16 }}
            >
              <Descriptions.Item label="Tên mẫu">
                <Text strong>{selectedTemplate.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Chủ đề">
                {selectedTemplate.subject}
              </Descriptions.Item>
              <Descriptions.Item label="Loại">
                {getCategoryTag(selectedTemplate.type)}
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

            <Divider orientation="left">Nội dung email</Divider>
            <div
              style={{
                background: "#fff",
                border: "1px solid #e7e7e6",
                borderRadius: 12,
                padding: 24,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  borderBottom: "1px solid #e7e7e6",
                  paddingBottom: 12,
                  marginBottom: 16,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Chủ đề:
                </Text>
                <div style={{ fontWeight: 600 }}>
                  {selectedTemplate.subject}
                </div>
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                  fontSize: 14,
                  color: "#4a4a4a",
                }}
              >
                {renderPreview(selectedTemplate.body)}
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Modal Chỉnh sửa */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EditOutlined style={{ color: MATCHA_GREEN }} />
            Chỉnh sửa mẫu email
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
        width={640}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item
            label="Tên mẫu"
            name="name"
            rules={[{ required: true, message: "Vui lòng nhập tên mẫu" }]}
          >
            <Input placeholder="VD: Email mời phỏng vấn" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Chủ đề email"
                name="subject"
                rules={[{ required: true, message: "Vui lòng nhập chủ đề" }]}
              >
                <Input placeholder="VD: Lời mời phỏng vấn tại SRIS" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Loại mẫu"
                name="type"
                rules={[{ required: true, message: "Vui lòng chọn loại mẫu" }]}
              >
                <Select placeholder="-- Chọn loại --">
                  {templateCategories.map((cat) => (
                    <Select.Option key={cat.value} value={cat.value}>
                      {cat.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Nội dung email"
            name="body"
            rules={[{ required: true, message: "Vui lòng nhập nội dung" }]}
          >
            <TextArea rows={10} placeholder="Nhập nội dung email..." />
          </Form.Item>

          <div style={{ background: "#f5f5f4", padding: 12, borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <b>Biến sử dụng:</b> {"{{candidateName}}"}, {"{{jobTitle}}"},{" "}
              {"{{companyName}}"}, {"{{interviewDate}}"}, {"{{interviewTime}}"}
            </Text>
          </div>
        </Form>
      </Modal>

      {/* Modal Xác nhận Chỉnh sửa */}
      <Modal
        title="Xác nhận chỉnh sửa"
        open={editConfirmModalOpen}
        onCancel={() => setEditConfirmModalOpen(false)}
        onOk={handleUpdate}
        okText="Xác nhận"
        cancelText="Hủy"
        okButtonProps={{ loading: submitting }}
      >
        <p>
          Bạn có chắc chắn muốn chỉnh sửa mẫu email "{selectedTemplate?.name}"
          không?
        </p>
      </Modal>

      {/* Modal Xác nhận Xóa */}
      <Modal
        title="Xác nhận xóa mẫu email"
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
            onClick={handleDelete}
          >
            Xóa
          </Button>,
        ]}
      >
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <DeleteOutlined
            style={{ fontSize: 48, color: "#ff4d4f", marginBottom: 16 }}
          />
          <p>Bạn có chắc chắn muốn xóa mẫu email này không?</p>
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
                <strong>Chủ đề:</strong> {selectedTemplate.subject}
              </p>
              <p>
                <strong>Loại:</strong>{" "}
                {getCategoryTag(selectedTemplate.type)}
              </p>
            </div>
          )}
          <p style={{ color: "#ff4d4f", marginTop: 16 }}>
            Hành động này không thể hoàn tác.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default MailTemplates;
