import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { MdCheckCircle, MdError, MdSync, MdLogout } from 'react-icons/md';

const API = 'http://localhost:3001';
export default function WhatsAppConnection() {
  const [status, setStatus] = useState({ status: 'not_connected' });
  const [qrImage, setQrImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [delay, setDelay] = useState('20000');
  const [maximumDelay, setMaximumDelay] = useState('45000');
  const [delaySaved, setDelaySaved] = useState(false);
  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('sessionToken') || ''}` });
  const refresh = async () => {
    const response = await fetch(`${API}/status`, { headers: authHeaders() });
    if (response.status === 401 || response.status === 403) throw new Error('Developer access is required.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to retrieve the WhatsApp connection status.');
    setStatus(data);
    setConnectionError(data.error || '');
    if (data.qr) setQrImage(await QRCode.toDataURL(data.qr, { width: 260, margin: 1 })); else setQrImage(null);
  };
  useEffect(() => {
    refresh().catch(() => {});
    fetch(`${API}/api/settings`).then(r => r.json()).then(data => {
      setDelay(data.settings?.delayBetweenMessages || '20000');
      setMaximumDelay(data.settings?.maximumDelayBetweenMessages || '45000');
    }).catch(() => {});
    const timer = setInterval(() => refresh().catch(() => {}), 2000);
    return () => clearInterval(timer);
  }, []);
  const connect = async () => {
    setBusy(true);
    setConnectionError('');
    try {
      const response = await fetch(`${API}/qr`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start WhatsApp.');
      setStatus(data);
      setConnectionError(data.error || '');
      await refresh();
    } catch (error) {
      setConnectionError(error.message || 'Unable to start WhatsApp.');
    } finally { setBusy(false); }
  };
  const disconnect = async () => { setBusy(true); try { await fetch(`${API}/disconnect`, { method: 'POST', headers: authHeaders() }); await refresh(); } finally { setBusy(false); } };
  const saveDelay = async () => {
    setBusy(true);
    try {
      const minimum = Math.max(15000, Number(delay) || 15000);
      const maximum = Math.max(minimum, Number(maximumDelay) || minimum);
      const response = await fetch(`${API}/api/whatsapp/delay`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ minimum, maximum }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save the sending interval.');
      setDelay(String(data.minimum));
      setMaximumDelay(String(data.maximum));
      setDelaySaved(true);
      setTimeout(() => setDelaySaved(false), 2500);
    } finally { setBusy(false); }
  };
  const connected = status.status === 'connected';
  return <div>
    <div className="settings-header-row"><div><h2 className="settings-title">WhatsApp Connection</h2><p className="settings-subtitle">Connect your WhatsApp account by scanning the QR code.</p></div></div>
    <div className="card settings-card">
      <div className={`status-badge ${connected ? 'connected' : ''}`}><div className="dot" />{connected ? 'CONNECTED' : 'NOT CONNECTED'}</div>
      <div className="form-group mt-3"><label>Status</label><p style={{ color: connected ? '#10b981' : '#ef4444' }}>{connected ? <><MdCheckCircle /> Connected</> : <><MdError /> Not Connected</>}</p></div>
      {!connected && <button className="btn btn-primary" onClick={connect} disabled={busy}><MdSync className={busy ? 'spin' : ''} /> {busy ? 'Preparing WhatsApp...' : status.status === 'initializing' ? 'Waiting for QR...' : 'Connect WhatsApp'}</button>}
      {!connected && <div className="form-group mt-4"><label>QR Code Area</label><div style={{ minHeight: 280, display: 'grid', placeItems: 'center', background: '#fff', borderRadius: 8 }}>{qrImage ? <img src={qrImage} alt="WhatsApp login QR code" width="260" height="260" /> : <span style={{ color: '#64748b' }}>{status.status === 'initializing' ? 'Starting WhatsApp. The QR code will appear shortly...' : 'Click Connect WhatsApp to generate a QR code.'}</span>}</div></div>}
      {connected && <div className="mt-4"><p><strong>Connected Number:</strong> {status.phoneNumber || '—'}</p><p><strong>Profile Name:</strong> {status.profileName || '—'}</p><button className="btn btn-secondary" onClick={disconnect} disabled={busy}><MdLogout /> Disconnect</button></div>}
      <div className="form-group mt-4">
        <label>TIME BETWEEN EACH MESSAGE (seconds)</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="input" aria-label="Minimum seconds between messages" type="number" min="15" step="1" value={(Number(delay) / 1000).toString()} onChange={e => setDelay(String(Math.round(Number(e.target.value) * 1000)))} style={{ maxWidth: 120 }} />
          <span style={{ color: '#94a3b8' }}>to</span>
          <input className="input" aria-label="Maximum seconds between messages" type="number" min="15" step="1" value={(Number(maximumDelay) / 1000).toString()} onChange={e => setMaximumDelay(String(Math.round(Number(e.target.value) * 1000)))} style={{ maxWidth: 120 }} />
          <button className="btn btn-primary btn-sm" onClick={saveDelay} disabled={busy}>Save time</button>
          {delaySaved && <span style={{ color: '#10b981' }}>Saved</span>}
        </div>
        <small style={{ color: '#64748b' }}>A different pause is chosen randomly within this range after every campaign message. Minimum: 15 seconds.</small>
      </div>
      {(connectionError || status.error) && <p style={{ color: '#ef4444', marginTop: 12 }}>{connectionError || status.error}</p>}
    </div>
  </div>;
}
