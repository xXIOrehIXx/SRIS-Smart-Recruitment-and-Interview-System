import React, { useState, useEffect, useMemo } from "react";
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
  Select,
  Statistic,
  Spin,
} from "antd";
import {
  SearchOutlined,
  EnvironmentOutlined,
  BankOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  UserOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { jobsAPI } from "../../services/api";
import { CareerHeader, CareerFooter } from "./CareerChrome";
import {
  formatDate,
  formatSalary,
  getDeadline,
  getExperienceColor,
  getJobDescription,
  getJobId,
  getJobType,
  getJobTypeColor,
  getLocation,
  getSkills,
  itemText,
} from "./jobFields";
import "./Recruitment.css";
import { useCompany } from "../../hooks/useCompany";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

const Recruitment = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  const { slug } = useCompany();

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchJobs = async () => {
    try {
      if (!slug) {
        console.error(
          "fetchJobs: thiếu slug — URL phải có dạng /{slug}/career",
        );
        message.error(
          "URL không hợp lệ: thiếu slug công ty. Vui lòng dùng /{slug}/career.",
        );
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await jobsAPI.getPublicJobsBySlug(slug);
      const jobList = response.data?.data || response.data || [];
      setJobs(jobList);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      message.error("Không thể tải danh sách tin tuyển dụng");
    } finally {
      setLoading(false);
    }
  };

  // Lấy danh sách departments duy nhất
  const departments = useMemo(() => {
    const depts = [
      ...new Set(jobs.map((job) => job.department).filter(Boolean)),
    ];
    return depts.sort();
  }, [jobs]);

  // Lọc jobs theo search và department
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        (job.title || "").toLowerCase().includes(searchText.toLowerCase()) ||
        getJobDescription(job).toLowerCase().includes(searchText.toLowerCase()) ||
        getSkills(job).some((skill) =>
          itemText(skill).toLowerCase().includes(searchText.toLowerCase()),
        );
      const matchesDepartment =
        selectedDepartment === "all" || job.department === selectedDepartment;
      return matchesSearch && matchesDepartment;
    });
  }, [jobs, searchText, selectedDepartment]);

  // Chi tiết là TRANG RIÊNG (không còn modal) — /{slug}/career/jobs/{jobId}
  const goToDetail = (job, hash = "") =>
    navigate(`/${slug}/career/jobs/${getJobId(job)}${hash}`);

  const renderJobCard = (job) => {
    const skills = getSkills(job);
    const deadline = getDeadline(job);
    const description = getJobDescription(job);
    const jobType = getJobType(job);
    const location = getLocation(job);

    return (
      <Card
        className="job-card"
        variant={false}
        hoverable
        onClick={() => goToDetail(job)}
      >
        <div className="job-card-header">
          <div className="job-title-section">
            <Title level={5} className="job-title">
              {job.title || job.Title || "N/A"}
            </Title>
            <Space size="small">
              {job.department && (
                <Tag color="blue" icon={<BankOutlined />}>
                  {job.department}
                </Tag>
              )}
              {jobType && (
                <Tag color={getJobTypeColor(jobType)}>{jobType}</Tag>
              )}
              {job.experienceLevel && (
                <Tag color={getExperienceColor(job.experienceLevel)}>
                  {job.experienceLevel}
                </Tag>
              )}
            </Space>
          </div>
          <div className="job-salary">
            <DollarOutlined className="salary-icon" />
            <Text strong className="salary-text">
              {formatSalary(job)}
            </Text>
          </div>
        </div>

        <div className="job-card-body">
          <Paragraph ellipsis={{ rows: 2 }} className="job-description">
            {description}
          </Paragraph>

          <Space size="middle" className="job-meta">
            {location && (
              <span>
                <EnvironmentOutlined /> {location}
              </span>
            )}
            {deadline && (
              <span>
                <ClockCircleOutlined /> Hạn: {formatDate(deadline)}
              </span>
            )}
            {(job.applicationCount || job.applicantCount) && (
              <span>
                <UserOutlined /> {job.applicationCount || job.applicantCount}{" "}
                ứng viên
              </span>
            )}
          </Space>

          {skills.length > 0 && (
            <div className="job-skills">
              {skills.slice(0, 4).map((skill, idx) => (
                <Tag key={idx} className="skill-tag">
                  {itemText(skill)}
                </Tag>
              ))}
              {skills.length > 4 && <Tag>+{skills.length - 4}</Tag>}
            </div>
          )}
        </div>

        <Divider style={{ margin: "12px 0" }} />

        <div className="job-card-footer">
          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                goToDetail(job, "#apply");
              }}
              className="apply-btn"
            >
              Apply ngay
            </Button>
            <Button
              icon={<FileTextOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                goToDetail(job);
              }}
            >
              Chi tiết
            </Button>
          </Space>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <Layout className="recruitment-layout">
        <CareerHeader />
        <Content
          className="recruitment-content"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "60vh",
          }}
        >
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="recruitment-layout">
      <CareerHeader />

      <Content className="recruitment-content">
        <div className="recruitment-header">
          <div className="header-text">
            <Title level={2} className="page-title">
              Cơ Hội Nghề Nghiệp
            </Title>
            <Paragraph className="page-subtitle">
              Khám phá các vị trí tuyển dụng phù hợp với bạn. Chúng tôi luôn tìm
              kiếm những tài năng xuất sắc!
            </Paragraph>
          </div>
          <div className="header-stats">
            <Card className="stat-card" variant={false}>
              <Statistic
                title="Vị trí đang tuyển"
                value={jobs.length}
                suffix="việc"
              />
            </Card>
            <Card className="stat-card" variant={false}>
              <Statistic
                title="Phòng ban"
                value={departments.length}
                suffix="bộ phận"
              />
            </Card>
          </div>
        </div>

        <Card
          className="filters-card"
          variant={false}
          style={{ marginBottom: 24 }}
        >
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={12} lg={10}>
              <Search
                placeholder="Tìm kiếm vị trí, kỹ năng..."
                allowClear
                size="large"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: "100%" }}
              />
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Select
                size="large"
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                placeholder="Chọn phòng ban"
                style={{ width: "100%" }}
              >
                <Option value="all">Tất cả phòng ban</Option>
                {departments.map((dept) => (
                  <Option key={dept} value={dept}>
                    {dept}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} lg={6}>
              <Text type="secondary">
                Tìm thấy <Text strong>{filteredJobs.length}</Text> vị trí phù
                hợp
              </Text>
            </Col>
          </Row>
        </Card>

        {filteredJobs.length > 0 ? (
          <Row gutter={[24, 24]}>
            {filteredJobs.map((job) => (
              <Col xs={24} md={12} xl={8} key={getJobId(job)}>
                {renderJobCard(job)}
              </Col>
            ))}
          </Row>
        ) : (
          <Card variant={false} className="no-results">
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <SearchOutlined
                style={{ fontSize: 64, color: "#d9d9d9", marginBottom: 16 }}
              />
              <Title level={4} type="secondary">
                Không tìm thấy vị trí phù hợp
              </Title>
              <Paragraph type="secondary">
                Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc để xem thêm cơ hội
                nghề nghiệp.
              </Paragraph>
            </div>
          </Card>
        )}
      </Content>

      <CareerFooter />
    </Layout>
  );
};

export default Recruitment;
