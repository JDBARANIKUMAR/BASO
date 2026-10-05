import { getDB } from '../config/db.js';

const COLLECTION = 'friendships';

const docToFriendship = (doc) => {
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    _id: doc.id,
    user: data.user || null,
    friend: data.friend || null,
    lastMessage: data.lastMessage || null,
    lastInteractionAt: data.lastInteractionAt?.toDate?.() || data.lastInteractionAt || null,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
  };
};

export const Friendship = {
  /**
   * Find a single friendship by user + friend pair
   */
  async findOne(filter) {
    let query = getDB().collection(COLLECTION);
    if (filter.user) query = query.where('user', '==', filter.user.toString());
    if (filter.friend) query = query.where('friend', '==', filter.friend.toString());

    const snapshot = await query.limit(1).get();
    if (snapshot.empty) return null;

    return docToFriendship(snapshot.docs[0]);
  },

  /**
   * Upsert a friendship document (find by user+friend, create if missing).
   * Returns the updated/created friendship.
   */
  async findOneAndUpdate(filter, updates, options = {}) {
    const db = getDB();
    const userId = filter.user?.toString();
    const friendId = filter.friend?.toString();

    // Use a deterministic document ID for upsert: user_friend
    const docId = `${userId}_${friendId}`;
    const ref = db.collection(COLLECTION).doc(docId);
    const doc = await ref.get();

    const now = new Date();
    if (doc.exists) {
      await ref.set(
        {
          ...updates,
          lastMessage: updates.lastMessage?.toString() || doc.data().lastMessage,
          updatedAt: now,
        },
        { merge: true }
      );
    } else if (options.upsert !== false) {
      await ref.set({
        user: userId,
        friend: friendId,
        lastMessage: updates.lastMessage?.toString() || null,
        lastInteractionAt: updates.lastInteractionAt || now,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      return null;
    }

    const updated = await ref.get();
    const friendship = docToFriendship(updated);

    // If populate friend was requested, do it here
    if (options.populate === 'friend') {
      const { User } = await import('./User.js');
      friendship.friend = await User.findById(friendId);
    }

    return friendship;
  },

  /**
   * Find all friendships for a user, with populated friend details.
   * Sorts by lastInteractionAt descending.
   */
  async findAllForUser(userId) {
    const db = getDB();
    const snapshot = await db
      .collection(COLLECTION)
      .where('user', '==', userId.toString())
      .orderBy('lastInteractionAt', 'desc')
      .get();

    const { User } = await import('./User.js');
    const { Message: MessageModel } = await import('./Message.js');

    const friendships = [];
    for (const doc of snapshot.docs) {
      const f = docToFriendship(doc);

      // Populate friend user data
      f.friend = await User.findById(f.friend);

      // Populate last message
      if (f.lastMessage) {
        f.lastMessage = await MessageModel.findById(f.lastMessage);
      }

      friendships.push(f);
    }

    return friendships;
  },
};
