import React, { useState, useEffect, useRef } from "react";
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
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { companyAPI, mailTemplateAPI } from "../../services/api";
import { useCompany } from "../../contexts/CompanyContext";
import { useBrandTheme } from "../../contexts/BrandThemeContext";
import BulletListInput from "../../components/BulletListInput";
import "./css/CompanyBranding.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const DEFAULT_COLOR = "#5D8C3E";

/** Gợi ý quyền lợi — nghề phổ thông, vì sản phẩm tuyển mọi vị trí chứ không riêng IT. */
const BENEFIT_HINTS = [
  "VD: Thưởng lương tháng 13",
  "VD: Đóng BHXH đầy đủ theo quy định",
  "VD: Du lịch, teambuilding hằng năm",
];

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
  const logoFileRef = useRef(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  // Quyền lợi mặc định (V035) — danh sách dòng, không nằm trong Form nên giữ ở state riêng.
  const [defaultBenefits, setDefaultBenefits] = useState([""]);

  /**
   * Tải ảnh logo từ máy lên rồi điền địa chỉ ảnh vào form.
   * Người dùng không phải biết địa chỉ ảnh là gì — họ chỉ chọn file như đính kèm email.
   * Dùng chung kho ảnh với mẫu email nên logo hiện được cả trong thư gửi ứng viên
   * (ảnh trong email bắt buộc là địa chỉ công khai, không nhúng file trực tiếp được).
   */
  const uploadLogo = async (file) => {
    if (!file) return;
    try {
      setLogoUploading(true);
      const res = await mailTemplateAPI.uploadImage(file);
      const url = res.data?.url;
      if (!url) throw new Error("no url");
      setLogoUrl(url);
      brandForm.setFieldsValue({ logoUrl: url });
      message.success("Đã tải logo lên — bấm Lưu thương hiệu để áp dụng.");
    } catch (error) {
      console.error("uploadLogo error", error);
      message.error(error?.response?.data?.error || "Không tải được ảnh logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl(null);
    brandForm.setFieldsValue({ logoUrl: null });
    message.info("Đã gỡ logo — bấm Lưu thương hiệu để áp dụng.");
  };

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
        // 3 ô này in ở đầu THƯ MỜI NHẬN VIỆC (5.15) — nhập 1 lần, mọi thư sau đều tự có.
        email: data.contactEmail,
        phone: data.phone,
        address: data.address,
      });

      // Luôn chừa 1 ô trống khi công ty chưa khai quyền lợi nào, không thì không có chỗ gõ.
      setDefaultBenefits(
        data.defaultBenefits?.length > 0 ? data.defaultBenefits : [""]
      );

      setLogoUrl(data.logoUrl || null);
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
        contactEmail: values.email,
        phone: values.phone,
        address: values.address,
        // Mảng rỗng = cố ý xoá hết; BE phân biệt với "không gửi mục này" (giữ nguyên).
        defaultBenefits: defaultBenefits.map((b) => b.trim()).filter(Boolean),
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
              </Row>

              {/* Quyền lợi gần như không đổi giữa các tin (BHXH, thưởng T13, du lịch) —
                  nhập 1 lần ở đây, mỗi tin MỚI tự điền sẵn, người đăng tin sửa riêng được.
                  Chỉ Admin sửa được mục này (endpoint PUT /company gác [WithRole(Admin)]),
                  còn người đăng tin chỉ đọc để điền sẵn. */}
              <Form.Item
                label="Quyền lợi mặc định"
                extra="Tự điền sẵn vào mỗi tin tuyển dụng MỚI. Sửa ở đây KHÔNG đổi các tin đã đăng."
              >
                <BulletListInput
                  items={defaultBenefits}
                  hints={BENEFIT_HINTS}
                  fallbackHint="Thêm một quyền lợi"
                  addLabel="Thêm quyền lợi"
                  onAdd={() => setDefaultBenefits([...defaultBenefits, ""])}
                  onRemove={(index) =>
                    setDefaultBenefits(defaultBenefits.filter((_, i) => i !== index))
                  }
                  onChange={(index, value) => {
                    const next = [...defaultBenefits];
                    next[index] = value;
                    setDefaultBenefits(next);
                  }}
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
                src={logoUrl}
                style={{ background: previewColor, fontSize: 48 }}
                icon={<BuildOutlined />}
              />
            </div>

            <Form form={brandForm} layout="vertical">
              {/* Ô nhập URL vẫn còn nhưng ẨN: người dùng chỉ chọn file, hệ thống tự điền
                  địa chỉ ảnh sau khi tải lên. Giữ Form.Item để handleSaveBrand đọc như cũ. */}
              <Form.Item name="logoUrl" hidden>
                <Input />
              </Form.Item>

              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    uploadLogo(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button
                  icon={<UploadOutlined />}
                  loading={logoUploading}
                  block
                  onClick={() => logoFileRef.current?.click()}
                >
                  {logoUrl ? "Đổi logo khác" : "Chọn ảnh logo từ máy"}
                </Button>

                {logoUrl && (
                  <Button danger type="text" block onClick={removeLogo}>
                    Gỡ logo
                  </Button>
                )}

                {/* Chỉ giữ điều người dùng KHÔNG tự đoán được: giới hạn file. Bỏ lời khuyên
                    kích thước ảnh (đơn vị px không nói lên gì với người làm nhân sự) và bỏ
                    câu nhắc bấm Lưu — nút Lưu nằm ngay bên dưới, không cần dặn. */}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Ảnh PNG hoặc JPG, tối đa 2MB.
                </Text>
              </Space>
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

              {/* Bản xem trước THẬT của đầu email gửi ứng viên. Trước đây chỗ này là một ô
                  tô màu ghi "Xem trước thương hiệu" — trông y hệt cái nút nên ai cũng bấm,
                  bấm thì không có gì xảy ra. Giờ nó cho thấy luôn logo + màu sẽ ra sao. */}
              <Text type="secondary" style={{ fontSize: 12 }}>
                Đầu email gửi ứng viên sẽ trông như thế này:
              </Text>
              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 16,
                  margin: "8px 0 16px",
                  background: "#fff",
                }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="logo"
                    style={{ display: "block", maxHeight: 40, maxWidth: 180, marginBottom: 10 }}
                  />
                ) : (
                  <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 10 }}>
                    (chưa có logo)
                  </Text>
                )}
                <div style={{ width: 48, height: 4, background: previewColor, marginBottom: 10 }} />
                <div style={{ fontSize: 13, color: "#1F2933" }}>
                  Chào <b style={{ color: previewColor }}>Nguyễn Văn An</b>,
                </div>
                <div style={{ fontSize: 13, color: "#1F2933" }}>
                  Chúc mừng bạn đã trúng tuyển vị trí{" "}
                  <b style={{ color: previewColor }}>Lập trình viên Backend</b>…
                </div>
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
