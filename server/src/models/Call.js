import { getDB } from '../config/db.js';

const COLLECTION = 'calls';

const docToCall = (doc) => {
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    _id: doc.id,
    caller: data.caller || null,
    recipient: data.recipient || null,
    type: data.type || 'voice',
    status: data.status || 'ongoing',
    duration: data.duration || 0,
    startedAt: data.startedAt?.toDate?.() || data.startedAt || null,
    endedAt: data.endedAt?.toDate?.() || data.endedAt || null,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
  };
};

export const Call = {
  /**
   * Create a new call log
   */
  async create(data) {
    const now = new Date();
    const docData = {
      caller: data.caller?.toString() || null,
      recipient: data.recipient?.toString() || null,
      type: data.type || 'voice',
      status: data.status || 'ongoing',
      duration: data.duration || 0,
      startedAt: data.startedAt || null,
      endedAt: data.endedAt || null,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await getDB().collection(COLLECTION).add(docData);
    return { _id: ref.id, ...docData };
  },

  /**
   * Get recent calls for a user (as caller or recipient).
   * Firestore doesn't support $or, so we merge two queries.
   */
  async findRecentForUser(userId, limit = 30) {
    const db = getDB();
    const uid = userId.toString();

    const [callerSnap, recipientSnap] = await Promise.all([
      db.collection(COLLECTION)
        .where('caller', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get(),
      db.collection(COLLECTION)
        .where('recipient', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get(),
    ]);

    const { User } = await import('./User.js');
    const calls = [];

    const processDoc = (doc) => calls.push(docToCall(doc));
    callerSnap.forEach(processDoc);
    recipientSnap.forEach(processDoc);

    // Sort descending by createdAt and limit
    calls.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    const limited = calls.slice(0, limit);

    // Populate caller and recipient user details
    for (const call of limited) {
      call.caller = await User.findById(call.caller);
      call.recipient = await User.findById(call.recipient);
    }

    return limited;
  },
};
