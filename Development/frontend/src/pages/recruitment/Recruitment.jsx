import React, { useEffect, useMemo, useState } from "react";
import {
  Layout,
  Input,
  Select,
  Checkbox,
  Button,
  Empty,
  Spin,
  Alert,
  Pagination,
} from "antd";
import {
  SearchOutlined,
  EnvironmentOutlined,
  ApartmentOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { jobsAPI, publicCareerAPI } from "../../services/api";
import { CareerHeader, CareerFooter } from "./CareerChrome";
import { useBrandTheme } from "../../contexts/BrandThemeContext";
import {
  getJobId,
  getJobDescription,
  getJobType,
  getLocation,
  getDeadline,
  formatSalary,
  formatDate,
} from "./jobFields";
import "./Recruitment.css";
import "./CareerSite.css";

const { Content } = Layout;

const PAGE_SIZE = 10;

/** Gom giá trị duy nhất của 1 field trên toàn bộ job, bỏ rỗng, sắp A-Z. */
const distinct = (jobs, read) =>
  Array.from(
    new Set(
      jobs
        .map(read)
        .filter((v) => typeof v === "string" && v.trim() !== "")
        .map((v) => v.trim()),
    ),
  ).sort((a, b) => a.localeCompare(b, "vi"));

/**
 * Career Site công khai — danh sách vị trí đang tuyển của 1 công ty (/{slug}/career).
 *
 * Bộ lọc sinh option TỪ DỮ LIỆU THẬT của công ty đó (không hardcode danh sách
 * địa điểm/cấp bậc): job của SRIS đến từ mọi ngành, mỗi công ty một kiểu dữ liệu,
 * hardcode sẽ ra bộ lọc rỗng không chọn được gì. Nhóm nào không có dữ liệu thì ẩn hẳn.
 */
const Recruitment = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { updateBrandColor } = useBrandTheme();

  const [jobs, setJobs] = useState([]);
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState(null);
  const [levels, setLevels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!slug) {
        setError("URL không hợp lệ: thiếu slug công ty. Đường dẫn đúng là /{slug}/career.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const [jobsRes, brandRes] = await Promise.allSettled([
          jobsAPI.getPublicJobsBySlug(slug),
          publicCareerAPI.getBrand(slug),
        ]);

        if (ignore) return;

        if (jobsRes.status === "rejected") throw jobsRes.reason;

        const raw = jobsRes.value.data?.data || jobsRes.value.data || [];
        setJobs(Array.isArray(raw) ? raw : []);

        // Brand hỏng thì vẫn hiện được danh sách — chỉ mất logo/tên công ty.
        const b = brandRes.status === "fulfilled" ? brandRes.value.data || null : null;
        setBrand(b);

        // Career site là trang công khai: CompanyContext (cần đăng nhập) không chạy,
        // nên phải tự nhuộm màu brand của tenant vào --brand-color ở đây.
        // Gọi KHÔNG điều kiện: updateBrandColor lưu màu vào localStorage, nên nếu chỉ
        // gọi khi tenant có màu thì công ty chưa cấu hình sẽ mặc lại màu của công ty
        // xem trước đó. Truyền null -> hàm tự rơi về màu mặc định.
        updateBrandColor(b?.primaryColor);
      } catch (err) {
        console.error("Error fetching public jobs:", err);
        if (!ignore) {
          setError(
            err?.response?.status === 404
              ? `Không tìm thấy trang tuyển dụng của "${slug}".`
              : "Không tải được danh sách vị trí. Vui lòng thử lại.",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [slug, updateBrandColor]);

  const locationOptions = useMemo(() => distinct(jobs, getLocation), [jobs]);

  // Hero khoe tối đa 3 địa điểm cho gọn một dòng, dư thì gộp thành "+N nơi khác".
  const heroLocations = useMemo(() => {
    if (locationOptions.length <= 3) return locationOptions;
    return [...locationOptions.slice(0, 3), `+${locationOptions.length - 3} nơi khác`];
  }, [locationOptions]);

  const levelOptions = useMemo(() => distinct(jobs, (j) => j.experienceLevel), [jobs]);
  const categoryOptions = useMemo(() => distinct(jobs, (j) => j.department), [jobs]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesKeyword =
        !kw ||
        (job.title || "").toLowerCase().includes(kw) ||
        getJobDescription(job).toLowerCase().includes(kw);
      const matchesLocation = !location || getLocation(job) === location;
      const matchesLevel = levels.length === 0 || levels.includes(job.experienceLevel);
      const matchesCategory =
        categories.length === 0 || categories.includes(job.department);
      return matchesKeyword && matchesLocation && matchesLevel && matchesCategory;
    });
  }, [jobs, keyword, location, levels, categories]);

  // Lọc xong mà vẫn đứng ở trang 5 thì màn hình trống trơn -> luôn về trang 1.
  useEffect(() => {
    setPage(1);
  }, [keyword, location, levels, categories]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters =
    keyword !== "" || location !== null || levels.length > 0 || categories.length > 0;

  const clearFilters = () => {
    setKeyword("");
    setLocation(null);
    setLevels([]);
    setCategories([]);
  };

  const openJob = (job) => navigate(`/${slug}/career/jobs/${getJobId(job)}`);

  const renderCard = (job) => {
    const type = getJobType(job);
    const jobLocation = getLocation(job);
    const deadline = getDeadline(job);

    return (
      <article
        key={getJobId(job)}
        className="cs-job-card"
        role="link"
        tabIndex={0}
        onClick={() => openJob(job)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openJob(job);
          }
        }}
      >
        <div className="cs-job-title-row">
          <h2 className="cs-job-title">{job.title || "Vị trí chưa đặt tên"}</h2>
          {job.experienceLevel && (
            <span className="cs-level">
              <span>{job.experienceLevel}</span>
            </span>
          )}
        </div>

        <div className="cs-job-info">
          {type && <span className="cs-type">{type}</span>}
          <span className="cs-salary">
            <DollarOutlined /> Mức lương: <strong>{formatSalary(job)}</strong>
          </span>
        </div>

        <div className="cs-job-meta">
          {job.department && (
            <span className="cs-meta-item">
              <ApartmentOutlined /> {job.department}
            </span>
          )}
          {jobLocation && (
            <span className="cs-meta-item">
              <EnvironmentOutlined /> {jobLocation}
            </span>
          )}
          {deadline && (
            <span className="cs-meta-item">
              <ClockCircleOutlined /> Hạn nộp: {formatDate(deadline)}
            </span>
          )}
        </div>
      </article>
    );
  };

  return (
    <Layout className="recruitment-page career-site">
      <CareerHeader brand={brand} />

      <Content>
        {!error && (
          <section className="cs-hero">
            <div className="cs-container">
              <h1 className="cs-hero-title">
                Cùng xây dựng sự nghiệp tại {brand?.name || "công ty chúng tôi"}
              </h1>
              <p className="cs-hero-sub">
                Xem các vị trí đang tuyển bên dưới. Nộp hồ sơ chỉ mất vài phút — bạn
                sẽ nhận được phản hồi qua email.
              </p>
              {/* Thống kê tính từ dữ liệu thật; chưa tải xong hoặc rỗng thì không hiện
                  con số nào, tránh nhấp nháy "0 vị trí" rồi mới ra số đúng. */}
              {!loading && jobs.length > 0 && (
                <div className="cs-hero-stats">
                  <span className="cs-hero-stat">
                    <TeamOutlined /> {jobs.length} vị trí đang tuyển
                  </span>
                  {heroLocations.length > 0 && (
                    <span className="cs-hero-stat">
                      <EnvironmentOutlined /> {heroLocations.join(" · ")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="cs-container">
          {error ? (
            <Alert
              type="error"
              showIcon
              message="Không hiển thị được trang tuyển dụng"
              description={error}
              style={{ margin: "40px 0" }}
            />
          ) : (
            <div className="cs-list-layout">
              <aside className="cs-filter">
                <div className="cs-filter-title">Bộ lọc</div>

                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Tìm theo từ khóa..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />

                {locationOptions.length > 0 && (
                  <div className="cs-filter-block">
                    <div className="cs-filter-block-title">Địa điểm</div>
                    <Select
                      allowClear
                      style={{ width: "100%" }}
                      placeholder="Tất cả địa điểm"
                      value={location}
                      onChange={(v) => setLocation(v ?? null)}
                      options={locationOptions.map((v) => ({ label: v, value: v }))}
                    />
                  </div>
                )}

                {levelOptions.length > 0 && (
                  <div className="cs-filter-block">
                    <div className="cs-filter-block-title">Kinh nghiệm</div>
                    <Checkbox.Group
                      value={levels}
                      onChange={setLevels}
                      options={levelOptions.map((v) => ({ label: v, value: v }))}
                    />
                  </div>
                )}

                {categoryOptions.length > 0 && (
                  <div className="cs-filter-block">
                    <div className="cs-filter-block-title">Phòng ban</div>
                    <Checkbox.Group
                      value={categories}
                      onChange={setCategories}
                      options={categoryOptions.map((v) => ({ label: v, value: v }))}
                    />
                  </div>
                )}

                {hasFilters && (
                  <div className="cs-filter-block">
                    <Button block onClick={clearFilters}>
                      Xóa bộ lọc
                    </Button>
                  </div>
                )}
              </aside>

              <main>
                <div className="cs-list-head">
                  {/* h2: h1 của trang đã là tiêu đề trong dải hero phía trên. */}
                  <h2 className="cs-list-title">Vị trí đang tuyển</h2>
                  <div className="cs-list-count">
                    <strong>{filtered.length}</strong> vị trí
                    {filtered.length !== jobs.length && ` / ${jobs.length}`}
                  </div>
                </div>

                {loading ? (
                  <div style={{ textAlign: "center", padding: "64px 0" }}>
                    <Spin size="large" />
                  </div>
                ) : filtered.length === 0 ? (
                  <Empty
                    description={
                      jobs.length === 0
                        ? "Hiện chưa có vị trí nào đang tuyển."
                        : "Không có vị trí nào khớp bộ lọc."
                    }
                    style={{ padding: "48px 0" }}
                  >
                    {hasFilters && <Button onClick={clearFilters}>Xóa bộ lọc</Button>}
                  </Empty>
                ) : (
                  <>
                    <div className="cs-job-grid">{pageItems.map(renderCard)}</div>

                    {filtered.length > PAGE_SIZE && (
                      <div className="cs-pagination">
                        <Pagination
                          current={page}
                          pageSize={PAGE_SIZE}
                          total={filtered.length}
                          showSizeChanger={false}
                          onChange={(p) => {
                            setPage(p);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </main>
            </div>
          )}
        </div>
      </Content>

      <CareerFooter brand={brand} />
    </Layout>
  );
};

export default Recruitment;
