import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, LogOut, RotateCw, AlertCircle, Check } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getCachedFriends, setCachedFriends } from '../services/offlineStorage';
import Logo from '../components/Logo';
import Avatar from '../components/Avatar';

export const HomePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isUserOnline, socket } = useSocket();

  const [friends, setFriends] = useState(getCachedFriends());
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add friend state
  const [searchMobile, setSearchMobile] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Fetch friends from server
  const fetchFriends = async () => {
    try {
      const res = await api.get('/friends');
      if (res.success) {
        setFriends(res.friends);
        setCachedFriends(res.friends);
      }
    } catch (err) {
      console.warn('[Home] Failed to load friends:', err);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  // Listen for real-time messages to update last message preview and order
  useEffect(() => {
    if (!socket) return;

    const handleMessageReceive = (message) => {
      setFriends((prev) => {
        const senderId = message.sender;
        const exists = prev.find((f) => f.user?._id === senderId);

        let updated;
        if (exists) {
          updated = prev.map((f) =>
            f.user?._id === senderId
              ? { ...f, lastMessage: message, lastInteractionAt: message.createdAt }
              : f
          );
        } else {
          // New conversation: refresh from server
          fetchFriends();
          return prev;
        }

        // Sort descending by lastInteractionAt
        updated.sort(
          (a, b) => new Date(b.lastInteractionAt || 0) - new Date(a.lastInteractionAt || 0)
        );
        setCachedFriends(updated);
        return updated;
      });
    };

    socket.on('message:receive', handleMessageReceive);
    return () => {
      socket.off('message:receive', handleMessageReceive);
    };
  }, [socket]);

  // Handle Search User
  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchResult(null);

    const trimmed = searchMobile.trim();
    if (!trimmed) return;

    setSearchLoading(true);
    try {
      const res = await api.get(`/friends/search?mobile=${encodeURIComponent(trimmed)}`);
      if (res.success && res.user) {
        setSearchResult(res);
      }
    } catch (err) {
      setSearchError(err.message || 'No registered user found with this number.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle Add Friend
  const handleAddFriend = async () => {
    if (!searchResult?.user?._id) return;
    setAddLoading(true);
    try {
      const res = await api.post('/friends/add', { friendId: searchResult.user._id });
      if (res.success) {
        setShowAddModal(false);
        setSearchMobile('');
        setSearchResult(null);
        await fetchFriends();
      }
    } catch (err) {
      setSearchError(err.message || 'Failed to add friend.');
    } finally {
      setAddLoading(false);
    }
  };

  // Format timestamp helper
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-lg mx-auto border-x border-zinc-900 select-none">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-zinc-900 px-5 py-4 flex items-center justify-between">
        <Logo size="sm" />

        <div className="flex items-center gap-3">
          {/* Add Friend Button */}
          <button
            onClick={() => {
              setShowAddModal(true);
              setSearchError('');
              setSearchResult(null);
            }}
            aria-label="Add Friend"
            className="w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center transition-all active:scale-95"
          >
            <Plus size={18} />
          </button>

          {/* User Avatar */}
          <Avatar name={user?.name} avatar={user?.avatar} size="sm" />

          {/* Logout */}
          <button
            onClick={logout}
            aria-label="Logout"
            className="w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Friends List */}
      <main className="flex-1 overflow-y-auto divide-y divide-zinc-900/80">
        {friends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-500">
              <Search size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No friends yet</h3>
            <p className="text-zinc-400 text-sm max-w-xs leading-relaxed mb-6">
              Enter a friend's mobile number above to start a conversation.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-white text-black font-semibold text-sm rounded-xl hover:bg-zinc-200 transition-all active:scale-95"
            >
              Add Friend
            </button>
          </div>
        ) : (
          friends.map((item) => {
            const friend = item.user;
            if (!friend) return null;
            const online = isUserOnline(friend._id) || friend.isOnline;

            return (
              <div
                key={friend._id}
                onClick={() => navigate(`/chat/${friend._id}`, { state: { friend } })}
                className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-950/70 transition-colors cursor-pointer active:bg-zinc-900/50"
              >
                <Avatar
                  name={friend.name}
                  avatar={friend.avatar}
                  size="md"
                  showStatus={true}
                  isOnline={online}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-white font-semibold text-base truncate">
                      {friend.name}
                    </h3>
                    <span className="text-zinc-500 text-xs shrink-0 ml-2">
                      {formatTime(item.lastInteractionAt || item.lastMessage?.createdAt)}
                    </span>
                  </div>

                  <p className="text-zinc-400 text-sm truncate">
                    {item.lastMessage ? item.lastMessage.content : 'No messages yet'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Add Friend Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Add Friend</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-2 font-semibold">
                  Mobile Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    autoFocus
                    placeholder="+91 9876543210"
                    value={searchMobile}
                    onChange={(e) => setSearchMobile(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-white text-sm"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className="px-4 py-2.5 bg-white text-black font-semibold rounded-xl text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    {searchLoading ? <RotateCw size={16} className="animate-spin" /> : 'Find'}
                  </button>
                </div>
              </div>

              {searchError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
                  <AlertCircle size={15} className="shrink-0 text-white" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Search Result Card */}
              {searchResult && (
                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={searchResult.user.name}
                      avatar={searchResult.user.avatar}
                      size="sm"
                    />
                    <div className="truncate">
                      <p className="text-white font-semibold text-sm truncate">
                        {searchResult.user.name}
                      </p>
                      <p className="text-zinc-500 text-xs truncate">
                        {searchResult.user.mobile}
                      </p>
                    </div>
                  </div>

                  {searchResult.alreadyFriend ? (
                    <span className="text-xs text-zinc-400 flex items-center gap-1 font-medium">
                      <Check size={14} className="text-white" /> Friends
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAddFriend}
                      disabled={addLoading}
                      className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                      {addLoading ? <RotateCw size={14} className="animate-spin" /> : 'Add'}
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
