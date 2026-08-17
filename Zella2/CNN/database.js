import { supabase } from './supabase.js'

// Now you can use it
const { data } = await supabase.from('todos').select('*')
const DB_NAME = 'zella_capital_db';
const DB_VERSION = 3;
const USERS_STORE = 'users';
const SESSION_STORE = 'session';
const TRANSACTIONS_STORE = 'transactions';
const LEGACY_USERS_KEY = 'zella_users';
const LEGACY_CURRENT_USER_KEY = 'zella_current_user';

let databasePromise = null;

function openDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(USERS_STORE)) {
        db.createObjectStore(USERS_STORE, { keyPath: 'email' });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(TRANSACTIONS_STORE)) {
        db.createObjectStore(TRANSACTIONS_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = () => reject(request.error);
  });

  return databasePromise;
}

function readLegacyUsers() {
  try {
    const storedUsers = localStorage.getItem(LEGACY_USERS_KEY);
    return storedUsers ? JSON.parse(storedUsers) : [];
  } catch (error) {
    console.error('Unable to read legacy users from storage.', error);
    return [];
  }
}

function readLegacyCurrentUser() {
  try {
    const storedUser = localStorage.getItem(LEGACY_CURRENT_USER_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error('Unable to read legacy current user from storage.', error);
    return null;
  }
}

async function ensureDatabaseReady() {
  try {
    const db = await openDatabase();
    await migrateLegacyStorage();
    return db;
  } catch (error) {
    console.warn('Falling back to localStorage because IndexedDB is unavailable.', error);
    return null;
  }
}

let migrationInProgress = false;

async function migrateLegacyStorage() {
  if (typeof localStorage === 'undefined' || migrationInProgress) {
    return;
  }
  migrationInProgress = true;

  try {
    // Read the legacy values and remove them BEFORE awaiting any migration write.
    // setCurrentUser/saveUsers call ensureDatabaseReady(), which calls back into
    // migrateLegacyStorage(); removing the keys synchronously (plus the guard flag
    // above) breaks that cycle. Without this, a session mirror written to
    // localStorage re-triggers migration forever and overflows the call stack
    // right after signup/login.
    const legacyUsers = readLegacyUsers();
    const legacyCurrentUser = readLegacyCurrentUser();
    localStorage.removeItem(LEGACY_USERS_KEY);
    localStorage.removeItem(LEGACY_CURRENT_USER_KEY);

    if (legacyUsers.length) {
      await saveUsers(legacyUsers);
    }

    if (legacyCurrentUser) {
      await setCurrentUser(legacyCurrentUser);
    }
  } finally {
    migrationInProgress = false;
  }
}

async function getUsers() {
  try {
    const db = await ensureDatabaseReady();
    if (!db) {
      return readLegacyUsers();
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(USERS_STORE, 'readonly');
      const store = transaction.objectStore(USERS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Unable to load users from the database.', error);
    return readLegacyUsers();
  }
}

async function saveUsers(users) {
  const db = await ensureDatabaseReady();

  if (!db) {
    localStorage.setItem(LEGACY_USERS_KEY, JSON.stringify(users));
    return users;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(USERS_STORE, 'readwrite');
    const store = transaction.objectStore(USERS_STORE);

    store.clear();
    users.forEach((user) => {
      store.put(user);
    });

    transaction.oncomplete = () => resolve(users);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getUserByEmail(email) {
  if (!email) {
    return null;
  }
  const users = await getUsers();
  return users.find((entry) => entry.email.toLowerCase() === email.trim().toLowerCase()) || null;
}

async function updateUserPassword(email, password) {
  const users = await getUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const updatedUsers = users.map((entry) =>
    entry.email.toLowerCase() === normalizedEmail ? { ...entry, password } : entry
  );

  const changed = updatedUsers.some((entry) => entry.email.toLowerCase() === normalizedEmail);
  if (!changed) {
    return { ok: false, message: 'User not found' };
  }

  await saveUsers(updatedUsers);
  return { ok: true, user: updatedUsers.find((entry) => entry.email.toLowerCase() === normalizedEmail) };
}

async function getCurrentUser() {
  try {
    const db = await ensureDatabaseReady();
    if (!db) {
      return readLegacyCurrentUser();
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, 'readonly');
      const store = transaction.objectStore(SESSION_STORE);
      const request = store.get('current');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Unable to load current user from the database.', error);
    return readLegacyCurrentUser();
  }
}

async function setCurrentUser(user) {
  const db = await ensureDatabaseReady();

  if (!db) {
    // IndexedDB is unavailable, so mirror the session in localStorage instead.
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LEGACY_CURRENT_USER_KEY, JSON.stringify(user));
    }
    return user;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE, 'readwrite');
    const store = transaction.objectStore(SESSION_STORE);
    const request = store.put({ id: 'current', ...user });

    request.onsuccess = () => resolve(user);
    request.onerror = () => reject(request.error);
  });
}

async function clearCurrentUser() {
  const db = await ensureDatabaseReady();

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_CURRENT_USER_KEY);
  }

  if (!db) {
    return true;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE, 'readwrite');
    const store = transaction.objectStore(SESSION_STORE);
    const request = store.delete('current');

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

