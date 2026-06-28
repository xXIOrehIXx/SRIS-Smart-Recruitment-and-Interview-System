import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Row, Col, Card, Form, Input, Select, DatePicker, 
  InputNumber, Button, Typography, Divider, Space, 
  message, Checkbox 
} from 'antd';
import { 
  SaveOutlined, 
  SendOutlined, 
  PlusOutlined, 
  DeleteOutlined
} from '@ant-design/icons';
import './css/CreateJob.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CreateJob = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [requirements, setRequirements] = useState(['']);
  const [benefits, setBenefits] = useState(['']);

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

  const handleSaveDraft = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      message.success('Job saved as draft');
      navigate('/recruiter/jobs');
    } catch (error) {
      message.error('Please fill in all required fields');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      message.success('Job posted successfully!');
      navigate('/recruiter/jobs');
    } catch (error) {
      message.error('Please fill in all required fields');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-job-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Post New Job</Title>
          <Text type="secondary">Fill in the details to create a new job posting</Text>
        </div>
      </div>

      <Form form={form} layout="vertical" className="job-form">
        <Row gutter={[24, 24]}>
          {/* Left Column */}
          <Col xs={24} lg={16}>
            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">Basic Information</Title>
              
              <Form.Item
                name="title"
                label="Job Title"
                rules={[{ required: true, message: 'Please enter job title' }]}
              >
                <Input placeholder="e.g. Senior Frontend Developer" size="large" />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="department"
                    label="Department"
                    rules={[{ required: true, message: 'Please select department' }]}
                  >
                    <Select placeholder="Select department" size="large">
                      <Select.Option value="engineering">Engineering</Select.Option>
                      <Select.Option value="product">Product</Select.Option>
                      <Select.Option value="design">Design</Select.Option>
                      <Select.Option value="marketing">Marketing</Select.Option>
                      <Select.Option value="sales">Sales</Select.Option>
                      <Select.Option value="hr">Human Resources</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="type"
                    label="Employment Type"
                    rules={[{ required: true, message: 'Please select type' }]}
                  >
                    <Select placeholder="Select type" size="large">
                      <Select.Option value="full-time">Full-time</Select.Option>
                      <Select.Option value="part-time">Part-time</Select.Option>
                      <Select.Option value="contract">Contract</Select.Option>
                      <Select.Option value="internship">Internship</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="location"
                    label="Location"
                    rules={[{ required: true, message: 'Please enter location' }]}
                  >
                    <Input placeholder="e.g. Hanoi, Vietnam" size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="workMode"
                    label="Work Mode"
                    rules={[{ required: true, message: 'Please select work mode' }]}
                  >
                    <Select placeholder="Select mode" size="large">
                      <Select.Option value="onsite">On-site</Select.Option>
                      <Select.Option value="remote">Remote</Select.Option>
                      <Select.Option value="hybrid">Hybrid</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="description"
                label="Job Description"
                rules={[{ required: true, message: 'Please enter job description' }]}
              >
                <TextArea 
                  rows={6} 
                  placeholder="Describe the role, responsibilities, and what makes this opportunity exciting..."
                  maxLength={2000}
                  showCount
                />
              </Form.Item>
            </Card>

            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">Requirements & Benefits</Title>
              
              <div className="dynamic-list">
                <label>Requirements</label>
                {requirements.map((req, index) => (
                  <div key={index} className="list-item">
                    <Input
                      placeholder={`Requirement ${index + 1}`}
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
                  Add Requirement
                </Button>
              </div>

              <Divider />

              <div className="dynamic-list">
                <label>Benefits</label>
                {benefits.map((benefit, index) => (
                  <div key={index} className="list-item">
                    <Input
                      placeholder={`Benefit ${index + 1}`}
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
                  Add Benefit
                </Button>
              </div>
            </Card>
          </Col>

          {/* Right Column */}
          <Col xs={24} lg={8}>
            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">Salary & Duration</Title>
              
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item
                    name="salaryMin"
                    label="Min Salary"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <InputNumber 
                      size="large"
                      style={{ width: '100%' }}
                      formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/\$\s?|(,*)/g, '')}
                      placeholder="Min"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="salaryMax"
                    label="Max Salary"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <InputNumber 
                      size="large"
                      style={{ width: '100%' }}
                      formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/\$\s?|(,*)/g, '')}
                      placeholder="Max"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="currency"
                label="Currency"
                initialValue="USD"
              >
                <Select size="large">
                  <Select.Option value="USD">USD - US Dollar</Select.Option>
                  <Select.Option value="VND">VND - Vietnamese Dong</Select.Option>
                  <Select.Option value="EUR">EUR - Euro</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="expiresAt"
                label="Application Deadline"
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  size="large"
                  placeholder="Select deadline"
                />
              </Form.Item>
            </Card>

            <Card className="form-card" bordered={false}>
              <Title level={5} className="section-title">Job Settings</Title>
              
              <Form.Item name="publishImmediately">
                <Checkbox checked>
                  Publish immediately after saving
                </Checkbox>
              </Form.Item>

              <Form.Item name="featured">
                <Checkbox>
                  Mark as featured job
                </Checkbox>
              </Form.Item>

              <Form.Item name="questions">
                <Checkbox>
                  Include application questions
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
                  Save as Draft
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
                  Publish Job
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
