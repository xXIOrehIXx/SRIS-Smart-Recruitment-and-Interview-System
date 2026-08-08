import React, { useState, useEffect } from "react";
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
  Divider,
  Alert,
} from "antd";
import {
  MailOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { mailTemplateAPI } from "../../services/api";
import EmailContentEditor, { fillSampleValues } from "../../components/EmailContentEditor";
import "./css/MailTemplates.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = "#5D8C3E";

// BE NotificationService.cs truyền các placeholder này theo từng trigger.
// Liệt kê trong UI để Human Resource khỏi gõ {{companyName}} / {{interviewDate}} sai.
const codeStyle = {
  background: "#fff",
  border: "1px solid #e7e7e6",
  borderRadius: 4,
  padding: "0 4px",
  fontFamily: "monospace",
  fontSize: 11,
};

const MailTemplates = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [loadingDefault, setLoadingDefault] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editConfirmModalOpen, setEditConfirmModalOpen] = useState(false);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [editForm] = Form.useForm();

  const previewData = {
    candidateName: "Nguyễn Văn A",
    jobTitle: "Frontend Developer",
    companyName: "SRIS",
  };

  // Danh sách 7 loại email template (khớp backend EmailTemplateType.cs).
  // Đặt ở đầu component để mọi computed bên dưới (missingTypes, columns, stats) đều
  // dùng được — nếu khai báo sau khi đã tham chiếu sẽ nổ TypeError.
  const templateCategories = [
    { value: "SCHEDULE", label: "Mời chọn lịch phỏng vấn", color: "blue" },
    // Thư mời nhận việc do hệ thống tự soạn từ form gửi thư mời -> KHÔNG tính là thiếu mẫu.
    // Vẫn để trong danh sách vì công ty nào muốn tự viết lời thư thì tạo mẫu đè lên được.
    { value: "OFFER_RESPONSE", label: "Thư mời nhận việc", color: "green", optional: true },
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
    {
      value: "ONBOARDING",
      label: "Chào mừng nhận việc (onboarding)",
      color: "purple",
    },
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

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
  // Tạo mẫu mới: dùng lại đúng modal chỉnh sửa, chỉ khác là chưa có template nào được chọn.
  const handleCreateClick = (presetType) => {
    setSelectedTemplate(null);
    editForm.resetFields();
    if (presetType) editForm.setFieldsValue({ type: presetType });
    setEditModalOpen(true);
  };

  // Công ty mới đã được tạo sẵn bộ mẫu lúc đăng ký; nút này để công ty cũ (hoặc ai lỡ xoá)
  // dựng lại phần còn thiếu.
  const seedDefaults = async () => {
    try {
      setLoadingDefault(true);
      const res = await mailTemplateAPI.seedDefaults();
      const added = res.data?.added ?? 0;
      message.success(added > 0 ? `Đã tạo ${added} mẫu email dựng sẵn.` : "Đã có đủ mẫu, không thiếu loại nào.");
      fetchTemplates();
    } catch (error) {
      console.error("seedDefaults error", error);
      message.error("Không tạo được bộ mẫu dựng sẵn.");
    } finally {
      setLoadingDefault(false);
    }
  };

  // Xem thử: điền dữ liệu mẫu vào các chỗ tự động, hiện đúng như ứng viên sẽ thấy.
  const openPreview = () => {
    setPreviewHtml(fillSampleValues(editForm.getFieldValue("body") || ""));
    setPreviewOpen(true);
  };

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

  // Điền sẵn khung mẫu do backend giữ (hiện có cho ONBOARDING) — HR chỉ việc sửa
  // các chỗ trong [ngoặc vuông] thay vì tự viết một email HTML từ số 0.
  const applyDefaultTemplate = async () => {
    const type = editForm.getFieldValue("type");
    if (!type) {
      message.warning("Chọn loại mẫu trước đã.");
      return;
    }
    try {
      setLoadingDefault(true);
      const res = await mailTemplateAPI.getDefault(type);
      const { subject, body } = res.data || {};
      if (!body) {
        message.info("Loại mẫu này chưa có khung sẵn.");
        return;
      }
      editForm.setFieldsValue({ body, subject: editForm.getFieldValue("subject") || subject });
      message.success("Đã điền khung mẫu — sửa các chỗ trong [ngoặc vuông] cho đúng công ty bạn.");
    } catch (error) {
      console.error("getDefault error", error);
      message.error("Không lấy được mẫu có sẵn.");
    } finally {
      setLoadingDefault(false);
    }
  };

  const handleEditConfirm = () => {
    setEditConfirmModalOpen(true);
  };

  const handleUpdate = async () => {
    try {
      setSubmitting(true);
      const values = editForm.getFieldsValue();
      const payload = { ...values, isActive: true };

      if (selectedTemplate) {
        await mailTemplateAPI.update(selectedTemplate.templateId || selectedTemplate.id, payload);
        message.success("Cập nhật mẫu email thành công!");
      } else {
        await mailTemplateAPI.create(payload);
        message.success("Đã tạo mẫu email — từ giờ hệ thống gửi theo nội dung này.");
      }
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

  const filteredTemplates = templates.filter(
    (t) =>
      !searchText ||
      (t.name || "").toLowerCase().includes(searchText.toLowerCase()) ||
      (t.subject || "").toLowerCase().includes(searchText.toLowerCase()),
  );

  /**
   * Loại email nào chưa có mẫu riêng của công ty thì hệ thống gửi bằng nội dung mặc định.
   * Liệt kê ra để người tuyển dụng biết mà bổ sung. Bỏ qua loại `optional` (thư mời nhận
   * việc) — nội dung của nó lấy từ form gửi thư mời chứ không phải từ mẫu email.
   */
  const missingTypes = templateCategories
    .filter((cat) => !cat.optional)
    .filter((cat) => !templates.some((t) => t.type === cat.value))
    .map((cat) => cat);
  const hasMissing = missingTypes.length > 0;

  const renderPreview = (body) => {
    let preview = body || "";
    Object.entries(previewData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, "g"), value);
    });
    // BE hỗ trợ thêm các biến khác ({{link}}, {{expiresAt}}, {{startTime}}) — preview
    // chỉ render biến có dữ liệu mẫu để Human Resource khỏi nhầm là biến hỏng.
    preview = preview
      .replace(/{{\s*link\s*}}/g, "https://cong-ty-cua-ban.vn/chon-lich")
      .replace(/{{\s*expiresAt\s*}}/g, "25/12/2026 23:59 UTC")
      .replace(/{{\s*startTime\s*}}/g, "10:00 25/12/2026 (UTC)");
    return preview;
  };

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
      width: 120,
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

      {hasMissing && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          message={
            <Space>
              <Text strong>
                {missingTypes.length} loại email chưa có mẫu riêng của công ty
              </Text>
              <Text type="secondary">
                Hệ thống vẫn gửi được bằng nội dung mặc định. Bấm vào nhãn bên dưới nếu bạn
                muốn tự viết lời thư cho công ty mình. Riêng thư chào mừng nhận việc: chưa có mẫu
                thì hệ thống KHÔNG gửi, vì thư đó cần thông tin thật của công ty bạn.
              </Text>
            </Space>
          }
          description={
            <Space wrap style={{ marginTop: 4 }}>
              {missingTypes.map((t) => (
                <Tag
                  key={t.value}
                  color={t.color}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleCreateClick(t.value)}
                >
                  {t.label} +
                </Tag>
              ))}
            </Space>
          }
        />
      )}

      <Card className="main-card" bordered={false}>
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Space>
            <Input
              placeholder="Tìm kiếm mẫu email..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Button icon={<MailOutlined />} loading={loadingDefault} onClick={seedDefaults}>
              Tạo bộ mẫu dựng sẵn
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              onClick={() => handleCreateClick(null)}
            >
              Tạo mẫu
            </Button>
          </Space>
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

      {/* Xem thử nội dung với dữ liệu mẫu. zIndex phải CAO HƠN modal chỉnh sửa: để mặc định
          thì hai modal cùng z-index 1000, bản xem thử nằm sau và người dùng tưởng nút hỏng. */}
      <Modal
        title="Xem thử email"
        open={previewOpen}
        zIndex={1100}
        onCancel={() => setPreviewOpen(false)}
        footer={[<Button key="close" onClick={() => setPreviewOpen(false)}>Đóng</Button>]}
        width={720}
      >
        <div
          style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: 16, background: "#fff" }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </Modal>

      {/* Modal Chỉnh sửa */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EditOutlined style={{ color: MATCHA_GREEN }} />
            {selectedTemplate ? "Chỉnh sửa mẫu email" : "Tạo mẫu email"}
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
            label={
              <Space>
                <span>Nội dung email</span>
                <Button type="link" size="small" loading={loadingDefault} onClick={applyDefaultTemplate}>
                  Dùng nội dung mẫu
                </Button>
                <Button type="link" size="small" onClick={openPreview}>
                  Xem thử
                </Button>
              </Space>
            }
            name="body"
            rules={[{ required: true, message: "Vui lòng nhập nội dung" }]}
          >
            <EmailContentEditor />
          </Form.Item>

          <div style={{ background: "#f5f5f4", padding: 12, borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Bấm <b>Chèn thông tin</b> trên thanh công cụ để đưa tên ứng viên, vị trí, ngày giờ…
              vào thư — hệ thống tự điền khi gửi cho từng người. Logo và màu thương hiệu của công ty
              được thêm tự động, bạn không cần chèn.
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
