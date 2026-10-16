import { MongoClient } from 'mongodb';

let db;

export async function connect() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing. Copy server/.env.example to server/.env and fill it in.');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'workout_planner');
  await db.collection('schedule').createIndex({ date: 1 });
  await db.collection('schedule').createIndex({ week: 1 });
  return db;
}

export const col = (name) => db.collection(name);
