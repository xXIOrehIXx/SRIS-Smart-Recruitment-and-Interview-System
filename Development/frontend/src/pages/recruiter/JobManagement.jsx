import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Dropdown,
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
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ExportOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { jobsAPI } from "../../services/api";
import "./css/JobManagement.css";

const { Title, Text } = Typography;

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

  const handleDeleteJob = async (jobId) => {
    try {
      await jobsAPI.delete(jobId);
      message.success("Xóa tin tuyển dụng thành công");
      fetchJobs();
    } catch (error) {
      console.error("Error deleting job:", error);
      message.error("Không thể xóa tin tuyển dụng");
    }
  };

  const getMenuItems = (record) => {
    const jobId = record.jobId || record.id;
    return [
      {
        key: "view",
        icon: <EyeOutlined />,
        label: "Xem Chi Tiết",
        onClick: () => navigate(`/recruiter/jobs/${jobId}`),
      },
      {
        key: "edit",
        icon: <EditOutlined />,
        label: "Chỉnh Sửa",
        onClick: () => navigate(`/recruiter/jobs/create?edit=${jobId}`),
      },
      {
        key: "candidates",
        icon: <EyeOutlined />,
        label: "Xem Ứng Viên",
        onClick: () => navigate(`/recruiter/jobs/${jobId}/candidates`),
      },
      {
        type: "divider",
      },
      {
        key:
          (record.status || "").toLowerCase() === "open" ? "pause" : "resume",
        icon:
          (record.status || "").toLowerCase() === "open" ? (
            <PauseCircleOutlined />
          ) : (
            <PlayCircleOutlined />
          ),
        label:
          (record.status || "").toLowerCase() === "open"
            ? "Tạm Dừng"
            : "Kích Hoạt Lại",
      },
      {
        key: "delete",
        icon: <DeleteOutlined />,
        label: "Xóa",
        danger: true,
      },
    ];
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
      filters: [
        { text: "Đang mở", value: "Open" },
        { text: "Tạm dừng", value: "Paused" },
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
      title: "",
      key: "actions",
      width: 50,
      render: (_, record) => (
        <Dropdown menu={{ items: getMenuItems(record) }} trigger={["click"]}>
          <Button type="text" icon={<MoreOutlined />} className="action-btn" />
        </Dropdown>
      ),
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
          onClick={() => navigate("/recruiter/jobs/create")}
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
