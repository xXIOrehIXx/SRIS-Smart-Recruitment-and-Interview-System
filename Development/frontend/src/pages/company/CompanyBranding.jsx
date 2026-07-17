import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Switch,
  Upload,
  Space,
  message,
  Row,
  Col,
  Divider,
  Avatar,
  ColorPicker,
  Tag,
} from "antd";
import {
  SaveOutlined,
  UploadOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  FileTextOutlined,
  InstagramOutlined,
  LinkedinOutlined,
  FacebookOutlined,
  RestOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { companyAPI } from "../../services/api";
import "./css/CompanyBranding.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const MATCHA_GREEN = "#5D8C3E";
const DRAFT_KEY = "company_branding_draft";

// Auto-save hook for page-level forms
const usePageDraft = (storageKey) => {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTime, setDraftTime] = useState(null);

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
        const draft = {
          values,
          savedAt: new Date().toISOString(),
        };
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

const CompanyBranding = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [brandForm] = Form.useForm();
  const [company, setCompany] = useState(null);
  const [logo, setLogo] = useState(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftTimeoutRef = useRef(null);

  // Draft auto-save hook
  const { hasDraft, draftTime, saveDraft, clearDraft, getDraft } =
    usePageDraft(DRAFT_KEY);

  useEffect(() => {
    fetchCompany();
  }, []);

  // Check for draft on load
  useEffect(() => {
    if (hasDraft) {
      setShowDraftBanner(true);
    }
  }, [hasDraft]);

  // Auto-save when form values change
  const handleDraftAutoSave = useCallback(
    (changedValues, allValues) => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
      draftTimeoutRef.current = setTimeout(() => {
        saveDraft(allValues);
      }, 1500);
    },
    [saveDraft],
  );

  // Restore draft
  const handleRestoreDraft = () => {
    const savedValues = getDraft();
    if (savedValues) {
      form.setFieldsValue(savedValues);
      message.success("Đã khôi phục dữ liệu đã lưu tạm");
    }
    setShowDraftBanner(false);
  };

  // Discard draft
  const handleDiscardDraft = () => {
    clearDraft();
    message.info("Đã xóa dữ liệu tạm");
    setShowDraftBanner(false);
  };

  const fetchCompany = async () => {
    try {
      setLoading(true);
      const response = await companyAPI.get();
      const data = response.data;
      setCompany(data);
      form.setFieldsValue({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        website: data.website,
        description: data.description,
        industry: data.industry,
        foundedYear: data.foundedYear,
        employeeCount: data.employeeCount,
      });
      brandForm.setFieldsValue({
        primaryColor: data.brandColors?.primary || MATCHA_GREEN,
        secondaryColor: data.brandColors?.secondary || "#7ab356",
      });
    } catch (error) {
      console.error("Error fetching company:", error);
      message.error("Không thể tải thông tin công ty");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (values) => {
    try {
      setSaving(true);
      await companyAPI.update(values);
      message.success("Lưu thông tin công ty thành công!");
      clearDraft(); // Clear draft after successful save
      fetchCompany();
    } catch (error) {
      console.error("Error saving company:", error);
      message.error("Không thể lưu thông tin công ty");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBrand = async (values) => {
    try {
      setSaving(true);
      await companyAPI.updateBrand(values);
      message.success("Lưu thương hiệu thành công!");
      fetchCompany();
    } catch (error) {
      console.error("Error saving brand:", error);
      message.error("Không thể lưu thương hiệu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="company-branding-page">
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
            Thương Hiệu Công Ty
          </Title>
          <Text type="secondary">
            Quản lý hình ảnh và thông tin thương hiệu công ty
          </Text>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <FileTextOutlined style={{ color: MATCHA_GREEN }} />
                Thông tin công ty
              </Space>
            }
            className="main-card"
            bordered={false}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveProfile}
              onValuesChange={handleDraftAutoSave}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Tên công ty"
                    name="name"
                    rules={[
                      { required: true, message: "Vui lòng nhập tên công ty" },
                    ]}
                  >
                    <Input
                      placeholder="VD: SRIS Corp"
                      size="large"
                      prefix={<FileTextOutlined />}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Ngành nghề" name="industry">
                    <Input placeholder="VD: Công nghệ thông tin" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Email liên hệ"
                    name="email"
                    rules={[{ type: "email", message: "Email không hợp lệ" }]}
                  >
                    <Input
                      placeholder="contact@company.com"
                      size="large"
                      prefix={<MailOutlined />}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Số điện thoại" name="phone">
                    <Input
                      placeholder="+84 123 456 789"
                      size="large"
                      prefix={<PhoneOutlined />}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Địa chỉ" name="address">
                <Input
                  placeholder="123 Nguyễn Huệ, Quận 1, TP.HCM"
                  size="large"
                  prefix={<EnvironmentOutlined />}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Website" name="website">
                    <Input
                      placeholder="https://company.com"
                      size="large"
                      prefix={<GlobalOutlined />}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Năm thành lập" name="foundedYear">
                    <Input placeholder="2020" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Số nhân viên" name="employeeCount">
                    <Input placeholder="50-100" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Mô tả công ty" name="description">
                <TextArea
                  rows={4}
                  placeholder="Giới thiệu ngắn về công ty..."
                  maxLength={1000}
                  showCount
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<SaveOutlined />}
                style={{
                  background: MATCHA_GREEN,
                  borderColor: MATCHA_GREEN,
                  height: 44,
                  paddingInline: 32,
                }}
              >
                Lưu thông tin
              </Button>
            </Form>
          </Card>

          <Card
            title={
              <Space>
                <GlobalOutlined style={{ color: MATCHA_GREEN }} />
                Mạng xã hội
              </Space>
            }
            className="main-card"
            bordered={false}
            style={{ marginTop: 24 }}
          >
            <Form layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label={
                      <span>
                        <FacebookOutlined style={{ marginRight: 8 }} />
                        Facebook
                      </span>
                    }
                    name="facebook"
                  >
                    <Input placeholder="facebook.com/company" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label={
                      <span>
                        <InstagramOutlined style={{ marginRight: 8 }} />
                        Instagram
                      </span>
                    }
                    name="instagram"
                  >
                    <Input placeholder="@company" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label={
                      <span>
                        <LinkedinOutlined style={{ marginRight: 8 }} />
                        LinkedIn
                      </span>
                    }
                    name="linkedin"
                  >
                    <Input placeholder="linkedin.com/company" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <GlobalOutlined style={{ color: MATCHA_GREEN }} />
                Logo công ty
              </Space>
            }
            className="main-card"
            bordered={false}
          >
            <div style={{ textAlign: "center" }}>
              <Avatar
                size={160}
                src={company?.logo || logo}
                style={{
                  background: `linear-gradient(135deg, ${company?.brandColors?.primary || MATCHA_GREEN}, ${company?.brandColors?.secondary || "#7ab356"})`,
                  marginBottom: 16,
                  fontSize: 64,
                }}
                icon={<FileTextOutlined />}
              />
              <Upload
                showUploadList={false}
                beforeUpload={(file) => {
                  if (!file.type.startsWith("image/")) {
                    message.error("Chỉ chấp nhận file hình ảnh!");
                    return Upload.LIST_IGNORE;
                  }
                  const reader = new FileReader();
                  reader.onload = (e) => setLogo(e.target.result);
                  reader.readAsDataURL(file);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} style={{ marginBottom: 8 }}>
                  Tải lên Logo
                </Button>
              </Upload>
              <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                PNG, JPG, SVG (tối đa 5MB, khuyến nghị 512x512px)
              </Text>
            </div>
          </Card>

          <Card
            title={
              <Space>
                <GlobalOutlined style={{ color: MATCHA_GREEN }} />
                Bộ màu thương hiệu
              </Space>
            }
            className="main-card"
            bordered={false}
            style={{ marginTop: 24 }}
          >
            <Form form={brandForm} layout="vertical" onFinish={handleSaveBrand}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Màu chính" name="primaryColor">
                    <ColorPicker
                      defaultValue={
                        company?.brandColors?.primary || MATCHA_GREEN
                      }
                      showText
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Màu phụ" name="secondaryColor">
                    <ColorPicker
                      defaultValue={
                        company?.brandColors?.secondary || "#7ab356"
                      }
                      showText
                      size="large"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <div
                style={{
                  background: `linear-gradient(135deg, ${company?.brandColors?.primary || MATCHA_GREEN}, ${company?.brandColors?.secondary || "#7ab356"})`,
                  height: 60,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                Xem trước thương hiệu
              </div>

              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<SaveOutlined />}
                block
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              >
                Lưu thương hiệu
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CompanyBranding;
