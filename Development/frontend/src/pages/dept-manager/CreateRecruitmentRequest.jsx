import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Row,
  Col,
  Button,
  Space,
  Divider,
  message,
  Steps,
  Alert,
  Radio,
  Slider,
  Tag,
  Spin,
} from 'antd';
import {
  SaveOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  TeamOutlined,
  DollarOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { recruitmentRequestAPI, departmentAPI } from '../../services/api';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  SKILLS_PREFIX,
  splitRequirements,
} from '../../services/recruitmentRequest';
import '../Dashboard.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const MATCHA_GREEN = '#5D8C3E';

// BE lưu priority HOA (LOW/MEDIUM/HIGH), Radio.Group dùng dạng Title case.
const PRIORITY_FORM_VALUE = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

const CreateRecruitmentRequest = () => {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const isEdit = !!requestId;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(isEdit);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitType, setSubmitType] = useState('draft');
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');

  // Danh mục phòng ban (V022) — Admin quản lý, chỉ hiện Active
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    departmentAPI.getAll()
      .then((r) => setDepartments(
        (r.data || []).filter((d) => d.status === 'Active').map((d) => d.name)
      ))
      .catch(() => setDepartments([]));
  }, []);

  // Chế độ sửa: nạp lại yêu cầu cũ vào form. BE chỉ cho sửa khi PENDING -> chặn sớm ở FE cho rõ lý do.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    recruitmentRequestAPI.getById(requestId)
      .then((res) => {
        if (cancelled) return;
        const r = res.data || {};
        if (r.status !== 'PENDING') {
          message.warning('Yêu cầu đã được xử lý — không sửa được nữa.');
          navigate('/dept/requests');
          return;
        }

        const { text, skills: parsedSkills } = splitRequirements(r.requirements);
        setSkills(parsedSkills);
        form.setFieldsValue({
          title: r.title,
          department: r.department,
          positions: r.quantity ?? 1,
          employmentType: r.employmentType,
          experienceLevel: r.experienceLevel,
          priority: PRIORITY_FORM_VALUE[r.priority] || 'Medium',
          description: r.description,
          requirements: text,
          benefits: r.benefits,
          salaryMin: r.salaryMin,
          salaryMax: r.salaryMax,
          startDate: r.expectedStartDate ? dayjs(r.expectedStartDate) : null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        message.error(err?.response?.data?.userMsg || 'Không tải được yêu cầu tuyển dụng');
        navigate('/dept/requests');
      })
      .finally(() => { if (!cancelled) setLoadingRequest(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  // Danh mục dùng CHUNG với màn duyệt yêu cầu — sửa nhãn ở một nơi, hai màn cùng đổi.
  const employmentTypes = EMPLOYMENT_TYPES;
  const experienceLevels = EXPERIENCE_LEVELS;

  const priorityOptions = [
    { value: 'Low', label: 'Thấp', color: '#52c41a' },
    { value: 'Medium', label: 'Trung bình', color: '#faad14' },
    { value: 'High', label: 'Cao', color: '#f5222d' },
  ];

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleSubmit = async () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
      return;
    }

    setLoading(true);
    try {
      const values = form.getFieldsValue(true);
      // RecruitmentRequestInputDto — skills không có cột riêng, gộp vào requirements
      const requirementsText = [
        values.requirements,
        skills.length > 0 ? `${SKILLS_PREFIX} ${skills.join(', ')}` : null,
      ].filter(Boolean).join('\n');

      const payload = {
        title: values.title,
        department: values.department,
        quantity: values.positions || 1,
        employmentType: values.employmentType,
        experienceLevel: values.experienceLevel,
        priority: (values.priority || 'MEDIUM').toUpperCase(),
        description: values.description,
        requirements: requirementsText || null,
        benefits: values.benefits,
        salaryMin: values.salaryMin,
        salaryMax: values.salaryMax,
        expectedStartDate: values.startDate?.format('YYYY-MM-DDTHH:mm:ss'),
      };

      if (isEdit) {
        await recruitmentRequestAPI.update(requestId, payload);
        message.success('Đã lưu thay đổi yêu cầu tuyển dụng.');
      } else {
        await recruitmentRequestAPI.create(payload);
        message.success('Đã gửi yêu cầu tuyển dụng — Recruiter sẽ duyệt và tạo tin đăng.');
      }
      navigate('/dept/requests');
    } catch (error) {
      console.error('Error saving request:', error);
      message.error(error?.response?.data?.userMsg || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: 'Thông tin cơ bản', icon: <FileTextOutlined /> },
    { title: 'Yêu cầu chi tiết', icon: <TeamOutlined /> },
    { title: 'Điều kiện & Lưu', icon: <SaveOutlined /> },
  ];

  const validateStep0 = () => {
    const values = form.getFieldsValue([
      'title',
      'department',
      'positions',
      'employmentType',
      'priority',
    ]);
    return values.title && values.department && values.positions && values.employmentType && values.priority;
  };

  const validateStep1 = () => {
    const values = form.getFieldsValue([
      'description',
      'requirements',
      'experienceLevel',
    ]);
    return values.description && values.requirements && values.experienceLevel;
  };

  return (
    <div className="create-request-page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(isEdit ? '/dept/requests' : '/dept/dashboard')}
          />
          <div>
            <Title level={3} className="page-title">
              {isEdit ? 'Sửa Yêu Cầu Tuyển Dụng' : 'Tạo Yêu Cầu Tuyển Dụng'}
            </Title>
            <Text type="secondary">
              {isEdit
                ? 'Chỉnh sửa yêu cầu đang chờ duyệt — Recruiter duyệt xong sẽ không sửa được nữa'
                : 'Gửi yêu cầu tuyển dụng mới cho phòng ban của bạn'}
            </Text>
          </div>
        </div>
      </div>

      <Card className="main-card" bordered={false}>
        {/* Spin BỌC (không thay thế) để Form luôn mounted — form.setFieldsValue khi nạp xong mới ăn. */}
        <Spin spinning={loadingRequest}>
        <Steps
          current={currentStep}
          items={steps}
          style={{ marginBottom: 32 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            positions: 1,
            priority: 'Medium',
            employmentType: 'FULL_TIME',
            experienceLevel: 'Mid',
            urgency: 50,
          }}
        >
          {currentStep === 0 && (
            <div>
              <Alert
                message="Thông tin cơ bản"
                description="Điền các thông tin cơ bản về vị trí tuyển dụng."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Row gutter={24}>
                <Col xs={24} lg={16}>
                  <Form.Item
                    label="Tên vị trí tuyển dụng"
                    name="title"
                    rules={[{ required: true, message: 'Vui lòng nhập tên vị trí' }]}
                  >
                    <Input placeholder="VD: Senior Frontend Developer" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={8}>
                  <Form.Item
                    label="Số lượng tuyển"
                    name="positions"
                    rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}
                  >
                    <InputNumber
                      min={1}
                      max={20}
                      style={{ width: '100%' }}
                      size="large"
                      placeholder="1"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Phòng ban"
                    name="department"
                    rules={[{ required: true, message: 'Vui lòng chọn phòng ban' }]}
                  >
                    <Select placeholder="-- Chọn phòng ban --" size="large">
                      {departments.map((dept) => (
                        <Option key={dept} value={dept}>
                          {dept}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Hình thức làm việc"
                    name="employmentType"
                    rules={[{ required: true, message: 'Vui lòng chọn hình thức' }]}
                  >
                    <Select placeholder="-- Chọn hình thức --" size="large">
                      {employmentTypes.map((type) => (
                        <Option key={type.value} value={type.value}>
                          {type.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col xs={24} lg={12}>
                  <Form.Item label="Mức ưu tiên" name="priority">
                    <Radio.Group>
                      {priorityOptions.map((opt) => (
                        <Radio.Button key={opt.value} value={opt.value}>
                          <Tag color={opt.color} style={{ marginRight: 4, marginBottom: 0 }}>
                            ●
                          </Tag>
                          {opt.label}
                        </Radio.Button>
                      ))}
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item label="Ngày cần tuyển" name="startDate">
                    <DatePicker
                      style={{ width: '100%' }}
                      size="large"
                      format="DD/MM/YYYY"
                      placeholder="Ngày bắt đầu tuyển"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <Alert
                message="Yêu cầu chi tiết"
                description="Mô tả công việc và yêu cầu cho vị trí này."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Form.Item
                label="Mô tả công việc"
                name="description"
                rules={[{ required: true, message: 'Vui lòng nhập mô tả công việc' }]}
              >
                <TextArea
                  rows={5}
                  placeholder="Mô tả chi tiết công việc, trách nhiệm chính, môi trường làm việc..."
                />
              </Form.Item>

              <Form.Item
                label="Yêu cầu ứng viên"
                name="requirements"
                rules={[{ required: true, message: 'Vui lòng nhập yêu cầu' }]}
              >
                <TextArea
                  rows={5}
                  placeholder="Kỹ năng cần có, kinh nghiệm, bằng cấp..."
                />
              </Form.Item>

              <Row gutter={24}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Cấp bậc kinh nghiệm"
                    name="experienceLevel"
                    rules={[{ required: true, message: 'Vui lòng chọn cấp bậc' }]}
                  >
                    <Select placeholder="-- Chọn cấp bậc --" size="large">
                      {experienceLevels.map((level) => (
                        <Option key={level.value} value={level.value}>
                          {level.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item label="Kỹ năng yêu cầu" required>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <Input
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập kỹ năng và Enter..."
                        size="large"
                      />
                      <Button type="dashed" onClick={handleAddSkill} size="large">
                        Thêm
                      </Button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {skills.map((skill) => (
                        <Tag
                          key={skill}
                          closable
                          onClose={() => handleRemoveSkill(skill)}
                          style={{ padding: '4px 8px', fontSize: 14 }}
                        >
                          {skill}
                        </Tag>
                      ))}
                    </div>
                    {skills.length === 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Chưa có kỹ năng nào được thêm
                      </Text>
                    )}
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Quyền lợi (tùy chọn)" name="benefits">
                <TextArea
                  rows={3}
                  placeholder="Các quyền lợi khi gia nhập công ty (bảo hiểm, bonus, training...)"
                />
              </Form.Item>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <Alert
                message="Điều kiện & Lưu"
                description="Kiểm tra thông tin và chọn cách lưu phù hợp."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Row gutter={24}>
                <Col xs={24} lg={12}>
                  <Card title="Thông tin tổng quan" size="small" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <Text type="secondary">Vị trí: </Text>
                        <Text strong>{form.getFieldValue('title') || '-'}</Text>
                      </div>
                      <div>
                        <Text type="secondary">Phòng ban: </Text>
                        <Text strong>{form.getFieldValue('department') || '-'}</Text>
                      </div>
                      <div>
                        <Text type="secondary">Số lượng: </Text>
                        <Text strong>{form.getFieldValue('positions') || '-'} vị trí</Text>
                      </div>
                      <div>
                        <Text type="secondary">Hình thức: </Text>
                        <Text strong>
                          {employmentTypes.find((t) => t.value === form.getFieldValue('employmentType'))?.label || '-'}
                        </Text>
                      </div>
                      <div>
                        <Text type="secondary">Mức ưu tiên: </Text>
                        <Tag color={priorityOptions.find((p) => p.value === form.getFieldValue('priority'))?.color}>
                          {form.getFieldValue('priority') || '-'}
                        </Tag>
                      </div>
                      <div>
                        <Text type="secondary">Cấp bậc: </Text>
                        <Text strong>
                          {experienceLevels.find((l) => l.value === form.getFieldValue('experienceLevel'))?.label || '-'}
                        </Text>
                      </div>
                    </div>
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card title="Kỹ năng yêu cầu" size="small" style={{ marginBottom: 16 }}>
                    {skills.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {skills.map((skill) => (
                          <Tag key={skill} style={{ marginBottom: 0 }}>
                            {skill}
                          </Tag>
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary">Chưa thêm kỹ năng</Text>
                    )}
                  </Card>

                  <Card title="Mức lương (tùy chọn)" size="small">
                    <Row gutter={8}>
                      <Col span={12}>
                        <Form.Item name="salaryMin" style={{ marginBottom: 0 }}>
                          <InputNumber
                            placeholder="Tối thiểu"
                            style={{ width: '100%' }}
                            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(value) => value.replace(/,/g, '')}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="salaryMax" style={{ marginBottom: 0 }}>
                          <InputNumber
                            placeholder="Tối đa"
                            style={{ width: '100%' }}
                            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(value) => value.replace(/,/g, '')}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Form.Item label="Ghi chú cho Recruiter (tùy chọn)" name="notes">
                <TextArea rows={3} placeholder="Các lưu ý đặc biệt, yêu cầu riêng cho recruiter..." />
              </Form.Item>

              {/* Sửa thì chỉ có 1 hành động (lưu lại) — không có khái niệm nháp/gửi nữa. */}
              {!isEdit && (
                <Form.Item label="Hành động">
                  <Radio.Group
                    value={submitType}
                    onChange={(e) => setSubmitType(e.target.value)}
                    size="large"
                  >
                    <Radio.Button value="draft" style={{ height: 48, lineHeight: '46px', paddingInline: 24 }}>
                      <Space>
                        <SaveOutlined />
                        Lưu nháp
                      </Space>
                    </Radio.Button>
                    <Radio.Button value="submit" style={{ height: 48, lineHeight: '46px', paddingInline: 24 }}>
                      <Space>
                        <SendOutlined />
                        Gửi yêu cầu
                      </Space>
                    </Radio.Button>
                  </Radio.Group>
                </Form.Item>
              )}
            </div>
          )}

          <Divider />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {currentStep > 0 && (
                <Button htmlType="button" onClick={() => setCurrentStep(currentStep - 1)} size="large">
                  <ArrowLeftOutlined /> Quay lại
                </Button>
              )}
            </div>
            <Space>
              <Button htmlType="button" onClick={() => navigate(isEdit ? '/dept/requests' : '/dept/dashboard')} size="large">
                Hủy
              </Button>
              {currentStep < 2 ? (
                <Button
                  type="primary"
                  htmlType="button"
                  size="large"
                  onClick={() => {
                    if (currentStep === 0 && !validateStep0()) {
                      message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
                      return;
                    }
                    if (currentStep === 1 && !validateStep1()) {
                      message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
                      return;
                    }
                    setCurrentStep(currentStep + 1);
                  }}
                  style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
                >
                  Tiếp tục
                </Button>
              ) : (
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  icon={isEdit || submitType === 'draft' ? <SaveOutlined /> : <SendOutlined />}
                  style={{
                    background: isEdit || submitType === 'submit' ? MATCHA_GREEN : undefined,
                    borderColor: isEdit || submitType === 'submit' ? MATCHA_GREEN : undefined,
                  }}
                >
                  {isEdit ? 'Lưu thay đổi' : submitType === 'draft' ? 'Lưu nháp' : 'Gửi yêu cầu'}
                </Button>
              )}
            </Space>
          </div>
        </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default CreateRecruitmentRequest;
