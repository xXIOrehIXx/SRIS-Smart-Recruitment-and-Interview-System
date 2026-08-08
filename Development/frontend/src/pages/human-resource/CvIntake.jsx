import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Table, Tag, Select, Upload, message,
  Row, Col, Space, Modal, Input, Empty
} from 'antd';
import {
  UploadOutlined, InboxOutlined, ReloadOutlined, EyeOutlined, FileTextOutlined
} from '@ant-design/icons';
import { cvAPI, jobsAPI, applicationAPI } from '../../services/api';
import './css/CvIntake.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// Nhãn 4 pha hiển thị (6 state nội bộ gộp lại — docs 5.16).
const STATE_LABEL = {
  NEW: { text: 'Hồ sơ mới', color: 'blue' },
  SCREENING: { text: 'Sàng lọc', color: 'gold' },
  INTERVIEW: { text: 'Phỏng vấn', color: 'purple' },
  OFFER: { text: 'Quyết định', color: 'cyan' },
  HIRED: { text: 'Đã tuyển', color: 'green' },
  REJECTED: { text: 'Đã loại', color: 'red' },
};

/**
 * Nhận hồ sơ ứng viên: Human Resource nộp CV hộ ứng viên (CV nhận qua email, hội chợ
 * việc làm...) và xem danh sách hồ sơ đã nộp của một vị trí.
 *
 * KHÔNG chấm điểm, KHÔNG xếp hạng — sàng lọc là việc của người tuyển dụng.
 */
const CvIntake = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applications, setApplications] = useState([]);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [file, setFile] = useState(null);
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
      width: 140,
      render: (state) => {
        const s = STATE_LABEL[state] || { text: state, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
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
            onChange={(e) => setCandidateName(e.target.value)}
          />
          <Input
            placeholder="Email ứng viên *"
            value={candidateEmail}
            onChange={(e) => setCandidateEmail(e.target.value)}
          />
          <Input
            placeholder="Số điện thoại"
            value={candidatePhone}
            onChange={(e) => setCandidatePhone(e.target.value)}
          />

          <Dragger
            accept=".pdf"
            maxCount={1}
            beforeUpload={(f) => {
              setFile(f);
              return false; // chặn upload tự động của antd — gửi kèm form bên trên
            }}
            onRemove={() => setFile(null)}
            fileList={file ? [file] : []}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Kéo thả hoặc bấm để chọn file CV</p>
            <p className="ant-upload-hint">
              Chỉ nhận PDF có lớp chữ. PDF scan ảnh sẽ không đọc được nội dung.
            </p>
          </Dragger>

          <Text type="secondary" style={{ fontSize: 12 }}>
            <FileTextOutlined /> Hồ sơ được tạo ở bước “Hồ sơ mới”; việc sàng lọc do bạn quyết định.
          </Text>
        </Space>
      </Modal>
    </div>
  );
};

export default CvIntake;
