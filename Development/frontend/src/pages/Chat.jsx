import React, { useState, useEffect, useRef } from 'react';
import { chatAiAPI } from '../services/api';

export default function Chat() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const endOfMessagesRef = useRef(null);

  // Cuộn xuống cuối khung chat tự động
  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading]);

  // Vừa vào trang là tự động lấy danh sách Model
  useEffect(() => {
    chatAiAPI.getModels()
      .then(res => {
        const data = res.data;
        if (data.models && data.models.length > 0) {
          setModels(data.models);
          setSelectedModel(data.models[0]); // Mặc định chọn model đầu tiên
        }
      })
      .catch(err => console.error("Lỗi lấy models:", err));
  }, []);

  const handleSend = async () => {
    if (!message.trim() || !selectedModel) return;
    
    const userMsg = message;
    setMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await chatAiAPI.chat(selectedModel, userMsg);
      setChatHistory(prev => [...prev, { role: 'ai', content: res.data.reply }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'error', content: err.response?.data || err.message }]);
    }
    
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', fontFamily: 'sans-serif', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>💬 Chat với LLM Model</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: '#f0f2f5', padding: '15px', borderRadius: '10px' }}>
        <label style={{ fontWeight: 'bold' }}>Model hiện tại:</label>
        <select 
          value={selectedModel} 
          onChange={e => setSelectedModel(e.target.value)}
          style={{ flex: 1, padding: '10px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc', outline: 'none' }}
        >
          {models.length === 0 && <option>Đang quét model trong server...</option>}
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={{ border: '1px solid #e1e4e8', borderRadius: '12px', padding: '20px', height: '500px', overflowY: 'auto', marginBottom: '20px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        {chatHistory.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', marginTop: '200px' }}>
            <p style={{ fontSize: '1.2em' }}>Hãy thử gửi lời chào!</p>
          </div>
        )}
        
        {chatHistory.map((msg, i) => (
          <div key={i} style={{ marginBottom: '20px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{ 
              display: 'inline-block', padding: '12px 18px', borderRadius: '20px',
              backgroundColor: msg.role === 'user' ? '#0084ff' : msg.role === 'error' ? '#ff4d4f' : '#f0f2f5',
              color: msg.role === 'user' ? 'white' : 'black',
              maxWidth: '85%', whiteSpace: 'pre-wrap', textAlign: 'left',
              lineHeight: '1.5', fontSize: '15px'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: 'left', marginBottom: '20px' }}>
            <div style={{ display: 'inline-block', padding: '12px 18px', borderRadius: '20px', backgroundColor: '#f0f2f5', color: '#666', fontStyle: 'italic', fontSize: '14px' }}>
              AI đang suy nghĩ...
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value={message} 
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Nhập câu hỏi ở đây (Bấm Enter để gửi)..."
          style={{ flex: 1, padding: '15px', fontSize: '16px', borderRadius: '25px', border: '1px solid #ccc', outline: 'none' }}
          disabled={loading}
        />
        <button 
          onClick={handleSend} 
          disabled={loading || !selectedModel}
          style={{ padding: '10px 25px', fontSize: '16px', cursor: 'pointer', borderRadius: '25px', background: '#0084ff', color: 'white', border: 'none', fontWeight: 'bold' }}
        >
          Gửi
        </button>
      </div>
    </div>
  );
}
