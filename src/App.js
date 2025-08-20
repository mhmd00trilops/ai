// src/App.js
import React, { useEffect, useRef, useState } from 'react';
import SoapNotes from './SoapNotes';
import './App.css';

const ChatApp = () => {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentView, setCurrentView] = useState('chat'); // 'chat' or 'soap'
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (currentView === 'chat') {
      scrollToBottom();
    }
  }, [messages, currentView]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (text, isUser = false, isError = false) => {
    setMessages(prev => [...prev, { text, isUser, isError }]);
  };

  const resetChat = () => {
    setSessionId(null);
    setMessages([]);
    setUserInput('');
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isTyping) return;
    const message = userInput;
    setUserInput('');
    addMessage(message, true);
    setIsTyping(true);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'comp-id': 'bcdb5d0d-40f6-4588-99d6-0099f58141b2',
        'comp-api-key': '30d508c3fb53a1614e490aa3117a614b',
      };
      if (sessionId) headers['session-id'] = sessionId;

      const res = await fetch('https://weal-customer-chatbot-stage.up.railway.app/chat/', {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_query: message }),
      });

      const data = await res.json();

      if (data.session_expired) {
        setSessionId(null);
      } else {
        setSessionId(data.session_id);
      }

      addMessage(data.response);
    } catch (error) {
      console.error('Error:', error);
      addMessage("Sorry, something went wrong. Please try again.", false, true);
    } finally {
      setIsTyping(false);
    }
  };

  // Navigation component
  const Navigation = () => (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      display: 'flex',
      gap: '10px'
    }}>
      <button
        onClick={() => setCurrentView('chat')}
        style={{
          backgroundColor: currentView === 'chat' ? '#007BFF' : '#6c757d',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0px 2px 6px rgba(0,0,0,0.2)',
        }}
      >
        💬 Chat
      </button>
      <button
        onClick={() => setCurrentView('soap')}
        style={{
          backgroundColor: currentView === 'soap' ? '#007BFF' : '#6c757d',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0px 2px 6px rgba(0,0,0,0.2)',
        }}
      >
        📝 SOAP Notes
      </button>
    </div>
  );

  // Render SOAP Notes view
  if (currentView === 'soap') {
    return (
      <>
        <Navigation />
        <SoapNotes />
      </>
    );
  }

  // Render Chat view
  return (
    <>
      <Navigation />
      <div className="chatbot-container">
        <div className="chat-header">
          <h1>AI Assistant</h1>
          <p>How can I help you today?</p>
        </div>

        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🤖</div>
              <h3>Welcome to AI Chat</h3>
              <p>Start a conversation by typing your message below</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`message ${msg.isUser ? 'user' : 'bot'}${msg.isError ? ' error' : ''}`}>
                <div className="message-avatar">{msg.isUser ? '👤' : '🤖'}</div>
                <div className="message-content">{msg.text}</div>
              </div>
            ))
          )}

          {isTyping && (
            <div className="message bot">
              <div className="message-avatar">🤖</div>
              <div className="message-content typing-indicator">
                <div className="typing-dots">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-wrapper">
            <input
              type="text"
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyPress={e => {
                if (e.key === 'Enter') sendMessage();
              }}
              placeholder="Type your message..."
              disabled={isTyping}
            />
          </div>
          <button className="send-button" onClick={sendMessage} disabled={isTyping}>➤</button>
          <button className="new-chat-button" onClick={resetChat}>New Chat</button>
        </div>
      </div>
    </>
  );
};

export default ChatApp;