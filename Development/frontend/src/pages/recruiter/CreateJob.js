import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Row, Col, Card, Form, Input, Select, DatePicker, 
  InputNumber, Button, Typography, Divider, Space, 
  message, Checkbox, Spin
} from 'antd';
import { 
  SaveOutlined, 
  SendOutlined, 
  PlusOutlined, 
  DeleteOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { jobsAPI } from '../../services/api';
import './css/CreateJob.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CreateJob = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [requirements, setRequirements] = useState(['']);
  const [benefits, setBenefits] = useState(['']);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingJobId, setEditingJobId] = useState(null);

  const editJobId = searchParams.get('edit');

  useEffect(() => {
    if (editJobId) {
      setIsEditMode(true);
      fetchJobDetails(editJobId);
    }
  }, [editJobId]);

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
          currency: job.currency || 'VND',
          expiresAt: job.deadline || job.expiresAt,
        });
        
        // Set requirements and benefits if available
        if (job.requirements && job.requirements.length > 0) {
          setRequirements(job.requirements);
        }
        if (job.benefits && job.benefits.length > 0) {
          setBenefits(job.benefits);
        }
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      message.error('Không thể tải thông tin tin tuyển dụng');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleAddRequirement = () => {
    setRequirements([...requirements, '']);
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
    setBenefits([...benefits, '']);
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
      employmentType: values.type,
      experienceLevel: values.experienceLevel,
      quantity: values.quantity,
      location: values.location,
      workMode: values.workMode,
      jdText: values.description,
      salaryMin: values.salaryMin,
      salaryMax: values.salaryMax,
      currency: values.currency || 'VND',
      deadline: values.expiresAt,
      requirements: requirements.filter(r => r.trim() !== ''),
      benefits: benefits.filter(b => b.trim() !== ''),
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
        message.success('Cập nhật tin tuyển dụng thành công');
      } else {
        await jobsAPI.create(data);
        message.success('Lưu nháp thành công');
      }
      navigate('/recruiter/jobs');
    } catch (error) {
      console.error('Error saving job:', error);
      message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
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
        message.success('Cập nhật và đăng tin thành công!');
      } else {
        await jobsAPI.create(data);
        message.success('Tin tuyển dụng đã được đăng thành công!');
      }
      navigate('/recruiter/jobs');
    } catch (error) {
      console.error('Error publishing job:', error);
      message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="create-job-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            {isEditMode ? 'Chỉnh Sửa Tin Tuyển Dụng' : 'Đăng Tin Tuyển Dụng Mới'}
          </Title>
          <Text type="secondary">
            {isEditMode ? 'Cập nhật thông tin tin tuyển dụng' : 'Điền thông tin để tạo tin tuyển dụng mới'}
          </Text>
        </div>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/recruiter/jobs')}
        >
          Quay Lại
        </Button>
      </div>

      <Form form={form} layout="vertical" className="job-form">
        <Row gutter={[24, 24]}>
          {/* Left Column */}
          <Col xs={24} lg={16}>
            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">Thông Tin Cơ Bản</Title>
              
              <Form.Item
                name="title"
                label="Tên Vị Trí"
                rules={[{ required: true, message: 'Vui lòng nhập tên vị trí' }]}
              >
                <Input placeholder="VD: Senior Frontend Developer" size="large" />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="department"
                    label="Phòng Ban"
                    rules={[{ required: true, message: 'Vui lòng chọn phòng ban' }]}
                  >
                    <Select placeholder="Chọn phòng ban" size="large">
                      <Select.Option value="Engineering">Kỹ thuật</Select.Option>
                      <Select.Option value="Product">Sản phẩm</Select.Option>
                      <Select.Option value="Design">Thiết kế</Select.Option>
                      <Select.Option value="Marketing">Marketing</Select.Option>
                      <Select.Option value="Sales">Kinh doanh</Select.Option>
                      <Select.Option value="HR">Nhân sự</Select.Option>
                      <Select.Option value="Finance">Tài chính</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="type"
                    label="Loại Công Việc"
                    rules={[{ required: true, message: 'Vui lòng chọn loại công việc' }]}
                  >
                    <Select placeholder="Chọn loại" size="large">
                      <Select.Option value="Full-time">Toàn thời gian</Select.Option>
                      <Select.Option value="Part-time">Bán thời gian</Select.Option>
                      <Select.Option value="Contract">Hợp đồng</Select.Option>
                      <Select.Option value="Internship">Thực tập</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="experienceLevel"
                    label="Kinh Nghiệm Yêu Cầu"
                  >
                    <Select placeholder="Chọn mức kinh nghiệm" size="large" allowClear>
                      <Select.Option value="Fresher">Fresher (Mới ra trường)</Select.Option>
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
                  <Form.Item
                    name="quantity"
                    label="Số Lượng Tuyển"
                  >
                    <InputNumber
                      size="large"
                      style={{ width: '100%' }}
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
                  <Form.Item
                    name="location"
                    label="Địa Điểm"
                    rules={[{ required: true, message: 'Vui lòng nhập địa điểm' }]}
                  >
                    <Input placeholder="VD: Hà Nội, Việt Nam" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="workMode"
                    label="Hình Thức Làm Việc"
                    rules={[{ required: true, message: 'Vui lòng chọn hình thức' }]}
                  >
                    <Select placeholder="Chọn hình thức" size="large">
                      <Select.Option value="Onsite">Tại văn phòng</Select.Option>
                      <Select.Option value="Remote">Từ xa</Select.Option>
                      <Select.Option value="Hybrid">Kết hợp</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="description"
                label="Mô Tả Công Việc"
                rules={[{ required: true, message: 'Vui lòng nhập mô tả công việc' }]}
              >
                <TextArea 
                  rows={6} 
                  placeholder="Mô tả về vai trò, trách nhiệm và cơ hội của vị trí này..."
                  maxLength={2000}
                  showCount
                />
              </Form.Item>
            </Card>

            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">Yêu Cầu & Phúc Lợi</Title>
              
              <div className="dynamic-list">
                <label>Yêu Cầu</label>
                {requirements.map((req, index) => (
                  <div key={index} className="list-item">
                    <Input
                      placeholder={`Yêu cầu ${index + 1}`}
                      value={req}
                      onChange={(e) => handleRequirementChange(index, e.target.value)}
                      prefix={<span className="list-number">{index + 1}</span>}
                    />
                    {requirements.length > 1 && (
                      <Button 
                        type="text" 
                        icon={<DeleteOutlined />} 
                        onClick={() => handleRemoveRequirement(index)}
                        className="remove-btn"
                      />
                    )}
                  </div>
                ))}
                <Button 
                  type="dashed" 
                  onClick={handleAddRequirement}
                  icon={<PlusOutlined />}
                  className="add-btn"
                >
                  Thêm Yêu Cầu
                </Button>
              </div>

              <Divider />

              <div className="dynamic-list">
                <label>Phúc Lợi</label>
                {benefits.map((benefit, index) => (
                  <div key={index} className="list-item">
                    <Input
                      placeholder={`Phúc lợi ${index + 1}`}
                      value={benefit}
                      onChange={(e) => handleBenefitChange(index, e.target.value)}
                      prefix={<span className="list-number">{index + 1}</span>}
                    />
                    {benefits.length > 1 && (
                      <Button 
                        type="text" 
                        icon={<DeleteOutlined />} 
                        onClick={() => handleRemoveBenefit(index)}
                        className="remove-btn"
                      />
                    )}
                  </div>
                ))}
                <Button 
                  type="dashed" 
                  onClick={handleAddBenefit}
                  icon={<PlusOutlined />}
                  className="add-btn"
                >
                  Thêm Phúc Lợi
                </Button>
              </div>
            </Card>
          </Col>

          {/* Right Column */}
          <Col xs={24} lg={8}>
            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">Lương & Thời Hạn</Title>
              
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item
                    name="salaryMin"
                    label="Lương Tối Thiểu"
                    rules={[{ required: true, message: 'Bắt buộc' }]}
                  >
                    <InputNumber 
                      size="large"
                      style={{ width: '100%' }}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/\$\s?|(,*)/g, '')}
                      placeholder="Tối thiểu"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="salaryMax"
                    label="Lương Tối Đa"
                    rules={[{ required: true, message: 'Bắt buộc' }]}
                  >
                    <InputNumber 
                      size="large"
                      style={{ width: '100%' }}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/\$\s?|(,*)/g, '')}
                      placeholder="Tối đa"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="currency"
                label="Đơn Vị Tiền Tệ"
                initialValue="VND"
              >
                <Select size="large">
                  <Select.Option value="VND">VND - Việt Nam Đồng</Select.Option>
                  <Select.Option value="USD">USD - US Dollar</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="expiresAt"
                label="Hạn Nộp Đơn"
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  size="large"
                  placeholder="Chọn hạn nộp"
                  format="DD/MM/YYYY"
                />
              </Form.Item>
            </Card>

            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">Cài Đặt Tin Tuyển Dụng</Title>
              
              <Form.Item name="publishImmediately" valuePropName="checked" initialValue={!isEditMode}>
                <Checkbox>
                  Đăng tin ngay sau khi lưu
                </Checkbox>
              </Form.Item>

              <Divider />

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  block 
                  size="large"
                  icon={<SaveOutlined />}
                  onClick={handleSaveDraft}
                  loading={loading}
                >
                  Lưu Nháp
                </Button>
                <Button 
                  type="primary" 
                  block 
                  size="large"
                  icon={<SendOutlined />}
                  onClick={handlePublish}
                  loading={loading}
                  className="publish-btn"
                >
                  {isEditMode ? 'Cập Nhật & Đăng Tin' : 'Đăng Tin Ngay'}
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default CreateJob;
