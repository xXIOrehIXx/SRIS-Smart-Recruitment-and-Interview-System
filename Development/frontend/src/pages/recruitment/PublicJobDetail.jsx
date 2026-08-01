import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Layout,
  Typography,
  Card,
  Row,
  Col,
  Button,
  Tag,
  Space,
  Divider,
  message,
  Input,
  Spin,
  Form,
  Upload,
  Breadcrumb,
  Result,
  Descriptions,
} from "antd";
import {
  EnvironmentOutlined,
  BankOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  StarOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  InboxOutlined,
  LinkOutlined,
  CalendarOutlined,
  SolutionOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { jobsAPI, publicCareerAPI } from "../../services/api";
import { CareerHeader, CareerFooter } from "./CareerChrome";
import {
  formatDate,
  formatSalary,
  getBenefits,
  getCreatedDate,
  getDeadline,
  getExperienceColor,
  getJobDescription,
  getJobId,
  getJobType,
  getJobTypeColor,
  getLocation,
  getRequirements,
  getSkills,
  itemText,
} from "./jobFields";
import "./Recruitment.css";
import "./PublicJobDetail.css";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

/**
 * Trang chi tiết tin tuyển dụng CÔNG KHAI — URL riêng /{slug}/career/jobs/{jobId}
 * (trước đây là modal trong trang danh sách). Form ứng tuyển nằm ngay trên trang.
 */
const PublicJobDetail = () => {
  const navigate = useNavigate();
  const { slug, jobId } = useParams();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [otherJobs, setOtherJobs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);
  const [file, setFile] = useState(null);
  const [form] = Form.useForm();
  const applyRef = useRef(null);

  const careerUrl = `/${slug}/career`;

  useEffect(() => {
    let ignore = false;

    const fetchJob = async () => {
      if (!slug || !jobId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await jobsAPI.getPublicJobBySlug(slug, jobId);
        const data = response.data?.data || response.data;
        if (ignore) return;
        if (!data) {
          setNotFound(true);
        } else {
          setJob(data);
        }
      } catch (error) {
        console.error("Error fetching job detail:", error);
        if (!ignore) setNotFound(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    const fetchOthers = async () => {
      if (!slug) return;
      try {
        const response = await jobsAPI.getPublicJobsBySlug(slug);
        const list = response.data?.data || response.data || [];
        if (ignore) return;
        setOtherJobs(
          list.filter((j) => String(getJobId(j)) !== String(jobId)).slice(0, 3),
        );
      } catch (error) {
        console.error("Error fetching other jobs:", error);
      }
    };

    fetchJob();
    fetchOthers();
    window.scrollTo(0, 0);

    return () => {
      ignore = true;
    };
  }, [slug, jobId]);

  const scrollToApply = useCallback(() => {
    applyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Từ trang danh sách bấm "Ứng tuyển" -> điều hướng kèm hash #apply.
  useEffect(() => {
    if (!loading && job && window.location.hash === "#apply") {
      // đợi layout xong rồi mới cuộn
      const timer = setTimeout(scrollToApply, 200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, job, scrollToApply]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (!file) {
        message.error("Vui lòng upload CV (file PDF)");
        return;
      }

      setSubmitting(true);

      const formData = new FormData();
      formData.append("candidateName", values.candidateName);
      formData.append("candidateEmail", values.candidateEmail);
      formData.append("candidatePhone", values.candidatePhone);
      formData.append("file", file);

      await publicCareerAPI.apply(slug, jobId, formData);

      message.success("Nộp CV thành công!");
      setApplied(true);
      form.resetFields();
      setFile(null);
    } catch (error) {
      if (error.errorFields) {
        return; // Form validation failed
      }
      console.error("Error submitting application:", error);
      message.error("Không thể nộp CV. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      message.success("Đã copy link tin tuyển dụng");
    } catch {
      message.info(window.location.href);
    }
  };

  if (loading) {
    return (
      <Layout className="recruitment-layout">
        <CareerHeader />
        <Content className="job-page-loading">
          <Spin size="large" />
        </Content>
        <CareerFooter />
      </Layout>
    );
  }

  if (notFound || !job) {
    return (
      <Layout className="recruitment-layout">
        <CareerHeader />
        <Content className="job-page-content">
          <Result
            status="404"
            title="Không tìm thấy vị trí"
            subTitle="Vị trí tuyển dụng không tồn tại hoặc đã đóng."
            extra={
              <Button type="primary" onClick={() => navigate(careerUrl)}>
                Xem các vị trí đang tuyển
              </Button>
            }
          />
        </Content>
        <CareerFooter />
      </Layout>
    );
  }

  const title = job.title || job.Title || "N/A";
  const description = getJobDescription(job);
  const requirements = getRequirements(job);
  const benefits = getBenefits(job);
  const skills = getSkills(job);
  const deadline = getDeadline(job);
  const createdDate = getCreatedDate(job);
  const jobType = getJobType(job);
  const location = getLocation(job);

  return (
    <Layout className="recruitment-layout">
      <CareerHeader />

      <div className="job-hero">
        <div className="job-hero-inner">
          <Breadcrumb
            className="job-breadcrumb"
            items={[
              {
                title: (
                  <a
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(careerUrl);
                    }}
                    href={careerUrl}
                  >
                    Cơ hội nghề nghiệp
                  </a>
                ),
              },
              { title },
            ]}
          />

          <Title level={1} className="job-hero-title">
            {title}
          </Title>

          <Space size={[8, 8]} wrap className="job-hero-tags">
            {job.department && (
              <Tag color="blue" icon={<BankOutlined />}>
                {job.department}
              </Tag>
            )}
            {jobType && <Tag color={getJobTypeColor(jobType)}>{jobType}</Tag>}
            {job.experienceLevel && (
              <Tag color={getExperienceColor(job.experienceLevel)}>
                {job.experienceLevel}
              </Tag>
            )}
            {(job.workMode || job.workingMode) && (
              <Tag>{job.workMode || job.workingMode}</Tag>
            )}
          </Space>

          <div className="job-hero-meta">
            {location && (
              <span>
                <EnvironmentOutlined /> {location}
              </span>
            )}
            <span>
              <DollarOutlined /> {formatSalary(job)}
            </span>
            {deadline && (
              <span>
                <ClockCircleOutlined /> Hạn nộp: {formatDate(deadline)}
              </span>
            )}
          </div>

          <Space size="middle" wrap className="job-hero-actions">
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              className="apply-btn-large"
              onClick={scrollToApply}
            >
              Ứng tuyển ngay
            </Button>
            <Button
              size="large"
              icon={<LinkOutlined />}
              className="job-hero-share"
              onClick={handleCopyLink}
            >
              Copy link
            </Button>
          </Space>
        </div>
      </div>

      <Content className="job-page-content">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card variant={false} className="detail-card job-section">
              <Title level={4} className="job-section-title">
                Mô tả công việc
              </Title>
              {description ? (
                <Paragraph className="job-section-text">{description}</Paragraph>
              ) : (
                <Text type="secondary">Chưa có mô tả công việc</Text>
              )}
            </Card>

            {requirements.length > 0 && (
              <Card
                variant={false}
                className="detail-card job-section"
                style={{ marginTop: 24 }}
              >
                <Title level={4} className="job-section-title">
                  Yêu cầu ứng viên
                </Title>
                <ul className="job-bullets">
                  {requirements.map((req, idx) => (
                    <li key={idx}>
                      <CheckCircleOutlined className="check-icon" />
                      <span>{itemText(req)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {benefits.length > 0 && (
              <Card
                variant={false}
                className="detail-card job-section"
                style={{ marginTop: 24 }}
              >
                <Title level={4} className="job-section-title">
                  Quyền lợi
                </Title>
                <ul className="job-bullets">
                  {benefits.map((benefit, idx) => (
                    <li key={idx}>
                      <StarOutlined className="star-icon" />
                      <span>{itemText(benefit)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {skills.length > 0 && (
              <Card
                variant={false}
                className="detail-card job-section"
                style={{ marginTop: 24 }}
              >
                <Title level={4} className="job-section-title">
                  Kỹ năng yêu cầu
                </Title>
                <div className="skills-container">
                  {skills.map((skill, idx) => (
                    <Tag key={idx} color="blue" className="skill-tag-large">
                      {itemText(skill)}
                    </Tag>
                  ))}
                </div>
              </Card>
            )}

            {/* ===== FORM ỨNG TUYỂN (ngay trên trang, không popup) ===== */}
            <div ref={applyRef} id="apply">
              <Card
                variant={false}
                className="detail-card job-section apply-section"
                style={{ marginTop: 24 }}
              >
                <Title level={4} className="job-section-title">
                  Ứng tuyển vị trí này
                </Title>

                {applied ? (
                  <Result
                    status="success"
                    title="Đã nhận hồ sơ của bạn!"
                    subTitle="Chúng tôi đã gửi email xác nhận kèm link theo dõi trạng thái hồ sơ."
                    extra={[
                      <Button key="more" onClick={() => navigate(careerUrl)}>
                        Xem vị trí khác
                      </Button>,
                      <Button key="again" onClick={() => setApplied(false)}>
                        Nộp lại CV khác
                      </Button>,
                    ]}
                  />
                ) : (
                  <Form form={form} layout="vertical" requiredMark={false}>
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="Họ và tên"
                          name="candidateName"
                          rules={[
                            { required: true, message: "Vui lòng nhập họ và tên!" },
                          ]}
                        >
                          <Input placeholder="Nhập họ và tên của bạn" size="large" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="Email"
                          name="candidateEmail"
                          rules={[
                            { required: true, message: "Vui lòng nhập email!" },
                            { type: "email", message: "Email không hợp lệ!" },
                          ]}
                        >
                          <Input placeholder="Nhập email của bạn" size="large" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item
                      label="Số điện thoại"
                      name="candidatePhone"
                      rules={[
                        { required: true, message: "Vui lòng nhập số điện thoại!" },
                        {
                          pattern: /^0\d{9}$/,
                          message:
                            "Số điện thoại phải đúng 10 chữ số, bắt đầu bằng 0",
                        },
                      ]}
                    >
                      <Input
                        placeholder="Nhập số điện thoại của bạn"
                        size="large"
                        maxLength={10}
                      />
                    </Form.Item>

                    <Form.Item label="Upload CV (PDF)">
                      <Dragger
                        name="file"
                        maxCount={1}
                        accept=".pdf"
                        beforeUpload={(f) => {
                          if (!f.name.toLowerCase().endsWith(".pdf")) {
                            message.error("Chỉ chấp nhận file PDF!");
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
                        <p className="ant-upload-text">
                          Click hoặc kéo file vào đây để upload
                        </p>
                        <p className="ant-upload-hint">
                          Chỉ chấp nhận file PDF, dung lượng tối đa 20MB
                        </p>
                      </Dragger>
                    </Form.Item>

                    <Button
                      type="primary"
                      size="large"
                      icon={<SendOutlined />}
                      className="apply-btn-large"
                      loading={submitting}
                      onClick={handleSubmit}
                    >
                      Nộp CV ứng tuyển
                    </Button>
                  </Form>
                )}
              </Card>
            </div>
          </Col>

          {/* ===== SIDEBAR ===== */}
          <Col xs={24} lg={8}>
            <div className="job-sidebar">
              <Card variant={false} className="detail-card">
                <Title level={5} className="job-section-title">
                  Thông tin vị trí
                </Title>
                <Descriptions column={1} size="small" className="job-summary">
                  <Descriptions.Item
                    label={
                      <>
                        <DollarOutlined /> Mức lương
                      </>
                    }
                  >
                    {formatSalary(job)}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <>
                        <EnvironmentOutlined /> Địa điểm
                      </>
                    }
                  >
                    {location || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <>
                        <BankOutlined /> Phòng ban
                      </>
                    }
                  >
                    {job.department || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <>
                        <SolutionOutlined /> Loại hình
                      </>
                    }
                  >
                    {jobType || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <>
                        <SolutionOutlined /> Hình thức
                      </>
                    }
                  >
                    {job.workMode || job.workingMode || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <>
                        <SolutionOutlined /> Kinh nghiệm
                      </>
                    }
                  >
                    {job.experienceLevel || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <>
                        <ClockCircleOutlined /> Hạn nộp
                      </>
                    }
                  >
                    {formatDate(deadline)}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <>
                        <CalendarOutlined /> Ngày đăng
                      </>
                    }
                  >
                    {formatDate(createdDate)}
                  </Descriptions.Item>
                </Descriptions>

                <Divider style={{ margin: "16px 0" }} />

                <Button
                  type="primary"
                  block
                  size="large"
                  icon={<SendOutlined />}
                  className="apply-btn-large"
                  onClick={scrollToApply}
                >
                  Ứng tuyển ngay
                </Button>
                <Button
                  block
                  icon={<ArrowLeftOutlined />}
                  style={{ marginTop: 12 }}
                  onClick={() => navigate(careerUrl)}
                >
                  Về danh sách vị trí
                </Button>
              </Card>

              {otherJobs.length > 0 && (
                <Card
                  variant={false}
                  className="detail-card"
                  style={{ marginTop: 24 }}
                >
                  <Title level={5} className="job-section-title">
                    Vị trí khác
                  </Title>
                  <div className="other-jobs">
                    {otherJobs.map((other) => (
                      <div
                        key={getJobId(other)}
                        className="other-job-item"
                        onClick={() =>
                          navigate(`${careerUrl}/jobs/${getJobId(other)}`)
                        }
                      >
                        <Text strong>{other.title || "N/A"}</Text>
                        <div className="other-job-meta">
                          {getLocation(other) && (
                            <span>
                              <EnvironmentOutlined /> {getLocation(other)}
                            </span>
                          )}
                          <span>
                            <DollarOutlined /> {formatSalary(other)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </Col>
        </Row>
      </Content>

      <CareerFooter />
    </Layout>
  );
};

export default PublicJobDetail;
