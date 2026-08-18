import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Table, Select, Upload, message,
  Row, Col, Space, Modal, Input, Empty
} from 'antd';
import {
  UploadOutlined, InboxOutlined, ReloadOutlined, EyeOutlined, FileTextOutlined
} from '@ant-design/icons';
import { cvAPI, jobsAPI, applicationAPI } from '../../services/api';
import ApplicationStateTag from '../../components/ApplicationStateTag';
import './css/CvIntake.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// Nhãn 4 pha dùng chung ở components/ApplicationStateTag.jsx — trước đây màn này tự khai một
// bảng riêng, và nó đã trôi khỏi bản gốc (đổi tên pha 17/08/2026 thì bảng này vẫn giữ chữ cũ).

/**
 * Nhận hồ sơ ứng viên: Human Resource nộp CV hộ ứng viên (CV nhận qua email, hội chợ
 * việc làm...) và xem danh sách hồ sơ đã nộp của một vị trí.
 *
 * AI chấm mức phù hợp CV↔tin tuyển dụng ở màn vị trí (V044/V046) để gợi ý đọc hồ sơ nào
 * trước; quyết định vẫn là của người tuyển dụng. Màn này chỉ NHẬN hồ sơ.
 */
const CvIntake = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applications, setApplications] = useState([]);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  // Ô nào do máy điền -> hiện nhãn "đã điền từ CV" để người dùng biết chỗ cần soát lại.
  const [prefilled, setPrefilled] = useState({});
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (selectedJob) fetchApplications(selectedJob);
  }, [selectedJob]);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
      if (response.data?.length > 0) setSelectedJob(response.data[0].jobId);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchApplications = async (jobId) => {
    try {
      setLoading(true);
      const response = await applicationAPI.getAll(jobId);
      setApplications(response.data?.applications || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const resetUploadModal = () => {
    setUploadModalOpen(false);
    setFile(null);
    setCandidateName('');
    setCandidateEmail('');
    setCandidatePhone('');
    setPrefilled({});
  };

  /**
   * Chọn file xong thì đọc thử CV và điền sẵn họ tên / email / điện thoại (V047).
   *
   * Chỉ điền vào ô đang TRỐNG — người dùng gõ tay trước rồi mới chọn file thì cái họ gõ
   * mới đúng, máy không được đè lên. Bóc hụt trường nào thì để trống trường đó; đây là gợi ý
   * để đỡ gõ, không phải nguồn dữ liệu.
   */
  const prefillFromCv = async (f) => {
    setParsing(true);
    try {
      const { data } = await cvAPI.parseCvPreview(f);
      const filled = {};
      if (data?.candidateName && !candidateName) {
        setCandidateName(data.candidateName);
        filled.name = true;
      }
      if (data?.candidateEmail && !candidateEmail) {
        setCandidateEmail(data.candidateEmail);
        filled.email = true;
      }
      if (data?.candidatePhone && !candidatePhone) {
        setCandidatePhone(data.candidatePhone);
        filled.phone = true;
      }
      setPrefilled(filled);

      if (data && data.hasText === false) {
        message.info('CV này không có lớp chữ (PDF scan ảnh) — nhập thông tin bằng tay.');
      }
    } catch (error) {
      // Điền sẵn hỏng thì cứ để form trống như trước, đừng chặn việc nộp hồ sơ.
      console.error('Error parsing CV for prefill:', error);
    } finally {
      setParsing(false);
    }
  };

  const handleUploadCV = async () => {
    if (!file || !selectedJob) {
      message.error('Vui lòng chọn file CV và vị trí');
      return;
    }
    if (!candidateName.trim() || !candidateEmail.trim()) {
      message.error('Vui lòng nhập tên và email ứng viên');
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('jobId', selectedJob);
      formData.append('candidateName', candidateName.trim());
      formData.append('candidateEmail', candidateEmail.trim());
      if (candidatePhone.trim()) formData.append('candidatePhone', candidatePhone.trim());

      const response = await cvAPI.uploadCV(formData);
      const status = response.data?.status;

      if (status === 'RECEIVED') {
        message.success('Đã nhận hồ sơ.');
        resetUploadModal();
        fetchApplications(selectedJob);
      } else {
        // NEEDS_MANUAL_EDIT (CV scan ảnh) / FAILED — CV đã lưu nhưng chưa thành hồ sơ.
        message.warning(response.data?.reason || 'Không nhận được hồ sơ từ file này.');
      }
    } catch (error) {
      console.error('Error uploading CV:', error);
      message.error(error?.response?.data?.error || 'Không thể tải CV lên. Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  // Mở file CV gốc (presigned URL ~1h) trong tab mới
  const handleOpenCvFile = async (cvId) => {
    try {
      const response = await cvAPI.getCvFileUrl(cvId);
      const url = response.data?.url;
      if (url) window.open(url, '_blank', 'noopener');
      else message.error('CV không có file gốc');
    } catch (error) {
      console.error('Error fetching CV file url:', error);
      message.error('Không thể mở file CV');
    }
  };

  const columns = [
    {
      title: 'Ứng viên',
      dataIndex: 'candidateName',
      key: 'candidateName',
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.candidateEmail}</Text>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'currentState',
      key: 'currentState',
      width: 180,
      render: (state) => <ApplicationStateTag state={state} />,
    },
    {
      title: 'Ngày nộp',
      dataIndex: 'appliedAt',
      key: 'appliedAt',
      width: 140,
      render: (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—'),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleOpenCvFile(record.cvId)}
        >
          Xem CV
        </Button>
      ),
    },
  ];

  return (
    <div className="cv-intake-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Nhận hồ sơ</Title>
          <Text type="secondary">
            Nộp CV hộ ứng viên và xem hồ sơ đã nhận của từng vị trí
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => selectedJob && fetchApplications(selectedJob)}>
            Làm mới
          </Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadModalOpen(true)}>
            Nộp CV
          </Button>
        </Space>
      </div>

      <Card className="main-card">
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Select
              style={{ width: '100%' }}
              placeholder="Chọn vị trí tuyển dụng"
              value={selectedJob}
              onChange={setSelectedJob}
              options={jobs.map((j) => ({ value: j.jobId, label: j.title }))}
            />
          </Col>
        </Row>

        <Table
          rowKey="applicationId"
          loading={loading}
          columns={columns}
          dataSource={applications}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có hồ sơ nào cho vị trí này"
              />
            ),
          }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </Card>

      <Modal
        title="Nộp CV cho ứng viên"
        open={uploadModalOpen}
        onCancel={resetUploadModal}
        onOk={handleUploadCV}
        okText="Nộp hồ sơ"
        cancelText="Huỷ"
        confirmLoading={uploading}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input
            placeholder="Họ tên ứng viên *"
            value={candidateName}
            onChange={(e) => { setCandidateName(e.target.value); setPrefilled((p) => ({ ...p, name: false })); }}
            suffix={prefilled.name ? <Text type="secondary" style={{ fontSize: 11 }}>từ CV</Text> : null}
          />
          <Input
            placeholder="Email ứng viên *"
            value={candidateEmail}
            onChange={(e) => { setCandidateEmail(e.target.value); setPrefilled((p) => ({ ...p, email: false })); }}
            suffix={prefilled.email ? <Text type="secondary" style={{ fontSize: 11 }}>từ CV</Text> : null}
          />
          <Input
            placeholder="Số điện thoại"
            value={candidatePhone}
            onChange={(e) => { setCandidatePhone(e.target.value); setPrefilled((p) => ({ ...p, phone: false })); }}
            suffix={prefilled.phone ? <Text type="secondary" style={{ fontSize: 11 }}>từ CV</Text> : null}
          />

          <Dragger
            accept=".pdf"
            maxCount={1}
            beforeUpload={(f) => {
              setFile(f);
              prefillFromCv(f);
              return false; // chặn upload tự động của antd — gửi kèm form bên trên
            }}
            onRemove={() => { setFile(null); setPrefilled({}); }}
            fileList={file ? [file] : []}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Kéo thả hoặc bấm để chọn file CV</p>
            <p className="ant-upload-hint">
              {parsing
                ? 'Đang đọc CV để điền sẵn thông tin...'
                : 'Chỉ nhận PDF có lớp chữ. Chọn file xong, hệ thống tự điền họ tên / email / điện thoại — bạn soát lại rồi nộp.'}
            </p>
          </Dragger>

          <Text type="secondary" style={{ fontSize: 12 }}>
            <FileTextOutlined /> Hồ sơ vào bước “Tiếp nhận & sàng lọc”; bạn đọc CV và quyết hồ sơ nào chuyển tiếp cho Trưởng bộ phận.
          </Text>
        </Space>
      </Modal>
    </div>
  );
};

export default CvIntake;
