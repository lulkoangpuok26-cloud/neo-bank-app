import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(__dirname, 'data', 'store.json');
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const idempotencyKeys = new Map();

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));

async function ensureStore() {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  try {
    const content = await fs.readFile(storePath, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed.users) parsed.users = [];
    if (!parsed.transactions) parsed.transactions = [];
    if (!parsed.atmCodes) parsed.atmCodes = [];
    if (!parsed.disputes) parsed.disputes = [];
    await fs.writeFile(storePath, JSON.stringify(parsed, null, 2), 'utf8');
    return parsed;
  } catch (error) {
    const initial = { users: [], transactions: [], atmCodes: [], disputes: [] };
    await fs.writeFile(storePath, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

let store = await ensureStore();

async function saveStore() {
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
}

async function seedDemoUser() {
  const exists = store.users.some((user) => user.email === 'demo@aliasset.app');
  if (exists) return;

  const passwordHash = await bcrypt.hash('AliBank#2025', 10);
  const pinHash = await bcrypt.hash('123456', 10);

  const user = {
    id: 'user_demo_alicia',
    name: 'Alicia Morgan',
    email: 'demo@aliasset.app',
    phone: '+12025550181',
    passwordHash,
    pinHash,
    failedPinAttempts: 0,
    pinLockedUntil: null,
    biometricEnabled: true,
    accounts: [{
      id: 'acct_demo_01',
      currency: 'USD',
      balance: 8452.61
    }],
    recipients: [
      { id: 'rec_01', name: 'Marcus Reed', phone: '+12025550199', accountNo: '47794' },
      { id: 'rec_02', name: 'Nia Thompson', phone: '+12025550210', accountNo: '62211' }
    ]
  };

  const baseTransactions = [
    { id: 'txn_01', userId: user.id, accountId: 'acct_demo_01', type: 'credit', description: 'Salary deposit', amount: 2400.00, currency: 'USD', referenceCode: 'CRD-1001', status: 'completed', createdAt: new Date().toISOString() },
    { id: 'txn_02', userId: user.id, accountId: 'acct_demo_01', type: 'debit', description: 'Fresh Market', amount: 122.40, currency: 'USD', referenceCode: 'DBT-1002', status: 'completed', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'txn_03', userId: user.id, accountId: 'acct_demo_01', type: 'credit', description: 'Refund - Studio booking', amount: 240.00, currency: 'USD', referenceCode: 'CRD-1003', status: 'completed', createdAt: new Date(Date.now() - 172800000).toISOString() },
    { id: 'txn_04', userId: user.id, accountId: 'acct_demo_01', type: 'debit', description: 'Skyline Residency', amount: 640.00, currency: 'USD', referenceCode: 'DBT-1004', status: 'completed', createdAt: new Date(Date.now() - 345600000).toISOString() },
    { id: 'txn_05', userId: user.id, accountId: 'acct_demo_01', type: 'debit', description: 'Transfer to Marcus Reed', amount: 150.00, currency: 'USD', referenceCode: 'TXN-1005', status: 'completed', createdAt: new Date(Date.now() - 432000000).toISOString() }
  ];

  store.users.push(user);
  store.transactions.push(...baseTransactions);
  await saveStore();
}

await seedDemoUser();

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function sanitizeUser(user) {
  const account = user.accounts?.[0] || { id: 'acct_default', currency: 'USD', balance: 0 };
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    currency: account.currency,
    balance: Number(account.balance),
    biometricEnabled: user.biometricEnabled,
    failedPinAttempts: user.failedPinAttempts,
    pinLockedUntil: user.pinLockedUntil
  };
}

function getUserById(userId) {
  return store.users.find((user) => user.id === userId);
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid bearer token.' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.id);
    if (!user) {
      return res.status(401).json({ message: 'User session not found.' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token expired or invalid.' });
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Ali Asset Bank API', time: new Date().toISOString() });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, pin } = req.body || {};
    if (!name || !email || !password || !phone || !pin) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (!/^[0-9]{6}$/.test(String(pin))) {
      return res.status(400).json({ message: 'PIN must be a 6-digit number.' });
    }

    const existing = store.users.find((user) => user.email.toLowerCase() === String(email).toLowerCase() || user.phone === String(phone));
    if (existing) {
      return res.status(409).json({ message: 'A user with that email or phone number already exists.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const pinHash = await bcrypt.hash(String(pin), 10);
    const newUser = {
      id: `user_${uuidv4()}`,
      name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      passwordHash,
      pinHash,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      biometricEnabled: false,
      accounts: [{ id: `acct_${uuidv4()}`, currency: 'USD', balance: 2500.00 }],
      recipients: []
    };

    store.users.push(newUser);
    await saveStore();

    const token = signToken(newUser);
    return res.status(201).json({ token, user: sanitizeUser(newUser) });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, pin } = req.body || {};
    if (!email || !password || !pin) {
      return res.status(400).json({ message: 'Email, password, and PIN are required.' });
    }

    const user = store.users.find((item) => item.email.toLowerCase() === String(email).toLowerCase());
    if (!user) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const lockExpiry = user.pinLockedUntil ? new Date(user.pinLockedUntil) : null;
    if (lockExpiry && lockExpiry > new Date()) {
      return res.status(423).json({ message: 'Your PIN is temporarily locked. Try again later.' });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const pinMatches = await bcrypt.compare(String(pin), user.pinHash);
    if (!pinMatches) {
      const nextAttempts = (user.failedPinAttempts || 0) + 1;
      user.failedPinAttempts = nextAttempts;
      user.pinLockedUntil = nextAttempts >= 3 ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
      await saveStore();

      if (nextAttempts >= 3) {
        return res.status(423).json({ message: 'Too many incorrect PIN attempts. Try again in 5 minutes.' });
      }

      return res.status(401).json({ message: `Incorrect PIN. ${3 - nextAttempts} attempt(s) remaining.` });
    }

    user.failedPinAttempts = 0;
    user.pinLockedUntil = null;
    await saveStore();

    return res.json({ token: signToken(user), user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed.', error: error.message });
  }
});

app.post('/api/auth/biometric', authMiddleware, async (req, res) => {
  const { enabled } = req.body || {};
  const user = getUserById(req.user.id);
  user.biometricEnabled = Boolean(enabled);
  await saveStore();
  return res.json({ enabled: user.biometricEnabled });
});

app.get('/api/dashboard', authMiddleware, (req, res) => {
  const user = getUserById(req.user.id);
  const account = user.accounts[0];
  const transactions = store.transactions
    .filter((tx) => tx.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map((tx) => ({
      id: tx.id,
      type: tx.type,
      description: tx.description,
      amount: Number(tx.amount),
      currency: tx.currency,
      referenceCode: tx.referenceCode,
      status: tx.status,
      createdAt: tx.createdAt
    }));

  return res.json({
    user: sanitizeUser(user),
    account: { ...account, balance: Number(account.balance) },
    transactions,
    quickActions: ['Transfer', 'QR Pay', 'ATM', 'Statements']
  });
});

app.get('/api/recipients/search', authMiddleware, (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  if (!query) return res.json([]);

  const user = getUserById(req.user.id);
  const matches = user.recipients.filter((recipient) => {
    return recipient.name.toLowerCase().includes(query) || recipient.phone.includes(query) || recipient.accountNo.includes(query);
  });

  return res.json(matches.slice(0, 5));
});

app.post('/api/transfers/confirm', authMiddleware, async (req, res) => {
  try {
    const { recipientPhone, amount, pin, idempotencyKey } = req.body || {};
    if (!recipientPhone || !amount || !pin || !idempotencyKey) {
      return res.status(400).json({ message: 'Recipient phone, amount, PIN, and idempotency key are required.' });
    }

    if (idempotencyKeys.has(idempotencyKey)) {
      return res.status(200).json({ success: true, transfer: idempotencyKeys.get(idempotencyKey), message: 'Transfer already processed.' });
    }

    const user = getUserById(req.user.id);
    const account = user.accounts[0];
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'Please enter a valid transfer amount.' });
    }
    if (numericAmount > Number(account.balance)) {
      return res.status(400).json({ message: 'Transfer exceeds your available balance.' });
    }

    const pinMatches = await bcrypt.compare(String(pin), user.pinHash);
    if (!pinMatches) {
      return res.status(401).json({ message: 'Incorrect transaction PIN.' });
    }

    const recipient = store.users.find((candidate) => candidate.phone === recipientPhone);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found in Ali Asset Bank.' });
    }

    const transferReference = `TXN-${uuidv4().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    account.balance = Number(account.balance) - numericAmount;

    const recipientAccount = recipient.accounts[0];
    if (!recipientAccount) {
      return res.status(404).json({ message: 'Recipient account is not active.' });
    }
    recipientAccount.balance = Number(recipientAccount.balance) + numericAmount;

    const debitTxn = {
      id: `txn_${uuidv4()}`,
      userId: user.id,
      accountId: account.id,
      type: 'debit',
      description: `Transfer to ${recipient.name}`,
      amount: numericAmount,
      currency: 'USD',
      referenceCode: transferReference,
      status: 'completed',
      createdAt: now
    };

    const creditTxn = {
      id: `txn_${uuidv4()}`,
      userId: recipient.id,
      accountId: recipientAccount.id,
      type: 'credit',
      description: `Incoming transfer from ${user.name}`,
      amount: numericAmount,
      currency: 'USD',
      referenceCode: `RCT-${uuidv4().slice(0, 8).toUpperCase()}`,
      status: 'completed',
      createdAt: now
    };

    store.transactions.push(debitTxn, creditTxn);
    const transferPayload = { reference: transferReference, amount: numericAmount, currency: 'USD', recipientName: recipient.name };
    idempotencyKeys.set(idempotencyKey, transferPayload);
    await saveStore();

    return res.json({ success: true, transfer: transferPayload, message: 'Transfer completed successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Transfer failed.', error: error.message });
  }
});

app.post('/api/qr-pay/settle', authMiddleware, async (req, res) => {
  try {
    const { merchantId, amount, currency = 'USD', payload, expiresAt } = req.body || {};
    if (!merchantId || !amount || !payload || !expiresAt) {
      return res.status(400).json({ message: 'QR payment details are incomplete.' });
    }

    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry < new Date()) {
      return res.status(400).json({ message: 'This QR payment is expired.' });
    }

    const user = getUserById(req.user.id);
    const account = user.accounts[0];
    const numericAmount = Number(amount);
    if (numericAmount <= 0 || numericAmount > Number(account.balance)) {
      return res.status(400).json({ message: 'Insufficient funds to complete this payment.' });
    }

    account.balance = Number(account.balance) - numericAmount;
    const reference = `QR-${uuidv4().slice(0, 8).toUpperCase()}`;
    const tx = {
      id: `txn_${uuidv4()}`,
      userId: user.id,
      accountId: account.id,
      type: 'qr_payment',
      description: `QR payment to ${merchantId}`,
      amount: numericAmount,
      currency,
      referenceCode: reference,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    store.transactions.push(tx);
    await saveStore();

    return res.json({ success: true, referenceCode: reference, message: 'Payment settled instantly. Push notification sent.' });
  } catch (error) {
    return res.status(500).json({ message: 'QR payment failed.', error: error.message });
  }
});

app.post('/api/atms/generate', authMiddleware, async (req, res) => {
  try {
    const { amount, currency = 'USD' } = req.body || {};
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: 'A valid amount is required.' });
    }

    const user = getUserById(req.user.id);
    const account = user.accounts[0];
    if (numericAmount > Number(account.balance)) {
      return res.status(400).json({ message: 'Amount exceeds available balance.' });
    }

    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const reference = `ATM-${uuidv4().slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const atmCode = {
      id: `atm_${uuidv4()}`,
      userId: user.id,
      amount: numericAmount,
      currency,
      pin,
      reference,
      expiresAt,
      createdAt: new Date().toISOString(),
      redeemed: false
    };

    store.atmCodes.push(atmCode);
    await saveStore();

    return res.json({ reference, pin, amount: numericAmount, currency, expiresAt, message: 'Cardless ATM code created. Expires in 5 minutes.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate cardless ATM code.', error: error.message });
  }
});

app.get('/api/statements', authMiddleware, (req, res) => {
  const { from, to } = req.query;
  const user = getUserById(req.user.id);

  let data = store.transactions.filter((tx) => tx.userId === user.id);
  if (from) data = data.filter((tx) => new Date(tx.createdAt) >= new Date(from));
  if (to) data = data.filter((tx) => new Date(tx.createdAt) <= new Date(to));

  data = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.json({ count: data.length, transactions: data.map((tx) => ({
    id: tx.id,
    type: tx.type,
    description: tx.description,
    amount: Number(tx.amount),
    currency: tx.currency,
    referenceCode: tx.referenceCode,
    createdAt: tx.createdAt,
    status: tx.status
  })) });
});

app.post('/api/disputes', authMiddleware, async (req, res) => {
  try {
    const { transactionRef, reason, note } = req.body || {};
    if (!transactionRef || !reason) {
      return res.status(400).json({ message: 'Transaction reference and reason are required.' });
    }

    const user = getUserById(req.user.id);
    const tx = store.transactions.find((item) => item.userId === user.id && item.referenceCode === transactionRef);
    if (!tx) {
      return res.status(404).json({ message: 'This transaction cannot be found in your account.' });
    }

    const dispute = {
      id: `dispute_${uuidv4()}`,
      userId: user.id,
      transactionRef,
      reason,
      note: note || '',
      status: 'open',
      createdAt: new Date().toISOString()
    };

    store.disputes.push(dispute);
    await saveStore();

    return res.status(201).json({ success: true, dispute, message: 'Dispute ticket created successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create dispute ticket.', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ali Asset Bank API listening on http://localhost:${PORT}`);
});
