import { v4 as uuidv4 } from 'uuid';

export interface TestUserDef {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  firebaseToken: string;
}

export function generateTestUser(index?: number, prefix: string = 'test'): TestUserDef {
  const id = index !== undefined ? String(index).padStart(4, '0') : uuidv4().slice(0, 8);
  const uid = `mock_${prefix}_uid_${id}`;
  const email = `${prefix}_user_${id}@knotnex.test`;
  const fullName = `Test User ${id}`;
  const phone = `+9198765${String(Math.floor(10000 + Math.random() * 90000))}`;
  const firebaseToken = `mock_firebase_${uid}:${email}:${encodeURIComponent(fullName)}`;

  return {
    uid,
    email,
    fullName,
    phone,
    firebaseToken,
  };
}
