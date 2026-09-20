import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Card, Typography, Button, Space, Descriptions, Divider, Avatar,
  Popconfirm, Spin, Result, message, Row, Col, Tooltip, Modal, Upload, Input, List, Empty,
} from 'antd';
import {
  ArrowLeftOutlined, UserOutlined, MailOutlined, FileTextOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StopOutlined, SendOutlined,
  UploadOutlined, PaperClipOutlined, DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { offerAPI, applicationAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { canRejectAtState } from '../../utils/decisionRights';
import { getStatusTag, getAppStatusTag, formatSalary, MATCHA_GREEN } from './offerDisplay';
import '../Dashboard.css';

const { Title, Text } = Typography;

/** Đuôi file nhận cho bản scan — khớp danh sách trắng ở BE (OfferService.AllowedAttachmentTypes). */
const SIGNED_FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';

/** Trần 10MB, cũng khớp BE. Chặn ngay ở đây để người dùng không chờ hết một lượt tải rồi mới báo lỗi. */
const MAX_SIGNED_FILE_BYTES = 10 * 1024 * 1024;

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * TRANG chi tiết thư mời nhận việc (Human Resource) — /offers/:applicationId.
 *
 * Là một trang riêng chứ không phải ngăn kéo trượt ra trên danh sách: đây là văn bản chính thức
 * đã gửi đi, người dùng cần đọc kỹ, cuộn, gửi link cho đồng nghiệp xem, và bấm những nút chốt
 * hồ sơ (nhận việc / từ chối / thu hồi). Việc đó xứng đáng có địa chỉ URL riêng và nút Back của
 * trình duyệt hoạt động đúng.
 */
const OfferDetail = () => {
  const navigate = useNavigate();
  const { applicationId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const role = user?.role;

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);
  const [application, setApplication] = useState(null);
  const [acting, setActing] = useState(false);

  // Bản scan hợp đồng đã ký (V058). Danh sách LỊCH SỬ: tải lên lần nữa không đè bản cũ.
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Hộp thoại "Đã nhận việc": ô đính kèm nằm NGAY TRONG đó, vì đúng lúc bấm nút này là lúc
  // nhân sự đang cầm bản scan trên tay. Nhưng để trống vẫn bấm được — giấy hay về chậm vài ngày.
  const [hireOpen, setHireOpen] = useState(false);
  const [hireFile, setHireFile] = useState(null);
  const [hireNote, setHireNote] = useState('');

  // Quay lại ĐÚNG bộ lọc vừa xem: có ?jobId= thì về tin đó, không có thì về danh sách TẤT CẢ
  // vị trí (mặc định của màn Thư mời). Không đoán jobId từ hồ sơ nữa — người đang xem tất cả mà
  // bấm Back lại bị thả vào một tin lẻ thì mất luôn các hồ sơ khác vừa thấy.
  const jobId = searchParams.get('jobId');
  const backToList = () => navigate(jobId ? `/offers?jobId=${jobId}` : '/offers');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Hồ sơ và thư mời là 2 nguồn: thư mời giữ nội dung lá thư, hồ sơ giữ tên/email ứng viên.
      // Gọi song song và cho phép thư mời 404 (hồ sơ chưa gửi thư) mà không làm hỏng cả trang.
      // Danh sách file đính kèm cũng cho phép hỏng riêng: chưa có thư mời thì endpoint này
      // trả rỗng/404, không có lý do gì làm trắng cả trang vì nó.
      const [appRes, offerRes, filesRes] = await Promise.all([
        applicationAPI.getById(applicationId),
        offerAPI.getByApplication(applicationId).catch(() => null),
        offerAPI.getAttachments(applicationId).catch(() => null),
      ]);
      setApplication(appRes.data || null);
      setOffer(offerRes?.data || null);
      setAttachments(filesRes?.data || []);
    } catch (error) {
      console.error('Error loading offer detail:', error);
      message.error(error?.response?.data?.userMsg || 'Không tải được thư mời');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRecordOutcome = async (accepted, note = null) => {
    try {
      setActing(true);
      await offerAPI.recordOutcome(applicationId, accepted, note);
      message.success(accepted
        ? 'Đã ghi nhận ứng viên nhận việc (hồ sơ chuyển sang Trúng tuyển).'
        : 'Đã ghi nhận ứng viên từ chối (hồ sơ chuyển sang Từ chối).');
      fetchAll();
      return true;
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể ghi nhận kết quả');
      return false;
    } finally {
      setActing(false);
    }
  };

  /** Kiểm file trước khi gửi đi — cùng luật với BE, chỉ để báo sớm. */
  const checkSignedFile = (file) => {
    if (file.size > MAX_SIGNED_FILE_BYTES) {
      message.error('File tối đa 10MB — bản scan nặng hơn thì giảm độ phân giải rồi tải lại.');
      return false;
    }
    return true;
  };

  const uploadAttachment = async (file, note) => {
    if (!checkSignedFile(file)) return false;
    try {
      setUploading(true);
      const res = await offerAPI.addAttachment(applicationId, file, note);
      // Chèn thẳng vào đầu danh sách thay vì tải lại cả trang: dòng mới hiện ngay, và
      // link tải trong res.data còn tươi.
      setAttachments((prev) => [res.data, ...prev]);
      return true;
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không tải được file lên');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSigned = async (file) => {
    if (await uploadAttachment(file, null)) message.success('Đã lưu bản scan hợp đồng đã ký.');
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await offerAPI.deleteAttachment(applicationId, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.attachmentId !== attachmentId));
      message.success('Đã gỡ file.');
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không gỡ được file');
    }
  };

  const closeHireModal = () => {
    setHireOpen(false);
    setHireFile(null);
    setHireNote('');
  };

  /**
   * Bấm xác nhận trong hộp thoại "Đã nhận việc": tải file TRƯỚC rồi mới ghi nhận kết quả.
   * Thứ tự này có chủ đích — ghi nhận trước mà tải file hỏng thì hồ sơ đã sang Trúng tuyển,
   * hộp thoại đóng lại và bằng chứng nằm lại trên máy nhân sự; làm ngược lại thì file đã lưu
   * an toàn, lỗi hiện ra ngay và bấm lại được.
   */
  const handleConfirmHire = async () => {
    if (hireFile && !(await uploadAttachment(hireFile, null))) return;
    const note = hireNote.trim() || null;
    if (await handleRecordOutcome(true, note)) closeHireModal();
  };

  const handleResend = async () => {
    try {
      setActing(true);
      await applicationAPI.createMagicLink(applicationId, 'OFFER_RESPONSE');
      message.success(`Đã gửi lại thư mời tới ${application?.candidateEmail || 'ứng viên'}.`);
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể gửi lại thư mời');
    } finally {
      setActing(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      setActing(true);
      await applicationAPI.reject(applicationId, 'Công ty thu hồi thư mời');
      message.success('Đã thu hồi thư mời (hồ sơ chuyển sang Từ chối)');
      fetchAll();
    } catch (error) {
      message.error(error?.response?.data?.userMsg || 'Không thể thu hồi thư mời');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" tip="Đang tải thư mời..." />
      </div>
    );
  }

  if (!offer) {
    return (
      <Result
        status="404"
        title="Chưa có thư mời"
        subTitle="Hồ sơ này chưa được gửi thư mời nhận việc."
        extra={<Button type="primary" onClick={backToList}>Về danh sách thư mời</Button>}
      />
    );
  }

  const isPending = offer.status === 'PENDING';

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={backToList} />
          <div>
            <Title level={3} className="page-title">Chi tiết thư mời</Title>
            <Text type="secondary">
              Hồ sơ #{offer.applicationId} • {application?.jobTitle || offer.jobTitle || '—'}
            </Text>
          </div>
        </div>
        <Space>
          {getStatusTag(offer.status)}
          {application?.currentState && getAppStatusTag(application.currentState)}
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={<Space><UserOutlined style={{ color: MATCHA_GREEN }} />Ứng viên</Space>}
            style={{ height: '100%' }}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space>
                <Avatar size={44} style={{ backgroundColor: MATCHA_GREEN }} icon={<UserOutlined />} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{application?.candidateName || '—'}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <MailOutlined /> {application?.candidateEmail || '—'}
                  </Text>
                </div>
              </Space>

              <Divider style={{ margin: '4px 0 8px' }} />

              <Descriptions column={1} size="small" colon={false}>
                <Descriptions.Item label="Điện thoại">{application?.candidatePhone || '—'}</Descriptions.Item>
                <Descriptions.Item label="Nguồn hồ sơ">{application?.candidateSource || '—'}</Descriptions.Item>
              </Descriptions>

              {/* Ứng viên trả lời bằng cách Reply chính email thư mời, không bấm gì trong hệ thống. */}
              <Text type="secondary" style={{ fontSize: 12 }}>
                Ứng viên đã nhận nguyên lá thư trong email và trả lời bằng cách phản hồi email đó.
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title={<Space><FileTextOutlined style={{ color: MATCHA_GREEN }} />Nội dung thư mời</Space>}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Vị trí">{offer.jobTitle || '—'}</Descriptions.Item>
              <Descriptions.Item label="Phòng ban">{offer.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Báo cáo cho">{offer.reportingTo || '—'}</Descriptions.Item>
              <Descriptions.Item label="Hình thức">{offer.employmentType || '—'}</Descriptions.Item>
              <Descriptions.Item label="Địa điểm">{offer.workLocation || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ngày bắt đầu">
                {offer.startDate ? dayjs(offer.startDate).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Mức lương">
                <Text strong style={{ color: MATCHA_GREEN }}>{formatSalary(offer)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Thưởng/Ưu đãi">{offer.bonus || '—'}</Descriptions.Item>
              <Descriptions.Item label="Phúc lợi" span={2}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{offer.benefits || '—'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Điều khoản" span={2}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{offer.terms || '—'}</span>
              </Descriptions.Item>
            </Descriptions>

            {offer.note && (
              <>
                <Divider style={{ margin: '16px 0 12px' }} />
                <Title level={5} style={{ marginBottom: 8 }}>Lời nhắn kèm thư</Title>
                <div style={{
                  background: '#f5f5f4', padding: 12, borderRadius: 8,
                  whiteSpace: 'pre-wrap', fontSize: 13,
                }}>
                  {offer.note}
                </div>
              </>
            )}

            <Divider style={{ margin: '16px 0 12px' }} />

            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Người ký">
                {offer.signerName
                  ? `${offer.signerName}${offer.signerTitle ? ` — ${offer.signerTitle}` : ''}`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Liên hệ nhân sự">
                {offer.hrContactName || offer.hrContactEmail || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Đã gửi lúc">
                {offer.sentAt ? dayjs(offer.sentAt).format('DD/MM/YYYY HH:mm') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Hạn phản hồi">
                {offer.expiresAt ? dayjs(offer.expiresAt).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {offer.respondedAt && (
        <Card style={{ marginTop: 16 }} title="Kết quả đã ghi nhận">
          <Space direction="vertical" size={6}>
            {getStatusTag(offer.status)}
            <Text type="secondary" style={{ fontSize: 13 }}>
              Ghi nhận lúc {dayjs(offer.respondedAt).format('DD/MM/YYYY HH:mm')}
            </Text>
            {offer.outcomeNote && (
              <div style={{
                background: '#f5f5f4', padding: 12, borderRadius: 8,
                fontSize: 13, whiteSpace: 'pre-wrap',
              }}>
                {offer.outcomeNote}
              </div>
            )}
          </Space>
        </Card>
      )}

      {/* Bản scan hợp đồng đã ký (V058). Hiện ở MỌI trạng thái thư mời, không riêng lúc còn
          chờ trả lời: giấy ký tay thường về sau khi đã bấm "Đã nhận việc", và sau này người ta
          quay lại đúng trang này để tra "đã ký hợp đồng chưa". */}
      <Card
        style={{ marginTop: 16 }}
        title={<Space><PaperClipOutlined style={{ color: MATCHA_GREEN }} />Hợp đồng đã ký (bản scan)</Space>}
        extra={(
          <Upload
            accept={SIGNED_FILE_ACCEPT}
            showUploadList={false}
            beforeUpload={(file) => { handleUploadSigned(file); return false; }}
          >
            <Button icon={<UploadOutlined />} loading={uploading}>Tải lên</Button>
          </Upload>
        )}
      >
        {attachments.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={(
              <Text type="secondary" style={{ fontSize: 13 }}>
                Chưa có bản scan nào. Ứng viên in thư mời ra, ký vào phần "Xác nhận của ứng viên"
                ở cuối thư, Giám đốc ký tiếp — rồi tải bản scan có đủ hai chữ ký lên đây.
              </Text>
            )}
          />
        ) : (
          <List
            size="small"
            dataSource={attachments}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Popconfirm
                    key="del"
                    title="Gỡ file này?"
                    description="Chỉ gỡ khỏi hồ sơ, không ảnh hưởng trạng thái ứng viên."
                    onConfirm={() => handleDeleteAttachment(item.attachmentId)}
                    okText="Gỡ" cancelText="Hủy" okButtonProps={{ danger: true }}
                  >
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<PaperClipOutlined style={{ color: MATCHA_GREEN, fontSize: 18 }} />}
                  title={item.fileUrl
                    ? <a href={item.fileUrl} target="_blank" rel="noreferrer">{item.fileName}</a>
                    /* Link presigned hỏng thì vẫn hiện tên file — người dùng biết là CÓ bản
                       scan, chỉ là lúc này storage không trả link. */
                    : <Text>{item.fileName}</Text>}
                  description={(
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {[
                        item.uploadedAt ? dayjs(item.uploadedAt).format('DD/MM/YYYY HH:mm') : null,
                        item.uploadedByName,
                        formatBytes(item.fileSize),
                      ].filter(Boolean).join(' • ')}
                      {item.note ? ` — ${item.note}` : ''}
                    </Text>
                  )}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {isPending && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <Space>
              <Button icon={<SendOutlined />} loading={acting} onClick={handleResend}>
                Gửi lại thư mời
              </Button>
              {/* THU HỒI là quyết định của CÔNG TY (OFFER→REJECTED) -> chỉ Giám đốc, giống
                  mọi đường rời bước Quyết định. Khác hẳn hai nút bên phải: những nút đó chỉ
                  GHI NHẬN câu trả lời của ứng viên nên nhân sự vẫn bấm được. */}
              {canRejectAtState(role, 'OFFER') ? (
                <Popconfirm
                  title="Thu hồi thư mời này?"
                  description="Hồ sơ sẽ chuyển sang Từ chối."
                  onConfirm={handleWithdraw}
                  okText="Thu hồi"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<StopOutlined />} loading={acting}>Thu hồi</Button>
                </Popconfirm>
              ) : (
                <Tooltip title="Thu hồi thư mời là quyết định của Giám đốc. Ghi nhận câu trả lời của ứng viên thì bạn vẫn làm được ở hai nút bên phải.">
                  <Button danger icon={<StopOutlined />} disabled>Thu hồi</Button>
                </Tooltip>
              )}
            </Space>
            <Space>
              <Popconfirm
                title="Ứng viên từ chối?"
                description="Hồ sơ sẽ chuyển sang Từ chối."
                onConfirm={() => handleRecordOutcome(false)}
                okText="Xác nhận" cancelText="Hủy" okButtonProps={{ danger: true }}
              >
                <Button icon={<CloseCircleOutlined />} loading={acting}>Từ chối</Button>
              </Popconfirm>
              {/* Không dùng Popconfirm như nút Từ chối: bấm nút này là lúc đính kèm bản scan
                  hợp đồng, cần cả ô chọn file lẫn ô ghi chú nên phải là hộp thoại thật. */}
              <Button type="primary" icon={<CheckCircleOutlined />} loading={acting}
                onClick={() => setHireOpen(true)}
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}>
                Đã nhận việc
              </Button>
            </Space>
          </div>
        </Card>
      )}

      <Modal
        open={hireOpen}
        title="Ghi nhận ứng viên đã nhận việc"
        okText="Xác nhận"
        cancelText="Hủy"
        confirmLoading={acting || uploading}
        onOk={handleConfirmHire}
        onCancel={closeHireModal}
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Text>Hồ sơ sẽ chuyển sang <Text strong>Trúng tuyển</Text>.</Text>

          <div>
            <Text strong>Bản scan hợp đồng đã ký</Text>
            <Text type="secondary"> (không bắt buộc)</Text>
            <div style={{ marginTop: 8 }}>
              <Upload
                accept={SIGNED_FILE_ACCEPT}
                maxCount={1}
                fileList={hireFile ? [hireFile] : []}
                beforeUpload={(file) => {
                  // return false: giữ file lại trong hộp thoại, chỉ gửi lên khi bấm Xác nhận.
                  if (checkSignedFile(file)) setHireFile(file);
                  return false;
                }}
                onRemove={() => setHireFile(null)}
              >
                <Button icon={<UploadOutlined />}>Chọn file PDF hoặc ảnh</Button>
              </Upload>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Chưa có giấy tờ cũng cứ xác nhận — tải bổ sung sau ở mục "Hợp đồng đã ký".
            </Text>
          </div>

          <div>
            <Text strong>Ghi chú</Text>
            <Text type="secondary"> (không bắt buộc)</Text>
            <Input.TextArea
              rows={2}
              maxLength={500}
              style={{ marginTop: 8 }}
              value={hireNote}
              onChange={(e) => setHireNote(e.target.value)}
              placeholder="Vd: ứng viên xác nhận qua điện thoại ngày 20/09, hợp đồng ký ngày 21/09."
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default OfferDetail;
