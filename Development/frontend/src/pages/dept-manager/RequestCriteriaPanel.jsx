import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Button, Empty, Form, Input, InputNumber, Modal, Popconfirm,
  Space, Table, Tag, Tooltip, Typography, message,
} from "antd";
import {
  CheckCircleOutlined, PlusOutlined, RobotOutlined, EditOutlined, DeleteOutlined
} from "@ant-design/icons";
import { requestCriteriaAPI } from "../../services/api";
import { weightPercentMap } from "../../utils/criteriaWeight";

const { Text } = Typography;

// Lượt bóc chạy NỀN (V037): bấm xong chỉ xếp hàng, worker gọi Local LLM mất hàng chục giây.
// Màn này hỏi lại trạng thái tới khi xong, y như màn Tiêu Chí của tin tuyển dụng.
const POLL_MS = 3000;

/**
 * Bộ tiêu chí ra đề NGAY TRÊN yêu cầu tuyển dụng (V056).
 *
 * Đây là chỗ Trưởng bộ phận vừa mô tả vị trí vừa ra đề — cùng một việc, cùng một văn bản.
 * Chốt xong, bộ tiêu chí nằm chờ; đến khi nhân sự tạo tin từ yêu cầu này thì nó CHUYỂN sang
 * tin và thành phiếu chấm phỏng vấn.
 *
 * Không có bước "gửi duyệt" như màn Tiêu Chí của job (V055): ở đây người ra đề chính là người
 * duyệt, nên thêm một nút gửi cho chính mình không kiểm soát thêm được gì.
 */
