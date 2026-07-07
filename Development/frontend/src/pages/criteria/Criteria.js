import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Modal, Form, Input, Select, Slider, Space, message, Popconfirm, Tooltip, Row, Col, Descriptions, Divider, Tabs } from 'antd';
import {
  PlusOutlined, CheckSquareOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, CopyOutlined, CheckCircleOutlined, StarOutlined
} from '@ant-design/icons';
import { criteriaAPI, jobsAPI } from '../../services/api';
import './css/Criteria.css';

const { Title, Text } = Typography;

const MATCHA_GREEN = '#5D8C3E';

const Criteria = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [jobCriteria, setJobCriteria] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchJobs();
  }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchJobCriteria(selectedJob);
    } else {
      setJobCriteria([]);
    }
  }, [selectedJob]);

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await criteriaAPI.getTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      message.error('Không thể tải danh sách tiêu chí');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobCriteria = async (jobId) => {
    try {
      const response = await criteriaAPI.getByJob(jobId);
      setJobCriteria(response.data || []);
    } catch (error) {
      console.error('Error fetching job criteria:', error);
      setJobCriteria([]);
    }
  };

  const handleCreateTemplate = async (values) => {
    try {
      setSubmitting(true);
      await criteriaAPI.createTemplate(values);
      message.success('Tạo template tiêu chí thành công!');
      setCreateModalOpen(false);
      form.resetFields();
      fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      message.error('Không thể tạo template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignToJob = async (values) => {
    try {
      setSubmitting(true);
      await criteriaAPI.addToJob(selectedJob, values);
      message.success('Gán tiêu chí thành công!');
      setAssignModalOpen(false);
      assignForm.resetFields();
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error('Error assigning criteria:', error);
      message.error('Không thể gán tiêu chí');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveFromJob = async (criteriaId) => {
    try {
      await criteriaAPI.removeFromJob(criteriaId);
      message.success('Đã xóa tiêu chí khỏi vị trí');
      fetchJobCriteria(selectedJob);
    } catch (error) {
      console.error('Error removing criteria:', error);
      message.error('Không thể xóa tiêu chí');
    }
  };

  const handleUpdateTemplate = async (values) => {
    try {
      setSubmitting(true);
      await criteriaAPI.updateTemplate(selectedTemplate.id, values);
      message.success('Cập nhật template thành công!');
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      message.error('Không thể cập nhật template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await criteriaAPI.deleteTemplate(id);
      message.success('Xóa template thành công!');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      message.error('Không thể xóa template');
    }
  };

  const templateColumns = [
    {
      title: 'Tên template',
      key: 'name',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
        </div>
      ),
    },
    {
      title: 'Số tiêu chí',
      key: 'criteriaCount',
      width: 120,
      render: (_, record) => (
        <Tag color="blue">{record.criteria?.length || 0} tiêu chí</Tag>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      render: (_, record) => (
        <Tag color={record.isActive !== false ? 'success' : 'default'}>
          {record.isActive !== false ? 'Hoạt động' : 'Tắt'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedTemplate(record);
                editForm.setFieldsValue({
                  name: record.name,
                  description: record.description,
                  criteria: record.criteria,
                });
                setEditModalOpen(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa template này?"
            onConfirm={() => handleDeleteTemplate(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Xóa">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const jobCriteriaColumns = [
    {
      title: 'Tiêu chí',
      key: 'name',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name || record.criterionName}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
        </div>
      ),
    },
    {
      title: 'Trọng số',
      key: 'weight',
      width: 160,
      render: (_, record) => (
        <div>
          <Slider
            value={record.weight || 1}
            min={1}
            max={10}
            disabled
            style={{ marginBottom: 4 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>Trọng số: {record.weight || 1}</Text>
        </div>
      ),
    },
    {
      title: 'Điểm tối đa',
      dataIndex: 'maxScore',
      key: 'maxScore',
      width: 100,
      render: (score) => <Text strong>{score || 100}</Text>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="Xóa tiêu chí này?"
          onConfirm={() => handleRemoveFromJob(record.id)}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />}>
            Xóa
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'templates',
      label: <span><CheckSquareOutlined /> Template tiêu chí</span>,
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
              style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
            >
              Tạo Template Mới
            </Button>
          </div>
          <Table
            columns={templateColumns}
            dataSource={templates}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </>
      ),
    },
    {
      key: 'job-criteria',
      label: <span><StarOutlined /> Tiêu chí theo vị trí</span>,
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Select
              placeholder="Chọn vị trí"
              value={selectedJob}
              onChange={(val) => setSelectedJob(val)}
              style={{ width: 280 }}
              showSearch
              filterOption={(input, option) =>
                (option.label || '').toLowerCase().includes(input.toLowerCase())
              }
              options={jobs.map(job => ({ value: job.id, label: job.title }))}
              allowClear
            />
            {selectedJob && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAssignModalOpen(true)}
                style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}
              >
                Gán tiêu chí
              </Button>
            )}
          </div>
          {selectedJob ? (
            <Table
              columns={jobCriteriaColumns}
              dataSource={jobCriteria}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8b' }}>
              Vui lòng chọn vị trí để xem tiêu chí
            </div>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="criteria-page">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Tiêu Chí Đánh Giá</Title>
          <Text type="secondary">Quản lý template và gán tiêu chí đánh giá cho vị trí tuyển dụng</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchTemplates(); if (selectedJob) fetchJobCriteria(selectedJob); }} loading={loading}>
          Làm mới
        </Button>
      </div>

      <Card className="main-card" bordered={false}>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlusOutlined style={{ color: MATCHA_GREEN }} />
            Tạo template tiêu chí mới
          </div>
        }
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateTemplate} style={{ marginTop: 20 }}>
          <Form.Item label="Tên template" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên template' }]}>
            <Input placeholder="VD: Template phỏng vấn kỹ thuật" />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} placeholder="Mô tả ngắn về template..." />
          </Form.Item>
          <Form.Item label="Trạng thái" name="isActive" initialValue={true} valuePropName="checked">
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text>Hoạt động</Text>
            </Space>
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setCreateModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}>
              Tạo template
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlusOutlined style={{ color: MATCHA_GREEN }} />
            Gán tiêu chí cho vị trí
          </div>
        }
        open={assignModalOpen}
        onCancel={() => { setAssignModalOpen(false); assignForm.resetFields(); }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssignToJob} style={{ marginTop: 20 }}>
          <Form.Item label="Chọn tiêu chí từ template" name="templateId" rules={[{ required: true, message: 'Vui lòng chọn template' }]}>
            <Select
              placeholder="-- Chọn template --"
              showSearch
              options={templates
                .filter(t => t.isActive !== false)
                .map(t => ({ value: t.id, label: `${t.name} (${t.criteria?.length || 0} tiêu chí)` }))}
            />
          </Form.Item>
          <Form.Item label="Trọng số mặc định" name="weight" initialValue={5}>
            <Slider min={1} max={10} marks={{ 1: '1', 5: '5', 10: '10' }} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setAssignModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}>
              Gán tiêu chí
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: MATCHA_GREEN }} />
            Chỉnh sửa template
          </div>
        }
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); editForm.resetFields(); setSelectedTemplate(null); }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateTemplate} style={{ marginTop: 20 }}>
          <Form.Item label="Tên template" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên template' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setEditModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ background: MATCHA_GREEN, borderColor: MATCHA_GREEN }}>
              Lưu thay đổi
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Criteria;
