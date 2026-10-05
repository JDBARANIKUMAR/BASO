import { getDB } from '../config/db.js';

const COLLECTION = 'messages';

const docToMessage = (doc) => {
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    _id: doc.id,
    sender: data.sender || null,
    recipient: data.recipient || null,
    content: data.content || '',
    tempId: data.tempId || null,
    status: data.status || 'sent',
    deliveredAt: data.deliveredAt?.toDate?.() || data.deliveredAt || null,
    readAt: data.readAt?.toDate?.() || data.readAt || null,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
  };
};

export const Message = {
  /**
   * Create a new message document
   */
  async create(data) {
    const now = new Date();
    const docData = {
      sender: data.sender?.toString() || null,
      recipient: data.recipient?.toString() || null,
      content: data.content || '',
      tempId: data.tempId || null,
      status: data.status || 'sent',
      deliveredAt: data.deliveredAt || null,
      readAt: data.readAt || null,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await getDB().collection(COLLECTION).add(docData);
    return { _id: ref.id, ...docData };
  },

  /**
   * Find messages matching a filter with sorting and limiting.
   * Supports the $or pattern used for chat: messages between two users.
   */
  async findConversation({ userId, friendId, before = null, limit = 40 }) {
    const db = getDB();
    const messagesRef = db.collection(COLLECTION);

    // Firestore doesn't support $or, so we run two queries and merge
    let query1 = messagesRef
      .where('sender', '==', userId.toString())
      .where('recipient', '==', friendId.toString());

    let query2 = messagesRef
      .where('sender', '==', friendId.toString())
      .where('recipient', '==', userId.toString());

    if (before) {
      const beforeDate = new Date(before);
      query1 = query1.where('createdAt', '<', beforeDate);
      query2 = query2.where('createdAt', '<', beforeDate);
    }

    query1 = query1.orderBy('createdAt', 'desc').limit(limit);
    query2 = query2.orderBy('createdAt', 'desc').limit(limit);

    const [snap1, snap2] = await Promise.all([query1.get(), query2.get()]);

    const messages = [];
    snap1.forEach((doc) => messages.push(docToMessage(doc)));
    snap2.forEach((doc) => messages.push(docToMessage(doc)));

    // Sort descending by createdAt, then limit
    messages.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    return messages.slice(0, limit);
  },

  /**
   * Update the status of multiple messages matching a filter.
   * Used for marking messages as 'read' or 'delivered'.
   */
  async updateManyStatus({ sender, recipient, excludeStatus, newStatus, updateFields }) {
    const db = getDB();
    const snapshot = await db
      .collection(COLLECTION)
      .where('sender', '==', sender.toString())
      .where('recipient', '==', recipient.toString())
      .get();

    const batch = db.batch();
    let count = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status !== excludeStatus) {
        batch.update(doc.ref, {
          status: newStatus,
          ...updateFields,
          updatedAt: new Date(),
        });
        count++;
      }
    });

    if (count > 0) await batch.commit();
    return count;
  },

  /**
   * Find a message by ID
   */
  async findById(id) {
    if (!id) return null;
    const doc = await getDB().collection(COLLECTION).doc(id.toString()).get();
    return docToMessage(doc);
  },
};
