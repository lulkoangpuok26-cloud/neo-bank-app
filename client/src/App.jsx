import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  Lock,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Wallet,
  Sparkles,
  Zap,
  Search,
  Send,
  Download,
  CircleAlert,
  UserRound,
  Camera
} from 'lucide-react';

const API_URL = 'http://localhost:4000';

const navItems = [
  { id: 'home', label: 'Home' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'qr', label: 'QR Pay' },
  { id: 'atm', label: 'ATM' },
  { id: 'statements', label: 'Statements' }
];

function App() {
  const [authMode, setAuthMode] = useState('login');
  const [token, setToken] = useState(localStorage.getItem('aliAssetToken') || '');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('aliAssetUser') || 'null'));
  const [message, setMessage] = useState('');
  const [screen, setScreen] = useState('home');
  const [showBalance, setShowBalance] = useState(true);
  const [dashboard, setDashboard] = useState({
    account: { balance: 8452.61, currency: 'USD' },
    transactions: [],
    user: { name: 'Alicia Morgan' }
  });

  const [loginForm, setLoginForm] = useState({ email: 'demo@aliasset.app', password: 'AliBank#2025', pin: '123456' });
  const [registerForm, setRegisterForm] = useState({ name: 'Alicia Morgan', email: 'demo@aliasset.app', password: 'AliBank#2025', phone: '+12025550181', pin: '123456' });
  const [transferForm, setTransferForm] = useState({ recipient: '+12025550199', amount: '150', pin: '123456', idempotencyKey: crypto.randomUUID() });
  const [qrForm, setQrForm] = useState({ merchantId: 'VOLT-DELTA', amount: '42.60', payload: '{"merchantId":"VOLT-DELTA","amount":42.6,"currency":"USD","expiresAt":"2026-12-31T23:59:59.000Z"}' });
  const [atmForm, setAtmForm] = useState({ amount: '200' });
  const [statementForm, setStatementForm] = useState({ from: '', to: '' });
  const [disputeForm, setDisputeForm] = useState({ transactionRef: '', reason: 'unauthorized_charge', note: '' });
  const [statements, setStatements] = useState({ count: 0, transactions: [] });
  const [qrResult, setQrResult] = useState(null);
  const [atmResult, setAtmResult] = useState(null);

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: dashboard.account?.currency || 'USD' }).format(value || 0);

  const loadDashboard = async (authToken = token) => {
    if (!authToken) return;
    const response = await fetch(`${API_URL}/api/dashboard`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) {
      localStorage.removeItem('aliAssetToken');
      localStorage.removeItem('aliAssetUser');
      setToken('');
      setUser(null);
      return;
    }
    const data = await response.json();
    setDashboard(data);
    setUser(data.user);
    localStorage.setItem('aliAssetUser', JSON.stringify(data.user));
  };

  useEffect(() => {
    if (token) {
      loadDashboard(token);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      setDisputeForm((prev) => ({ ...prev, transactionRef: dashboard.transactions[0]?.referenceCode || '' }));
    }
  }, [dashboard.transactions, user]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const payload = authMode === 'login'
      ? { email: loginForm.email, password: loginForm.password, pin: loginForm.pin }
      : { name: registerForm.name, email: registerForm.email, password: registerForm.password, phone: registerForm.phone, pin: registerForm.pin };
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'Authentication failed');
      return;
    }

    setToken(data.token);
    localStorage.setItem('aliAssetToken', data.token);
    localStorage.setItem('aliAssetUser', JSON.stringify(data.user));
    setUser(data.user);
    setScreen('home');
    setMessage(authMode === 'login' ? 'Welcome back to Ali Asset Bank.' : 'Your account is ready.');
    await loadDashboard(data.token);
  }

  async function handleTransfer(event) {
    event.preventDefault();
    const response = await fetch(`${API_URL}/api/transfers/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        recipientPhone: transferForm.recipient,
        amount: transferForm.amount,
        pin: transferForm.pin,
        idempotencyKey: transferForm.idempotencyKey
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'Transfer failed');
      return;
    }
    setMessage(`Transfer complete: ${data.transfer.reference}`);
    setTransferForm({ ...transferForm, amount: '', pin: '', idempotencyKey: crypto.randomUUID() });
    await loadDashboard(token);
  }

  async function handleQrPayment(event) {
    event.preventDefault();
    const payload = JSON.parse(qrForm.payload);
    const response = await fetch(`${API_URL}/api/qr-pay/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        merchantId: payload.merchantId || qrForm.merchantId,
        amount: payload.amount || qrForm.amount,
        currency: payload.currency || 'USD',
        expiresAt: payload.expiresAt,
        payload: JSON.stringify(payload)
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'Payment failed');
      return;
    }
    setQrResult(data);
    setMessage('QR payment settled successfully.');
    await loadDashboard(token);
  }

  async function handleAtmGenerate(event) {
    event.preventDefault();
    const response = await fetch(`${API_URL}/api/atms/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: atmForm.amount, currency: 'USD' })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'ATM withdrawal failed');
      return;
    }
    setAtmResult(data);
    setMessage('Cardless ATM code generated.');
  }

  async function handleStatementFetch(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (statementForm.from) params.set('from', statementForm.from);
    if (statementForm.to) params.set('to', statementForm.to);
    const response = await fetch(`${API_URL}/api/statements?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    setStatements(data);
    setMessage(`Loaded ${data.count} transactions.`);
  }

  async function handleDisputeSubmit(event) {
    event.preventDefault();
    const response = await fetch(`${API_URL}/api/disputes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        transactionRef: disputeForm.transactionRef,
        reason: disputeForm.reason,
        note: disputeForm.note
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'Unable to file dispute');
      return;
    }
    setMessage('Dispute has been filed successfully.');
    setDisputeForm({ ...disputeForm, note: '' });
  }

  const renderAuth = () => (
    <div className="w-full max-w-md bank-card rounded-[30px] p-5 text-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-sky-300">Private banking</div>
          <h1 className="text-3xl font-bold mt-2">Ali Asset Bank</h1>
        </div>
        <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-300 border border-sky-400/20">
          <Landmark className="h-6 w-6" />
        </div>
      </div>

      <div className="flex gap-2 rounded-2xl bg-slate-900/80 p-1 mb-5">
        <button onClick={() => setAuthMode('login')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${authMode === 'login' ? 'bg-sky-500 text-white' : 'text-slate-300'}`}>
          Login
        </button>
        <button onClick={() => setAuthMode('register')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${authMode === 'register' ? 'bg-sky-500 text-white' : 'text-slate-300'}`}>
          Register
        </button>
      </div>

      <form onSubmit={handleAuthSubmit} className="space-y-4">
        {authMode === 'register' && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm text-slate-300">Full name</span>
              <input value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-sky-400" placeholder="Alicia Morgan" />
            </label>
            <label className="block">
              <span className="text-sm text-slate-300">Phone</span>
              <input value={registerForm.phone} onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-sky-400" placeholder="+12025550181" />
            </label>
          </div>
        )}

        <label className="block">
          <span className="text-sm text-slate-300">Email</span>
          <input value={authMode === 'login' ? loginForm.email : registerForm.email} onChange={(e) => authMode === 'login' ? setLoginForm({ ...loginForm, email: e.target.value }) : setRegisterForm({ ...registerForm, email: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-sky-400" placeholder="name@bank.com" />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Password</span>
          <input type="password" value={authMode === 'login' ? loginForm.password : registerForm.password} onChange={(e) => authMode === 'login' ? setLoginForm({ ...loginForm, password: e.target.value }) : setRegisterForm({ ...registerForm, password: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-sky-400" placeholder="••••••••••" />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">6-digit PIN</span>
          <input type="password" inputMode="numeric" value={authMode === 'login' ? loginForm.pin : registerForm.pin} onChange={(e) => authMode === 'login' ? setLoginForm({ ...loginForm, pin: e.target.value }) : setRegisterForm({ ...registerForm, pin: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-sky-400" placeholder="123456" maxLength={6} />
        </label>

        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3 text-sm text-sky-100">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Protected account access</div>
        </div>

        <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white shadow-soft">
          {authMode === 'login' ? 'Secure login' : 'Create account'}
        </button>
      </form>

      {message && <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-sm text-slate-200">{message}</div>}
    </div>
  );

  const renderHome = () => (
    <div className="space-y-4">
      <div className="rounded-[28px] bg-gradient-to-br from-sky-500 via-blue-600 to-sky-800 p-5 text-white shadow-soft">
        <div className="flex items-center justify-between text-sm text-sky-100">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Good morning</div>
          <button className="p-2 rounded-xl bg-white/10" onClick={() => setScreen('home')}><Bell className="h-4 w-4" /></button>
        </div>
        <div className="mt-5">
          <div className="text-sm text-sky-100">Welcome back</div>
          <h2 className="text-2xl font-bold mt-1">{dashboard.user?.name || user?.name || 'Alicia Morgan'}</h2>
        </div>

        <div className="mt-6 rounded-2xl bg-slate-950/20 border border-white/10 p-4">
          <div className="flex items-center justify-between text-sm text-sky-100">
            <span>Available balance</span>
            <button className="bg-white/10 p-2 rounded-lg" onClick={() => setShowBalance((prev) => !prev)}>
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className={`text-3xl font-bold ${showBalance ? '' : 'balance-hidden'}`}>
              {showBalance ? formatCurrency(dashboard.account?.balance || 0) : '••••••'}
            </div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium">USD</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Transfer', icon: ArrowLeftRight, action: () => setScreen('transfer') },
          { label: 'QR Pay', icon: QrCode, action: () => setScreen('qr') },
          { label: 'ATM', icon: CreditCard, action: () => setScreen('atm') },
          { label: 'Statements', icon: ReceiptText, action: () => setScreen('statements') }
        ].map(({ label, icon: Icon, action }) => (
          <button key={label} onClick={action} className="tile rounded-2xl p-4 text-left">
            <div className="mb-3 inline-flex rounded-xl bg-sky-500/10 p-2 text-sky-300">
              <Icon className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium text-slate-100">{label}</div>
          </button>
        ))}
      </div>

      <div className="tile rounded-[24px] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Recent transactions</div>
          <button className="text-xs text-sky-300" onClick={() => setScreen('statements')}>View all</button>
        </div>
        <div className="space-y-3">
          {(dashboard.transactions || []).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2 ${tx.type === 'credit' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                  {tx.type === 'credit' ? <Wallet className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-100">{tx.description}</div>
                  <div className="text-xs text-slate-400">{tx.referenceCode}</div>
                </div>
              </div>
              <div className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-emerald-300' : 'text-slate-100'}`}>
                {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTransfer = () => (
    <div className="tile rounded-[24px] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-sky-300">P2P transfer</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Send money</h3>
        </div>
        <div className="rounded-xl bg-sky-500/10 p-2 text-sky-300"><ArrowLeftRight className="h-5 w-5" /></div>
      </div>
      <form onSubmit={handleTransfer} className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-300">Recipient phone</span>
          <input value={transferForm.recipient} onChange={(e) => setTransferForm({ ...transferForm, recipient: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white" placeholder="+12025550199" />
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Amount</span>
          <input type="number" step="0.01" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white" placeholder="250.00" />
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Transaction PIN</span>
          <input type="password" inputMode="numeric" maxLength={6} value={transferForm.pin} onChange={(e) => setTransferForm({ ...transferForm, pin: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white" placeholder="123456" />
        </label>
        <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white">Confirm transfer</button>
      </form>
    </div>
  );

  const renderQr = () => (
    <div className="tile rounded-[24px] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-sky-300">QR payment</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Bankak | Pay</h3>
        </div>
        <div className="rounded-xl bg-sky-500/10 p-2 text-sky-300"><Camera className="h-5 w-5" /></div>
      </div>

      <div className="scanner-frame rounded-3xl p-3">
        <div className="aspect-square rounded-2xl border border-dashed border-sky-500/40 bg-slate-950/60 p-4 flex items-center justify-center">
          <div className="text-center text-slate-300">
            <QrCode className="mx-auto h-12 w-12 text-sky-300" />
            <div className="mt-3 text-sm">Scanner view</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleQrPayment} className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-300">QR payload</span>
          <textarea value={qrForm.payload} onChange={(e) => setQrForm({ ...qrForm, payload: e.target.value })} className="mt-2 min-h-28 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white" />
        </label>
        <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white">Pay now</button>
      </form>

      {qrResult && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200">
          Payment reference: {qrResult.referenceCode}
        </div>
      )}
    </div>
  );

  const renderAtm = () => (
    <div className="tile rounded-[24px] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-sky-300">Cash withdrawal</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Cardless ATM</h3>
        </div>
        <div className="rounded-xl bg-sky-500/10 p-2 text-sky-300"><Smartphone className="h-5 w-5" /></div>
      </div>

      <form onSubmit={handleAtmGenerate} className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-300">Amount</span>
          <input type="number" step="10" value={atmForm.amount} onChange={(e) => setAtmForm({ amount: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white" placeholder="200" />
        </label>
        <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white">Generate access code</button>
      </form>

      {atmResult && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-sky-100">
          <div className="text-xs uppercase tracking-[0.2em] text-sky-300">Access code</div>
          <div className="mt-3 text-3xl font-bold tracking-[0.32em]">{atmResult.pin}</div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
            <span>Reference</span>
            <span className="font-mono text-sky-200">{atmResult.reference}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
            <span>Expires</span>
            <span>{new Date(atmResult.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderStatements = () => (
    <div className="tile rounded-[24px] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-sky-300">Statements</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Filter transactions</h3>
        </div>
        <div className="rounded-xl bg-sky-500/10 p-2 text-sky-300"><Download className="h-5 w-5" /></div>
      </div>

      <form onSubmit={handleStatementFetch} className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-slate-300">From</span>
          <input type="date" value={statementForm.from} onChange={(e) => setStatementForm({ ...statementForm, from: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-white" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-300">To</span>
          <input type="date" value={statementForm.to} onChange={(e) => setStatementForm({ ...statementForm, to: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-white" />
        </label>
        <button type="submit" className="col-span-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white">Apply filters</button>
      </form>

      <div className="space-y-3">
        {(statements.transactions || []).slice(0, 6).map((tx) => (
          <div key={tx.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-100">{tx.description}</div>
              <div className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-emerald-300' : 'text-slate-100'}`}>{tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}</div>
            </div>
            <div className="mt-2 text-xs text-slate-400">{tx.referenceCode} • {new Date(tx.createdAt).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDispute = () => (
    <div className="tile rounded-[24px] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-sky-300">Dispute</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Report issue</h3>
        </div>
        <div className="rounded-xl bg-sky-500/10 p-2 text-sky-300"><CircleAlert className="h-5 w-5" /></div>
      </div>

      <form onSubmit={handleDisputeSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-300">Transaction reference</span>
          <input value={disputeForm.transactionRef} onChange={(e) => setDisputeForm({ ...disputeForm, transactionRef: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white" placeholder="CRD-1001" />
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Reason</span>
          <select value={disputeForm.reason} onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white">
            <option value="unauthorized_charge">Unauthorized charge</option>
            <option value="duplicate_transaction">Duplicate transaction</option>
            <option value="merchant_issue">Merchant issue</option>
            <option value="processing_error">Processing error</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Details</span>
          <textarea value={disputeForm.note} onChange={(e) => setDisputeForm({ ...disputeForm, note: e.target.value })} className="mt-2 min-h-28 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white" placeholder="Add context for the case" />
        </label>
        <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white">Submit dispute</button>
      </form>
    </div>
  );

  const activeView = {
    home: renderHome(),
    transfer: renderTransfer(),
    qr: renderQr(),
    atm: renderAtm(),
    statements: renderStatements(),
    dispute: renderDispute()
  }[screen] || renderHome();

  if (!token || !user) {
    return <div className="app-shell">{renderAuth()}</div>;
  }

  return (
    <div className="app-shell">
      <div className="w-full max-w-md">
        <div className="bank-card rounded-[32px] p-4 text-slate-100">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-500/10 p-2 text-sky-300"><Landmark className="h-5 w-5" /></div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-sky-300">Ali Asset</div>
                <div className="text-lg font-semibold text-white">Bank</div>
              </div>
            </div>
            <button className="rounded-xl border border-slate-700 bg-slate-900/70 p-2 text-slate-200" onClick={() => setScreen('dispute')}>
              <UserRound className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Secure account</span>
              <span className="inline-flex items-center gap-1 text-emerald-300"><ShieldCheck className="h-4 w-4" /> Verified</span>
            </div>
          </div>

          {activeView}

          <div className="mt-5 grid grid-cols-5 gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-2">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => setScreen(item.id)} className={`rounded-xl px-2 py-2 text-[11px] font-medium ${screen === item.id ? 'bg-sky-500 text-white' : 'text-slate-300'}`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
