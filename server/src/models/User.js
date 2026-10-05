import { getDB } from '../config/db.js';

const COLLECTION = 'users';

/**
 * Helper: Convert Firestore Timestamps to JS Dates in a doc snapshot
 */
const docToUser = (doc) => {
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    _id: doc.id,
    mobile: data.mobile || '',
    name: data.name || '',
    avatar: data.avatar || '',
    isRegistered: data.isRegistered || false,
    isOnline: data.isOnline || false,
    lastSeen: data.lastSeen?.toDate?.() || data.lastSeen || null,
    refreshToken: data.refreshToken || null,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
  };
};

export const User = {
  /**
   * Find a user by their Firestore document ID
   */
  async findById(id) {
    if (!id) return null;
    const doc = await getDB().collection(COLLECTION).doc(id.toString()).get();
    const user = docToUser(doc);
    if (user) user.toPublicJSON = () => toPublicJSON(user);
    return user;
  },

  /**
   * Find one user matching a filter object.
   * Supports: { mobile, isRegistered } etc.
   */
  async findOne(filter, selectFields = null) {
    let query = getDB().collection(COLLECTION);

    for (const [key, value] of Object.entries(filter)) {
      query = query.where(key, '==', value);
    }

    const snapshot = await query.limit(1).get();
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const user = docToUser(doc);
    if (user) user.toPublicJSON = () => toPublicJSON(user);

    // If selectFields is specified, filter the returned object
    if (selectFields && typeof selectFields === 'string') {
      const fields = selectFields.split(' ').map((f) => f.trim());
      const filtered = { _id: user._id };
      fields.forEach((f) => {
        if (f in user) filtered[f] = user[f];
      });
      return filtered;
    }

    return user;
  },

  /**
   * Create a new user document. Auto-generates an ID.
   */
  async create(data) {
    const now = new Date();
    const docData = {
      mobile: data.mobile || '',
      name: data.name || '',
      avatar: data.avatar || '',
      isRegistered: data.isRegistered ?? false,
      isOnline: data.isOnline ?? false,
      lastSeen: data.lastSeen || now,
      refreshToken: data.refreshToken || null,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await getDB().collection(COLLECTION).add(docData);
    const user = { _id: ref.id, ...docData };
    user.toPublicJSON = () => toPublicJSON(user);
    return user;
  },

  /**
   * Save/update a user object (must have _id).
   */
  async save(user) {
    if (!user._id) throw new Error('Cannot save user without _id');
    const now = new Date();
    const updateData = {
      mobile: user.mobile,
      name: user.name,
      avatar: user.avatar,
      isRegistered: user.isRegistered,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      refreshToken: user.refreshToken,
      updatedAt: now,
    };
    await getDB().collection(COLLECTION).doc(user._id.toString()).set(updateData, { merge: true });
    user.updatedAt = now;
    return user;
  },

  /**
   * Find by ID and update specific fields. Returns the updated user.
   */
  async findByIdAndUpdate(id, updates) {
    if (!id) return null;
    const ref = getDB().collection(COLLECTION).doc(id.toString());
    await ref.set({ ...updates, updatedAt: new Date() }, { merge: true });
    const doc = await ref.get();
    const user = docToUser(doc);
    if (user) user.toPublicJSON = () => toPublicJSON(user);
    return user;
  },
};

function toPublicJSON(user) {
  return {
    _id: user._id,
    mobile: user.mobile,
    name: user.name,
    avatar: user.avatar,
    isRegistered: user.isRegistered,
    isOnline: user.isOnline,
    lastSeen: user.lastSeen,
    createdAt: user.createdAt,
  };
}
