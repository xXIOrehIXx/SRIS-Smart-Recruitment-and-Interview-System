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
  message,
  Form,
  Typography,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { departmentAPI } from "../../services/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

// Quản lý danh mục phòng ban (V022) — CHỈ Admin. Job/Yêu cầu tuyển dụng chọn từ danh mục này.
const DepartmentManagement = () => {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [searchText, setSearchText] = useState("");

  const [editModal, setEditModal] = useState(false);
  const [selected, setSelected] = useState(null); // null = tạo mới
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await departmentAPI.getAll();
      setDepartments(response.data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
      message.error("Không thể tải danh sách phòng ban");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const openCreate = () => {
    setSelected(null);
    form.resetFields();
    form.setFieldsValue({ status: "Active" });
    setEditModal(true);
  };

  const openEdit = (record) => {
    setSelected(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      status: record.status,
    });
    setEditModal(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (selected) {
        await departmentAPI.update(selected.departmentId, values);
        message.success("Đã cập nhật phòng ban");
      } else {
        await departmentAPI.create(values);
        message.success("Đã tạo phòng ban");
      }
      setEditModal(false);
      fetchDepartments();
    } catch (error) {
      if (error?.errorFields) return; // lỗi validate form — antd đã hiện dưới ô nhập
      const msg =
        error?.response?.data?.userMsg ||
        error?.response?.data?.UserMsg ||
        "Không lưu được phòng ban";
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: `Xóa phòng ban "${record.name}"?`,
      content:
        record.jobCount > 0
          ? `Phòng ban đang có ${record.jobCount} tin tuyển dụng — không xóa được, hãy đổi trạng thái sang Ngừng dùng.`
          : "Hành động này không hoàn tác được.",
      okText: "Xóa",
      okButtonProps: { danger: true, disabled: record.jobCount > 0 },
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await departmentAPI.delete(record.departmentId);
          message.success("Đã xóa phòng ban");
          fetchDepartments();
        } catch (error) {
          const msg =
            error?.response?.data?.userMsg ||
            error?.response?.data?.UserMsg ||
            "Không xóa được phòng ban";
          message.error(msg);
        }
      },
    });
  };

  const filtered = departments.filter((d) =>
    (d.name || "").toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: "Tên phòng ban",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => (a.name || "").localeCompare(b.name || ""),
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Số tin tuyển dụng",
      dataIndex: "jobCount",
      key: "jobCount",
      width: 160,
      sorter: (a, b) => a.jobCount - b.jobCount,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status) =>
        status === "Active" ? (
          <Tag color="green">Đang dùng</Tag>
        ) : (
          <Tag>Ngừng dùng</Tag>
        ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 130,
      render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "-"),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Quản lý phòng ban
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchDepartments} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm phòng ban
          </Button>
        </Space>
      </Space>

      <Card>
        <Input
          placeholder="Tìm phòng ban..."
          prefix={<SearchOutlined />}
          allowClear
          style={{ maxWidth: 320, marginBottom: 16 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Table
          rowKey="departmentId"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </Card>

      <Modal
        title={selected ? "Sửa phòng ban" : "Thêm phòng ban"}
        open={editModal}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setEditModal(false)}
        okText={selected ? "Lưu" : "Tạo"}
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Tên phòng ban"
            rules={[
              { required: true, message: "Vui lòng nhập tên phòng ban" },
              { max: 255, message: "Tối đa 255 ký tự" },
            ]}
          >
            <Input placeholder="VD: Kinh doanh, Kỹ thuật, Nhân sự..." />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item
            name="status"
            label="Trạng thái"
            tooltip="Ngừng dùng = ẩn khỏi dropdown chọn phòng ban, tin cũ giữ nguyên"
          >
            <Select
              options={[
                { value: "Active", label: "Đang dùng" },
                { value: "Inactive", label: "Ngừng dùng" },
              ]}
            />
          </Form.Item>
          {selected && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Đổi tên phòng ban sẽ tự cập nhật tên mới cho các tin tuyển dụng và
              yêu cầu tuyển dụng đang dùng tên cũ.
            </Text>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentManagement;
