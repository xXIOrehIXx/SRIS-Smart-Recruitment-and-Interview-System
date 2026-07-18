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
import "./css/CompanyBranding.css";

const { Title, Text } = Typography;

const MATCHA_GREEN = "#5D8C3E";

/** Extract hex string from Color object or return as-is if already a string. */
const toHex = (value) => {
  if (!value) return null;
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
      });

      brandForm.setFieldsValue({
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor || MATCHA_GREEN,
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
      await companyAPI.updateBrand({
        name: values.name,
        logoUrl: brandForm.getFieldValue("logoUrl") || company?.logoUrl,
        primaryColor: toHex(brandForm.getFieldValue("primaryColor")) || company?.primaryColor,
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
      await companyAPI.updateBrand({
        name: brandValues.name || company?.name,
        logoUrl: brandValues.logoUrl || null,
        primaryColor: toHex(brandValues.primaryColor) || null,
      });
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

  const rawColor = brandForm.getFieldValue("primaryColor") || company?.primaryColor || MATCHA_GREEN;
  const previewColor = toHex(rawColor);

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
                <BuildOutlined style={{ color: MATCHA_GREEN }} />
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

              <Divider />

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
        </Col>

        {/* Right column — logo + brand colors */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <LinkOutlined style={{ color: MATCHA_GREEN }} />
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
                <SaveOutlined style={{ color: MATCHA_GREEN }} />
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
