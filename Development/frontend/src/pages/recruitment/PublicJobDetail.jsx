import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Layout,
  Button,
  Form,
  Input,
  Upload,
  Spin,
  Result,
  Alert,
  Tag,
  message,
} from "antd";
import {
  EnvironmentOutlined,
  DollarOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  InboxOutlined,
  ArrowLeftOutlined,
  ShareAltOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  SolutionOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { jobsAPI, publicCareerAPI } from "../../services/api";
import { CareerHeader, CareerFooter } from "./CareerChrome";
import { useBrandTheme } from "../../contexts/BrandThemeContext";
import {
  getJobId,
  getJobDescription,
  getRequirements,
  getBenefits,
  getSkills,
  getJobType,
  getLocation,
  getDeadline,
  isJobExpired,
  itemText,
  formatSalary,
  formatDate,
} from "./jobFields";
import "./Recruitment.css";
import "./CareerSite.css";

const { Content } = Layout;
const { Dragger } = Upload;

/** Một khối nội dung (Mô tả / Yêu cầu / Quyền lợi) — ẩn hẳn khi job không có dữ liệu. */
const ContentBlock = ({ title, text, items }) => {
  const list = (items || []).map(itemText).filter(Boolean);
  const hasText = typeof text === "string" && text.trim() !== "";
  if (!hasText && list.length === 0) return null;

  return (
    <section className="cs-content-block">
      <h2 className="cs-section-title">{title}</h2>
      {hasText ? (
        <div className="cs-text">{text}</div>
      ) : (
        <ul>
          {list.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
};

const OverviewItem = ({ icon, label, value }) =>
  value ? (
    <div className="cs-overview-item">
      <span className="cs-ov-icon">{icon}</span>
      <div>
        <div className="cs-ov-label">{label}</div>
        <div className="cs-ov-value">{value}</div>
      </div>
    </div>
  ) : null;

/**
 * Trang chi tiết vị trí CÔNG KHAI — /{slug}/career/jobs/{jobId}.
 * Bố cục 2 cột: nội dung tin bên trái, sidebar tóm tắt + form ứng tuyển bên phải.
 */
const PublicJobDetail = () => {
  const navigate = useNavigate();
  const { slug, jobId } = useParams();
  const { updateBrandColor } = useBrandTheme();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [brand, setBrand] = useState(null);
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

    const load = async () => {
      if (!slug || !jobId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [jobRes, brandRes, listRes] = await Promise.allSettled([
          jobsAPI.getPublicJobBySlug(slug, jobId),
          publicCareerAPI.getBrand(slug),
          jobsAPI.getPublicJobsBySlug(slug),
        ]);

        if (ignore) return;

        if (jobRes.status === "rejected") {
          setNotFound(true);
        } else {
          const data = jobRes.value.data?.data || jobRes.value.data;
          if (data) setJob(data);
          else setNotFound(true);
        }

        // Gọi KHÔNG điều kiện (lý do đầy đủ ở Recruitment.jsx): màu brand nằm trong
        // localStorage nên công ty chưa đặt màu phải được reset về mặc định,
        // không mặc lại màu của công ty xem trước đó.
        const b = brandRes.status === "fulfilled" ? brandRes.value.data || null : null;
        setBrand(b);
        updateBrandColor(b?.primaryColor);

        if (listRes.status === "fulfilled") {
          const list = listRes.value.data?.data || listRes.value.data || [];
          setOtherJobs(
            (Array.isArray(list) ? list : [])
              .filter((j) => String(getJobId(j)) !== String(jobId))
              .slice(0, 3),
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    window.scrollTo(0, 0);

    return () => {
      ignore = true;
    };
  }, [slug, jobId, updateBrandColor]);

  const scrollToApply = useCallback(() => {
    applyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Vào thẳng bằng link có #apply (vd từ email) thì cuộn xuống form sau khi render xong.
  useEffect(() => {
    if (!loading && job && window.location.hash === "#apply") {
      const timer = setTimeout(scrollToApply, 200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, job, scrollToApply]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (!file) {
        message.error("Vui lòng đính kèm CV (file PDF)");
        return;
      }

      setSubmitting(true);

      const formData = new FormData();
      formData.append("candidateName", values.candidateName);
      formData.append("candidateEmail", values.candidateEmail);
      formData.append("candidatePhone", values.candidatePhone);
      formData.append("file", file);

      await publicCareerAPI.apply(slug, jobId, formData);

      setApplied(true);
      form.resetFields();
      setFile(null);
    } catch (error) {
      if (error.errorFields) return; // form chưa hợp lệ — antd đã hiện lỗi tại field
      console.error("Error submitting application:", error);
      message.error(
        error?.response?.data?.userMsg || "Không nộp được hồ sơ. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      message.success("Đã copy link tin tuyển dụng");
    } catch {
      message.info(window.location.href);
    }
  };

  if (loading) {
    return (
      <Layout className="recruitment-page career-site">
        <CareerHeader brand={brand} />
        <Content>
          <div style={{ textAlign: "center", padding: "96px 0" }}>
            <Spin size="large" />
          </div>
        </Content>
        <CareerFooter brand={brand} />
      </Layout>
    );
  }

  if (notFound || !job) {
    return (
      <Layout className="recruitment-page career-site">
        <CareerHeader brand={brand} />
        <Content>
          <div className="cs-container">
            <Result
              status="404"
              title="Không tìm thấy vị trí"
              subTitle="Tin tuyển dụng này không tồn tại hoặc đã đóng."
              extra={
                <Button type="primary" onClick={() => navigate(careerUrl)}>
                  Xem các vị trí đang tuyển
                </Button>
              }
            />
          </div>
        </Content>
        <CareerFooter brand={brand} />
      </Layout>
    );
  }

  const type = getJobType(job);
  const location = getLocation(job);
  const deadline = getDeadline(job);
  const expired = isJobExpired(job);
  const skills = getSkills(job).map(itemText).filter(Boolean);

  return (
    <Layout className="recruitment-page career-site">
      <CareerHeader brand={brand} />

      <Content>
        <div className="cs-detail-top">
          <div className="cs-container cs-detail-top-inner">
            <div className="cs-detail-heading">
              <div className="cs-detail-badge">
                <SolutionOutlined />
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 className="cs-detail-title">{job.title}</h1>
                <div className="cs-detail-sub">
                  {brand?.name && <span>{brand.name}</span>}
                  {type && <span className="cs-type">{type}</span>}
                  {job.experienceLevel && (
                    <span className="cs-level">
                      <span>{job.experienceLevel}</span>
                    </span>
                  )}
                  {expired && <Tag color="default">Đã hết hạn nộp hồ sơ</Tag>}
                </div>
              </div>
            </div>

            <div className="cs-detail-actions">
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(careerUrl)}>
                Tất cả vị trí
              </Button>
              {/* Hết hạn: không còn cửa nộp nên nút Ứng tuyển cũng không còn nghĩa. */}
              {!expired && (
                <Button type="primary" onClick={scrollToApply}>
                  Ứng tuyển
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="cs-container">
          <div className="cs-detail-body">
            <div>
              <ContentBlock title="Mô tả công việc" text={getJobDescription(job)} />
              <ContentBlock title="Yêu cầu ứng viên" items={getRequirements(job)} />
              <ContentBlock title="Quyền lợi" items={getBenefits(job)} />
              {skills.length > 0 && (
                <ContentBlock title="Kỹ năng" items={skills} />
              )}
            </div>

            <aside className="cs-sidebar">
              <div className="cs-panel">
                <div className="cs-panel-title">Thông tin chung</div>
                <OverviewItem
                  icon={<EnvironmentOutlined />}
                  label="Nơi làm việc"
                  value={location}
                />
                <OverviewItem
                  icon={<DollarOutlined />}
                  label="Mức lương"
                  value={formatSalary(job)}
                />
                <OverviewItem
                  icon={<TrophyOutlined />}
                  label="Kinh nghiệm"
                  value={job.experienceLevel}
                />
                <OverviewItem
                  icon={<ApartmentOutlined />}
                  label="Phòng ban"
                  value={job.department}
                />
                <OverviewItem
                  icon={<ClockCircleOutlined />}
                  label="Hạn nộp hồ sơ"
                  value={
                    deadline
                      ? `${formatDate(deadline)}${expired ? " — đã hết hạn" : ""}`
                      : null
                  }
                />

                <div className="cs-share">
                  <Button icon={<ShareAltOutlined />} onClick={handleShare} block>
                    Chia sẻ vị trí này
                  </Button>
                </div>
              </div>

              <div className="cs-panel" ref={applyRef} id="apply">
                <div className="cs-panel-title">Ứng tuyển</div>

                {expired ? (
                  <>
                    <Alert
                      type="warning"
                      showIcon
                      message="Đã hết hạn nộp hồ sơ"
                      description={
                        deadline
                          ? `Vị trí này nhận hồ sơ đến hết ngày ${formatDate(deadline)}. Bạn vẫn xem được nội dung tin, nhưng không nộp hồ sơ mới được nữa.`
                          : "Vị trí này đã ngừng nhận hồ sơ. Bạn vẫn xem được nội dung tin, nhưng không nộp hồ sơ mới được nữa."
                      }
                    />
                    <Button
                      style={{ marginTop: 16 }}
                      block
                      onClick={() => navigate(careerUrl)}
                    >
                      Xem vị trí đang tuyển
                    </Button>
                  </>
                ) : applied ? (
                  <div className="cs-apply-done">
                    <Result
                      status="success"
                      title="Đã nhận hồ sơ!"
                      subTitle="Cảm ơn bạn đã ứng tuyển. Chúng tôi sẽ liên hệ nếu hồ sơ phù hợp."
                      extra={
                        <Button onClick={() => navigate(careerUrl)}>
                          Xem vị trí khác
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className="cs-apply-intro">
                      Để lại thông tin và CV, nhà tuyển dụng sẽ liên hệ với bạn.
                    </div>

                    <Form form={form} layout="vertical" requiredMark={false}>
                      <Form.Item
                        name="candidateName"
                        label="Họ và tên"
                        rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
                      >
                        <Input prefix={<UserOutlined />} placeholder="Nguyễn Văn A" />
                      </Form.Item>

                      <Form.Item
                        name="candidatePhone"
                        label="Số điện thoại"
                        rules={[
                          { required: true, message: "Vui lòng nhập số điện thoại" },
                          {
                            pattern: /^0\d{9}$/,
                            message: "Số điện thoại phải đúng 10 chữ số, bắt đầu bằng 0",
                          },
                        ]}
                      >
                        <Input prefix={<PhoneOutlined />} placeholder="0912345678" />
                      </Form.Item>

                      <Form.Item
                        name="candidateEmail"
                        label="Email"
                        rules={[
                          { required: true, message: "Vui lòng nhập email" },
                          { type: "email", message: "Email không hợp lệ" },
                        ]}
                      >
                        <Input prefix={<MailOutlined />} placeholder="ban@email.com" />
                      </Form.Item>

                      <Form.Item label="CV (PDF)" required>
                        <Dragger
                          accept=".pdf"
                          maxCount={1}
                          multiple={false}
                          fileList={file ? [file] : []}
                          // Backend chỉ nhận .pdf; chặn tại đây để người dùng biết ngay
                          // thay vì gửi lên rồi ăn 400. false = không tự upload.
                          beforeUpload={(f) => {
                            const isPdf =
                              f.type === "application/pdf" ||
                              f.name.toLowerCase().endsWith(".pdf");
                            if (!isPdf) {
                              message.error("CV phải là file PDF");
                              return Upload.LIST_IGNORE;
                            }
                            if (f.size > 20 * 1024 * 1024) {
                              message.error("File tối đa 20MB");
                              return Upload.LIST_IGNORE;
                            }
                            setFile(f);
                            return false;
                          }}
                          onRemove={() => setFile(null)}
                        >
                          <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                          </p>
                          <p className="ant-upload-text">Kéo thả CV vào đây</p>
                          <p className="ant-upload-hint">hoặc bấm để chọn file PDF</p>
                        </Dragger>
                      </Form.Item>

                      <Button
                        type="primary"
                        block
                        size="large"
                        loading={submitting}
                        onClick={handleSubmit}
                      >
                        Nộp hồ sơ
                      </Button>
                    </Form>
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>

        {otherJobs.length > 0 && (
          <div className="cs-related">
            <div className="cs-container">
              <div className="cs-related-head">
                <h2 className="cs-related-title">Vị trí khác</h2>
                <Button type="link" onClick={() => navigate(careerUrl)}>
                  Xem tất cả
                </Button>
              </div>

              <div className="cs-related-grid">
                {otherJobs.map((other) => (
                  <article
                    key={getJobId(other)}
                    className="cs-job-card"
                    role="link"
                    tabIndex={0}
                    onClick={() =>
                      navigate(`/${slug}/career/jobs/${getJobId(other)}`)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/${slug}/career/jobs/${getJobId(other)}`);
                      }
                    }}
                  >
                    <div className="cs-job-title-row">
                      <h3 className="cs-job-title">{other.title}</h3>
                    </div>
                    <div className="cs-job-info">
                      {getJobType(other) && (
                        <span className="cs-type">{getJobType(other)}</span>
                      )}
                      <span className="cs-salary">{formatSalary(other)}</span>
                    </div>
                    {getLocation(other) && (
                      <div className="cs-job-meta">
                        <span className="cs-meta-item">
                          <EnvironmentOutlined /> {getLocation(other)}
                        </span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}
      </Content>

      <CareerFooter brand={brand} />
    </Layout>
  );
};

export default PublicJobDetail;
