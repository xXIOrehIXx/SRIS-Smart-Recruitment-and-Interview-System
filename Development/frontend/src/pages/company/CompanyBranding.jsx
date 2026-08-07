import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Space,
  message,
  Row,
  Col,
  Avatar,
  ColorPicker,
  Divider,
} from "antd";
import {
  SaveOutlined,
  LinkOutlined,
  BuildOutlined,
} from "@ant-design/icons";
import { companyAPI } from "../../services/api";
import { useCompany } from "../../contexts/CompanyContext";
import { useBrandTheme } from "../../contexts/BrandThemeContext";
import "./css/CompanyBranding.css";

const { Title, Text } = Typography;

const DEFAULT_COLOR = "#5D8C3E";

const toHex = (value) => {
  if (!value) return DEFAULT_COLOR;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toHexString" in value)
    return value.toHexString();
  return String(value);
};

const CompanyBranding = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);
  const [form] = Form.useForm();
  const [brandForm] = Form.useForm();
  const [company, setCompany] = useState(null);
  const { refreshCompany } = useCompany();
  const { primaryColor, updateBrandColor } = useBrandTheme();

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    try {
      setLoading(true);
      const response = await companyAPI.get();
      const data = response.data;
      setCompany(data);

      form.setFieldsValue({
        name: data.name,
        industry: data.industry,
        // 3 ô này in ở đầu THƯ MỜI NHẬN VIỆC (5.15) — nhập 1 lần, mọi thư sau đều tự có.
        email: data.contactEmail,
        phone: data.phone,
        address: data.address,
      });

      brandForm.setFieldsValue({
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor || DEFAULT_COLOR,
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
      await companyAPI.update({
        name: values.name,
        industry: values.industry,
        contactEmail: values.email,
        phone: values.phone,
        address: values.address,
      });
      message.success("Lưu thông tin công ty thành công!");
      await refreshCompany();
      fetchCompany();
    } catch (error) {
      console.error("Error saving company:", error);
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Không thể lưu thông tin công ty";
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBrand = async () => {
    try {
      setBrandSaving(true);
      const brandValues = brandForm.getFieldsValue();
      const chosenColor = toHex(brandValues.primaryColor) || DEFAULT_COLOR;

      await companyAPI.updateBrand({
        name: brandValues.name || company?.name,
        logoUrl: brandValues.logoUrl || null,
        primaryColor: chosenColor,
      });

      updateBrandColor(chosenColor);
      message.success("Lưu thương hiệu thành công!");
      await refreshCompany();
      fetchCompany();
    } catch (error) {
      console.error("Error saving brand:", error);
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Không thể lưu thương hiệu";
      message.error(msg);
    } finally {
      setBrandSaving(false);
    }
  };

  const previewColor = toHex(
    brandForm.getFieldValue("primaryColor") || company?.primaryColor || DEFAULT_COLOR
  );

  return (
    <div className="company-branding-page">
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
        {/* Left column — company info */}
        <Col xs={24} lg={16}>
            <Card
            title={
              <Space>
                <BuildOutlined style={{ color: primaryColor }} />
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
                    <Input placeholder="VD: SRIS Corp" size="large" />
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
                  <Form.Item label="Số điện thoại" name="phone" rules={[{ pattern: /^0\d{9}$/, message: "Số điện thoại phải đúng 10 chữ số, bắt đầu bằng 0" }]}>
                    <Input
                      placeholder="+84 123 456 789"
                      size="large"
                      prefix={<PhoneOutlined />}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Địa chỉ"
                name="address"
                extra="Địa chỉ, email và số điện thoại ở trên được in làm phần đầu thư mời nhận việc gửi ứng viên."
              >
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
                  height: 44,
                  paddingInline: 32,
                }}
              >
                Lưu thông tin
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Right column — logo + brand colors */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <LinkOutlined style={{ color: primaryColor }} />
                Logo công ty
              </Space>
            }
            className="main-card"
            bordered={false}
          >
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <Avatar
                size={120}
                src={company?.logoUrl}
                style={{
                  background: previewColor,
                  fontSize: 48,
                }}
                icon={<BuildOutlined />}
              />
            </div>
            <Form form={brandForm} layout="vertical">
              <Form.Item label="Logo URL" name="logoUrl">
                <Input
                  placeholder="https://example.com/logo.png"
                  prefix={<LinkOutlined />}
                />
              </Form.Item>
              <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                Dán URL logo từ CDN hoặc upload lên MinIO rồi dán link.
              </Text>
            </Form>
          </Card>

          <Card
            title={
              <Space>
                <SaveOutlined style={{ color: primaryColor }} />
                Bộ màu thương hiệu
              </Space>
            }
            className="main-card"
            bordered={false}
            style={{ marginTop: 24 }}
          >
            <Form form={brandForm} layout="vertical">
              <Form.Item label="Màu chính (Primary Color)" name="primaryColor">
                <ColorPicker
                  showText
                  size="large"
                  format="hex"
                />
              </Form.Item>

              <div
                style={{
                  background: previewColor,
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
                htmlType="button"
                loading={brandSaving}
                icon={<SaveOutlined />}
                block
                onClick={handleSaveBrand}
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
