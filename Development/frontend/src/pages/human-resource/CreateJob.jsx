import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
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
  Space,
  message,
  Spin,
  Alert,
} from "antd";
import {
  SaveOutlined,
  SendOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import {
  jobsAPI,
  recruitmentRequestAPI,
  usersAPI,
  departmentAPI,
  employmentTypeAPI,
  companyAPI,
} from "../../services/api";
import {
  EXPERIENCE_LEVEL_TO_JOB,
  experienceYearsToJob,
  splitRequirements,
} from "../../services/recruitmentRequest";
import JobSetupSteps from "../../components/JobSetupSteps";
import BulletListInput from "../../components/BulletListInput";
import "./css/CreateJob.css";

// Thiếu Text ở đây là trang SẬP TRẮNG khi vào chế độ sửa: JSX bên dưới có <Text>, không
// destructure thì nó ăn vào class Text của DOM và React gọi class như hàm -> throw.
const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Gợi ý cho 3 dòng yêu cầu đầu tiên. Mỗi dòng một KIỂU yêu cầu khác nhau (bằng cấp / kinh
 * nghiệm / công cụ) để người dùng nhìn ra ngay ranh giới "phải có sẵn" với "sẽ làm sau khi
 * vào" — chỗ hay nhầm nhất, và nhầm là AI bóc tiêu chí ra rỗng.
 * Ví dụ cố tình lấy nghề phổ thông, không lấy nghề IT: sản phẩm tuyển mọi vị trí.
 */
const REQUIREMENT_HINTS = [
  "VD: Tốt nghiệp Cao đẳng trở lên",
  "VD: Có ít nhất 1 năm kinh nghiệm ở vị trí tương đương",
  "VD: Sử dụng thành thạo Excel",
];

/** Gợi ý quyền lợi — cùng tinh thần: nghề phổ thông, không lấy đãi ngộ kiểu công ty IT. */
const BENEFIT_HINTS = [
  "VD: Thưởng lương tháng 13",
  "VD: Đóng BHXH đầy đủ theo quy định",
  "VD: Du lịch, teambuilding hằng năm",
];

/**
 * Gộp quyền lợi riêng của tin với quyền lợi mặc định của công ty (V035).
 *
 * Hai thứ này KHÁC vai nên nối vào nhau chứ không tranh chỗ: DM ghi thứ đặc thù vị trí
 * ("hỗ trợ xăng xe đi thị trường"), mặc định là thứ cả công ty ai cũng có (BHXH, thưởng
 * T13). Bỏ mặc định đi thì HR lại phải gõ tay BHXH cho từng tin — đúng việc đang muốn dẹp.
 *
 * Dòng riêng đứng trước, mặc định nối sau. Khử trùng sau khi trim, không phân biệt hoa
 * thường — nên chỉ bắt được trùng Y HỆT: "Thưởng T13" với "Thưởng lương tháng 13" vẫn ra
 * hai dòng, người dùng tự xoá bớt (danh sách sửa được ngay tại chỗ).
 */
const mergeBenefits = (current, defaults) => {
  const own = (current || []).map((b) => (b || "").trim()).filter(Boolean);
  const seen = new Set(own.map((b) => b.toLowerCase()));
  const merged = [...own];

  (defaults || []).forEach((b) => {
    const line = (b || "").trim();
    if (line && !seen.has(line.toLowerCase())) {
      seen.add(line.toLowerCase());
      merged.push(line);
    }
  });

  // Luôn chừa 1 ô trống để còn chỗ gõ khi chưa có quyền lợi nào.
  return merged.length > 0 ? merged : [""];
};

/**
 * Quy tắc validate cho từng field — đặt riêng để dễ tái sử dụng giữa
 * "Lưu nháp" (chỉ check required cơ bản) và "Đăng tin" (check full).
 *
 * Các con số (min/max) phản ánh BE DTO đi kèm:
 *  - JobCreateDto.Title: [Required, MaxLength(300)]
 *  - JobCreateDto.Status: regex "Draft|Open|Closed"
 *  - JobGetDto.Description: TextArea max 2000
 *  - Job entity: quantity min 1, salary thuộc decimal (lớn)
 *
 * FE validate CHẶT hơn BE (vd: description min 50 ký tự) là chủ ý — muốn cảnh báo Human
 * Resource sớm vì AI bóc tiêu chí đọc chính JD này; JD ngắn quá thì không bóc ra tiêu chí
 * nào (ai-service từ chối JD dưới 30 ký tự) và phải tự nhập tay cả bộ.
 */
/**
 * Đổi giá trị ngày từ API sang thứ <DatePicker> nhận được (dayjs), an toàn với dữ liệu bẩn.
 * Ngày rỗng/không parse được -> undefined: ô để trống, KHÔNG làm sập cả trang.
 */
const toDatePickerValue = (value) => {
  if (!value) return undefined;
  const d = dayjs(value);
  return d.isValid() ? d : undefined;
};

const FIELD_RULES = {
  // Basic — luôn áp dụng kể cả Lưu nháp
  title: () => [
    { required: true, message: "Vui lòng nhập tiêu đề tin đăng" },
    { whitespace: true, message: "Tiêu đề không được chỉ chứa khoảng trắng" },
    { min: 5, message: "Tiêu đề tối thiểu 5 ký tự" },
    { max: 300, message: "Tiêu đề tối đa 300 ký tự" },
  ],
  // Strict — chỉ áp dụng khi Đăng tin
  description: () => [
    { required: true, message: "Vui lòng nhập mô tả công việc" },
    { whitespace: true, message: "Mô tả không được chỉ chứa khoảng trắng" },
    { min: 50, message: "Mô tả tối thiểu 50 ký tự (tin càng rõ yêu cầu thì AI đề xuất tiêu chí càng đúng)" },
    { max: 2000, message: "Mô tả tối đa 2000 ký tự" },
  ],
  department: () => [
    { required: true, message: "Vui lòng chọn phòng ban" },
  ],
  // Bắt buộc khi ĐĂNG tin: người này duyệt ứng viên vào vòng phỏng vấn và chốt tuyển.
  // Thiếu thì hồ sơ nộp về sẽ kẹt ở cột Sàng lọc vì không ai có quyền duyệt (BE cũng chặn).
  departmentManagerId: () => [
    { required: true, message: "Vui lòng chọn trưởng bộ phận phụ trách" },
  ],
  location: () => [
    { required: true, message: "Vui lòng nhập địa điểm" },
    { whitespace: true, message: "Địa điểm không được chỉ chứa khoảng trắng" },
    { min: 2, message: "Địa điểm tối thiểu 2 ký tự" },
    { max: 200, message: "Địa điểm tối đa 200 ký tự" },
  ],
  type: () => [
    { required: true, message: "Vui lòng chọn loại công việc" },
  ],
  quantity: () => [
    { type: "integer", min: 1, message: "Số lượng tối thiểu 1" },
    { type: "integer", max: 999, message: "Số lượng tối đa 999" },
  ],
  skillTags: () => [
    {
      // Giá trị là MẢNG chip (Select mode="tags"), nên rule {max} của antd sẽ đếm số chip
      // chứ không phải số ký tự. Tự kiểm trên đúng chuỗi mà BE sẽ lưu vào cột skill_tags.
      validator: (_, value) =>
        (value || []).join(", ").length > 500
          ? Promise.reject(new Error("Kỹ năng tối đa 500 ký tự"))
          : Promise.resolve(),
    },
  ],
  expiresAt: () => [
    {
      validator: (_, value) => {
        if (!value) return Promise.resolve();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (value.toDate() < today) {
          return Promise.reject(new Error("Hạn nộp đơn phải từ hôm nay trở đi"));
        }
        return Promise.resolve();
      },
    },
  ],
  salaryMin: ({ getFieldValue }) => ({
    rules: [
      { required: true, message: "Vui lòng nhập lương tối thiểu" },
      { type: "number", min: 0, message: "Lương tối thiểu phải ≥ 0" },
      { type: "number", max: 10_000_000_000, message: "Lương tối thiểu quá lớn" },
      {
        validator: (_, value) => {
          if (value == null) return Promise.resolve();
          const max = getFieldValue("salaryMax");
          if (max != null && value > max) {
            return Promise.reject(new Error("Lương tối thiểu phải nhỏ hơn hoặc bằng lương tối đa"));
          }
          return Promise.resolve();
        },
      },
    ],
  }),
  salaryMax: ({ getFieldValue }) => ({
    rules: [
      { required: true, message: "Vui lòng nhập lương tối đa" },
      { type: "number", min: 0, message: "Lương tối đa phải ≥ 0" },
      { type: "number", max: 10_000_000_000, message: "Lương tối đa quá lớn" },
      {
        validator: (_, value) => {
          if (value == null) return Promise.resolve();
          const min = getFieldValue("salaryMin");
          if (min != null && value < min) {
            return Promise.reject(new Error("Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu"));
          }
          return Promise.resolve();
        },
      },
    ],
  }),
};

/**
 * Trả về rules cho từng field theo chế độ:
 *  - "draft": chỉ title (để user lưu dở dang)
 *  - "publish": full validate
 */
const buildRules = (mode, form) => {
  const isDraft = mode === "draft";
  return {
    title: FIELD_RULES.title(),
    // Mô tả, lương, địa điểm — chỉ bắt buộc khi Đăng tin
    description: isDraft ? [] : FIELD_RULES.description(),
    department: isDraft ? [] : FIELD_RULES.department(),
    departmentManagerId: isDraft ? [] : FIELD_RULES.departmentManagerId(),
    location: isDraft ? [] : FIELD_RULES.location(),
    type: isDraft ? [] : FIELD_RULES.type(),
    quantity: isDraft ? [] : FIELD_RULES.quantity(),
    skillTags: isDraft ? [] : FIELD_RULES.skillTags(),
    expiresAt: isDraft ? [] : FIELD_RULES.expiresAt(),
    salaryMin: isDraft
      ? []
      : FIELD_RULES.salaryMin({ getFieldValue: form.getFieldValue }).rules,
    salaryMax: isDraft
      ? []
      : FIELD_RULES.salaryMax({ getFieldValue: form.getFieldValue }).rules,
  };
};

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
  const [deptOptions, setDeptOptions] = useState([]);
  const [employmentOptions, setEmploymentOptions] = useState([]);
  // Quyền lợi mặc định của công ty (V035) — giữ trong ref vì prefill từ Yêu cầu tuyển dụng
  // chạy song song, cần đọc giá trị mới nhất chứ không phải bản đóng băng lúc render.
  const companyDefaultBenefitsRef = useRef([]);
  // mode hiện tại đang validate: "draft" (mặc định — cho phép thiếu field) hay "publish"
  const [mode, setMode] = useState("draft");
  const [formError, setFormError] = useState(null);
  // Rules động — đổi khi mode đổi để Form re-render message phù hợp
  const rules = buildRules(mode, form);

  useEffect(() => {
    // Dropdown "Người quyết tuyển" — DM (kèm Admin, đúng luật Admin làm được mọi việc)
    usersAPI.getOptions("DepartmentManager")
      .then((r) => setDmOptions(r.data || []))
      .catch(() => setDmOptions([]));
    // Dropdown "Phòng ban" — danh mục Department (V022), chỉ hiện Active
    departmentAPI.getAll()
      .then((r) => setDeptOptions((r.data || []).filter((d) => d.status === "Active")))
      .catch(() => setDeptOptions([]));
    // Dropdown "Loại công việc" — danh mục EmploymentType (V027), dùng chung với form Yêu cầu
    employmentTypeAPI.getAll()
      .then((r) => setEmploymentOptions((r.data || []).filter((t) => t.status === "Active")))
      .catch(() => setEmploymentOptions([]));

    // Quyền lợi mặc định của công ty (V035): chỉ điền sẵn cho tin MỚI. Vào SỬA tin cũ mà
    // cũng điền là đè mất quyền lợi người dùng đã sửa riêng cho tin đó.
    // Admin nhập ở /admin/company-branding; HR chỉ ĐỌC (GET /company không gác role).
    if (!searchParams.get("edit")) {
      companyAPI.get()
        .then((r) => {
          const defaults = r.data?.defaultBenefits || [];
          companyDefaultBenefitsRef.current = defaults;
          if (defaults.length === 0) return;
          // Cập nhật theo hàm: prefill từ Yêu cầu tuyển dụng có thể đã điền quyền lợi của DM
          // trước khi lời gọi này về — gộp lên cái đang có, không đạp lên.
          setBenefits((prev) => mergeBenefits(prev, defaults));
        })
        .catch(() => {
          // Không lấy được hồ sơ công ty thì thôi, người dùng vẫn gõ tay được.
          companyDefaultBenefitsRef.current = [];
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editJobId = searchParams.get("edit");
  const requestId = searchParams.get("requestId"); // tạo job TỪ yêu cầu tuyển dụng của DM (5.17)

  const steps = [
    { key: "posting", title: "Đăng tin" },
    { key: "application", title: "Đơn ứng tuyển" },
    { key: "stages", title: "Giai đoạn" },
  ];

  // StrictMode (dev) mount effect 2 lần -> prefill chạy 2 lượt, HR thấy toast lặp
  // và ghi đè cả sửa tay giữa chừng. Ref nhớ đã prefill yêu cầu nào rồi.
  const prefilledRequestIdRef = useRef(null);

  useEffect(() => {
    if (editJobId) {
      setIsEditMode(true);
      fetchJobDetails(editJobId);
    } else if (requestId && prefilledRequestIdRef.current !== requestId) {
      prefilledRequestIdRef.current = requestId;
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

      // Dòng "Kỹ năng yêu cầu: ..." DM gõ -> ô Kỹ Năng riêng, không để lẫn vào gạch đầu dòng.
      const { text: requirementsText, skills } = splitRequirements(req.requirements);

      form.setFieldsValue({
        title: req.title,
        department: req.department,
        // DM ra đề thì cũng chính là người chốt ở bước Offer — điền sẵn, HR đổi được nếu cần.
        departmentManagerId: req.createdBy || undefined,
        // V027: hai form dùng CHUNG danh mục hình thức làm việc -> gán thẳng, không quy đổi.
        type: req.employmentType || undefined,
        // Số năm DM nhập là nguồn chính; yêu cầu cũ (trước V024) mới rơi về cấp bậc.
        experienceLevel:
          experienceYearsToJob(req.experienceYearsMin)
          ?? EXPERIENCE_LEVEL_TO_JOB[req.experienceLevel],
        quantity: req.quantity,
        // Ô Kỹ năng là Select mode="tags" -> nhận MẢNG, không phải chuỗi ngăn phẩy.
        skillTags: skills,
        description: req.description,
        salaryMin: req.salaryMin,
        salaryMax: req.salaryMax,
      });
      if (requirementsText) setRequirements(requirementsText.split("\n").filter(Boolean));
      // Quyền lợi DM ghi là thứ đặc thù vị trí; quyền lợi mặc định của công ty nối vào sau
      // chứ không bị bỏ — nếu không HR lại phải gõ tay BHXH, thưởng T13 cho từng tin.
      setBenefits(
        mergeBenefits(
          req.benefits ? req.benefits.split("\n").filter(Boolean) : [],
          companyDefaultBenefitsRef.current
        )
      );
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
          // Thiếu dòng này là mỗi lần sửa job sẽ gửi kỹ năng RỖNG lên BE -> xoá sạch
          // skill_tags cũ, dù người dùng không hề đụng vào ô đó.
          skillTags: job.skills || [],
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          currency: job.currency || "VND",
          // PHẢI bọc dayjs: ô này là <DatePicker> của antd v5, nó gọi thẳng các hàm của
          // dayjs lên giá trị nhận được. Gán chuỗi ISO từ API vào là component throw và
          // React unmount cả trang -> người dùng thấy MÀN HÌNH TRẮNG. Chỉ job CÓ hạn nộp
          // mới dính, nên lỗi này nằm im cho tới khi có job điền deadline.
          expiresAt: toDatePickerValue(job.deadline || job.expiresAt),
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

  /**
   * Chuẩn hoá giá trị ô Kỹ năng về mảng sạch. Bình thường Select mode="tags" đã trả mảng,
   * nhưng bản nháp lưu trước đây còn giữ chuỗi ngăn phẩy nên vẫn phải chịu được cả hai.
   */
  const toSkillList = (value) => {
    const raw = Array.isArray(value) ? value : String(value || "").split(",");
    return raw.map((s) => s.trim()).filter(Boolean);
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
      // Kỹ năng TỪNG bị bỏ quên ở đây: ô hiện trên form, có validate, có prefill, nhưng
      // không nằm trong payload nên gõ gì cũng mất trắng mà không báo lỗi. BE nhận mảng
      // (JobCreateDto.Skills) rồi tự nối thành chuỗi lưu vào skill_tags.
      skills: toSkillList(values.skillTags),
      // KHÔNG có `isPublished` ở đây nữa: BE không hề có trường đó (JobCreateDto/JobUpdateDto),
      // nên nút "Lưu nháp" trước đây vẫn tạo tin trạng thái Open và tin lên career site ngay.
      // Trạng thái do từng luồng đặt: Lưu nháp -> Draft (chỉ khi tạo mới), Đăng tin -> Open.
    };
  };

  const handleSaveDraft = async () => {
    setMode("draft");
    setFormError(null);
    try {
      // Khi Lưu nháp: chỉ check title là bắt buộc. Các field khác OK để trống.
      await form.validateFields(["title"]);
      setLoading(true);
      const values = form.getFieldsValue();
      const data = getFormData(values);

      if (isEditMode && editingJobId) {
        // Sửa tin đã có: KHÔNG gửi status -> BE giữ nguyên trạng thái đang có. Bấm "Lưu nháp"
        // trên một tin đang đăng chỉ để lưu thay đổi, không âm thầm gỡ tin khỏi career site.
        await jobsAPI.update(editingJobId, data);
        message.success("Cập nhật tin tuyển dụng thành công — bạn có thể tiếp tục chỉnh sửa.");
        // QUAN TRỌNG: KHÔNG navigate sau khi update — user còn đang trong luồng edit. Trước
        // đây navigate("/human-resource/jobs") làm user mất context, muốn sửa tiếp phải vào lại.
        // Tạo mới (không phải edit) thì navigate tới JobDetail vừa tạo cho user xem lại.
      } else {
        // Tin mới lưu nháp -> Draft: chưa hiện trên trang tuyển dụng công khai
        // (career site chỉ lấy tin Open).
        const res = await jobsAPI.create({ ...data, status: "Draft" });
        await linkToRequest(res.data?.jobId);
        message.success("Lưu nháp thành công — tin CHƯA hiển thị trên trang tuyển dụng.");
        navigate("/human-resource/jobs");
      }
    } catch (error) {
      // Lỗi validate (title trống) — antd throw object có errorFields
      if (error?.errorFields) {
        setFormError("Vui lòng nhập tiêu đề để lưu nháp.");
        form.scrollToField(error.errorFields[0].name, {
          block: "center",
          behavior: "smooth",
        });
        return;
      }
      // Lỗi từ BE
      console.error("Error saving job:", error);
      const apiMessage =
        error?.response?.data?.userMsg ||
        error?.response?.data?.UserMsg ||
        error?.response?.data?.message ||
        error?.message;
      setFormError(apiMessage || "Không thể lưu nháp. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    setMode("publish");
    setFormError(null);
    try {
      // Validate TOÀN BỘ trước khi bay BE.
      await form.validateFields();
      setLoading(true);
      const values = form.getFieldsValue();
      // Đăng tin = đưa trạng thái về Open (career site chỉ hiện tin Open).
      const data = { ...getFormData(values), status: "Open" };

      if (isEditMode && editingJobId) {
        await jobsAPI.update(editingJobId, data);
        message.success("Cập nhật và đăng tin thành công! Tin đã hiển thị trên trang tuyển dụng.");
        // Giữ nguyên trang edit để user có thể chỉnh tiếp — KHÔNG navigate (giống handleSaveDraft).
      } else {
        const res = await jobsAPI.create(data);
        await linkToRequest(res.data?.jobId);
        message.success("Tin tuyển dụng đã được đăng thành công!");
        navigate("/human-resource/jobs");
      }
    } catch (error) {
      if (error?.errorFields) {
        const first = error.errorFields[0];
        const firstMsg = first?.errors?.[0];
        setFormError(
          firstMsg || "Vui lòng điền đầy đủ thông tin bắt buộc trước khi đăng tin.",
        );
        form.scrollToField(first.name, { block: "center", behavior: "smooth" });
        return;
      }
      console.error("Error publishing job:", error);
      const apiMessage =
        error?.response?.data?.userMsg ||
        error?.response?.data?.UserMsg ||
        error?.response?.data?.message ||
        error?.message;
      setFormError(apiMessage || "Không thể đăng tin. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Submit bằng Enter trong khi đang ở tab Lưu nháp — vẫn phải cho phép save dở dang.
   * Khi user bấm "Đăng tin" mà fail validate, alert sẽ được set qua handlePublish.
   */
  const onFinishFailed = ({ errorFields }) => {
    const first = errorFields?.[0];
    if (!first) return;
    const msg = first.errors?.[0];
    setFormError(msg || "Vui lòng kiểm tra lại các trường được đánh dấu đỏ.");
    form.scrollToField(first.name, { block: "center", behavior: "smooth" });
  };

  // Tắt Alert tổng khi user sửa bất kỳ field nào
  const dismissFormError = () => {
    if (formError) setFormError(null);
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
                rules={rules.title}
              >
                <Input
                  size="large"
                  placeholder="VD: Nhân viên Kinh doanh"
                  onChange={dismissFormError}
                />
              </Form.Item>

              <Form.Item
                name="description"
                label="Mô tả công việc"
                rules={rules.description}
              >
                <TextArea
                  rows={6}
                  maxLength={2000}
                  showCount
                  placeholder="Những đầu việc ứng viên sẽ làm sau khi vào công ty..."
                  onChange={dismissFormError}
                />
              </Form.Item>

              {/* Ô này quyết định AI có bóc được tiêu chí hay không. Mô tả công việc thường
                  chỉ liệt kê đầu việc — không chấm điểm được cho người chưa vào làm — nên
                  bỏ trống mục yêu cầu là bấm "AI bóc tiêu chí" sẽ ra rỗng. */}
              <Form.Item
                label="Yêu cầu ứng viên"
                tooltip="Thứ ứng viên phải CÓ SẴN trước khi vào làm: bằng cấp, số năm kinh nghiệm, chứng chỉ, ngoại ngữ. Khác với mô tả công việc là thứ họ sẽ làm sau khi vào. AI dựa vào mục này để đề xuất phiếu chấm phỏng vấn."
              >
                <BulletListInput
                  items={requirements}
                  hints={REQUIREMENT_HINTS}
                  fallbackHint="Thêm một yêu cầu với ứng viên"
                  addLabel="Thêm yêu cầu"
                  onAdd={handleAddRequirement}
                  onRemove={handleRemoveRequirement}
                  onChange={handleRequirementChange}
                  onInteract={dismissFormError}
                />
              </Form.Item>

              {/* Quyền lợi cũng từng là ô "tàng hình": state + handler có sẵn, payload có gửi,
                  nhưng JSX không vẽ nên tin đăng ra luôn trống phần này. Đặt cạnh Yêu cầu vì
                  cả hai đều là nội dung hiện trên tin đăng công khai. */}
              <Form.Item
                label="Quyền lợi"
                tooltip="Hiển thị trên tin tuyển dụng công khai để ứng viên cân nhắc. Không dùng để đánh giá — AI đề xuất tiêu chí bỏ qua mục này."
              >
                <BulletListInput
                  items={benefits}
                  hints={BENEFIT_HINTS}
                  fallbackHint="Thêm một quyền lợi"
                  addLabel="Thêm quyền lợi"
                  onAdd={handleAddBenefit}
                  onRemove={handleRemoveBenefit}
                  onChange={handleBenefitChange}
                  onInteract={dismissFormError}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="department"
                    label="Phòng ban"
                    tooltip="Danh mục phòng ban do Admin quản lý (menu Phòng Ban)"
                    rules={rules.department}
                  >
                    <Select
                      showSearch
                      placeholder="-- Chọn phòng ban --"
                      optionFilterProp="label"
                      options={deptOptions.map((d) => ({
                        value: d.name,
                        label: d.name,
                      }))}
                      notFoundContent="Chưa có phòng ban — nhờ Admin tạo ở menu Phòng Ban"
                      onChange={dismissFormError}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="departmentManagerId"
                    label="Trưởng bộ phận phụ trách"
                    tooltip="Người này duyệt ứng viên vào vòng phỏng vấn và chốt tuyển ở bước Quyết định. Bắt buộc khi đăng tin — thiếu thì hồ sơ nộp về sẽ kẹt ở bước Sàng lọc."
                    rules={rules.departmentManagerId}
                  >
                    <Select
                      allowClear
                      showSearch
                      onChange={dismissFormError}
                      optionFilterProp="label"
                      placeholder="Chọn trưởng bộ phận"
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
                    rules={rules.location}
                  >
                    <Input
                      size="large"
                      placeholder="VD: Hà Nội, TP.HCM, Remote..."
                      onChange={dismissFormError}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="type"
                    label="Loại công việc"
                    rules={rules.type}
                  >
                    {/* Danh mục hình thức làm việc (V027) — Admin quản lý ở /admin/employment-types,
                        dùng chung với form Yêu cầu tuyển dụng nên prefill khớp thẳng, không quy đổi. */}
                    <Select
                      size="large"
                      placeholder="Chọn loại công việc"
                      onChange={dismissFormError}
                      options={employmentOptions.map((t) => ({
                        value: t.name,
                        label: t.name,
                      }))}
                      notFoundContent="Chưa có hình thức làm việc nào — Admin thêm ở mục Hình Thức Làm Việc"
                    />
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
                  <Form.Item name="quantity" label="Số Lượng Tuyển" rules={rules.quantity}>
                    <InputNumber
                      size="large"
                      style={{ width: "100%" }}
                      min={1}
                      max={999}
                      placeholder="VD: 3"
                      onChange={dismissFormError}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={16}>
                  <Form.Item
                    name="skillTags"
                    label="Kỹ năng"
                    rules={rules.skillTags}
                    tooltip="Gõ từng kỹ năng rồi nhấn Enter. Dán cả cụm ngăn bởi dấu phẩy cũng được — hệ thống tự tách."
                  >
                    {/* Chip thay vì ô text ngăn phẩy: gõ liền không phẩy thì người dùng THẤY
                        ngay nó dồn thành một chip mà sửa, thay vì âm thầm thành một "kỹ năng"
                        dài cả câu. tokenSeparators nuốt luôn dấu phẩy/chấm phẩy/xuống dòng
                        khi dán từ Word, Excel. */}
                    <Select
                      mode="tags"
                      size="large"
                      tokenSeparators={[",", ";", "\n"]}
                      placeholder="Gõ từng kỹ năng rồi nhấn Enter — VD: Excel"
                      // KHÔNG dùng open={false} để giấu panel: chế độ tags dựa vào panel để
                      // nhận phím Enter, tắt đi là mất đúng thao tác chính. Chỉ bỏ khung
                      // "No data" lúc chưa gõ gì.
                      notFoundContent={null}
                      suffixIcon={null}
                      onChange={dismissFormError}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="expiresAt" label="Hạn nộp đơn" rules={rules.expiresAt}>
                    {/* Hạn nộp ở quá khứ = tin đăng ra đã hết hạn -> chặn ngay ở lịch. */}
                    <DatePicker
                      style={{ width: "100%" }}
                      size="large"
                      placeholder="Chọn hạn nộp"
                      format="DD/MM/YYYY"
                      disabledDate={(current) => current && current < dayjs().startOf("day")}
                      onChange={dismissFormError}
                    />
                  </Form.Item>
                </Col>
              </Row>
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
                    rules={rules.salaryMin}
                    dependencies={["salaryMax"]}
                  >
                    <InputNumber
                      size="large"
                      style={{ width: "100%" }}
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                      placeholder="Tối thiểu"
                      onChange={dismissFormError}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="salaryMax"
                    label="Lương tối đa"
                    rules={rules.salaryMax}
                    dependencies={["salaryMin"]}
                  >
                    <InputNumber
                      size="large"
                      style={{ width: "100%" }}
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                      placeholder="Tối đa"
                      onChange={dismissFormError}
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
          onClick={() => navigate("/human-resource/jobs")}
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
          <Form
            form={form}
            layout="vertical"
            className="job-form"
            onFinishFailed={onFinishFailed}
            scrollToFirstError={{ block: "center", behavior: "smooth" }}
            // Validate mỗi lần blur/change — user sửa sẽ thấy lỗi tự biến mất.
            validateTrigger={["onBlur", "onChange"]}
          >
            {isEditMode && editingJobId && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={
                  <Space>
                    <Text strong>Đang chỉnh sửa tin tuyển dụng.</Text>
                    <Text type="secondary">
                      Sau khi bấm "Lưu nháp" hoặc "Đăng tin", trang sẽ giữ nguyên — bạn có thể
                      tiếp tục chỉnh.
                    </Text>
                  </Space>
                }
                action={
                  <Button size="small" onClick={() => navigate(`/human-resource/jobs/${editingJobId}`)}>
                    Xem tin
                  </Button>
                }
              />
            )}
            {formError && (
              <Alert
                type="error"
                message={formError}
                showIcon
                closable
                onClose={() => setFormError(null)}
                style={{ marginBottom: 16 }}
              />
            )}
            {renderStepContent()}
          </Form>
        </div>
      </div>

      <div className="wizard-footer">
        <Space>
          <div></div>
        </Space>
        <Space>
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
