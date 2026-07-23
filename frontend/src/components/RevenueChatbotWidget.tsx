import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

interface RevenueChatbotWidgetProps {
  onExportReport?: () => void;
}

export const RevenueChatbotWidget: React.FC<RevenueChatbotWidgetProps> = ({ onExportReport }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasNewInsight, setHasNewInsight] = useState(true);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: 'Xin chào Quản lý! Tôi là **Trợ lý Doanh thu AI** (kết nối trực tiếp dữ liệu bãi xe).\n\nBạn có thể hỏi tôi về tổng doanh thu, doanh thu <span style="color:#60A5FA;font-weight:600;">Khách lẻ</span>, <span style="color:#4ADE80;font-weight:600;">Gói tháng</span>, hoặc so sánh với kỳ trước!',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasNewInsight(false);
    }
  }, [messages, isOpen]);

  const quickReplies = [
    'Doanh thu hôm nay',
    'So sánh tháng này với tháng trước',
    'Tóm tắt theo Khách lẻ / Gói tháng',
    'Xuất báo cáo nhanh',
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    if (query === 'Xuất báo cáo nhanh') {
      const userMsg: Message = {
        id: Date.now().toString(),
        sender: 'user',
        text: query,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: 'Đang tiến hành xuất báo cáo doanh thu ra file Excel cho bạn...',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg, botMsg]);
      if (!textToSend) setInput('');
      if (onExportReport) {
        onExportReport();
      }
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await api.post<{ success: boolean; data: { answer: string; timestamp: string } }>(
        '/chatbot/ask',
        { question: query }
      );

      const botText = res.data?.data?.answer || 'Tôi đã nhận được dữ liệu nhưng không thể xử lý câu trả lời.';

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: botText,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('[Chatbot Error]', err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: '❌ Khởi tạo kết nối Gemini thất bại. Vui lòng kiểm tra lại backend hoặc GEMINI_API_KEY trong .env.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        sender: 'bot',
        text: 'Đã làm mới hội thoại! Bạn cần tôi phân tích dữ liệu doanh thu nào tiếp theo?',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <>
      {/* ── FLOATING LAUNCHER BUTTON ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            border: 'none',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4), 0 4px 10px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          title="Mở Trợ lý Doanh thu AI"
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {/* Parking Logo Icon */}
          <div style={{ position: 'relative', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'sans-serif', color: '#FFF' }}>P</span>
          </div>

          {/* Insight Alert Badge */}
          {hasNewInsight && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '14px',
                height: '14px',
                backgroundColor: '#EF4444',
                borderRadius: '50%',
                border: '2px solid #0F1420',
                boxShadow: '0 0 8px #EF4444',
              }}
            />
          )}
        </button>
      )}

      {/* ── CHATBOT WIDGET MODAL ── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 10000,
            width: isExpanded ? '640px' : '400px',
            height: isExpanded ? '720px' : '540px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 32px)',
            backgroundColor: '#171E2E',
            border: '1px solid #2A3346',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 20px rgba(59, 130, 246, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'all 0.3s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: '#0F1420',
              borderBottom: '1px solid #2A3346',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#3B82F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  color: '#FFF',
                  fontSize: '18px',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                }}
              >
                P
              </div>
              <div>
                <div style={{ color: '#F3F4F6', fontWeight: 600, fontSize: '15px', lineHeight: '1.2' }}>
                  Trợ lý Doanh thu
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
                  <span style={{ color: '#9CA3AF', fontSize: '12px' }}>Online • Gemini 2.5 Flash</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={handleResetChat}
                style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                title="Làm mới hội thoại"
              >
                🔄
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                title={isExpanded ? 'Thu nhỏ' : 'Phóng to'}
              >
                {isExpanded ? '🗗' : '🗖'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '6px', borderRadius: '6px', fontSize: '16px' }}
                title="Đóng"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              backgroundColor: '#0F1420',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '12px 16px',
                    borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    backgroundColor: msg.sender === 'user' ? '#2563EB' : '#1E2536',
                    color: msg.sender === 'user' ? '#FFFFFF' : '#E5E7EB',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    whiteSpace: 'pre-wrap',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: msg.text.replace(/\n/g, '<br />'),
                  }}
                />
                <span style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', paddingLeft: '4px', paddingRight: '4px' }}>
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div
                  style={{
                    padding: '10px 16px',
                    borderRadius: '16px 16px 16px 4px',
                    backgroundColor: '#1E2536',
                    color: '#9CA3AF',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                  <span>Trợ lý AI đang truy vấn dữ liệu...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reply Chips */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#171E2E',
              borderTop: '1px solid #2A3346',
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none',
            }}
          >
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(reply)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid #3B82F6',
                  color: '#60A5FA',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#3B82F6';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.color = '#60A5FA';
                }}
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#171E2E',
              borderTop: '1px solid #2A3346',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <input
              type="text"
              placeholder="Hỏi về doanh thu, lượt xe, gói tháng..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#0F1420',
                border: '1px solid #2A3346',
                color: '#F3F4F6',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                backgroundColor: loading || !input.trim() ? '#374151' : '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Gửi
            </button>
          </div>
        </div>
      )}
    </>
  );
};