const RequestCriteriaPanel = ({ requestId, canEdit, status }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Dòng đang sửa (null = modal đang ở chế độ THÊM). Dùng chung một modal cho thêm/sửa:
  // hai form giống hệt nhau, tách ra chỉ để lệch nhau về sau.
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const pollRef = useRef(null);
  const aliveRef = useRef(true);

  const fetchItems = useCallback(async () => {
    if (!requestId) return;
    try {
      setLoading(true);
      const { data } = await requestCriteriaAPI.list(requestId);
      if (aliveRef.current) setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading request criteria:", error);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [requestId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Dọn timer khi đóng modal / đổi yêu cầu: để lại là nó vẫn gọi API sau khi component chết,
  // và setState trên component đã unmount.
  useEffect(() => {
    aliveRef.current = true;
    fetchItems();
    return () => {
      aliveRef.current = false;
      stopPolling();
    };
  }, [fetchItems, stopPolling]);

  const poll = useCallback(async () => {
    try {
      const { data } = await requestCriteriaAPI.extractStatus(requestId);
      if (!aliveRef.current) return;

      if (data?.running) {
        pollRef.current = setTimeout(poll, POLL_MS);
        return;
      }

      stopPolling();
      setExtracting(false);

      if (data?.status === "DONE") {
        if ((data.criteriaCount ?? 0) === 0) {
          message.info("AI không tìm thấy tiêu chí nào mới so với danh sách hiện có.", 6);
        } else {
          message.success(`AI đề xuất ${data.criteriaCount} tiêu chí — rà lại rồi bấm Chốt.`);
        }
        fetchItems();
        return;
      }

      // JD chỉ có đầu việc, không nêu yêu cầu nào -> KHÔNG phải AI hỏng, là việc người dùng sửa được.
      message.warning(
        data?.errorMessage
          || "AI chưa đề xuất được tiêu chí nào — bạn có thể tự thêm từng dòng.",
        8
      );
    } catch (error) {
      console.error("Error polling extract status:", error);
      if (!aliveRef.current) return;
      stopPolling();
      setExtracting(false);
    }
  }, [requestId, fetchItems, stopPolling]);

  const handleExtract = async () => {
    try {
      setExtracting(true);
      await requestCriteriaAPI.extract(requestId);
      message.info("AI đang đọc yêu cầu tuyển dụng — việc này mất vài chục giây.", 5);
      pollRef.current = setTimeout(poll, POLL_MS);
    } catch (error) {
      console.error("Error requesting extraction:", error);
      setExtracting(false);
      message.error(
        error?.response?.data?.userMsg || "Không thể bóc tiêu chí từ yêu cầu này."
      );
    }
  };

  const draftCount = items.filter((c) => c.status !== "APPROVED").length;
  const approvedCount = items.filter((c) => c.status === "APPROVED").length;
  const weightPct = useMemo(() => weightPercentMap(items, "criteriaId"), [items]);

  const closeForm = () => {
    setAddOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    const payload = {
      name: values.name.trim(),
      weight: values.weight,
      maxScore: editing?.maxScore ?? 10,
    };
    try {
      setBusy(true);
      if (editing) {
        // `active` bắt buộc ở CriteriaUpdateDto — giữ nguyên giá trị đang có, màn này không
        // có chỗ bật/tắt dòng (gỡ hẳn thì dùng nút Xóa).
        await requestCriteriaAPI.update(editing.criteriaId, { ...payload, active: editing.active !== false });
        message.success("Đã sửa tiêu chí.");
      } else {
        await requestCriteriaAPI.add(requestId, payload);
        message.success("Đã thêm tiêu chí.");
      }
      closeForm();
      fetchItems();
    } catch (error) {
      console.error("Error saving criterion:", error);
      message.error(
        error?.response?.data?.userMsg
          || (editing ? "Không sửa được tiêu chí." : "Không thêm được tiêu chí.")
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (record) => {
    try {
      setBusy(true);
      await requestCriteriaAPI.remove(record.criteriaId);
      message.success("Đã xóa tiêu chí.");
      fetchItems();
    } catch (error) {
      console.error("Error deleting criterion:", error);
      message.error(error?.response?.data?.userMsg || "Không xóa được tiêu chí.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (values) => {
    if (!editItem) return;
    try {
      setBusy(true);
      await requestCriteriaAPI.update(editItem.criteriaId, {
        name: values.name.trim(),
        weight: values.weight,
        maxScore: editItem.maxScore || 10,
      });
      message.success("Đã cập nhật tiêu chí.");
      setEditItem(null);
      editForm.resetFields();
      fetchItems();
    } catch (error) {
      console.error("Error updating criterion:", error);
      message.error(error?.response?.data?.userMsg || "Không cập nhật được tiêu chí.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (criteriaId) => {
    try {
      setBusy(true);
      await requestCriteriaAPI.delete(criteriaId);
      message.success("Đã xóa tiêu chí.");
      fetchItems();
    } catch (error) {
      console.error("Error deleting criterion:", error);
      message.error(error?.response?.data?.userMsg || "Không xóa được tiêu chí.");
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    try {
      setBusy(true);
      const { data } = await requestCriteriaAPI.approve(requestId);
      message.success(
        `Đã chốt ${data?.approved ?? draftCount} tiêu chí. Khi nhân sự tạo tin từ yêu cầu này, `
        + "bộ tiêu chí sẽ thành phiếu chấm phỏng vấn."
      );
      fetchItems();
    } catch (error) {
      console.error("Error approving criteria:", error);
      message.error(error?.response?.data?.userMsg || "Không chốt được bộ tiêu chí.");
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      title: "Tiêu chí",
      dataIndex: "name",
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text>{v}</Text>
          {r.source === "AI_EXTRACTED" && (
            <Tag icon={<RobotOutlined />} color="purple" style={{ fontSize: 11 }}>
              AI đề xuất
            </Tag>
          )}
        </Space>
      ),
    },
    {
      // Trọng số thô ("2") không đọc được nếu không biết tổng cả bộ -> quy sang tỉ trọng %,
      // đúng như màn Tiêu Chí của tin. Cùng utils nên hai màn không lệch cách làm tròn.
      title: "Tỉ trọng",
      dataIndex: "weight",
      width: 100,
      render: (w, record) => (
        <Tooltip title={`Trọng số ${w} / tổng trọng số cả bộ`}>
          <Text strong>{weightPct[record.criteriaId] ?? 0}%</Text>
        </Tooltip>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 120,
      render: (v) =>
        v === "APPROVED"
          ? <Tag color="success">Đã chốt</Tag>
          : <Tag color="gold">Bản nháp</Tag>,
    },
  ];

  // AI chỉ ĐỀ XUẤT — người ra đề phải sửa được chữ và gỡ được dòng thừa, nếu không thì "rà lại
  // rồi bấm Chốt" chỉ còn mỗi lựa chọn chốt nguyên văn bản máy viết.
  if (canEdit) {
    columns.push({
      title: "",
      key: "actions",
      width: 90,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Sửa">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record);
                setAddOpen(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa tiêu chí này?"
            description={record.name}
            onConfirm={() => handleDelete(record)}
            okText="Xóa"
            okButtonProps={{ danger: true }}
            cancelText="Giữ lại"
          >
            <Tooltip title="Xóa">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    });
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text strong>Tiêu chí đánh giá ứng viên</Text>
        {canEdit && (
          <Space>
            <Button
              icon={<RobotOutlined />}
              loading={extracting}
              onClick={handleExtract}
            >
              AI bóc tiêu chí
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Thêm tay
            </Button>
          </Space>
        )}
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Bộ tiêu chí này sẽ thành phiếu chấm phỏng vấn của vị trí"
        description={
          "AI đọc chính phần mô tả và yêu cầu bạn vừa nhập ở trên để đề xuất. "
          + "Rà lại rồi bấm Chốt — khi nhân sự tạo tin từ yêu cầu này, bộ tiêu chí đã chốt "
          + "sẽ tự chuyển sang tin để người phỏng vấn chấm theo."
        }
      />

      {draftCount > 0 && canEdit && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${draftCount} tiêu chí đang ở bản nháp`}
          description="Sửa lại nội dung nếu cần rồi chốt. Chỉ tiêu chí ĐÃ CHỐT mới theo sang tin tuyển dụng."
          action={
            <Popconfirm
              title={`Chốt ${draftCount} tiêu chí?`}
              description="Sau khi chốt, đây là bộ tiêu chí dùng để chấm phỏng vấn vị trí này."
              onConfirm={handleApprove}
              okText="Chốt"
              cancelText="Để sau"
            >
              <Button type="primary" icon={<CheckCircleOutlined />} loading={busy}>
                Chốt bộ tiêu chí
              </Button>
            </Popconfirm>
          }
        />
      )}

      {/* Yêu cầu đã duyệt mà không có tiêu chí nào -> tin tạo ra sẽ KHÔNG có phiếu chấm.
          Nói ngay ở đây, vì lúc đó mới phát hiện thì đã muộn.
          REJECTED/CANCELLED thì im: yêu cầu đã đóng, không còn tin nào sinh ra từ nó để mà thiếu. */}
      {approvedCount === 0 && draftCount === 0
        && status !== "REJECTED" && status !== "CANCELLED" && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Chưa có tiêu chí nào"
          description="Tin tuyển dụng tạo từ yêu cầu này sẽ không có phiếu chấm phỏng vấn."
        />
      )}

      <Table
        size="small"
        rowKey="criteriaId"
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={canEdit ? 'Bấm "AI bóc tiêu chí" để bắt đầu' : "Chưa có tiêu chí"}
            />
          ),
        }}
      />

      <Modal
        title={editing ? "Sửa tiêu chí" : "Thêm tiêu chí"}
        open={addOpen}
        onCancel={closeForm}
        onOk={() => form.submit()}
        confirmLoading={busy}
        okText={editing ? "Lưu" : "Thêm"}
        cancelText="Hủy"
        destroyOnClose
      >
        {/* destroyOnClose huỷ Form mỗi lần đóng -> initialValues được áp lại ở lần mở sau.
            Đừng đổi sang form.setFieldsValue trong onClick: lúc đó Form chưa mount, giá trị rơi
            vào hư vô và ô sửa mở ra trống trơn. */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={editing ? { name: editing.name, weight: editing.weight } : { weight: 2 }}
        >
          <Form.Item
            name="name"
            label="Tên tiêu chí"
            rules={[{ required: true, message: "Nhập tên tiêu chí" }]}
          >
            <Input placeholder="Ví dụ: Kinh nghiệm quản lý đội nhóm" />
          </Form.Item>
          <Form.Item
            name="weight"
            label="Trọng số"
            tooltip="Tiêu chí quan trọng gấp mấy lần tiêu chí thường. Bảng hiển thị nó dưới dạng tỉ trọng % trên tổng cả bộ."
            rules={[{ required: true, message: "Nhập trọng số" }]}
          >
            <InputNumber min={1} max={5} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Sửa tiêu chí"
        open={!!editItem}
        onCancel={() => { setEditItem(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        confirmLoading={busy}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item
            name="name"
            label="Tên tiêu chí"
            rules={[{ required: true, message: "Nhập tên tiêu chí" }]}
          >
            <Input placeholder="Ví dụ: Kinh nghiệm quản lý đội nhóm" />
          </Form.Item>
          <Form.Item
            name="weight"
            label="Trọng số"
            tooltip="Tiêu chí quan trọng gấp mấy lần tiêu chí thường"
            rules={[{ required: true, message: "Nhập trọng số" }]}
          >
            <InputNumber min={1} max={5} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RequestCriteriaPanel;
