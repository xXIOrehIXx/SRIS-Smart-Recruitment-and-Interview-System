import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Row,
  Col,
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Typography,
  Divider,
  Space,
  message,
  Checkbox,
  Spin,
  Tooltip,
  ColorPicker,
} from "antd";
import {
  SaveOutlined,
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { jobsAPI, recruitmentRequestAPI, usersAPI } from "../../services/api";
import JobSetupSteps from "../../components/JobSetupSteps";
import "./css/CreateJob.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

const CreateJob = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [requirements, setRequirements] = useState([""]);
  const [benefits, setBenefits] = useState([""]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingJobId, setEditingJobId] = useState(null);
  const [currentStep, setCurrentStep] = useState("posting");
  const [dmOptions, setDmOptions] = useState([]);

  useEffect(() => {
    // Dropdown "Người quyết tuyển" — DM (kèm Admin, đúng luật Admin làm được mọi việc)
    usersAPI.getOptions("DepartmentManager")
      .then((r) => setDmOptions(r.data || []))
      .catch(() => setDmOptions([]));
  }, []);

  const editJobId = searchParams.get("edit");
  const requestId = searchParams.get("requestId"); // tạo job TỪ yêu cầu tuyển dụng của DM (5.17)

  const steps = [
    { key: "posting", title: "Đăng tin" },
    { key: "application", title: "Đơn ứng tuyển" },
    { key: "stages", title: "Giai đoạn" },
  ];

  useEffect(() => {
    if (editJobId) {
      setIsEditMode(true);
      fetchJobDetails(editJobId);
    } else if (requestId) {
      prefillFromRequest(requestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editJobId, requestId]);

  // Prefill từ Yêu cầu tuyển dụng của DM — tạo xong gọi convert để truy vết đề bài -> job
  const prefillFromRequest = async (id) => {
    try {
      setInitialLoading(true);
      const response = await recruitmentRequestAPI.getById(id);
      const req = response.data;
      form.setFieldsValue({
        title: req.title,
        department: req.department,
        type: req.employmentType,
        description: req.description,
        salaryMin: req.salaryMin,
        salaryMax: req.salaryMax,
      });
      if (req.requirements) setRequirements(req.requirements.split("\n").filter(Boolean));
      if (req.benefits) setBenefits(req.benefits.split("\n").filter(Boolean));
      message.info(`Đang tạo tin từ yêu cầu tuyển dụng của ${req.createdByName || "DM"} — "${req.title}"`);
    } catch (error) {
      console.error("Error loading request:", error);
      message.error("Không thể tải yêu cầu tuyển dụng");
    } finally {
      setInitialLoading(false);
    }
  };

  // Đánh dấu yêu cầu -> CONVERTED sau khi tạo job (best-effort, không chặn flow)
  const linkToRequest = async (jobId) => {
    if (!requestId || !jobId) return;
    try {
      await recruitmentRequestAPI.convert(requestId, jobId);
    } catch (error) {
      console.error("Error linking job to request:", error);
      message.warning("Job đã tạo nhưng chưa gắn được vào yêu cầu tuyển dụng.");
    }
  };

  const fetchJobDetails = async (jobId) => {
    try {
      setInitialLoading(true);
      const response = await jobsAPI.getById(jobId);
      const job = response.data;

      if (job) {
        setEditingJobId(jobId);
        form.setFieldsValue({
          title: job.title,
          department: job.department,
          type: job.employmentType || job.jobType,
          experienceLevel: job.experienceLevel,
          quantity: job.quantity,
          location: job.location || job.workLocation,
          workMode: job.workMode,
          description: job.jdText || job.description,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          currency: job.currency || "VND",
          expiresAt: job.deadline || job.expiresAt,
        });

        if (job.requirements && job.requirements.length > 0) {
          setRequirements(job.requirements);
        }
        if (job.benefits && job.benefits.length > 0) {
          setBenefits(job.benefits);
        }
      }
    } catch (error) {
      console.error("Error fetching job details:", error);
      message.error("Không thể tải thông tin tin tuyển dụng");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleAddRequirement = () => {
    setRequirements([...requirements, ""]);
  };

  const handleRemoveRequirement = (index) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const handleRequirementChange = (index, value) => {
    const newRequirements = [...requirements];
    newRequirements[index] = value;
    setRequirements(newRequirements);
  };

  const handleAddBenefit = () => {
    setBenefits([...benefits, ""]);
  };

  const handleRemoveBenefit = (index) => {
    setBenefits(benefits.filter((_, i) => i !== index));
  };

  const handleBenefitChange = (index, value) => {
    const newBenefits = [...benefits];
    newBenefits[index] = value;
    setBenefits(newBenefits);
  };

  const getFormData = (values) => {
    return {
      title: values.title,
      department: values.department,
      departmentManagerId: values.departmentManagerId || null,
      employmentType: values.type,
      experienceLevel: values.experienceLevel,
      quantity: values.quantity,
      location: values.location,
      workMode: values.workMode,
      jdText: values.description,
      salaryMin: values.salaryMin,
      salaryMax: values.salaryMax,
      currency: values.currency || "VND",
      deadline: values.expiresAt,
      requirements: requirements.filter((r) => r.trim() !== ""),
      benefits: benefits.filter((b) => b.trim() !== ""),
      isPublished: false,
    };
  };

  const handleSaveDraft = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      const values = form.getFieldsValue();
      const data = getFormData(values);

      if (isEditMode && editingJobId) {
        await jobsAPI.update(editingJobId, data);
        message.success("Cập nhật tin tuyển dụng thành công");
      } else {
        const res = await jobsAPI.create(data);
        await linkToRequest(res.data?.jobId);
        message.success("Lưu nháp thành công");
      }
      navigate("/recruiter/jobs");
    } catch (error) {
      console.error("Error saving job:", error);
      message.error("Vui lòng điền đầy đủ thông tin bắt buộc");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      const values = form.getFieldsValue();
      const data = getFormData(values);
      data.isPublished = true;

      if (isEditMode && editingJobId) {
        await jobsAPI.update(editingJobId, data);
        message.success("Cập nhật và đăng tin thành công!");
      } else {
        const res = await jobsAPI.create(data);
        await linkToRequest(res.data?.jobId);
        message.success("Tin tuyển dụng đã được đăng thành công!");
      }
      navigate("/recruiter/jobs");
    } catch (error) {
      console.error("Error publishing job:", error);
      message.error("Vui lòng điền đầy đủ thông tin bắt buộc");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    message.info(
      "Xem trước trang đăng tuyển sẽ được mở trong bản cập nhật tiếp theo",
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "posting":
        return (
          <>
            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">
                Đăng tin
              </Title>

              <Form.Item
                name="title"
                label="Tiêu đề tin đăng"
                rules={[
                  { required: true, message: "Vui lòng nhập tiêu đề tin đăng" },
                ]}
              >
                <Input size="large" />
              </Form.Item>

              <Form.Item
                name="description"
                label="Mô tả công việc"
                rules={[
                  { required: true, message: "Vui lòng nhập mô tả công việc" },
                ]}
              >
                <TextArea rows={6} maxLength={2000} showCount />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="department"
                    label="Phòng ban"
                    rules={[
                      { required: true, message: "Vui lòng chọn phòng ban" },
                    ]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="departmentManagerId"
                    label="Người quyết tuyển (DM)"
                    tooltip="DM sẽ là người CHỐT tuyển/loại ở bước Offer (docs 5.17). Bỏ trống = Recruiter tự quyết — đường mặc định của công ty nhỏ."
                  >
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder="Bỏ trống = Recruiter tự quyết"
                      options={dmOptions.map((u) => ({
                        value: u.userId,
                        label: `${u.fullName || u.email}${u.role === "Admin" ? " (Admin)" : ""}`,
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="location"
                    label="Địa điểm"
                    rules={[
                      { required: true, message: "Vui lòng nhập địa điểm" },
                    ]}
                  >
                    <Input size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="type"
                    label="Loại công việc"
                    initialValue="Full-time"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn loại công việc",
                      },
                    ]}
                  >
                    {/* defaultValue trên Select KHÔNG ghi vào Form store -> validate fail
                        dù ô đang hiển thị giá trị. Phải dùng initialValue của Form.Item. */}
                    <Select size="large">
                      <Select.Option value="Full-time">
                        Toàn thời gian
                      </Select.Option>
                      <Select.Option value="Part-time">
                        Bán thời gian
                      </Select.Option>
                      <Select.Option value="Contract">Hợp đồng</Select.Option>
                      <Select.Option value="Internship">Thực tập</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="experienceLevel" label="Kinh Nghiệm Yêu Cầu">
                    <Select
                      placeholder="Chọn mức kinh nghiệm"
                      size="large"
                      allowClear
                    >
                      <Select.Option value="Fresher">
                        Fresher (Mới ra trường)
                      </Select.Option>
                      <Select.Option value="1+">1+ năm</Select.Option>
                      <Select.Option value="2+">2+ năm</Select.Option>
                      <Select.Option value="3+">3+ năm</Select.Option>
                      <Select.Option value="5+">5+ năm</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="quantity" label="Số Lượng Tuyển">
                    <InputNumber
                      size="large"
                      style={{ width: "100%" }}
                      min={1}
                      max={999}
                      placeholder="VD: 3"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={16}>
                  <Form.Item
                    name="skillTags"
                    label="Kỹ Năng (phân cách bằng dấu phẩy)"
                  >
                    <Input
                      placeholder="VD: React, Node.js, TypeScript"
                      size="large"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="expiresAt" label="Hạn nộp đơn">
                    <DatePicker
                      style={{ width: "100%" }}
                      size="large"
                      placeholder="Chọn hạn nộp"
                      format="DD/MM/YYYY"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card className="form-card" bordered={false}>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="buttonText"
                    label="Nội dung nút"
                    rules={[{ max: 25, message: "Tối đa 25 ký tự" }]}
                    className="button-text-field"
                  >
                    <Input
                      placeholder="Ứng tuyển ngay"
                      size="large"
                      maxLength={25}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}></Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="template"
                    label="Mẫu trang đăng tuyển"
                    initialValue="visual"
                  >
                    <Select size="large">
                      <Select.Option value="visual">
                        Visual (mặc định)
                      </Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="backgroundImage" label="Ảnh nền">
                    <Input
                      placeholder="https://example.com/bg.jpg"
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="textColor" label="Màu chữ">
                    <ColorPicker defaultValue="#FFFFFF" size="large" showText />
                  </Form.Item>
                </Col>
              </Row>

              <Card className="preview-card" bordered={false}>
                <div className="preview-banner">
                  <span>Website preview</span>
                </div>
                <div className="preview-content">
                  <Title level={5} style={{ marginBottom: 8 }}>
                    Senior Frontend Developer
                  </Title>
                  <Text type="secondary">
                    Đây là bản xem trước mẫu trang đăng tuyển của bạn.
                  </Text>
                </div>
              </Card>
            </Card>
          </>
        );
      case "application":
        return (
          <>
            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">
                Lương & thời hạn
              </Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="salaryMin"
                    label="Lương tối thiểu"
                    rules={[{ required: true, message: "Bắt buộc" }]}
                  >
                    <InputNumber
                      size="large"
                      style={{ width: "100%" }}
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                      placeholder="Tối thiểu"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="salaryMax"
                    label="Lương tối đa"
                    rules={[{ required: true, message: "Bắt buộc" }]}
                  >
                    <InputNumber
                      size="large"
                      style={{ width: "100%" }}
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                      placeholder="Tối đa"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="currency"
                label="Đơn vị tiền tệ"
                initialValue="VND"
              >
                <Select size="large">
                  <Select.Option value="VND">VND - Việt Nam Đồng</Select.Option>
                  <Select.Option value="USD">USD - US Dollar</Select.Option>
                </Select>
              </Form.Item>
            </Card>
            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">
                Đơn ứng tuyển
              </Title>
            </Card>
          </>
        );
      case "stages":
        return (
          <Card className="form-card" bordered={false}>
            <Title level={5} className="section-title">
              Giai đoạn
            </Title>
          </Card>
        );
      default:
        return null;
    }
  };

  if (initialLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="create-job-page">
      <div className="page-header">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/recruiter/jobs")}
        >
          Quay lại
        </Button>
      </div>

      <div className="wizard-shell">
        <aside className="wizard-sidebar">
          <Card className="wizard-sidebar-card" bordered={false}>
            <JobSetupSteps
              currentStep={currentStep}
              onChange={setCurrentStep}
            />
          </Card>
        </aside>

        <div className="wizard-content">
          <Form form={form} layout="vertical" className="job-form">
            {renderStepContent()}
          </Form>
        </div>
      </div>

      <div className="wizard-footer">
        <Space>
          <div></div>
        </Space>
        <Space>
          <Tooltip title="Xem trước trang đăng tuyển">
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              size="large"
            />
          </Tooltip>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveDraft}
            loading={loading}
            size="large"
          >
            Lưu nháp
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handlePublish}
            loading={loading}
            size="large"
          >
            Đăng tin
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default CreateJob;
