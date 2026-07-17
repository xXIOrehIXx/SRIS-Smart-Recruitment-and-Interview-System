import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  DatePicker,
  Select,
  Input,
  message,
  Row,
  Col,
  Descriptions,
  Empty,
  Popconfirm,
  Divider,
  List,
  Badge,
  Tooltip,
  Alert,
  Tabs,
} from "antd";
import {
  PlusOutlined,
  CalendarOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  TeamOutlined,
  MailOutlined,
  PhoneOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  ExclamationCircleTwoTone,
  SendOutlined,
  StopOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { interviewAPI, jobsAPI, applicationAPI } from "../../services/api";
import "../Dashboard.css";

dayjs.extend(utc);

const { Title, Text } = Typography;
const { Option } = Select;

const statusConfig = {
  OPEN: { color: "processing", label: "Đang mở" },
  LOCKED: { color: "warning", label: "Đã khóa" },
  CANCELLED: { color: "error", label: "Đã hủy" },
};

const slotStatusConfig = {
  OPEN: { color: "success", label: "Trống" },
  BOOKED: { color: "processing", label: "Đã đặt" },
  LOCKED: { color: "warning", label: "Khóa" },
};

const inviteStatusConfig = {
  INVITED: { color: "processing", label: "Đã mời" },
  CONFIRMED: { color: "success", label: "Đã chốt" },
  CANCELLED: { color: "error", label: "Đã hủy" },
  EXPIRED: { color: "default", label: "Hết hạn" },
};

const flagConfig = {
  NONE: { color: "default", icon: null, label: "" },
  YELLOW: {
    color: "warning",
    icon: <ExclamationCircleTwoTone twoToneColor="#faad14" />,
    label: "Báo bận 1+ lần",
  },
  RED: {
    color: "error",
    icon: <CloseCircleTwoTone twoToneColor="#f5222d" />,
    label: "Báo bận 2+ lần — cần gọi",
  },
};

const InterviewSchedule = () => {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [candidates, setCandidates] = useState([]);

  const [interviewers, setInterviewers] = useState([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [activePool, setActivePool] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);

  const [createForm] = Form.useForm();
  const [inviteForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // --- Form state cho 2 modal ---
  // Pool: tối đa 3 khung giờ, mỗi khung có PANEL (1..5 interviewer) + thời điểm
  const [poolSlots, setPoolSlots] = useState([]); // [{ id, interviewerIds: [], startTime }]
  const [editingSlotId, setEditingSlotId] = useState(null);

  const MAX_PANEL = 5;

  useEffect(() => {
    fetchJobs();
    fetchInterviewers();
  }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchPools(selectedJob);
      fetchCandidates(selectedJob);
    } else {
      setPools([]);
      setCandidates([]);
    }
  }, [selectedJob]);

  // --- Data fetchers ---
  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      setJobs([]);
    }
  };

  const fetchInterviewers = async () => {
    try {
      const response = await interviewAPI.getInterviewers();
      const data = response?.data || [];
      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data?.data)) list = data.data;
      setInterviewers(
        list.map((i, idx) => ({
          id: i.userId || i.id || idx + 1,
          name:
            i.fullName ||
            i.name ||
            i.userName ||
            i.email ||
            `Interviewer ${idx + 1}`,
          email: i.email || "",
        })),
      );
    } catch (error) {
      console.error("Error fetching interviewers:", error);
      setInterviewers([]);
    }
  };

  const fetchPools = async (jobId) => {
    if (!jobId) return;
    setLoading(true);
    try {
      const response = await interviewAPI.getPoolsByJob(jobId);
      const data = response?.data;
      const list = Array.isArray(data)
        ? data
        : data?.items || data?.pools || [];
      setPools(list);
    } catch (error) {
      console.error("Error fetching pools:", error);
      setPools([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async (jobId) => {
    if (!jobId) {
      setCandidates([]);
      return;
    }
    try {
      const response = await applicationAPI.getAll(jobId);
      const data = response?.data;
      let applications = [];
      if (Array.isArray(data)) applications = data;
      else if (data?.items) applications = data.items;
      else if (data?.applications) applications = data.applications;
      else if (Array.isArray(data?.data)) applications = data.data;

      const mapped = applications
        .filter(
          (item) =>
            (item.currentState || item.state || "").toUpperCase() ===
            "INTERVIEW",
        )
        .map((item) => ({
          applicationId: item.applicationId || item.id,
          candidateId: item.candidateId,
          name: item.candidateName || item.name || "N/A",
          email: item.candidateEmail || item.email || "",
        }));
      setCandidates(mapped);
      if (applications.length > 0 && mapped.length === 0) {
        message.info("Chưa có ứng viên nào ở trạng thái INTERVIEW.");
      }
    } catch (error) {
      console.error("Error fetching candidates:", error);
      setCandidates([]);
    }
  };

  // --- Pool creation ---
  const handleAddSlot = () => {
    if (poolSlots.length >= 3) {
      message.warning("Mỗi pool chỉ được tối đa 3 khung giờ.");
      return;
    }
    const newSlot = { id: Date.now(), interviewerIds: [], startTime: null };
    setPoolSlots((prev) => [...prev, newSlot]);
    setEditingSlotId(newSlot.id);
  };

  const handleSlotChange = (slotId, patch) => {
    setPoolSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, ...patch } : s)),
    );
  };

  const handleRemoveSlot = (slotId) => {
    setPoolSlots((prev) => prev.filter((s) => s.id !== slotId));
    if (editingSlotId === slotId) setEditingSlotId(null);
  };

  const openCreatePool = () => {
    setIsCreateOpen(true);
    setPoolSlots([]);
    setEditingSlotId(null);
    createForm.resetFields();
  };

  const handleCreatePool = async () => {
    if (poolSlots.length === 0) {
      message.error("Vui lòng thêm ít nhất 1 khung giờ.");
      return;
    }
    for (const s of poolSlots) {
      if (!s.startTime) {
        message.error("Mỗi khung giờ phải có thời điểm.");
        return;
      }
      if (!s.interviewerIds || s.interviewerIds.length === 0) {
        message.error(
          "Mỗi khung giờ phải có ít nhất 1 interviewer trong panel.",
        );
        return;
      }
      if (s.interviewerIds.length > MAX_PANEL) {
        message.error(`Mỗi khung tối đa ${MAX_PANEL} interviewer trong panel.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        Slots: poolSlots.map((s) => ({
          InterviewerIds: s.interviewerIds,
          StartTime: dayjs(s.startTime).toISOString(),
        })),
      };
      await interviewAPI.createPool(selectedJob, payload);
      message.success("Đã mở pool khung phỏng vấn.");
      setIsCreateOpen(false);
      setPoolSlots([]);
      setEditingSlotId(null);
      createForm.resetFields();
      fetchPools(selectedJob);
    } catch (error) {
      console.error("Error creating pool:", error);
      const detail =
        error?.response?.data?.message || error?.response?.data?.error;
      message.error(detail || "Tạo pool thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Invite ---
  const openInvite = (pool) => {
    setActivePool(pool);
    setInviteResult(null);
    inviteForm.resetFields();
    setIsInviteOpen(true);
  };

  const handleInvite = async (values) => {
    if (!activePool) return;
    const ids = values?.applicationIds || [];
    if (ids.length === 0) {
      message.error("Vui lòng chọn ít nhất 1 ứng viên.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await interviewAPI.inviteToPool(activePool.poolId, {
        ApplicationIds: ids,
      });
      setInviteResult(response?.data || { Invited: [], Skipped: [] });
      message.success(
        `Đã mời ${response?.data?.Invited?.length || 0} ứng viên.`,
      );
      inviteForm.resetFields();
      fetchPools(selectedJob);
    } catch (error) {
      console.error("Error inviting:", error);
      const detail =
        error?.response?.data?.message || error?.response?.data?.error;
      message.error(detail || "Mời thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPool = async (pool) => {
    setSubmitting(true);
    try {
      await interviewAPI.cancelPool(pool.poolId, {
        Reason: "Hủy bởi recruiter",
      });
      message.success("Đã hủy pool.");
      fetchPools(selectedJob);
    } catch (error) {
      console.error("Error cancelling pool:", error);
      const detail =
        error?.response?.data?.message || error?.response?.data?.error;
      message.error(detail || "Hủy pool thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Helpers ---
  const interviewerName = (id) => {
    const found = interviewers.find((i) => String(i.id) === String(id));
    return found?.name || `ID #${id}`;
  };

  // Candidate đã được mời trong pool hiện tại (để ẩn khỏi dropdown)
  const alreadyInvitedAppIds = (pool) => {
    if (!pool?.invitedCandidates && !pool?.InvitedCandidates) return [];
    const list = pool.invitedCandidates || pool.InvitedCandidates || [];
    return list.map((c) => c.applicationId || c.ApplicationId);
  };

  // --- Render ---
  return (
    <div className="interview-schedule-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">
            Interview Schedule
          </Title>
          <Text type="secondary">
            Mở pool khung giờ dùng chung → mời ứng viên chọn khung (Section 15)
          </Text>
        </div>
        <Space>
          <Select
            placeholder="Chọn tin tuyển dụng"
            value={selectedJob}
            onChange={setSelectedJob}
            style={{ width: 280 }}
            allowClear
          >
            {jobs.map((job) => (
              <Option key={job.jobId || job.id} value={job.jobId || job.id}>
                {job.title}
              </Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreatePool}
            disabled={!selectedJob}
          >
            Mở pool mới
          </Button>
        </Space>
      </div>

      {!selectedJob ? (
        <Card bordered={false}>
          <Empty description="Chọn 1 tin tuyển dụng để xem và tạo pool phỏng vấn." />
        </Card>
      ) : (
        <Card bordered={false} loading={loading}>
          {pools.length === 0 ? (
            <Empty description="Chưa có pool nào cho job này. Bấm 'Mở pool mới'." />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={pools}
              renderItem={(pool) => {
                const slots = pool.slots || pool.Slots || [];
                const invited =
                  pool.invitedCandidates || pool.InvitedCandidates || [];
                const poolStatus = pool.status || pool.Status;
                const round = pool.roundNumber ?? pool.RoundNumber ?? 1;
                return (
                  <Card
                    key={pool.poolId || pool.PoolId}
                    type="inner"
                    style={{ marginBottom: 16 }}
                    title={
                      <Space>
                        <TeamOutlined />
                        <Text strong>
                          Pool #{pool.poolId || pool.PoolId} — Vòng {round}
                        </Text>
                        <Tag
                          color={statusConfig[poolStatus]?.color || "default"}
                        >
                          {statusConfig[poolStatus]?.label || poolStatus}
                        </Tag>
                      </Space>
                    }
                    extra={
                      poolStatus !== "CANCELLED" &&
                      poolStatus !== "LOCKED" && (
                        <Space>
                          <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={() => openInvite(pool)}
                          >
                            Mời ứng viên
                          </Button>
                          <Popconfirm
                            title="Hủy pool này?"
                            description="Khung sẽ bị khóa, các lời mời chờ sẽ bị hủy."
                            okText="Hủy pool"
                            cancelText="Không"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleCancelPool(pool)}
                          >
                            <Button danger icon={<StopOutlined />}>
                              Hủy pool
                            </Button>
                          </Popconfirm>
                        </Space>
                      )
                    }
                  >
                    <Row gutter={16}>
                      <Col span={11}>
                        <Title level={5}>
                          <ClockCircleOutlined /> Khung giờ ({slots.length})
                        </Title>
                        <List
                          size="small"
                          dataSource={slots}
                          renderItem={(slot) => {
                            const st = slot.status || slot.Status;
                            const booked =
                              slot.bookedApplicationId ||
                              slot.BookedApplicationId;
                            const panel =
                              slot.interviewers || slot.Interviewers || [];
                            return (
                              <List.Item>
                                <Space
                                  direction="vertical"
                                  size={4}
                                  style={{ width: "100%" }}
                                >
                                  <Space>
                                    <CalendarOutlined />
                                    <Text>
                                      {dayjs
                                        .utc(slot.startTime || slot.StartTime)
                                        .local()
                                        .format("DD/MM/YYYY HH:mm")}
                                    </Text>
                                    <Tag
                                      color={
                                        slotStatusConfig[st]?.color || "default"
                                      }
                                    >
                                      {slotStatusConfig[st]?.label || st}
                                    </Tag>
                                    {booked && (
                                      <Tag color="success">Đã có ứng viên</Tag>
                                    )}
                                  </Space>
                                  <Space wrap>
                                    <TeamOutlined />
                                    <Text type="secondary">
                                      Người phỏng vấn ({panel.length}):
                                    </Text>
                                    {panel.length === 0 ? (
                                      <Tag>—</Tag>
                                    ) : (
                                      panel.map((i) => {
                                        const iid =
                                          i.interviewerId || i.InterviewerId;
                                        return (
                                          <Tag key={iid} color="blue">
                                            {i.fullName ||
                                              i.FullName ||
                                              `ID #${iid}`}
                                          </Tag>
                                        );
                                      })
                                    )}
                                  </Space>
                                </Space>
                              </List.Item>
                            );
                          }}
                        />
                      </Col>
                      <Col span={13}>
                        <Title level={5}>
                          <MailOutlined /> Ứng viên đã mời ({invited.length})
                        </Title>
                        {invited.length === 0 ? (
                          <Text type="secondary">Chưa mời ai.</Text>
                        ) : (
                          <List
                            size="small"
                            dataSource={invited}
                            renderItem={(inv) => {
                              const st = inv.status || inv.Status;
                              const flag = inv.flag || inv.Flag || "NONE";
                              const count =
                                inv.noSlotFitsCount ?? inv.NoSlotFitsCount ?? 0;
                              const appId =
                                inv.applicationId || inv.ApplicationId;
                              const candidate = candidates.find(
                                (c) =>
                                  String(c.applicationId) === String(appId),
                              );
                              const appLabel =
                                candidate?.name || `App #${appId}`;
                              return (
                                <List.Item>
                                  <Space>
                                    <Text strong>{appLabel}</Text>
                                    <Tag
                                      color={
                                        inviteStatusConfig[st]?.color ||
                                        "default"
                                      }
                                    >
                                      {inviteStatusConfig[st]?.label || st}
                                    </Tag>
                                    {flag !== "NONE" && (
                                      <Tooltip title={flagConfig[flag]?.label}>
                                        <Tag color={flagConfig[flag]?.color}>
                                          {flagConfig[flag]?.icon} {count} lần
                                          báo bận
                                        </Tag>
                                      </Tooltip>
                                    )}
                                    {st === "INVITED" && flag !== "NONE" && (
                                      <Tooltip title="Recruiter nên gọi điện chốt tay qua /manual-interview">
                                        <Tag
                                          icon={<PhoneOutlined />}
                                          color="orange"
                                        >
                                          Gợi ý gọi
                                        </Tag>
                                      </Tooltip>
                                    )}
                                  </Space>
                                </List.Item>
                              );
                            }}
                          />
                        )}
                      </Col>
                    </Row>
                  </Card>
                );
              }}
            />
          )}
        </Card>
      )}

      {/* Modal: Tạo pool */}
      <Modal
        title="Mở pool khung giờ phỏng vấn"
        open={isCreateOpen}
        onCancel={() => setIsCreateOpen(false)}
        width={720}
        footer={[
          <Button key="cancel" onClick={() => setIsCreateOpen(false)}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={submitting}
            onClick={handleCreatePool}
          >
            Tạo pool
          </Button>,
        ]}
      >
        <Alert
          message="Mỗi pool = 1 bộ khung giờ dùng chung cho 1 job + 1 vòng phỏng vấn. Mỗi khung có 1–5 người phỏng vấn cùng dự buổi."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        {selectedJobDetail && (
          <Descriptions
            size="small"
            column={1}
            bordered
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="Job">
              {selectedJobDetail.title}
            </Descriptions.Item>
            <Descriptions.Item label="Phòng ban">
              {selectedJobDetail.department || "—"}
            </Descriptions.Item>
          </Descriptions>
        )}

        <Form form={createForm} layout="vertical">
          <Space style={{ marginBottom: 12 }}>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddSlot}
              disabled={poolSlots.length >= 3}
            >
              Thêm khung giờ ({poolSlots.length}/3)
            </Button>
          </Space>

          {poolSlots.length === 0 ? (
            <Empty description="Chưa có khung giờ nào" />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={poolSlots}
              renderItem={(slot, idx) => (
                <Card
                  key={slot.id}
                  size="small"
                  type="inner"
                  title={`Khung #${idx + 1}`}
                  style={{ marginBottom: 12 }}
                  extra={
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveSlot(slot.id)}
                    >
                      Xóa
                    </Button>
                  }
                >
                  <Row gutter={12}>
                    <Col span={10}>
                      <Text type="secondary">
                        Người phỏng vấn ({(slot.interviewerIds || []).length}/
                        {MAX_PANEL})
                      </Text>
                      <Select
                        mode="multiple"
                        style={{ width: "100%" }}
                        placeholder="Chọn 1–5 người cùng dự buổi phỏng vấn"
                        value={slot.interviewerIds || []}
                        onChange={(v) => {
                          if (v.length > MAX_PANEL) {
                            message.warning(
                              `Mỗi khung tối đa ${MAX_PANEL} người phỏng vấn.`,
                            );
                            return;
                          }
                          handleSlotChange(slot.id, { interviewerIds: v });
                        }}
                        showSearch
                        optionFilterProp="children"
                        maxTagCount="responsive"
                      >
                        {interviewers.map((i) => (
                          <Option key={i.id} value={i.id}>
                            {i.name} {i.email ? `(${i.email})` : ""}
                          </Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={14}>
                      <Text type="secondary">Thời điểm</Text>
                      <DatePicker
                        showTime
                        format="DD/MM/YYYY HH:mm"
                        placeholder="Chọn ngày giờ"
                        value={slot.startTime}
                        onChange={(v) =>
                          handleSlotChange(slot.id, { startTime: v })
                        }
                        disabledDate={(current) =>
                          current && current < dayjs().startOf("day")
                        }
                        style={{ width: "100%" }}
                      />
                    </Col>
                  </Row>
                </Card>
              )}
            />
          )}
        </Form>
      </Modal>

      {/* Modal: Mời ứng viên */}
      <Modal
        title={`Mời ứng viên vào Pool #${activePool?.poolId || activePool?.PoolId || ""}`}
        open={isInviteOpen}
        onCancel={() => {
          setIsInviteOpen(false);
          setInviteResult(null);
        }}
        width={720}
        footer={null}
      >
        <Alert
          message="Mỗi ứng viên được mời sẽ nhận 1 email chứa magic link SCHEDULE để chọn khung giờ. Ai chốt trước lấy trước."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {!inviteResult ? (
          <Form form={inviteForm} layout="vertical" onFinish={handleInvite}>
            <Form.Item
              name="applicationIds"
              label="Chọn ứng viên (chỉ những người đang ở trạng thái INTERVIEW)"
              rules={[
                { required: true, message: "Vui lòng chọn ít nhất 1 ứng viên" },
              ]}
            >
              <Select
                mode="multiple"
                placeholder={
                  candidates.length
                    ? "Chọn ứng viên"
                    : "Job này chưa có ứng viên ở trạng thái INTERVIEW"
                }
                showSearch
                optionFilterProp="children"
                disabled={candidates.length === 0}
                filterOption={(input, option) =>
                  (option?.children || "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {candidates
                  .filter(
                    (c) =>
                      !alreadyInvitedAppIds(activePool).includes(
                        c.applicationId,
                      ),
                  )
                  .map((c) => (
                    <Option key={c.applicationId} value={c.applicationId}>
                      {c.name} {c.email ? `(${c.email})` : ""}
                    </Option>
                  ))}
              </Select>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
              <Space>
                <Button onClick={() => setIsInviteOpen(false)}>Hủy</Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  Gửi lời mời
                </Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <div>
            <Title level={5}>Kết quả mời</Title>
            <List
              size="small"
              header={
                <Text strong>Đã mời ({inviteResult.Invited?.length || 0})</Text>
              }
              dataSource={inviteResult.Invited || []}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Tooltip title="Copy magic link cho ứng viên (chỉ hiển thị 1 lần ở đây)">
                      <Button
                        size="small"
                        icon={<LinkOutlined />}
                        onClick={() => {
                          navigator.clipboard.writeText(
                            item.MagicToken || item.magicToken || "",
                          );
                          message.success("Đã copy token vào clipboard.");
                        }}
                      >
                        Copy link
                      </Button>
                    </Tooltip>,
                  ]}
                >
                  <Space>
                    <CheckCircleTwoTone twoToneColor="#52c41a" />
                    <Text>App #{item.ApplicationId || item.applicationId}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Hết hạn:{" "}
                      {dayjs(item.TokenExpiresAt || item.tokenExpiresAt).format(
                        "DD/MM/YYYY HH:mm",
                      )}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
            {(inviteResult.Skipped || []).length > 0 && (
              <List
                size="small"
                style={{ marginTop: 16 }}
                header={
                  <Text strong type="danger">
                    Bị bỏ qua ({inviteResult.Skipped?.length || 0})
                  </Text>
                }
                dataSource={inviteResult.Skipped || []}
                renderItem={(item) => (
                  <List.Item>
                    <Space>
                      <CloseCircleTwoTone twoToneColor="#f5222d" />
                      <Text>
                        App #{item.ApplicationId || item.applicationId}
                      </Text>
                      <Text type="secondary">{item.Reason || item.reason}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InterviewSchedule;
