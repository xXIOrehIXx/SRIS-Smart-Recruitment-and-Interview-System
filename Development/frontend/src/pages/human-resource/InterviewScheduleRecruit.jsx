import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Table, Tag, Space, Modal, Form, DatePicker, Select,
  Input, message, Empty, Badge, Popconfirm, Divider, Alert, Tooltip
} from 'antd';
import {
  PlusOutlined, CalendarOutlined, ReloadOutlined, DeleteOutlined,
  UserAddOutlined, PhoneOutlined, MinusCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { interviewAPI, jobsAPI, applicationAPI, usersAPI } from '../../services/api';
import '../Dashboard.css';

const { Title, Text } = Typography;

/**
 * Đặt lịch phỏng vấn theo POOL dùng chung (docs Section 15):
 * Human Resource mở 1 pool khung giờ cho job + vòng → mời nhiều ứng viên (mỗi người nhận
 * 1 magic link SCHEDULE qua email) → ai chốt slot trước lấy trước.
 * Ứng viên báo bận nhiều lần (cờ vàng/đỏ) → Human Resource gọi điện rồi "Chốt lịch tay".
 */
const InterviewScheduleRecruit = () => {
  // ?jobId= — mở thẳng đúng vị trí mà người dùng vừa đứng (trang ứng viên, trang tin tuyển
  // dụng). Không có tham số thì rơi về vị trí đầu danh sách như cũ.
  const [searchParams, setSearchParams] = useSearchParams();
  const jobIdFromUrl = Number(searchParams.get('jobId')) || null;

  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [pools, setPools] = useState([]);
  const [applications, setApplications] = useState([]); // mọi hồ sơ của job (map tên + lọc INTERVIEW)
  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inviteModal, setInviteModal] = useState(null);   // pool đang mời
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [createForm] = Form.useForm();
  const [inviteForm] = Form.useForm();
  const [manualForm] = Form.useForm();

  useEffect(() => {
    fetchJobs();
    fetchInterviewers();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      const jobList = response.data || [];
      setJobs(jobList);
      if (jobList.length === 0) return;
      // Job trong URL phải CÓ trong danh sách mới chọn — id rác (job đã đóng/khác công ty)
      // thì bảng trống trơn mà không rõ vì sao, thà rơi về vị trí đầu.
      const wanted = jobList.find((j) => j.jobId === jobIdFromUrl);
      setSelectedJobId(wanted ? wanted.jobId : jobList[0].jobId);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      message.error('Không thể tải danh sách vị trí');
    }
  };

  // Dropdown Interviewer qua /users/options (Human Resource gọi được, khác /users chỉ Admin)
  const fetchInterviewers = async () => {
    try {
      const response = await usersAPI.getOptions('Interviewer');
      setInterviewers(response.data || []);
    } catch (error) {
      console.error('Error fetching interviewers:', error);
      setInterviewers([]);
    }
  };

  const fetchJobData = useCallback(async (jobId) => {
    if (!jobId) {
      setPools([]);
      setApplications([]);
      return;
    }
    setLoading(true);
    try {
      const [poolsRes, appsRes] = await Promise.all([
        interviewAPI.getInterviewPools(jobId),
        applicationAPI.getAll(jobId),
      ]);
      setPools(poolsRes.data || []);
      setApplications(appsRes.data?.applications || []);
    } catch (error) {
      console.error('Error fetching pools:', error);
      message.error('Không thể tải lịch phỏng vấn của vị trí này');
      setPools([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobData(selectedJobId);
  }, [selectedJobId, fetchJobData]);

  // ===== Helpers =====

  const interviewerName = (id) => {
    const found = interviewers.find(i => i.userId === id);
    return found ? (found.fullName || found.email) : `#${id}`;
  };

  const appById = (applicationId) =>
    applications.find(a => a.applicationId === applicationId);

  const candidateLabel = (applicationId) => {
    const app = appById(applicationId);
    return app ? `${app.candidateName}${app.candidateEmail ? ` — ${app.candidateEmail}` : ''}` : `Hồ sơ #${applicationId}`;
  };

  // Ứng viên đang ở state INTERVIEW — đối tượng được mời vào pool / chốt tay
  const interviewStageApps = applications.filter(a => a.currentState === 'INTERVIEW');

  // ===== Vòng phỏng vấn của vị trí =====
  // Mô hình lấy theo các ATS thật (Greenhouse "Interview Plan", Lever/Workable "stages"):
  // một vị trí có một DÃY vòng liên tục 1,2,3... ; SỐ do hệ thống đánh, người dùng chỉ đặt TÊN.
  // Vòng đã hủy không tính — hủy rồi làm lại đúng vòng đó là chuyện bình thường.
  const roundInfo = new Map(); // roundNumber -> { round, name, hasOpen }
  pools.filter(p => p.status !== 'CANCELLED').forEach((p) => {
    const cur = roundInfo.get(p.roundNumber) || { round: p.roundNumber, name: null, hasOpen: false };
    // pools từ BE sắp mới nhất trước -> tên bắt được đầu tiên là tên gần đây nhất của vòng đó.
    if (!cur.name && p.name) cur.name = p.name;
    if (p.status === 'OPEN') cur.hasOpen = true;
    roundInfo.set(p.roundNumber, cur);
  });

  const nextRound = [...roundInfo.keys()].reduce((max, r) => Math.max(max, r || 0), 0) + 1;

  // Mở vòng MỚI là lựa chọn mặc định. Mở lại vòng ĐÃ CÓ là đường dành cho ứng viên nộp muộn:
  // họ vẫn phải qua vòng 1 dù người khác đã sang vòng 3. Vòng còn đợt đang mở thì không hiện
  // (mời thẳng vào đợt đó, khỏi đẻ hai đợt song song cùng vòng).
  const roundOptions = [
    { value: nextRound, label: `Vòng ${nextRound} — vòng mới` },
    ...[...roundInfo.values()]
      .filter(r => !r.hasOpen)
      .sort((a, b) => a.round - b.round)
      .map(r => ({
        value: r.round,
        label: `Vòng ${r.round}${r.name ? ` · ${r.name}` : ''} — mở thêm khung cho ứng viên vào sau`,
      })),
  ];

  // Nhãn hiển thị của một vòng: tên là thứ nói buổi đó để LÀM GÌ, số chỉ nói thứ tự.
  const roundLabel = (pool) => `Vòng ${pool.roundNumber}${pool.name ? ` · ${pool.name}` : ''}`;

  // Pool CLOSED = pool 1 khung do "Chốt lịch tay" sinh ra (BE: ManualConfirmAsync). Không ai
  // được mời qua email ở đây, nên đừng gọi là "ứng viên đã mời" hay hỏi có cần gọi điện không.
  const isManualPool = (pool) => pool.status === 'CLOSED';

  // ===== Ràng buộc thời gian của một khung =====
  // Mốc SỚM NHẤT một khung được phép rơi vào. Hai điều kiện gộp lại:
  //  1. Không ở quá khứ.
  //  2. Vòng ≥ 2 phải diễn ra SAU khung muộn nhất của vòng liền trước — nếu không sẽ có ứng
  //     viên phỏng vấn vòng 2 trước khi vòng 1 của họ diễn ra. BE chặn lại chuyện này, ở đây
  //     chặn sớm để người dùng không phải bấm xong mới biết.
  const watchedRound = Form.useWatch('roundNumber', createForm);
  const prevRoundLatest = (() => {
    const r = watchedRound || nextRound;
    if (!r || r <= 1) return null;
    const times = pools
      .filter(p => p.status !== 'CANCELLED' && p.roundNumber === r - 1)
      .flatMap(p => (p.slots || []).map(s => s.startTime))
      .filter(Boolean)
      .map(t => dayjs(t));
    return times.length ? times.reduce((a, b) => (a.isAfter(b) ? a : b)) : null;
  })();
  const minSlotTime = prevRoundLatest && prevRoundLatest.isAfter(dayjs())
    ? prevRoundLatest.add(1, 'minute')
    : dayjs();

  // disabledDate chỉ chặn NGÀY; không chặn GIỜ thì chọn đúng ngày mốc vẫn ra một thời điểm đã
  // qua (ô chọn giờ để nguyên 00:00) rồi bị BE đá lại — đúng cái bẫy hay dính nhất.
  const timeGuards = (min) => ({
    disabledDate: (current) => current && current < min.startOf('day'),
    disabledTime: (current) => {
      if (!current || !current.isSame(min, 'day')) return {};
      return {
        disabledHours: () => Array.from({ length: min.hour() }, (_, i) => i),
        disabledMinutes: (h) => (h === min.hour()
          ? Array.from({ length: min.minute() + 1 }, (_, i) => i)
          : []),
      };
    },
  });

  // Bấm 1 phát ra giờ hẹn thường dùng, khỏi phải lăn từng cột ngày/giờ/phút.
  const slotPresets = (min) => {
    const base = min.isBefore(dayjs()) ? dayjs() : min;
    const at = (d, h) => d.hour(h).minute(0).second(0).millisecond(0);
    return [
      { label: 'Ngày mai 09:00', value: at(base.add(1, 'day'), 9) },
      { label: 'Ngày mai 14:00', value: at(base.add(1, 'day'), 14) },
      { label: '3 ngày nữa 09:00', value: at(base.add(3, 'day'), 9) },
      { label: 'Thứ Hai tới 09:00', value: at(base.add(1, 'week').startOf('week').add(1, 'day'), 9) },
    ];
  };

  // Ô chọn giờ mặc định 09:00 thay vì 00:00: chọn ngày xong là đã có giờ hẹn dùng được ngay,
  // không phải cuộn cột giờ, và không rơi vào "00:00 hôm nay = quá khứ".
  const slotTimeProps = (min) => ({
    showTime: { format: 'HH:mm', minuteStep: 15, defaultValue: dayjs().hour(9).minute(0).second(0) },
    format: 'DD/MM/YYYY HH:mm',
    presets: slotPresets(min),
    ...timeGuards(min),
  });

  // ===== Actions =====

  const handleCreatePool = async (values) => {
    const slots = (values.slots || []).filter(s => s && s.interviewerIds?.length && s.startTime);
    if (slots.length === 0) {
      message.error('Cần ít nhất 1 khung giờ (interviewer + thời gian)');
      return;
    }
    setSubmitting(true);
    try {
      await interviewAPI.createPool(selectedJobId, {
        // Số vòng lấy từ dropdown (vòng mới = nextRound, hoặc vòng cũ mở lại); BE tính lại và
        // chặn nhảy cóc, nên hai tab mở song song không đẻ ra dãy vòng thủng lỗ.
        roundNumber: values.roundNumber || nextRound,
        name: values.name?.trim() || undefined,
        // startTime gửi lên BE dạng ISO local (không có 'Z' / timezone) để giữ
        // đúng giờ user chọn. Trước đây dùng toISOString() đổi sang UTC khiến giờ
        // hiển thị ở FE lệch (vd user chọn 09:00 +07:00 → BE lưu 02:00 UTC).
        slots: slots.map(s => ({
          interviewerIds: s.interviewerIds,
          startTime: s.startTime.format('YYYY-MM-DDTHH:mm:ss'),
        })),
      });
      message.success('Đã mở pool khung giờ phỏng vấn!');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error('Error creating pool:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể mở pool. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async (values) => {
    const applicationIds = values.applicationIds || [];
    if (applicationIds.length === 0) {
      message.error('Chọn ít nhất 1 ứng viên');
      return;
    }
    setSubmitting(true);
    try {
      const response = await interviewAPI.invite(inviteModal.poolId, applicationIds);
      const { invited = [], skipped = [] } = response.data || {};
      if (invited.length > 0) {
        message.success(`Đã mời ${invited.length} ứng viên — mỗi người nhận 1 email chọn lịch.`);
        // Hiện link chọn lịch để copy gửi tay (khi chưa cấu hình SMTP)
        Modal.success({
          title: `Đã mời ${invited.length} ứng viên — link chọn lịch`,
          width: 640,
          content: (
            <div>
              <p>Email đã tự gửi kèm link (nếu SMTP đã cấu hình). Copy gửi tay nếu cần:</p>
              {invited.map((i) => (
                <div key={i.scheduleId} style={{ marginBottom: 10 }}>
                  <Text strong>{candidateLabel(i.applicationId)}</Text>
                  <Typography.Paragraph
                    copyable={{ text: `${window.location.origin}/schedule?token=${encodeURIComponent(i.magicToken)}` }}
                    style={{ wordBreak: 'break-all', marginBottom: 0 }}
                  >
                    {`${window.location.origin}/schedule?token=${i.magicToken}`}
                  </Typography.Paragraph>
                </div>
              ))}
            </div>
          ),
        });
      }
      if (skipped.length > 0) {
        Modal.warning({
          title: `${skipped.length} ứng viên bị bỏ qua`,
          content: (
            <ul style={{ paddingLeft: 18 }}>
              {skipped.map(s => (
                <li key={s.applicationId}>{candidateLabel(s.applicationId)}: {s.reason}</li>
              ))}
            </ul>
          ),
        });
      }
      setInviteModal(null);
      inviteForm.resetFields();
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error('Error inviting:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể mời ứng viên.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPool = async (poolId) => {
    try {
      await interviewAPI.cancelPool(poolId, 'Hủy bởi Human Resource');
      message.success('Đã hủy (ứng viên đã chốt lịch sẽ nhận email báo).');
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error('Error canceling pool:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể hủy pool.');
    }
  };

  const handleManualConfirm = async (values) => {
    setSubmitting(true);
    try {
      await interviewAPI.manualConfirm(values.applicationId, {
        interviewerIds: values.interviewerIds,
        // Gửi local ISO không 'Z' để khớp giờ user chọn (xem comment ở handleCreatePool).
        startTime: values.startTime.format('YYYY-MM-DDTHH:mm:ss'),
        // Không gửi roundNumber — BE tự đánh vòng kế tiếp của ứng viên này.
      });
      message.success('Đã chốt lịch tay cho ứng viên!');
      setManualModalOpen(false);
      manualForm.resetFields();
      fetchJobData(selectedJobId);
    } catch (error) {
      console.error('Error manual confirm:', error);
      message.error(error?.response?.data?.userMsg || 'Không thể chốt lịch.');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Render =====

  const slotColumns = [
    {
      title: 'Thời gian',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (t) => (
        <span><CalendarOutlined /> {dayjs(t).format('DD/MM/YYYY - HH:mm')}</span>
      ),
    },
    {
      title: 'Panel interviewer',
      dataIndex: 'interviewers',
      key: 'interviewers',
      render: (list, record) => (list?.length
        ? list.map(i => <Tag key={i.interviewerId}>{i.fullName || i.email}</Tag>)
        : <Tag>{interviewerName(record.interviewerId)}</Tag>),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = {
          OPEN: { color: 'success', label: 'Còn trống' },
          BOOKED: { color: 'processing', label: 'Đã được đặt' },
          LOCKED: { color: 'default', label: 'Đã khóa' },
        };
        const c = config[status] || { color: 'default', label: status };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: 'Ứng viên đã đặt',
      dataIndex: 'bookedApplicationId',
      key: 'bookedApplicationId',
      render: (appId) => appId ? candidateLabel(appId) : <Text type="secondary">—</Text>,
    },
  ];

  const invitedColumns = [
    {
      title: 'Ứng viên',
      dataIndex: 'applicationId',
      key: 'applicationId',
      render: (appId) => candidateLabel(appId),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = {
          PENDING: { color: 'warning', label: 'Chờ chọn lịch' },
          CONFIRMED: { color: 'success', label: 'Đã chốt lịch' },
          NO_SLOT_FITS: { color: 'orange', label: 'Báo bận' },
          CANCELLED: { color: 'error', label: 'Đã hủy' },
        };
        const c = config[status] || { color: 'default', label: status };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      // "Cờ nhắc" là chữ của người viết code, người dùng không đoán ra. Cột này chỉ trả lời
      // đúng một câu: ứng viên NÀY, CHƯA CHỐT ĐƯỢC LỊCH, có nên gọi điện hẹn tay không.
      title: (
        <Tooltip title="Chỉ áp dụng cho ứng viên còn đang chờ chọn lịch: bấm 'không có khung giờ nào phù hợp' nhiều lần thì nên gọi điện hẹn tay thay vì gửi thêm link">
          <span>Cần gọi điện?</span>
        </Tooltip>
      ),
      dataIndex: 'flag',
      key: 'flag',
      render: (flag, record) => {
        // Đã chốt/đã hủy thì câu hỏi hết nghĩa. Ghi "Không cần" cho người vừa được chốt lịch
        // (nhất là chốt TAY, tức cuộc gọi đã xảy ra rồi) đọc thành lời khuyên sai.
        if (record.status === 'CONFIRMED') {
          return <Tooltip title="Đã có lịch — không phải gọi thêm"><Text type="secondary">—</Text></Tooltip>;
        }
        if (record.status === 'CANCELLED') {
          return <Text type="secondary">—</Text>;
        }
        if (flag === 'RED') {
          return (
            <Tooltip title={`Ứng viên báo bận ${record.noSlotFitsCount} lần — gọi điện chốt lịch tay ngay`}>
              <Badge color="red" text={<Text type="danger">Gọi ngay</Text>} />
            </Tooltip>
          );
        }
        if (flag === 'YELLOW') {
          return (
            <Tooltip title={`Ứng viên báo bận ${record.noSlotFitsCount} lần — cân nhắc gọi điện`}>
              <Badge color="gold" text="Nên gọi" />
            </Tooltip>
          );
        }
        return <Tooltip title="Ứng viên chưa báo bận lần nào — cứ để họ tự chọn lịch"><Text type="secondary">Chưa cần</Text></Tooltip>;
      },
    },
  ];

  // Bảng của pool chốt tay: bỏ cột "Cần gọi điện?" (cuộc gọi chính là thứ tạo ra pool này).
  const manualBookedColumns = invitedColumns.slice(0, 2);

  return (
    <div className="interview-schedule-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Lịch phỏng vấn</Title>
          <Text type="secondary">
            Mở pool khung giờ dùng chung → mời ứng viên chọn lịch qua email → ai chốt trước lấy trước
          </Text>
        </div>
        <Space>
          <Select
            placeholder="Chọn vị trí"
            value={selectedJobId}
            onChange={(jobId) => {
              setSelectedJobId(jobId);
              // Ghi vào URL để F5 / chia sẻ link vẫn đúng vị trí đang xem.
              setSearchParams({ jobId: String(jobId) }, { replace: true });
            }}
            style={{ width: 260 }}
            showSearch
            optionFilterProp="label"
            options={jobs.map(job => ({ value: job.jobId, label: job.title }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchJobData(selectedJobId)} loading={loading}>
            Làm mới
          </Button>
          <Button icon={<PhoneOutlined />} onClick={() => setManualModalOpen(true)} disabled={!selectedJobId}>
            Chốt lịch tay
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)} disabled={!selectedJobId}>
            Mở pool khung giờ
          </Button>
        </Space>
      </div>

      {!selectedJobId && (
        <Card className="main-card" bordered={false}>
          <Empty description="Chọn một vị trí để xem lịch phỏng vấn" />
        </Card>
      )}

      {selectedJobId && pools.length === 0 && !loading && (
        <Card className="main-card" bordered={false}>
          <Empty description={
            <div>
              <Text>Chưa có pool khung giờ nào cho vị trí này</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Bấm "Mở pool khung giờ" để tạo bộ khung, sau đó mời các ứng viên đang ở bước Phỏng vấn
              </Text>
            </div>
          } />
        </Card>
      )}

      {selectedJobId && pools.map((pool) => (
        <Card
          key={pool.poolId}
          className="main-card"
          bordered={false}
          style={{ marginBottom: 16 }}
          title={
            <Space>
              <Text strong>{roundLabel(pool)}</Text>
              {/* 'CLOSED' là chữ trong DB, không phải chữ cho người dùng — pool đóng ở hệ
                  thống này chỉ sinh ra từ nhánh chốt lịch tay. */}
              <Tag color={pool.status === 'OPEN' ? 'success' : pool.status === 'CANCELLED' ? 'error' : 'blue'}>
                {pool.status === 'OPEN' ? 'Đang mở'
                  : pool.status === 'CANCELLED' ? 'Đã hủy'
                  : isManualPool(pool) ? 'Chốt lịch tay' : 'Đã đóng'}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {isManualPool(pool)
                  ? 'Buổi hẹn tay, không mời qua email'
                  : `${pool.slots.filter(s => s.status === 'BOOKED').length}/${pool.slots.length} khung đã được đặt`}
              </Text>
            </Space>
          }
          extra={
            // Hủy được MỌI pool chưa hủy, kể cả buổi chốt tay (pool CLOSED): lỡ chốt nhầm giờ
            // hay nhầm vòng thì phải có đường rút. Chỉ "Mời ứng viên" mới cần pool đang mở.
            pool.status !== 'CANCELLED' && (
              <Space>
                {pool.status === 'OPEN' && (
                  <Button
                    size="small"
                    icon={<UserAddOutlined />}
                    onClick={() => setInviteModal(pool)}
                  >
                    Mời ứng viên
                  </Button>
                )}
                <Popconfirm
                  title={isManualPool(pool) ? 'Hủy buổi phỏng vấn này?' : 'Hủy pool này?'}
                  description={isManualPool(pool)
                    ? 'Buổi hẹn tay sẽ bị hủy và ứng viên nhận email báo. Vòng này sẽ không tính khi đánh số vòng sau.'
                    : 'Khung giờ sẽ khóa, lời mời chờ sẽ hủy, ứng viên đã chốt được email báo.'}
                  onConfirm={() => handleCancelPool(pool.poolId)}
                  okText={isManualPool(pool) ? 'Hủy buổi' : 'Hủy pool'}
                  cancelText="Không"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    {isManualPool(pool) ? 'Hủy buổi' : 'Hủy pool'}
                  </Button>
                </Popconfirm>
              </Space>
            )
          }
        >
          <Table
            columns={slotColumns}
            dataSource={pool.slots}
            rowKey="slotId"
            pagination={false}
            size="small"
          />
          {pool.invitedCandidates.length > 0 && (
            <>
              <Divider orientation="left" plain style={{ margin: '16px 0 8px' }}>
                {isManualPool(pool)
                  ? 'Ứng viên đã chốt lịch'
                  : `Ứng viên đã mời (${pool.invitedCandidates.length})`}
              </Divider>
              <Table
                columns={isManualPool(pool) ? manualBookedColumns : invitedColumns}
                dataSource={pool.invitedCandidates}
                rowKey="scheduleId"
                pagination={false}
                size="small"
              />
            </>
          )}
        </Card>
      ))}

      {/* Modal: mở pool mới */}
      <Modal
        title="Mở pool khung giờ phỏng vấn"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        // Reset SAU khi form đã mount lại: vòng mặc định phụ thuộc vị trí đang chọn, không
        // reset thì đổi vị trí xong mở modal vẫn thấy số vòng của vị trí trước.
        afterOpenChange={(open) => { if (open) createForm.resetFields(); }}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Một pool dùng chung cho cả vòng: mở khung giờ 1 lần, mời nhiều ứng viên, ai chốt trước lấy trước."
        />
        <Form form={createForm} layout="vertical" onFinish={handleCreatePool}>
          {/* SỐ vòng không gõ tay — chỉ chọn "vòng mới" (mặc định) hoặc mở lại một vòng đã có.
              Cho gõ tự do thì người dùng mở "vòng 5" khi mới có vòng 1. */}
          <Form.Item
            name="roundNumber"
            label="Vòng phỏng vấn"
            initialValue={nextRound}
            rules={[{ required: true, message: 'Chọn vòng' }]}
            extra={nextRound === 1
              ? 'Vòng đầu tiên của vị trí này.'
              : `Vị trí này đã có ${nextRound - 1} vòng. Mở lại vòng cũ khi có ứng viên nộp muộn cần phỏng vấn đúng vòng đó.`}
          >
            <Select
              options={roundOptions}
              // Mở lại vòng cũ thì điền sẵn đúng tên vòng đó — ứng viên vào sau phải thấy
              // "Vòng 1 · Phỏng vấn sơ bộ" y như người vào trước, không phải một vòng vô danh.
              onChange={(r) => createForm.setFieldValue('name', roundInfo.get(r)?.name || undefined)}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên vòng (tùy chọn)"
            extra="Interviewer và ứng viên đọc tên này để biết buổi đó để làm gì. Bỏ trống thì mọi nơi chỉ hiện 'Vòng N'."
          >
            <Input placeholder="VD: Sơ loại qua điện thoại · Phỏng vấn chuyên môn · Gặp giám đốc" maxLength={120} />
          </Form.Item>

          <Form.List name="slots" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                <Divider orientation="left" plain style={{ margin: '4px 0 8px' }}>
                  Khung giờ phỏng vấn
                </Divider>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                  Mỗi khung là một chỗ ứng viên có thể đặt. Mở nhiều khung để nhiều người cùng chọn
                  — ai chốt trước lấy trước.
                  {prevRoundLatest && ` Vòng này phải diễn ra sau ${prevRoundLatest.format('HH:mm DD/MM/YYYY')} (khung muộn nhất của vòng trước).`}
                </Text>

                {/* Mỗi khung = 1 khối có NHÃN cho từng ô. Trước đây chữ "Khung giờ:" đứng trên
                    cả hàng mà ô đầu hàng lại là panel interviewer -> đọc thành "khung giờ =
                    chọn người". Giờ ngày/giờ đứng trước (đúng thứ tự cột của bảng), mỗi ô có
                    nhãn riêng. */}
                {fields.map((field, idx) => (
                  <div
                    key={field.key}
                    style={{
                      border: '1px solid #f0f0f0', borderRadius: 8,
                      padding: '12px 12px 0', marginBottom: 8, position: 'relative',
                    }}
                  >
                    <Space align="start" wrap size={12}>
                      <Form.Item
                        name={[field.name, 'startTime']}
                        label={`Khung ${idx + 1} — ngày & giờ`}
                        rules={[{ required: true, message: 'Chọn ngày & giờ' }]}
                        style={{ marginBottom: 12 }}
                      >
                        <DatePicker
                          {...slotTimeProps(minSlotTime)}
                          placeholder="Chọn ngày & giờ"
                          style={{ width: 230 }}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'interviewerIds']}
                        label="Người phỏng vấn (1–5)"
                        rules={[{ required: true, message: 'Chọn ít nhất 1 người' }]}
                        style={{ marginBottom: 12 }}
                      >
                        <Select
                          mode="multiple"
                          maxTagCount={2}
                          maxCount={5}
                          placeholder="Chọn người phỏng vấn"
                          style={{ width: 260 }}
                          showSearch
                          optionFilterProp="label"
                          options={interviewers.map(i => ({
                            value: i.userId,
                            label: i.fullName || i.email,
                          }))}
                        />
                      </Form.Item>
                    </Space>
                    {fields.length > 1 && (
                      <Tooltip title="Bỏ khung này">
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(field.name)}
                          style={{ position: 'absolute', top: 6, right: 6 }}
                        />
                      </Tooltip>
                    )}
                  </div>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block>
                  Thêm khung giờ
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => { setCreateModalOpen(false); createForm.resetFields(); }}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>Mở pool</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: mời ứng viên vào pool */}
      <Modal
        title={inviteModal ? `Mời ứng viên — ${roundLabel(inviteModal)}` : ''}
        open={!!inviteModal}
        onCancel={() => { setInviteModal(null); inviteForm.resetFields(); }}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Mỗi ứng viên được mời sẽ nhận email kèm đường dẫn để tự chọn khung giờ. Chỉ mời được hồ sơ đang ở bước Phỏng vấn."
        />
        <Form form={inviteForm} layout="vertical" onFinish={handleInvite}>
          <Form.Item
            name="applicationIds"
            label={`Ứng viên đang ở bước Phỏng vấn (${interviewStageApps.length})`}
            rules={[{ required: true, message: 'Chọn ít nhất 1 ứng viên' }]}
          >
            <Select
              mode="multiple"
              placeholder="Chọn ứng viên"
              showSearch
              optionFilterProp="label"
              options={interviewStageApps.map(a => ({
                value: a.applicationId,
                label: `${a.candidateName}${a.candidateEmail ? ` — ${a.candidateEmail}` : ''}`,
              }))}
              notFoundContent={<Text type="secondary">Chưa có hồ sơ nào được duyệt vào vòng phỏng vấn — Trưởng bộ phận phụ trách vị trí duyệt trước, hồ sơ sẽ tự hiện ở đây</Text>}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setInviteModal(null); inviteForm.resetFields(); }}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>Gửi lời mời</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: chốt lịch tay (nhánh gọi điện) */}
      <Modal
        title="Chốt lịch tay (đã gọi điện thống nhất với ứng viên)"
        open={manualModalOpen}
        onCancel={() => { setManualModalOpen(false); manualForm.resetFields(); }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={manualForm} layout="vertical" onFinish={handleManualConfirm}>
          <Form.Item
            name="applicationId"
            label="Ứng viên (đã được duyệt vào vòng phỏng vấn)"
            rules={[{ required: true, message: 'Chọn ứng viên' }]}
          >
            <Select
              placeholder="Chọn ứng viên"
              showSearch
              optionFilterProp="label"
              options={interviewStageApps.map(a => ({
                value: a.applicationId,
                label: `${a.candidateName}${a.candidateEmail ? ` — ${a.candidateEmail}` : ''}`,
              }))}
              notFoundContent={<Text type="secondary">Chưa có hồ sơ nào được duyệt vào vòng phỏng vấn — Trưởng bộ phận phụ trách vị trí duyệt trước</Text>}
            />
          </Form.Item>
          <Form.Item
            name="interviewerIds"
            label="Người phỏng vấn (1–5)"
            rules={[{ required: true, message: 'Chọn ít nhất 1 người' }]}
          >
            <Select
              mode="multiple"
              maxCount={5}
              placeholder="Chọn interviewer"
              showSearch
              optionFilterProp="label"
              options={interviewers.map(i => ({ value: i.userId, label: i.fullName || i.email }))}
            />
          </Form.Item>
          <Form.Item
            name="startTime"
            label="Thời gian phỏng vấn"
            rules={[{ required: true, message: 'Chọn thời gian' }]}
          >
            {/* Chốt tay không ràng buộc theo vòng của vị trí (vòng đếm theo chính ứng viên),
                nên mốc sớm nhất chỉ là "bây giờ". */}
            <DatePicker
              {...slotTimeProps(dayjs())}
              placeholder="Chọn ngày & giờ"
              style={{ width: '100%' }}
            />
          </Form.Item>
          {/* Vòng chốt tay đếm theo CHÍNH ứng viên (buổi thứ mấy của người này), BE tự ++ —
              FE không biết ứng viên nào đã phỏng vấn mấy vòng nên đừng bày ô cho chọn. */}
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Hệ thống tự đánh số vòng: buổi này là vòng kế tiếp của chính ứng viên được chọn."
          />
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setManualModalOpen(false); manualForm.resetFields(); }}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>Chốt lịch</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InterviewScheduleRecruit;
