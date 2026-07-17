import React, { useState } from "react";
import {
  Card,
  Typography,
  Table,
  Tag,
  Avatar,
  Button,
  Space,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Badge,
} from "antd";
import {
  CalendarOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  UserOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "../Dashboard.css";

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = "#5D8C3E";

const DeptInterviewSchedule = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const interviews = [
    {
      id: 1,
      candidate: "Nguyễn Văn Minh",
      position: "Senior Frontend Developer",
      department: "Engineering",
      requestTitle: "Senior Frontend Developer",
      date: "2026-07-08",
      time: "14:00",
      endTime: "15:00",
      duration: 60,
      type: "Technical",
      level: 2,
      interviewers: ["Trần Văn A", "Lê Thị B"],
      status: "SCHEDULED",
      meetingLink: "https://meet.google.com/abc-defg-hij",
    },
    {
      id: 2,
      candidate: "Trần Thị Lan",
      position: "UI/UX Designer",
      department: "Design",
      requestTitle: "UI/UX Designer",
      date: "2026-07-08",
      time: "16:00",
      endTime: "17:00",
      duration: 60,
      type: "HR",
      level: 1,
      interviewers: ["Phạm Văn C"],
      status: "SCHEDULED",
      meetingLink: "https://meet.google.com/xyz-uvwx-rst",
    },
    {
      id: 3,
      candidate: "Lê Hoàng Nam",
      position: "Backend Developer",
      department: "Engineering",
      requestTitle: "Senior Frontend Developer",
      date: "2026-07-09",
      time: "09:00",
      endTime: "10:30",
      duration: 90,
      type: "Technical",
      level: 2,
      interviewers: ["Hoàng Văn D", "Nguyễn Thị E"],
      status: "PENDING",
      meetingLink: "https://meet.google.com/pqr-stuv-wxy",
    },
    {
      id: 4,
      candidate: "Phạm Thu Hà",
      position: "QA Engineer",
      department: "QA",
      requestTitle: "QA Engineer",
      date: "2026-07-09",
      time: "11:00",
      endTime: "12:00",
      duration: 60,
      type: "Culture",
      level: 1,
      interviewers: ["Vũ Văn F"],
      status: "SCHEDULED",
      meetingLink: "https://meet.google.com/mno-pqrs-tuv",
    },
    {
      id: 5,
      candidate: "Hoàng Đức Anh",
      position: "Product Manager",
      department: "Product",
      requestTitle: "Product Manager",
      date: "2026-07-10",
      time: "14:00",
      endTime: "15:00",
      duration: 60,
      type: "Technical",
      level: 3,
      interviewers: ["Đặng Văn G", "Bùi Thị H"],
      status: "COMPLETED",
      meetingLink: null,
    },
    {
      id: 6,
      candidate: "Đỗ Minh Tuấn",
      position: "Data Analyst",
      department: "Data",
      requestTitle: "Data Analyst",
      date: "2026-07-11",
      time: "10:00",
      endTime: "11:00",
      duration: 60,
      type: "HR",
      level: 1,
      interviewers: ["Lý Văn I"],
      status: "PENDING",
      meetingLink: null,
    },
  ];

  const departments = [
    "Engineering",
    "Design",
    "QA",
    "Product",
    "Data",
    "Marketing",
    "Sales",
  ];

  const getStatusConfig = (status) => {
    const configs = {
      SCHEDULED: {
        color: "success",
        label: "Đã lên lịch",
        icon: <CalendarOutlined />,
      },
      PENDING: {
        color: "warning",
        label: "Chờ xác nhận",
        icon: <ClockCircleOutlined />,
      },
      COMPLETED: {
        color: "default",
        label: "Đã hoàn thành",
        icon: <VideoCameraOutlined />,
      },
      CANCELLED: { color: "error", label: "Đã hủy" },
    };
    return configs[status] || { color: "default", label: status };
  };

  const getTypeColor = (type) => {
    const colors = {
      Technical: "blue",
      HR: "green",
      Culture: "purple",
    };
    return colors[type] || "default";
  };

  const columns = [
    {
      title: "Ứng viên",
      key: "candidate",
      fixed: "left",
      width: 240,
      render: (_, record) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar
            style={{ backgroundColor: MATCHA_GREEN }}
            icon={<UserOutlined />}
          />
          <div>
            <Text strong>{record.candidate}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.position}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Phòng ban",
      dataIndex: "department",
      key: "department",
      width: 120,
    },
    {
      title: "Yêu cầu TD",
      dataIndex: "requestTitle",
      key: "requestTitle",
      width: 160,
      render: (text) => <Text type="secondary">{text || "-"}</Text>,
    },
    {
      title: "Ngày & Giờ",
      key: "datetime",
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <CalendarOutlined style={{ color: MATCHA_GREEN }} />
            <Text>{dayjs(record.date).format("DD/MM/YYYY")}</Text>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <ClockCircleOutlined style={{ color: "#faad14" }} />
            <Text>
              {record.time} - {record.endTime}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 110,
      render: (type) => <Tag color={getTypeColor(type)}>{type}</Tag>,
    },
    {
      title: "Vòng",
      dataIndex: "level",
      key: "level",
      width: 80,
      render: (level) => <Tag color="cyan">Vòng {level}</Tag>,
    },
    {
      title: "Người phỏng vấn",
      key: "interviewers",
      width: 180,
      render: (_, record) => (
        <div>
          {record.interviewers.map((name, idx) => (
            <Tag key={idx} style={{ marginBottom: 2 }}>
              {name}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status) => {
        const config = getStatusConfig(status);
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 140,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/dept/interview/${record.id}`)}
          >
            Chi tiết
          </Button>
          {record.meetingLink && (
            <Button
              type="primary"
              size="small"
              icon={<VideoCameraOutlined />}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              onClick={() => window.open(record.meetingLink, "_blank")}
            >
              Tham gia
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const filteredData = interviews.filter((item) => {
    const matchesSearch =
      !searchText ||
      item.candidate.toLowerCase().includes(searchText.toLowerCase()) ||
      item.position.toLowerCase().includes(searchText.toLowerCase()) ||
      item.department.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    const matchesDept =
      departmentFilter === "all" || item.department === departmentFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  const scheduledCount = interviews.filter(
    (i) => i.status === "SCHEDULED",
  ).length;
  const pendingCount = interviews.filter((i) => i.status === "PENDING").length;
  const completedCount = interviews.filter(
    (i) => i.status === "COMPLETED",
  ).length;

  return (
    <div className="dept-interview-schedule-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Lịch Phỏng Vấn
          </Title>
          <Text type="secondary">Quản lý lịch phỏng vấn theo phòng ban</Text>
        </div>
        <Space>
          <Badge
            count={scheduledCount}
            style={{ backgroundColor: MATCHA_GREEN }}
          >
            <Button icon={<CalendarOutlined />}>
              Đã lên lịch: {scheduledCount}
            </Button>
          </Badge>
          <Badge count={pendingCount} style={{ backgroundColor: "#faad14" }}>
            <Button icon={<ClockCircleOutlined />}>
              Chờ xác nhận: {pendingCount}
            </Button>
          </Badge>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Tổng lịch"
              value={interviews.length}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Hôm nay"
              value={interviews.filter((i) => i.date === "2026-07-08").length}
              valueStyle={{ color: MATCHA_GREEN }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic title="Tuần này" value={interviews.length} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic title="Tháng này" value={interviews.length + 5} />
          </Card>
        </Col>
      </Row>

      <Card className="main-card" bordered={false}>
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Input
              placeholder="Tìm kiếm..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
            <Select
              value={departmentFilter}
              onChange={setDepartmentFilter}
              style={{ width: 150 }}
            >
              <Option value="all">Tất cả phòng ban</Option>
              {departments.map((d) => (
                <Option key={d} value={d}>
                  {d}
                </Option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 150 }}
            >
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="SCHEDULED">Đã lên lịch</Option>
              <Option value="PENDING">Chờ xác nhận</Option>
              <Option value="COMPLETED">Đã hoàn thành</Option>
            </Select>
          </div>
          <Text type="secondary">{filteredData.length} lịch phỏng vấn</Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} lịch`,
          }}
          scroll={{ x: 1300 }}
        />
      </Card>
    </div>
  );
};

export default DeptInterviewSchedule;
