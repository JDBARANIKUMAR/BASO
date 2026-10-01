/**
 * Offline storage helper for caching chats and conversations locally
 */

const STORAGE_PREFIX = 'baso_chat_';

export const getCachedMessages = (friendId) => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${friendId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const setCachedMessages = (friendId, messages) => {
  try {
    // Keep most recent 100 messages cached per contact
    const slice = messages.slice(-100);
    localStorage.setItem(`${STORAGE_PREFIX}${friendId}`, JSON.stringify(slice));
  } catch (e) {
    console.warn('[OfflineStorage] Cache write failed:', e);
  }
};

export const getCachedFriends = () => {
  try {
    const raw = localStorage.getItem('baso_cached_friends');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const setCachedFriends = (friends) => {
  try {
    localStorage.setItem('baso_cached_friends', JSON.stringify(friends));
  } catch (e) {
    console.warn('[OfflineStorage] Friends cache failed:', e);
  }
};
