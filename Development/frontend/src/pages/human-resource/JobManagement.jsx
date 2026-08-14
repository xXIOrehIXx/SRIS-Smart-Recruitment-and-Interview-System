import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Typography,
  Avatar,
  Badge,
  message,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  EditOutlined,
  StopOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  ExportOutlined,
  EyeOutlined,
  PoweroffOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { jobsAPI } from "../../services/api";
import "./css/JobManagement.css";

const { Title, Text } = Typography;

// Bề rộng cố định cho nút đổi trạng thái ở cột Thao Tác — đủ chứa nhãn dài nhất ("Đóng tin").
// Để ngoài component: object literal tạo lại mỗi lần render là prop mới với mọi hàng của bảng.
const ACTION_TOGGLE_STYLE = { minWidth: 94 };

const JobManagement = () => {
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  useEffect(() => {
    fetchJobs();
  }, [pagination.current, pagination.pageSize]);

  const fetchJobs = async (params = {}) => {
    try {
      setLoading(true);
      const response = await jobsAPI.getAll(true);
      // Chuẩn hoá: backend có thể trả thẳng array, hoặc wrapper { data: [...] }, hoặc { items: [...] }
      let raw = response.data;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        raw = raw.data || raw.items || raw.jobs || raw.result || [];
      }
      const jobList = Array.isArray(raw) ? raw : [];
      setJobs(jobList);
      setPagination((prev) => ({
        ...prev,
        total: jobList.length,
      }));
    } catch (error) {
      console.error("Error fetching jobs:", error);
      message.error("Không thể tải danh sách tin tuyển dụng");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination, filters, sorter) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };

  /**
   * Đóng job (soft-close) — gọi DELETE /api/jobs/{id}. BE JobService.CloseAsync set
   * status='Closed' mà không xóa cứng. Sau khi đóng: job không còn trong career site và
   * list mặc định, nhưng vẫn hiện khi filter 'Đã đóng' (giữ row cho analytics + hồ sơ).
   * Yêu cầu xác nhận — đây là thao tác một chiều, Human Resource có thể "Mở lại" sau.
   */
  const handleCloseJob = async (record) => {
    try {
      await jobsAPI.delete(record.jobId || record.id);
      message.success(`Đã đóng tin "${record.title}" — job không còn hiện trên trang công khai.`);
      fetchJobs();
    } catch (error) {
      console.error("Error closing job:", error);
      message.error(error?.response?.data?.userMsg || "Không thể đóng tin tuyển dụng");
    }
  };

  /**
   * Mở lại job Closed -> Open bằng PUT /api/jobs/{id} { status: "Open" }. BE chấp nhận
   * status "Open"/"Closed" trong regex ["Draft|Open|Closed"]. Trước đây menu "Kích hoạt
   * lại" không có onClick — bug UX.
   */
  const handleReopenJob = async (record) => {
    try {
      const jobId = record.jobId || record.id;
      // Lấy job hiện tại, đổi status, gửi PUT — tránh mất các field khác.
      const res = await jobsAPI.getById(jobId);
      const current = res.data || {};
      await jobsAPI.update(jobId, { ...current, status: "Open" });
      message.success(`Đã mở lại tin "${record.title}".`);
      fetchJobs();
    } catch (error) {
      console.error("Error reopening job:", error);
      message.error(error?.response?.data?.userMsg || "Không thể mở lại tin");
    }
  };

  // Đóng tin là thao tác một chiều (mở lại được, nhưng tin biến mất khỏi career site ngay)
  // -> vẫn hỏi lại dù nút đã nằm sẵn trên hàng.
  const confirmCloseJob = (record) => {
    Modal.confirm({
      title: `Đóng tin "${record.title}"?`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Tin sẽ chuyển sang trạng thái <b>Đã đóng</b> và không còn hiện trên trang tuyển dụng công khai.</p>
          <p style={{ marginBottom: 0 }}>
            Hồ sơ ứng viên <b>vẫn được giữ</b> để không mất dữ liệu. Có thể <b>Mở lại</b> sau.
          </p>
        </div>
      ),
      okText: "Đóng tin",
      okButtonProps: { danger: true },
      cancelText: "Hủy",
      onOk: () => handleCloseJob(record),
    });
  };

  const columns = [
    {
      title: "Vị Trí",
      dataIndex: "title",
      key: "title",
      sorter: (a, b) => (a.title || "").localeCompare(b.title || ""),
      render: (text, record) => (
        <div className="job-info-cell">
          <div className="job-title-row">
            <span className="job-title">
              {typeof text === "string" ? text : String(text ?? "")}
            </span>
            <Badge
              count={
                record.applicationCount ||
                (Array.isArray(record.application)
                  ? record.application.length
                  : 0)
              }
              style={{ backgroundColor: "#5D8C3E" }}
              className="applications-badge"
            />
          </div>
          <div className="job-meta-row">
            <Tag className="dept-tag">
              {String(record.department ?? record.departmentName ?? "N/A")}
            </Tag>
            <Text type="secondary" className="location-text">
              {String(record.location ?? record.workLocation ?? "N/A")}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Loại Công Việc",
      key: "employmentType",
      filters: [
        { text: "Full-time", value: "Full-time" },
        { text: "Part-time", value: "Part-time" },
        { text: "Contract", value: "Contract" },
        { text: "Internship", value: "Internship" },
        { text: "Remote", value: "Remote" },
      ],
      onFilter: (value, record) => (record.employmentType || "") === value,
      render: (_, record) => {
        const rawType = record.employmentType ?? record.jobType;
        const type = typeof rawType === "string" ? rawType : "";
        if (!type) return <Text type="secondary">N/A</Text>;
        const colorMap = {
          "Full-time": "green",
          "Part-time": "blue",
          Contract: "orange",
          Internship: "cyan",
          Remote: "purple",
        };
        return <Tag color={colorMap[type] || "default"}>{type}</Tag>;
      },
    },
    {
      title: "Lương",
      dataIndex: "salary",
      key: "salary",
      render: (salary, record) => {
        let salaryText = record.salary;
        if (!salaryText && record.salaryMin && record.salaryMax) {
          salaryText = `${formatCurrency(record.salaryMin)} - ${formatCurrency(record.salaryMax)}`;
        }
        if (typeof salaryText !== "string" || !salaryText)
          salaryText = "Thỏa thuận";
        return <span className="salary-text">{salaryText}</span>;
      },
    },
    {
      title: "Ngày Đăng",
      dataIndex: "createdAt",
      key: "createdAt",
      sorter: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
      render: (date) => (
        <Text type="secondary">{date ? formatDate(date) : "N/A"}</Text>
      ),
    },
    {
      title: "Trạng Thái",
      key: "status",
      // BE chỉ có Draft | Open | Closed (JobCreateDto regex). "Tạm dừng" từng nằm ở đây
      // nhưng không trạng thái nào bên dưới sinh ra nó -> lọc xong luôn rỗng.
      filters: [
        { text: "Đang mở", value: "Open" },
        { text: "Đã đóng", value: "Closed" },
        { text: "Bản nháp", value: "Draft" },
      ],
      onFilter: (value, record) => (record.status || "") === value,
      render: (status, record) => {
        // Chuẩn hoá status — backend có thể trả thẳng string hoặc lồng trong object { value, label }
        let raw = status;
        if (raw && typeof raw === "object") {
          raw = raw.value ?? raw.name ?? raw.code ?? raw.status ?? null;
        }
        const value =
          typeof raw === "string"
            ? raw
            : record && typeof record.status === "string"
              ? record.status
              : "Draft";
        const config = {
          Open: { color: "success", label: "Đang mở" },
          Paused: { color: "warning", label: "Tạm dừng" },
          Closed: { color: "default", label: "Đã đóng" },
          Draft: { color: "processing", label: "Bản nháp" },
        };
        const cfg = config[value] || { color: "default", label: value };
        return <Tag color={cfg.color}>{String(cfg.label)}</Tag>;
      },
    },
    {
      // Ba việc thường làm nhất bày thẳng ra hàng — trước đây nấp sau nút "..." nên phải
      // bấm hai lần mới thấy có những gì.
      title: "Thao Tác",
      key: "actions",
      // 260 vừa đủ cho "Xem + Sửa + Mở lại" nhưng thiếu ~10px cho "Đóng tin" (nhãn dài hơn),
      // nên Space wrap đẩy nút thứ ba xuống dòng và hàng cao gấp đôi. Nới ra cho cả hai nhãn.
      width: 300,
      render: (_, record) => {
        const jobId = record.jobId || record.id;
        const isOpen = (record.status || "").toLowerCase() === "open";
        return (
          <Space size={4} wrap>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/human-resource/jobs/${jobId}`)}
            >
              Xem
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/human-resource/jobs/create?edit=${jobId}`)}
            >
              Sửa
            </Button>
            {/* Hai nhãn dài ngắn khác nhau nhưng cùng MỘT chỗ đứng: khoá bề rộng theo nhãn dài
                hơn ("Đóng tin"). Không khoá thì bấm đổi trạng thái xong cả hàng co giãn theo,
                và cột nào vừa khít ở trạng thái này lại tràn ở trạng thái kia. */}
            {isOpen ? (
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                style={ACTION_TOGGLE_STYLE}
                onClick={() => confirmCloseJob(record)}
              >
                Đóng tin
              </Button>
            ) : (
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                style={ACTION_TOGGLE_STYLE}
                onClick={() => handleReopenJob(record)}
              >
                Mở lại
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const formatCurrency = (value) => {
    if (!value) return "";
    return new Intl.NumberFormat("vi-VN").format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  const filteredData = jobs.filter((job) => {
    const matchesSearch =
      (job.title || "").toLowerCase().includes(searchText.toLowerCase()) ||
      (job.department || "").toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="job-management-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Tin Tuyển Dụng
          </Title>
          <Text type="secondary">
            Quản lý tin tuyển dụng và theo dõi ứng viên
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/human-resource/jobs/create")}
          className="create-btn"
        >
          Đăng Tin Mới
        </Button>
      </div>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Input
              placeholder="Tìm kiếm tin tuyển dụng..."
              prefix={<SearchOutlined style={{ color: "#8c8c8b" }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className="status-filter"
              options={[
                { value: "all", label: "Tất Cả" },
                { value: "Open", label: "Đang mở" },
                { value: "Paused", label: "Tạm dừng" },
                { value: "Closed", label: "Đã đóng" },
                { value: "Draft", label: "Bản nháp" },
              ]}
            />
          </div>
          <div className="toolbar-right">
            {selectedRowKeys.length > 0 && (
              <Text type="secondary" className="selected-count">
                Đã chọn {selectedRowKeys.length} tin
              </Text>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchJobs()}
              loading={loading}
            >
              Làm Mới
            </Button>
          </div>
        </div>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={filteredData}
          rowKey={(record) => record.jobId || record.id}
          className="jobs-table"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} tin tuyển dụng`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
          }}
        />
      </Card>
    </div>
  );
};

export default JobManagement;
