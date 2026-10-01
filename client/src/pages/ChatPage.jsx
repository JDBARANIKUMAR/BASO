import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, Video, Send, Check, CheckCheck, RotateCw } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import { getCachedMessages, setCachedMessages } from '../services/offlineStorage';
import Avatar from '../components/Avatar';

export const ChatPage = () => {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAuth();
  const { socket, isUserOnline } = useSocket();
  const { startCall } = useCall();

  // Friend data (passed from navigation or fetched)
  const [friend, setFriend] = useState(location.state?.friend || null);
  const [messages, setMessages] = useState(() => getCachedMessages(friendId));
  const [inputMessage, setInputMessage] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const isFirstLoadRef = useRef(true);

  // Fetch friend profile if not present
  useEffect(() => {
    if (!friend) {
      api.get('/friends').then((res) => {
        if (res.success) {
          const match = res.friends.find((f) => f.user?._id === friendId);
          if (match?.user) setFriend(match.user);
        }
      });
    }
  }, [friendId, friend]);

  // Fetch initial message history
  const fetchMessages = async () => {
    try {
      const res = await api.get(`/messages/${friendId}?limit=40`);
      if (res.success) {
        setMessages(res.messages);
        setHasMore(res.hasMore);
        setCachedMessages(friendId, res.messages);
      }
    } catch (err) {
      console.warn('[Chat] Failed to load messages:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [friendId]);

  // Mark incoming messages as read
  useEffect(() => {
    if (socket && friendId) {
      socket.emit('message:read', { senderId: friendId });
    }
  }, [socket, friendId, messages.length]);

  // Real-time message events
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (newMsg) => {
      if (newMsg.sender === friendId || newMsg.recipient === friendId) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m._id === newMsg._id || (m.tempId && m.tempId === newMsg.tempId))) {
            return prev.map((m) =>
              m.tempId === newMsg.tempId ? newMsg : m
            );
          }
          const updated = [...prev, newMsg];
          setCachedMessages(friendId, updated);
          return updated;
        });

        // Mark as read
        if (newMsg.sender === friendId) {
          socket.emit('message:read', { senderId: friendId });
        }
      }
    };

    const handleReadAck = ({ readBy, readAt }) => {
      if (readBy === friendId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.recipient === friendId && m.status !== 'read'
              ? { ...m, status: 'read', readAt }
              : m
          )
        );
      }
    };

    socket.on('message:receive', handleReceive);
    socket.on('message:read_ack', handleReadAck);

    return () => {
      socket.off('message:receive', handleReceive);
      socket.off('message:read_ack', handleReadAck);
    };
  }, [socket, friendId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (isFirstLoadRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      isFirstLoadRef.current = false;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Load older messages on scroll top
  const handleScroll = async () => {
    const container = chatContainerRef.current;
    if (!container || loadingOlder || !hasMore || messages.length === 0) return;

    if (container.scrollTop === 0) {
      setLoadingOlder(true);
      const oldestMsg = messages[0];
      try {
        const res = await api.get(
          `/messages/${friendId}?before=${encodeURIComponent(oldestMsg.createdAt)}&limit=30`
        );
        if (res.success && res.messages.length > 0) {
          const oldScrollHeight = container.scrollHeight;
          setMessages((prev) => [...res.messages, ...prev]);
          setHasMore(res.hasMore);

          // Preserve scroll position
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight - oldScrollHeight;
          });
        } else {
          setHasMore(false);
        }
      } catch (err) {
        console.warn('[Chat] Failed to load older messages:', err);
      } finally {
        setLoadingOlder(false);
      }
    }
  };

  // Send message
  const handleSend = async (e) => {
    e.preventDefault();
    const content = inputMessage.trim();
    if (!content) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      tempId,
      sender: user._id,
      recipient: friendId,
      content,
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    // Optimistic UI update
    setMessages((prev) => {
      const updated = [...prev, optimisticMessage];
      setCachedMessages(friendId, updated);
      return updated;
    });
    setInputMessage('');

    if (socket && socket.connected) {
      socket.emit(
        'message:send',
        { recipientId: friendId, content, tempId },
        (res) => {
          if (res?.success && res.message) {
            setMessages((prev) =>
              prev.map((m) => (m.tempId === tempId ? res.message : m))
            );
          }
        }
      );
    } else {
      // Fallback to HTTP REST
      try {
        const res = await api.post('/messages/send', {
          recipientId: friendId,
          content,
          tempId,
        });
        if (res.success && res.message) {
          setMessages((prev) =>
            prev.map((m) => (m.tempId === tempId ? res.message : m))
          );
        }
      } catch (err) {
        console.error('[Chat] Failed to send message:', err);
      }
    }
  };

  const isOnline = isUserOnline(friendId) || friend?.isOnline;

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-lg mx-auto border-x border-zinc-900 select-none">
      {/* Top Bar: Back, Name & Photo, ONLY Voice Call & Video Call */}
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-zinc-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/')}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
          >
            <ArrowLeft size={18} />
          </button>

          <Avatar
            name={friend?.name}
            avatar={friend?.avatar}
            size="sm"
            showStatus={true}
            isOnline={isOnline}
          />

          <div className="truncate">
            <h2 className="text-white font-semibold text-base truncate leading-tight">
              {friend?.name || 'Friend'}
            </h2>
            <p className="text-[11px] text-zinc-400 font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        {/* ONLY TWO ICONS: Voice Call and Video Call */}
        <div className="flex items-center gap-2">
          {/* Voice Call */}
          <button
            onClick={() => startCall(friend, 'voice')}
            aria-label="Voice Call"
            className="w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center transition-all active:scale-95"
            title="Voice Call"
          >
            <Phone size={16} />
          </button>

          {/* Video Call */}
          <button
            onClick={() => startCall(friend, 'video')}
            aria-label="Video Call"
            className="w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center transition-all active:scale-95"
            title="Video Call"
          >
            <Video size={16} />
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <main
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {loadingOlder && (
          <div className="flex justify-center py-2 text-zinc-500">
            <RotateCw size={16} className="animate-spin" />
          </div>
        )}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center text-zinc-500 text-sm">
            <p>No messages yet.</p>
            <p className="text-xs text-zinc-600 mt-1">Say hello to start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === user?._id;

            return (
              <div
                key={msg._id || msg.tempId}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
                    isMe
                      ? 'bg-zinc-950 text-white border border-zinc-800 rounded-br-sm'
                      : 'bg-white text-black border border-zinc-300 rounded-bl-sm'
                  }`}
                >
                  <p>{msg.content}</p>

                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isMe ? 'text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    <span>{formatMessageTime(msg.createdAt)}</span>

                    {/* Status Ticks for Sent Messages */}
                    {isMe && (
                      <span className="ml-0.5 inline-flex items-center">
                        {msg.status === 'sent' && <Check size={12} className="text-zinc-500" />}
                        {msg.status === 'delivered' && (
                          <CheckCheck size={13} className="text-zinc-400" />
                        )}
                        {msg.status === 'read' && (
                          <CheckCheck size={13} className="text-white font-bold" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Box with Send Button */}
      <footer className="sticky bottom-0 z-20 bg-black/95 backdrop-blur-md border-t border-zinc-900 p-3 sm:p-4">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-full text-white placeholder-zinc-600 focus:outline-none focus:border-white text-sm transition-colors"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim()}
            aria-label="Send Message"
            className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center font-bold hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-white"
          >
            <Send size={16} />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default ChatPage;