async function authenticateUser(email, password) {
  const users = await getUsers();
  return users.find((entry) => entry.email.toLowerCase() === email.toLowerCase() && entry.password === password) || null;
}

async function createUser({ fullName, email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return { ok: false, message: 'Email and password are required.' };
  }

  const users = await getUsers();
  const existingUser = users.find((entry) => entry.email.toLowerCase() === normalizedEmail);
  if (existingUser) {
    return { ok: false, message: 'An account with that email already exists.' };
  }

  const user = {
    email: normalizedEmail,
    fullName: String(fullName || '').trim(),
    password,
    createdAt: new Date().toISOString(),
  };

  const updatedUsers = [...users, user];
  await saveUsers(updatedUsers);
  return { ok: true, user };
}

async function saveTransaction(transaction) {
  const db = await ensureDatabaseReady();

  if (!db) {
    const storedTransactions = JSON.parse(localStorage.getItem('zella_transactions') || '[]');
    const nextTransaction = { ...transaction, id: Date.now() };
    storedTransactions.push(nextTransaction);
    localStorage.setItem('zella_transactions', JSON.stringify(storedTransactions));
    return nextTransaction;
  }

  return new Promise((resolve, reject) => {
    const transactionRequest = db.transaction(TRANSACTIONS_STORE, 'readwrite');
    const store = transactionRequest.objectStore(TRANSACTIONS_STORE);
    const request = store.add(transaction);

    request.onsuccess = () => resolve({ ...transaction, id: request.result });
    request.onerror = () => reject(request.error);
  });
}

async function getTransactions() {
  const db = await ensureDatabaseReady();

  if (!db) {
    return JSON.parse(localStorage.getItem('zella_transactions') || '[]');
  }

  return new Promise((resolve, reject) => {
    const transactionRequest = db.transaction(TRANSACTIONS_STORE, 'readonly');
    const store = transactionRequest.objectStore(TRANSACTIONS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function updateTransactionStatus(id, status, note = '') {
  const db = await ensureDatabaseReady();

  if (!db) {
    const storedTransactions = JSON.parse(localStorage.getItem('zella_transactions') || '[]');
    const updatedTransactions = storedTransactions.map((entry) => entry.id === id ? { ...entry, status, note, updatedAt: new Date().toISOString() } : entry);
    localStorage.setItem('zella_transactions', JSON.stringify(updatedTransactions));
    return updatedTransactions.find((entry) => entry.id === id) || null;
  }

  return new Promise((resolve, reject) => {
    const transactionRequest = db.transaction(TRANSACTIONS_STORE, 'readwrite');
    const store = transactionRequest.objectStore(TRANSACTIONS_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      const existing = request.result;
      if (!existing) {
        resolve(null);
        return;
      }

      const updated = { ...existing, status, note, updatedAt: new Date().toISOString() };
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(updated);
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

window.zellaDatabase = {
  ensureDatabaseReady,
  getUsers,
  saveUsers,
  getUserByEmail,
  updateUserPassword,
  getCurrentUser,
  setCurrentUser,
  clearCurrentUser,
  authenticateUser,
  createUser,
  saveTransaction,
  getTransactions,
  updateTransactionStatus
};
