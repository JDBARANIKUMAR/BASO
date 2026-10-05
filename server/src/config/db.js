import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let db;

export const connectDB = async () => {
  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Use individual env vars (useful for deployment platforms like Render/Railway)
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Replace escaped newlines in private key
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // Falls back to GOOGLE_APPLICATION_CREDENTIALS env var
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }

    db = admin.firestore();
    console.log(`[Database] Firebase Firestore Connected (Project: ${admin.app().options.credential.projectId || 'default'})`);
  } catch (error) {
    console.error(`[Database Error] ${error.message}`);
    process.exit(1);
  }
};

export const getDB = () => {
  if (!db) {
    throw new Error('Firestore not initialized. Call connectDB() first.');
  }
  return db;
};

export { admin };
