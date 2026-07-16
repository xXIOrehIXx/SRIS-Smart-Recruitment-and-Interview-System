import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Typography, Card, Row, Col, Button, Modal, Descriptions, Tag, Space, List, Divider, message, Input, Select, Statistic, Spin, Form, Upload } from 'antd';
import { 
  SearchOutlined, 
  EnvironmentOutlined, 
  BankOutlined, 
  ClockCircleOutlined, 
  DollarOutlined, 
  FileTextOutlined,
  UserOutlined,
  SaveOutlined,
  SendOutlined,
  CheckCircleOutlined,
  StarOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  UploadOutlined,
  InboxOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { jobsAPI, publicCareerAPI } from '../../services/api';
import './Recruitment.css';
import { useCompany } from '../../hooks/useCompany';

const { Dragger } = Upload;

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

const Recruitment = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [applyingJob, setApplyingJob] = useState(null);
  const [applyForm] = Form.useForm();
  const [file, setFile] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const { slug }= useCompany();

  const fetchJobs = async () => {
    try {
      if (!slug) {
        console.error('fetchJobs: thiếu slug — URL phải có dạng /{slug}/recruitment');
        message.error('URL không hợp lệ: thiếu slug công ty. Vui lòng dùng /{slug}/recruitment.');
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await jobsAPI.getPublicJobsBySlug(slug);
      const jobList = response.data?.data || response.data || [];
      setJobs(jobList);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      message.error('Không thể tải danh sách tin tuyển dụng');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobDetail = async (jobId) => {
    try {
      if (!slug) {
        console.error('fetchJobDetail: thiếu slug — kiểm tra URL phải có dạng /{slug}/recruitment');
        return null;
      }
      const response = await jobsAPI.getPublicJobBySlug(slug, jobId);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching job detail:', error);
      return null;
    }
  };

  // Helper: lấy id từ job (hỗ trợ cả id và JobId)
  const getJobId = (job) => job.jobId || job.id;

  // Lấy danh sách departments duy nhất
  const departments = useMemo(() => {
    const depts = [...new Set(jobs.map(job => job.department).filter(Boolean))];
    return depts.sort();
  }, [jobs]);

  // Lọc jobs theo search và department
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = 
        (job.title || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (job.jdText || job.description || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (job.skills || []).some(skill => (skill || '').toLowerCase().includes(searchText.toLowerCase()));
      const matchesDepartment = selectedDepartment === 'all' || job.department === selectedDepartment;
      return matchesSearch && matchesDepartment;
    });
  }, [jobs, searchText, selectedDepartment]);

  const handleViewDetails = async (job) => {
    const jobId = getJobId(job);
    const jobDetail = await fetchJobDetail(jobId);
    setSelectedJob(jobDetail || job);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedJob(null);
  };

  const handleApply = (job) => {
    const jobId = getJobId(job);
    if (appliedJobs.includes(jobId)) {
      message.info('Bạn đã ứng tuyển vị trí này rồi');
      return;
    }
    setApplyingJob(job);
    setApplyModalVisible(true);
  };

  const handleSubmitApplication = async () => {
    try {
      const values = await applyForm.validateFields();
      
      if (!file) {
        message.error('Vui lòng upload CV (file PDF)');
        return;
      }

      setApplyingJob({ ...applyingJob, submitting: true });
      
      const formData = new FormData();
      formData.append('candidateName', values.candidateName);
      formData.append('candidateEmail', values.candidateEmail);
      formData.append('candidatePhone', values.candidatePhone);
      formData.append('file', file);

      const jobId = getJobId(applyingJob);
      await publicCareerAPI.apply(slug, jobId, formData);
      
      message.success('Nộp CV thành công!');
      setAppliedJobs([...appliedJobs, jobId]);
      setApplyModalVisible(false);
      applyForm.resetFields();
      setFile(null);
    } catch (error) {
      if (error.errorFields) {
        return; // Form validation failed
      }
      console.error('Error submitting application:', error);
      message.error('Không thể nộp CV. Vui lòng thử lại.');
    } finally {
      setApplyingJob(prev => prev?.submitting ? null : prev);
    }
  };

  const handleCancelApply = () => {
    setApplyModalVisible(false);
    applyForm.resetFields();
    setFile(null);
    setApplyingJob(null);
  };

  const getJobTypeColor = (type) => {
    switch (type) {
      case 'Full-time': return 'green';
      case 'Part-time': return 'blue';
      case 'Contract': return 'orange';
      case 'Remote': return 'purple';
      case 'Internship': return 'cyan';
      default: return 'default';
    }
  };

  const getExperienceColor = (exp) => {
    if (!exp) return 'default';
    if (exp.includes('5+')) return 'red';
    if (exp.includes('3+')) return 'orange';
    if (exp.includes('2+')) return 'blue';
    return 'green';
  };

  const formatSalary = (job) => {
    if (job.salary) return job.salary;
    const currency = job.currency ? ` ${job.currency}` : '';
    if (job.salaryMin && job.salaryMax) {
      const format = (n) => new Intl.NumberFormat('vi-VN').format(n);
      return `${format(job.salaryMin)} - ${format(job.salaryMax)}${currency}`;
    }
    if (job.salaryMin) {
      const format = (n) => new Intl.NumberFormat('vi-VN').format(n);
      return `Từ ${format(job.salaryMin)}${currency}`;
    }
    return 'Thỏa thuận';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('vi-VN');
  };

  const renderJobCard = (job) => {
    const jobId = getJobId(job);
    return (
    <Card 
      className="job-card"
      variant={false}
      hoverable
      onClick={() => handleViewDetails(job)}
    >
      <div className="job-card-header">
        <div className="job-title-section">
          <Title level={5} className="job-title">{job.title}</Title>
          <Space size="small">
            {job.department && <Tag color="blue" icon={<BankOutlined />}>{job.department}</Tag>}
            {job.employmentType && <Tag color={getJobTypeColor(job.employmentType)}>{job.employmentType}</Tag>}
            {job.experienceLevel && <Tag color={getExperienceColor(job.experienceLevel)}>{job.experienceLevel}</Tag>}
          </Space>
        </div>
        <div className="job-salary">
          <DollarOutlined className="salary-icon" />
          <Text strong className="salary-text">{formatSalary(job)}</Text>
        </div>
      </div>

      <div className="job-card-body">
        <Paragraph ellipsis={{ rows: 2 }} className="job-description">
          {job.jdText || job.description}
        </Paragraph>

        <Space size="middle" className="job-meta">
          {job.location && <span><EnvironmentOutlined /> {job.location}</span>}
          {job.deadline && <span><ClockCircleOutlined /> Hạn: {formatDate(job.deadline)}</span>}
          {job.applicationCount && <span><UserOutlined /> {job.applicationCount} ứng viên</span>}
        </Space>

        {job.skills && job.skills.length > 0 && (
          <div className="job-skills">
            {job.skills.slice(0, 4).map((skill, idx) => (
              <Tag key={idx} className="skill-tag">{skill}</Tag>
            ))}
            {job.skills.length > 4 && <Tag>+{job.skills.length - 4}</Tag>}
          </div>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <div className="job-card-footer">
        <Space>
          <Button 
            type="primary" 
            icon={<SendOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleApply(job);
            }}
            disabled={appliedJobs.includes(jobId)}
            loading={applyingJob === jobId}
            className={appliedJobs.includes(jobId) ? 'applied-btn' : 'apply-btn'}
          >
            {appliedJobs.includes(jobId) ? 'Đã ứng tuyển' : 'Apply ngay'}
          </Button>
          <Button 
            icon={<FileTextOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetails(job);
            }}
          >
            Chi tiết
          </Button>
        </Space>
      </div>
    </Card>
    );
  };

  const renderJobDetail = () => {
    if (!selectedJob) return null;

    const jobId = getJobId(selectedJob);
    return (
      <div className="job-detail">
        <div className="job-detail-header">
          <div className="job-detail-title">
            <Title level={3}>{selectedJob.title}</Title>
            <Space size="middle">
              {selectedJob.department && <Tag color="blue" icon={<BankOutlined />}>{selectedJob.department}</Tag>}
              {selectedJob.employmentType && <Tag color={getJobTypeColor(selectedJob.employmentType)}>{selectedJob.employmentType}</Tag>}
              {selectedJob.experienceLevel && <Tag color={getExperienceColor(selectedJob.experienceLevel)}>{selectedJob.experienceLevel}</Tag>}
            </Space>
          </div>
          <div className="job-detail-actions">
            <Button 
              type="primary" 
              size="large"
              icon={<SendOutlined />}
              onClick={() => handleApply(selectedJob)}
              disabled={appliedJobs.includes(jobId)}
              loading={applyingJob === jobId}
              className={appliedJobs.includes(jobId) ? 'applied-btn' : 'apply-btn-large'}
            >
              {appliedJobs.includes(jobId) ? 'Đã ứng tuyển' : 'Apply ngay'}
            </Button>
          </div>
        </div>

        <div className="job-detail-meta">
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" variant={false} className="meta-card">
                <Space>
                  <DollarOutlined className="meta-icon" />
                  <div>
                    <Text type="secondary">Mức lương</Text>
                    <div className="meta-value">{formatSalary(selectedJob)}</div>
                  </div>
                </Space>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" variant={false} className="meta-card">
                <Space>
                  <EnvironmentOutlined className="meta-icon" />
                  <div>
                    <Text type="secondary">Địa điểm</Text>
                    <div className="meta-value">{selectedJob.location || 'N/A'}</div>
                  </div>
                </Space>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" variant={false} className="meta-card">
                <Space>
                  <ClockCircleOutlined className="meta-icon" />
                  <div>
                    <Text type="secondary">Hạn nộp</Text>
                    <div className="meta-value">{formatDate(selectedJob.deadline)}</div>
                  </div>
                </Space>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" variant={false} className="meta-card">
                <Space>
                  <UserOutlined className="meta-icon" />
                  <div>
                    <Text type="secondary">Ứng viên</Text>
                    <div className="meta-value">{selectedJob.applicationCount || 0} người</div>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={14}>
            <Card title="Mô tả công việc" variant={false} className="detail-card">
              <Paragraph>{selectedJob.jdText || selectedJob.description}</Paragraph>
              
              {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                <>
                  <Divider orientation="left">Yêu cầu</Divider>
                  <List
                    dataSource={selectedJob.requirements}
                    renderItem={(req, index) => (
                      <List.Item className="requirement-item">
                        <CheckCircleOutlined className="check-icon" />
                        <Text>{req}</Text>
                      </List.Item>
                    )}
                  />
                </>
              )}

              {selectedJob.benefits && selectedJob.benefits.length > 0 && (
                <>
                  <Divider orientation="left">Quyền lợi</Divider>
                  <List
                    dataSource={selectedJob.benefits}
                    renderItem={(benefit) => (
                      <List.Item className="benefit-item">
                        <StarOutlined className="star-icon" />
                        <Text>{benefit}</Text>
                      </List.Item>
                    )}
                  />
                </>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            {selectedJob.skills && selectedJob.skills.length > 0 && (
              <Card title="Kỹ năng yêu cầu" variant={false} className="detail-card">
                <div className="skills-container">
                  {selectedJob.skills.map((skill, idx) => (
                    <Tag key={idx} color="blue" className="skill-tag-large">{skill}</Tag>
                  ))}
                </div>
              </Card>
            )}

            <Card title="Thông tin thêm" variant={false} className="detail-card" style={{ marginTop: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Ngày đăng">{formatDate(selectedJob.createdAt || selectedJob.postedDate)}</Descriptions.Item>
                <Descriptions.Item label="Phòng ban">{selectedJob.department || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Loại hình">{selectedJob.employmentType || selectedJob.jobType || selectedJob.type || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Kinh nghiệm">{selectedJob.experienceLevel || 'N/A'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  if (loading) {
    return (
      <Layout className="recruitment-layout">
        <Header className="recruitment-page-header">
          <div className="header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#5D8C3E"/>
              <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2"/>
              <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24 18V26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>SRIS</span>
          </div>
        </Header>
        <Content className="recruitment-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="recruitment-layout">
      <Header className="recruitment-page-header">
        <div className="header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#5D8C3E"/>
            <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2"/>
            <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 18V26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>SRIS</span>
        </div>
        <div className="nav-links">
          <a href="#product">Product</a>
          <a href="#pricing">Pricing</a>
          <a href="#resources">Resources</a>
          <a href="#customers">Customers</a>
        </div>
        <div className="header-actions">
          <Button type="text" className="login-btn" onClick={() => navigate('/login')}>Log in</Button>
          <Button type="primary" shape="round" className="demo-btn" onClick={() => navigate('/register')}>Book a demo</Button>
        </div>
      </Header>

      <Content className="recruitment-content">
        <div className="recruitment-header">
          <div className="header-text">
            <Title level={2} className="page-title">
              Cơ Hội Nghề Nghiệp
            </Title>
            <Paragraph className="page-subtitle">
              Khám phá các vị trí tuyển dụng phù hợp với bạn. Chúng tôi luôn tìm kiếm những tài năng xuất sắc!
            </Paragraph>
          </div>
          <div className="header-stats">
            <Card className="stat-card" variant={false}>
              <Statistic title="Vị trí đang tuyển" value={jobs.length} suffix="việc" />
            </Card>
            <Card className="stat-card" variant={false}>
              <Statistic title="Phòng ban" value={departments.length} suffix="bộ phận" />
            </Card>
          </div>
        </div>

        <Card className="filters-card" variant={false} style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={12} lg={10}>
              <Search
                placeholder="Tìm kiếm vị trí, kỹ năng..."
                allowClear
                size="large"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Select
                size="large"
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                placeholder="Chọn phòng ban"
                style={{ width: '100%' }}
              >
                <Option value="all">Tất cả phòng ban</Option>
                {departments.map(dept => (
                  <Option key={dept} value={dept}>{dept}</Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} lg={6}>
              <Text type="secondary">
                Tìm thấy <Text strong>{filteredJobs.length}</Text> vị trí phù hợp
              </Text>
            </Col>
          </Row>
        </Card>

        {filteredJobs.length > 0 ? (
          <Row gutter={[24, 24]}>
            {filteredJobs.map(job => (
              <Col xs={24} md={12} xl={8} key={getJobId(job)}>
                {renderJobCard(job)}
              </Col>
            ))}
          </Row>
        ) : (
          <Card variant={false} className="no-results">
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <SearchOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
              <Title level={4} type="secondary">Không tìm thấy vị trí phù hợp</Title>
              <Paragraph type="secondary">
                Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc để xem thêm cơ hội nghề nghiệp.
              </Paragraph>
            </div>
          </Card>
        )}

        <Modal
          title={null}
          open={isModalVisible}
          onCancel={handleCloseModal}
          width={1000}
          footer={null}
          className="job-detail-modal"
          destroyOnHidden
          closeIcon={<CloseOutlined />}
        >
          {selectedJob && renderJobDetail()}
        </Modal>

        <Modal
          title="Nộp CV Ứng Tuyển"
          open={applyModalVisible}
          onCancel={handleCancelApply}
          footer={[
            <Button key="cancel" onClick={handleCancelApply}>
              Hủy
            </Button>,
            <Button 
              key="submit" 
              type="primary" 
              loading={applyingJob?.submitting}
              onClick={handleSubmitApplication}
            >
              Nộp CV
            </Button>,
          ]}
          width={500}
        >
          <Form form={applyForm} layout="vertical" style={{ marginTop: 20 }}>
            <Form.Item
              label="Họ và tên"
              name="candidateName"
              rules={[{ required: true, message: 'Vui lòng nhập họ và tên!' }]}
            >
              <Input placeholder="Nhập họ và tên của bạn" size="large" />
            </Form.Item>

            <Form.Item
              label="Email"
              name="candidateEmail"
              rules={[
                { required: true, message: 'Vui lòng nhập email!' },
                { type: 'email', message: 'Email không hợp lệ!' }
              ]}
            >
              <Input placeholder="Nhập email của bạn" size="large" />
            </Form.Item>

            <Form.Item
              label="Số điện thoại"
              name="candidatePhone"
              rules={[
                { required: true, message: 'Vui lòng nhập số điện thoại!' },
                { pattern: /^[0-9]{9,11}$/, message: 'Số điện thoại không hợp lệ!' }
              ]}
            >
              <Input placeholder="Nhập số điện thoại của bạn" size="large" />
            </Form.Item>

            <Form.Item label="Upload CV (PDF)">
              <Dragger
                name="file"
                maxCount={1}
                accept=".pdf"
                beforeUpload={(f) => {
                  if (!f.name.endsWith('.pdf')) {
                    message.error('Chỉ chấp nhận file PDF!');
                    return Upload.LIST_IGNORE;
                  }
                  setFile(f);
                  return false;
                }}
                fileList={file ? [file] : []}
                onRemove={() => setFile(null)}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Click hoặc kéo file vào đây để upload</p>
                <p className="ant-upload-hint">Chỉ chấp nhận file PDF, dung lượng tối đa 20MB</p>
              </Dragger>
            </Form.Item>
          </Form>
        </Modal>
      </Content>

      <Footer className="recruitment-page-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#5D8C3E"/>
              <path d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z" stroke="white" strokeWidth="2"/>
              <path d="M20 22L24 26L28 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24 18V26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>SRIS</span>
          </div>
          <Text type="secondary">© 2026 SRIS. All rights reserved.</Text>
        </div>
      </Footer>
    </Layout>
  );
};

export default Recruitment;
