import React, { useState, useEffect, useRef } from 'react';

const Chat = ({ messages, sendMessage }) => {
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        sendMessage(newMessage);
        setNewMessage("");
    }

    return (
        <div className="chat-container" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'var(--bg-secondary)',
            borderRadius: '1rem',
            overflow: 'hidden'
        }}>
            <div className="chat-header" style={{
                padding: '1rem',
                borderBottom: '1px solid var(--bg-primary)',
                fontWeight: 'bold'
            }}>
                Toplantı Sohbeti
            </div>

            <div className="chat-messages" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
            }}>
                {messages.map((msg, index) => (
                    <div key={index} className="message" style={{
                        alignSelf: msg.isMe ? 'flex-end' : 'flex-start',
                        background: msg.isMe ? 'var(--accent)' : 'var(--bg-primary)',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        maxWidth: '80%',
                        fontSize: '0.9rem'
                    }}>
                        {!msg.isMe && <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '2px' }}>{msg.sender}</div>}
                        {msg.message}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} style={{
                padding: '1rem',
                borderTop: '1px solid var(--bg-primary)',
                display: 'flex',
                gap: '0.5rem'
            }}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Mesaj yaz..."
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                    ➤
                </button>
            </form>
        </div>
    );
};

export default Chat;
