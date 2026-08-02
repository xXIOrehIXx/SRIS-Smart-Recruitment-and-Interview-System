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
import { employmentTypeAPI } from "../../services/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

// Quản lý danh mục hình thức làm việc (V027) — CHỈ Admin, giống danh mục phòng ban.
// Tin tuyển dụng + Yêu cầu tuyển dụng dùng CHUNG danh mục này.
const EmploymentTypeManagement = () => {
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState([]);
  const [searchText, setSearchText] = useState("");

  const [editModal, setEditModal] = useState(false);
  const [selected, setSelected] = useState(null); // null = tạo mới
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const response = await employmentTypeAPI.getAll();
      setTypes(response.data || []);
    } catch (error) {
      console.error("Error fetching employment types:", error);
      message.error("Không thể tải danh sách hình thức làm việc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
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
        await employmentTypeAPI.update(selected.employmentTypeId, values);
        message.success("Đã cập nhật hình thức làm việc");
      } else {
        await employmentTypeAPI.create(values);
        message.success("Đã tạo hình thức làm việc");
      }
      setEditModal(false);
      fetchTypes();
    } catch (error) {
      if (error?.errorFields) return; // lỗi validate form — antd đã hiện dưới ô nhập
      const msg =
        error?.response?.data?.userMsg ||
        error?.response?.data?.UserMsg ||
        "Không lưu được hình thức làm việc";
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: `Xóa hình thức "${record.name}"?`,
      content:
        record.jobCount > 0
          ? `Đang có ${record.jobCount} tin tuyển dụng dùng hình thức này — không xóa được, hãy đổi trạng thái sang Ngừng dùng.`
          : "Hành động này không hoàn tác được.",
      okText: "Xóa",
      okButtonProps: { danger: true, disabled: record.jobCount > 0 },
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await employmentTypeAPI.delete(record.employmentTypeId);
          message.success("Đã xóa hình thức làm việc");
          fetchTypes();
        } catch (error) {
          const msg =
            error?.response?.data?.userMsg ||
            error?.response?.data?.UserMsg ||
            "Không xóa được hình thức làm việc";
          message.error(msg);
        }
      },
    });
  };

  const filtered = types.filter((t) =>
    (t.name || "").toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: "Hình thức làm việc",
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
        status === "Active" ? <Tag color="green">Đang dùng</Tag> : <Tag>Ngừng dùng</Tag>,
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
          <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
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
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Hình thức làm việc
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTypes} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm hình thức
          </Button>
        </Space>
      </Space>

      <Card>
        <Input
          placeholder="Tìm hình thức làm việc..."
          prefix={<SearchOutlined />}
          allowClear
          style={{ maxWidth: 320, marginBottom: 16 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Table
          rowKey="employmentTypeId"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </Card>

      <Modal
        title={selected ? "Sửa hình thức làm việc" : "Thêm hình thức làm việc"}
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
            label="Tên hình thức"
            rules={[
              { required: true, message: "Vui lòng nhập tên hình thức làm việc" },
              { max: 100, message: "Tối đa 100 ký tự" },
            ]}
          >
            <Input placeholder="VD: Toàn thời gian, Thời vụ, Làm việc từ xa..." />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item
            name="status"
            label="Trạng thái"
            tooltip="Ngừng dùng = ẩn khỏi dropdown, tin cũ giữ nguyên"
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
              Đổi tên sẽ tự cập nhật tên mới cho các tin tuyển dụng và yêu cầu tuyển dụng
              đang dùng tên cũ.
            </Text>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default EmploymentTypeManagement;
