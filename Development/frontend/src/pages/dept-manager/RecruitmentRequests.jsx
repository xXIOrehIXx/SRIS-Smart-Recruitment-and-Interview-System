import React, { useState } from "react";
import {
  Card,
  Typography,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Modal,
  Descriptions,
  Avatar,
  message,
  Popconfirm,
} from "antd";
import {
  FileTextOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "../Dashboard.css";

const { Title, Text } = Typography;
const { Option } = Select;

const MATCHA_GREEN = "#5D8C3E";

const DeptRecruitmentRequests = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [detailModal, setDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const requests = [
    {
      id: 1,
      title: "Senior Frontend Developer",
      department: "Engineering",
      positions: 2,
      priority: "High",
      submittedDate: "2026-07-05",
      status: "PENDING",
      submittedBy: "Nguyễn Trí Minh",
      employmentType: "FULL_TIME",
      experienceLevel: "Senior",
      description:
        "Cần tuyển 2 Senior Frontend Developer với 4+ năm kinh nghiệm React, TypeScript.",
      requirements:
        "• 4+ năm kinh nghiệm React\n• Thành thạo TypeScript, CSS\n• Có kinh nghiệm với testing",
    },
    {
      id: 2,
      title: "UI/UX Designer",
      department: "Design",
      positions: 1,
      priority: "Medium",
      submittedDate: "2026-07-03",
      status: "PENDING",
      submittedBy: "Trần Thu Hà",
      employmentType: "FULL_TIME",
      experienceLevel: "Mid",
      description: "Cần tuyển 1 UI/UX Designer cho team sản phẩm.",
      requirements:
        "• 2+ năm kinh nghiệm UI/UX\n• Thành thạo Figma\n• Hiểu biết về design system",
    },
    {
      id: 3,
      title: "DevOps Engineer",
      department: "Infrastructure",
      positions: 1,
      priority: "High",
      submittedDate: "2026-07-01",
      status: "APPROVED",
      submittedBy: "Lê Hoàng Nam",
      employmentType: "FULL_TIME",
      experienceLevel: "Senior",
      description: "Cần tuyển DevOps Engineer quản lý hạ tầng cloud.",
      requirements:
        "• 4+ năm kinh nghiệm DevOps\n• Thành thạo AWS/GCP, Docker, Kubernetes",
    },
    {
      id: 4,
      title: "Product Manager",
      department: "Product",
      positions: 1,
      priority: "Medium",
      submittedDate: "2026-06-28",
      status: "APPROVED",
      submittedBy: "Phạm Đức Anh",
      employmentType: "FULL_TIME",
      experienceLevel: "Mid",
      description: "Cần tuyển Product Manager cho dự án mới.",
      requirements: "• 3+ năm kinh nghiệm PM\n• Kinh nghiệm Agile/Scrum",
    },
    {
      id: 5,
      title: "Data Analyst",
      department: "Data",
      positions: 1,
      priority: "Low",
      submittedDate: "2026-06-25",
      status: "REJECTED",
      submittedBy: "Hoàng Minh Tuấn",
      employmentType: "FULL_TIME",
      experienceLevel: "Junior",
      description: "Tuyển Data Analyst hỗ trợ phân tích dữ liệu.",
      requirements: "• 1+ năm kinh nghiệm\n• Thành thạo SQL, Python",
    },
    {
      id: 6,
      title: "Backend Developer",
      department: "Engineering",
      positions: 2,
      priority: "High",
      submittedDate: "2026-07-07",
      status: "PENDING",
      submittedBy: "Vũ Thị Lan",
      employmentType: "FULL_TIME",
      experienceLevel: "Senior",
      description: "Cần tuyển 2 Backend Developer cho team API.",
      requirements:
        "• 4+ năm kinh nghiệm backend\n• Node.js hoặc Java\n• PostgreSQL, Redis",
    },
  ];

  const getStatusConfig = (status) => {
    const configs = {
      PENDING: {
        color: "warning",
        label: "Chờ duyệt",
        icon: <ClockCircleOutlined />,
      },
      APPROVED: {
        color: "success",
        label: "Đã duyệt",
        icon: <CheckCircleOutlined />,
      },
      REJECTED: {
        color: "error",
        label: "Từ chối",
        icon: <CloseCircleOutlined />,
      },
      DRAFT: { color: "default", label: "Nháp", icon: <FileTextOutlined /> },
    };
    return configs[status] || { color: "default", label: status };
  };

  const getPriorityColor = (priority) => {
    const colors = { High: "error", Medium: "warning", Low: "success" };
    return colors[priority] || "default";
  };

  const columns = [
    {
      title: "Vị trí",
      key: "title",
      fixed: "left",
      width: 220,
      render: (_, record) => (
        <div>
          <Text strong>{record.title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.department}
          </Text>
        </div>
      ),
    },
    {
      title: "Số lượng",
      dataIndex: "positions",
      key: "positions",
      width: 90,
      render: (val) => <Tag color="blue">{val} vị trí</Tag>,
    },
    {
      title: "Mức ưu tiên",
      dataIndex: "priority",
      key: "priority",
      width: 110,
      render: (val) => <Tag color={getPriorityColor(val)}>{val}</Tag>,
    },
    {
      title: "Cấp bậc",
      dataIndex: "experienceLevel",
      key: "experienceLevel",
      width: 100,
    },
    {
      title: "Người gửi",
      dataIndex: "submittedBy",
      key: "submittedBy",
      width: 150,
      render: (text) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Avatar
            size={24}
            style={{ backgroundColor: MATCHA_GREEN }}
            icon={<UserOutlined />}
          />
          <Text style={{ fontSize: 13 }}>{text}</Text>
        </div>
      ),
    },
    {
      title: "Ngày gửi",
      dataIndex: "submittedDate",
      key: "submittedDate",
      width: 110,
      render: (date) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
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
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRequest(record);
              setDetailModal(true);
            }}
          />
          {record.status === "PENDING" && (
            <>
              <Popconfirm
                title="Phê duyệt yêu cầu này?"
                onConfirm={() => message.success("Đã phê duyệt!")}
                okText="Duyệt"
                cancelText="Hủy"
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{
                    background: MATCHA_GREEN,
                    borderColor: MATCHA_GREEN,
                  }}
                />
              </Popconfirm>
              <Popconfirm
                title="Từ chối yêu cầu này?"
                onConfirm={() => message.success("Đã từ chối!")}
                okText="Từ chối"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const filteredData = requests.filter((item) => {
    const matchesSearch =
      !searchText ||
      item.title.toLowerCase().includes(searchText.toLowerCase()) ||
      item.department.toLowerCase().includes(searchText.toLowerCase()) ||
      item.submittedBy.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || item.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  return (
    <div className="dept-requests-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Yêu Cầu Tuyển Dụng
          </Title>
          <Text type="secondary">
            Quản lý yêu cầu tuyển dụng từ các phòng ban
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/dept/create-request")}
          style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
        >
          Tạo Yêu Cầu Mới
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Tổng yêu cầu"
              value={requests.length}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Chờ duyệt"
              value={pendingCount}
              valueStyle={{ color: "#faad14" }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Đã duyệt"
              value={approvedCount}
              valueStyle={{ color: "#52c41a" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bordered={false}>
            <Statistic
              title="Từ chối"
              value={rejectedCount}
              valueStyle={{ color: "#f5222d" }}
              prefix={<CloseCircleOutlined />}
            />
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
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 150 }}
            >
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="PENDING">Chờ duyệt</Option>
              <Option value="APPROVED">Đã duyệt</Option>
              <Option value="REJECTED">Từ chối</Option>
              <Option value="DRAFT">Nháp</Option>
            </Select>
            <Select
              value={priorityFilter}
              onChange={setPriorityFilter}
              style={{ width: 130 }}
            >
              <Option value="all">Tất cả</Option>
              <Option value="High">Cao</Option>
              <Option value="Medium">Trung bình</Option>
              <Option value="Low">Thấp</Option>
            </Select>
          </div>
          <Text type="secondary">{filteredData.length} yêu cầu</Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} yêu cầu`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileTextOutlined style={{ color: MATCHA_GREEN }} />
            <span>Chi tiết yêu cầu tuyển dụng</span>
          </div>
        }
        open={detailModal}
        onCancel={() => {
          setDetailModal(false);
          setSelectedRequest(null);
        }}
        footer={
          selectedRequest?.status === "PENDING" ? (
            <Space>
              <Button onClick={() => setDetailModal(false)}>Đóng</Button>
              <Button danger icon={<CloseCircleOutlined />}>
                Từ chối
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              >
                Phê duyệt
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setDetailModal(false)}>Đóng</Button>
          )
        }
        width={700}
      >
        {selectedRequest && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Title level={4}>{selectedRequest.title}</Title>
              <Space>
                <Tag color={getPriorityColor(selectedRequest.priority)}>
                  {selectedRequest.priority}
                </Tag>
                {(() => {
                  const c = getStatusConfig(selectedRequest.status);
                  return (
                    <Tag color={c.color} icon={c.icon}>
                      {c.label}
                    </Tag>
                  );
                })()}
              </Space>
            </div>

            <Descriptions
              column={2}
              bordered
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="Phòng ban">
                {selectedRequest.department}
              </Descriptions.Item>
              <Descriptions.Item label="Số lượng">
                {selectedRequest.positions} vị trí
              </Descriptions.Item>
              <Descriptions.Item label="Cấp bậc">
                {selectedRequest.experienceLevel}
              </Descriptions.Item>
              <Descriptions.Item label="Hình thức">
                {selectedRequest.employmentType}
              </Descriptions.Item>
              <Descriptions.Item label="Người gửi" span={2}>
                {selectedRequest.submittedBy}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày gửi" span={2}>
                {dayjs(selectedRequest.submittedDate).format("DD/MM/YYYY")}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="Mô tả công việc"
              column={1}
              bordered
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item>
                {selectedRequest.description}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="Yêu cầu ứng viên"
              column={1}
              bordered
              size="small"
            >
              <Descriptions.Item>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    margin: 0,
                    fontFamily: "inherit",
                  }}
                >
                  {selectedRequest.requirements}
                </pre>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeptRecruitmentRequests;
