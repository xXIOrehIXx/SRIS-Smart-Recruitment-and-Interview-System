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
} from "@ant-design/icons";
import { mailTemplateAPI } from "../../services/api";
import "./css/MailTemplates.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = "#5D8C3E";

// BE NotificationService.cs truyền các placeholder này theo từng trigger.
// Liệt kê trong UI để Human Resource khỏi gõ {{companyName}} / {{interviewDate}} sai.
const SUPPORTED_VARIABLES = [
  { key: "{{candidateName}}", desc: "Tên ứng viên — mọi loại email" },
  { key: "{{jobTitle}}",      desc: "Vị trí ứng tuyển — mọi loại email" },
  {
    key: "{{link}}",
    desc:
      "Magic link cho SCHEDULE / STATUS / OFFER_RESPONSE; " +
      "Google Calendar URL cho INTERVIEW_CONFIRMED (không phải magic link)",
  },
  {
    key: "{{expiresAt}}",
    desc:
      "Thời điểm magic link hết hạn (UTC, dd/MM/yyyy HH:mm) — chỉ SCHEDULE / STATUS / OFFER_RESPONSE",
  },
  {
    key: "{{startTime}}",
    desc: "Giờ phỏng vấn (UTC, HH:mm dd/MM/yyyy) — chỉ INTERVIEW_CONFIRMED / INTERVIEW_CANCELLED",
  },
  {
    key: "{{reason}}",
    desc: "Lý do hủy (tùy chọn) — chỉ INTERVIEW_CANCELLED",
  },
  // Nhóm dưới đây do email onboarding dùng (hệ thống tự điền từ hồ sơ công ty + thư mời).
  { key: "{{companyName}}",    desc: "Tên công ty — chỉ ONBOARDING" },
  { key: "{{startDate}}",      desc: "Ngày vào làm lấy từ thư mời (dd/MM/yyyy) — chỉ ONBOARDING" },
  { key: "{{companyAddress}}", desc: "Địa chỉ công ty — chỉ ONBOARDING" },
  { key: "{{hrEmail}}",        desc: "Email liên hệ nhân sự — chỉ ONBOARDING" },
  { key: "{{emailDomain}}",    desc: "Tên miền email nội bộ — chỉ ONBOARDING" },
  { key: "{{brandColor}}",     desc: "Màu brand công ty (dùng trong style) — chỉ ONBOARDING" },
  { key: "{{companyLogoImg}}", desc: "Thẻ <img> logo công ty, rỗng nếu chưa có logo — chỉ ONBOARDING" },
];
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

  const filteredTemplates = templates.filter(
    (t) =>
      !searchText ||
      (t.name || "").toLowerCase().includes(searchText.toLowerCase()) ||
      (t.subject || "").toLowerCase().includes(searchText.toLowerCase()),
  );

  /**
   * Mỗi trigger email gửi cho ứng viên cần tối thiểu 1 template active.
   * Liệt kê các loại CHƯA có template active để Human Resource biết đường bổ sung —
   * nếu không hệ thống sẽ fallback nội dung hard-coded, không đồng nhất giữa
   * các trigger.
   */
  const missingTypes = templateCategories
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
      .replace(/{{\s*link\s*}}/g, "https://example.com/schedule?token=xxx")
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
                {missingTypes.length} loại email CHƯA có template active
              </Text>
              <Text type="secondary">
                Hệ thống sẽ gửi nội dung mặc định (hard-coded) cho các trigger này — nội
                dung không đồng nhất giữa các trigger. Liên hệ Admin để bổ sung template.
              </Text>
            </Space>
          }
          description={
            <Space wrap style={{ marginTop: 4 }}>
              {missingTypes.map((t) => (
                <Tag key={t.value} color={t.color}>
                  {t.label}
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
            label={
              <span>
                Nội dung email
                <Button
                  type="link"
                  size="small"
                  loading={loadingDefault}
                  onClick={applyDefaultTemplate}
                  style={{ paddingLeft: 8 }}
                >
                  Dùng mẫu có sẵn
                </Button>
              </span>
            }
            name="body"
            rules={[{ required: true, message: "Vui lòng nhập nội dung" }]}
          >
            <TextArea rows={10} placeholder="Nhập nội dung email..." />
          </Form.Item>

          <div style={{ background: "#f5f5f4", padding: 12, borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <b>Biến được hỗ trợ:</b>{" "}
              {SUPPORTED_VARIABLES.map((v, idx) => (
                <span key={v.key}>
                  <code style={codeStyle}>{v.key}</code>
                  {idx < SUPPORTED_VARIABLES.length - 1 ? ", " : ""}
                </span>
              ))}
              {" "}— <Text type="warning">dùng sai biến sẽ không render</Text>.
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
