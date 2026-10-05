import { getDB } from '../config/db.js';

const COLLECTION = 'otps';

const docToOtp = (doc) => {
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    _id: doc.id,
    mobile: data.mobile || '',
    code: data.code || '',
    expiresAt: data.expiresAt?.toDate?.() || data.expiresAt || null,
    resendAvailableAt: data.resendAvailableAt?.toDate?.() || data.resendAvailableAt || null,
    attempts: data.attempts || 0,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
  };
};

export const Otp = {
  /**
   * Find an OTP record by mobile number
   */
  async findOne(filter) {
    let query = getDB().collection(COLLECTION);
    for (const [key, value] of Object.entries(filter)) {
      query = query.where(key, '==', value);
    }

    const snapshot = await query.limit(1).get();
    if (snapshot.empty) return null;

    return docToOtp(snapshot.docs[0]);
  },

  /**
   * Upsert OTP: find by mobile, update or create
   */
  async findOneAndUpdate(filter, updates, options = {}) {
    const db = getDB();
    // Use mobile as deterministic doc ID for OTP
    const mobile = filter.mobile;
    const docId = mobile.replace(/\+/g, 'p'); // sanitize + for doc ID
    const ref = db.collection(COLLECTION).doc(docId);
    const now = new Date();

    await ref.set(
      {
        mobile,
        ...updates,
        updatedAt: now,
        createdAt: now, // will be overwritten on merge if already exists
      },
      { merge: true }
    );

    const doc = await ref.get();
    return docToOtp(doc);
  },

  /**
   * Delete an OTP record by its ID
   */
  async deleteOne(filter) {
    const db = getDB();
    if (filter._id) {
      await db.collection(COLLECTION).doc(filter._id).delete();
    }
  },

  /**
   * Save (update) an existing OTP record
   */
  async save(record) {
    if (!record._id) throw new Error('Cannot save OTP without _id');
    await getDB()
      .collection(COLLECTION)
      .doc(record._id)
      .set({ attempts: record.attempts, updatedAt: new Date() }, { merge: true });
    return record;
  },
};
