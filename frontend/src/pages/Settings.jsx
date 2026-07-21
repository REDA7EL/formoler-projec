import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { 
  MdVpnKey, MdWebhook, MdPeople, MdVisibilityOff, MdVisibility, 
  MdSync, MdAdd, MdClose, MdSettings, MdLock, MdDelete, MdEdit, MdSave, MdCheckCircle, MdError
} from 'react-icons/md';
import './Settings.css';

// ─── TAB: General ────────────────────────────────────────────────────────────
const GeneralTab = () => {
  const [appName, setAppName] = useState('WhatsApp Campaign Manager');
  const [timezone, setTimezone] = useState('UTC+01:00 — Maroc');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/settings')
      .then(r => r.json())
      .then(data => {
        const s = data.settings || {};
        if (s.app_name) setAppName(s.app_name);
        if (s.timezone) setTimezone(s.timezone);
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      await fetch('http://localhost:3001/api/settings/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { app_name: appName, timezone } }),
      });
      setSaveMsg('ok');
    } catch {
      setSaveMsg('err');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  return (
    <div>
      <div className="settings-header-row">
        <div>
          <h2 className="settings-title">Paramètres Généraux</h2>
          <p className="settings-subtitle">Gérez le nom de l'application et le fuseau horaire.</p>
        </div>
      </div>
      <div className="card settings-card">
        <div className="card-header-icon">
          <MdSettings className="section-icon" />
          <h3>Informations de l'Application</h3>
        </div>
        <div className="form-group mt-3">
          <label>NOM DE L'APPLICATION</label>
          <input
            type="text"
            className="input"
            value={appName}
            onChange={e => setAppName(e.target.value)}
          />
        </div>
        <div className="form-group mt-3">
          <label>FUSEAU HORAIRE</label>
          <select className="input" value={timezone} onChange={e => setTimezone(e.target.value)}>
            <option value="UTC+01:00 — Maroc">UTC+01:00 — Maroc (Greenwich +1)</option>
            <option value="UTC+00:00 — GMT">UTC+00:00 — GMT</option>
            <option value="UTC+03:00 — Arabie Saoudite">UTC+03:00 — Arabie Saoudite</option>
            <option value="UTC-05:00 — EST">UTC-05:00 — EST (New York)</option>
          </select>
        </div>
        <div className="settings-card-footer mt-4">
          <div>
            {saveMsg === 'ok' && <span style={{ color: '#10b981', fontSize: '13px' }}>✓ Enregistré avec succès!</span>}
            {saveMsg === 'err' && <span style={{ color: '#ef4444', fontSize: '13px' }}>✗ Échec de l'enregistrement</span>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving}>
            <MdSave /> {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── TAB: API Connection ────────────────────────────────────────────────
const ApiTab = () => {
  const [showToken, setShowToken]     = useState(false);
  const [isTesting, setIsTesting]     = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [testResult, setTestResult]   = useState(null);   // null | { success, displayName, phoneNumber, status, quality, error }
  const [saveMsg, setSaveMsg]         = useState(null);   // null | 'ok' | 'err'
  const [isConnected, setIsConnected] = useState(false);

  const [creds, setCreds] = useState({
    access_token:        '',
    phone_id:            '',
    business_id:         '',
    whatsapp_delay_ms:   '1000',
    webhook_url:         '',
    webhook_token:       ''
  });

  // Load from backend on mount
  useEffect(() => {
    fetch('http://localhost:3001/api/settings')
      .then(r => r.json())
      .then(data => {
        const s = data.settings || {};
        setCreds({
          access_token:      s.access_token      || '',
          phone_id:          s.phone_id          || '',
          business_id:       s.business_id       || '',
          whatsapp_delay_ms: s.whatsapp_delay_ms || '1000',
          webhook_url:       s.webhook_url       || '',
          webhook_token:     s.webhook_token     || ''
        });
      })
      .catch(console.error);
  }, []);

  const handleChange = (key, val) => setCreds(prev => ({ ...prev, [key]: val }));

  // Save credentials to backend
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      await fetch('http://localhost:3001/api/settings/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: creds })
      });
      setSaveMsg('ok');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg('err');
    } finally {
      setIsSaving(false);
    }
  };

  // Test real connection via backend
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('http://localhost:3001/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: creds.access_token,
          phoneNumberId: creds.phone_id
        })
      });
      const data = await res.json();
      setTestResult(data);
      setIsConnected(data.success);
      setTimeout(() => setTestResult(null), 6000);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div>
      <div className="settings-header-row">
        <div>
          <h2 className="settings-title">WhatsApp Business API</h2>
          <p className="settings-subtitle">Configure your credentials to enable messaging capabilities.</p>
        </div>
        <div className={`status-badge ${isConnected ? 'connected' : ''}`}>
          <div className="dot"></div>
          {isConnected ? 'CONNECTED' : 'NOT TESTED'}
        </div>
      </div>

      {/* Credentials Card */}
      <div className="card settings-card">
        <div className="card-header-icon">
          <MdVpnKey className="section-icon" />
          <h3>API Credentials</h3>
        </div>

        <div className="form-group mt-3">
          <label>PERMANENT ACCESS TOKEN</label>
          <div className="input-wrapper" style={{ position: 'relative' }}>
            <input
              type={showToken ? 'text' : 'password'}
              value={creds.access_token}
              onChange={e => handleChange('access_token', e.target.value)}
              className="input"
              style={{ width: '100%', paddingRight: '42px' }}
              placeholder="EAAOl7ZA6q..."
            />
            <button
              className="icon-btn"
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94A3B8' }}
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <MdVisibility /> : <MdVisibilityOff />}
            </button>
          </div>
        </div>

        <div className="grid-2-col mt-3">
          <div className="form-group">
            <label>PHONE NUMBER ID</label>
            <input
              type="text"
              value={creds.phone_id}
              onChange={e => handleChange('phone_id', e.target.value)}
              className="input"
              placeholder="e.g. 102938475610293"
            />
          </div>
          <div className="form-group">
            <label>BUSINESS ACCOUNT ID</label>
            <input
              type="text"
              value={creds.business_id}
              onChange={e => handleChange('business_id', e.target.value)}
              className="input"
              placeholder="e.g. 883746291038475"
            />
          </div>
        </div>

        <div className="form-group mt-3">
          <label>DELAY BETWEEN MESSAGES (ms)</label>
          <input
            type="number"
            min="500"
            max="5000"
            step="100"
            value={creds.whatsapp_delay_ms}
            onChange={e => handleChange('whatsapp_delay_ms', e.target.value)}
            className="input"
            style={{ maxWidth: '200px' }}
          />
          <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>Recommended: 1000ms to avoid Meta rate limits</small>
        </div>

        <div className="settings-card-footer mt-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleTestConnection} disabled={isTesting}>
              <MdSync className={isTesting ? 'spin' : ''} />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
            {testResult && testResult.success && (
              <span style={{ color: '#10b981', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MdCheckCircle /> Connected — {testResult.displayName} ({testResult.phoneNumber})
              </span>
            )}
            {testResult && !testResult.success && (
              <span style={{ color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MdError /> {testResult.error}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saveMsg === 'ok' && <span style={{ color: '#10b981', fontSize: '13px' }}>✓ Saved!</span>}
            {saveMsg === 'err' && <span style={{ color: '#ef4444', fontSize: '13px' }}>✗ Save failed</span>}
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving}>
              <MdSave /> {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Webhook Card */}
      <div className="card settings-card mt-4">
        <div className="card-header-icon">
          <MdWebhook className="section-icon text-secondary" />
          <h3>Webhook Configuration</h3>
        </div>
        <div className="form-group mt-3">
          <label>CALLBACK URL</label>
          <input
            type="text"
            value={creds.webhook_url}
            onChange={e => handleChange('webhook_url', e.target.value)}
            className="input"
            placeholder="https://api.yourdomain.com/v1/whatsapp/webhook"
          />
        </div>
        <div className="form-group mt-3">
          <label>VERIFY TOKEN</label>
          <input
            type="text"
            value={creds.webhook_token}
            onChange={e => handleChange('webhook_token', e.target.value)}
            className="input"
            placeholder="secret_token_12345"
          />
        </div>
        <div className="settings-card-footer mt-4">
          <span></span>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving}>
            <MdSave /> Save Webhook
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── TAB: Team ───────────────────────────────────────────────────────────────
const TeamTab = ({ openAddUser, refreshKey }) => {
  const [members, setMembers] = useState([]);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetch('http://localhost:3001/api/team')
      .then(r => r.json())
      .then(data => setMembers(data.team || []))
      .catch(console.error);
  }, [refreshKey]);

  const handleDelete = async (id) => {
    if (id === currentUser.id) { alert('Vous ne pouvez pas supprimer votre propre compte!'); return; }
    if (!window.confirm('Supprimer cet utilisateur?')) return;
    await fetch(`http://localhost:3001/api/team/${id}`, { method: 'DELETE' });
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '?';

  return (
    <div>
      <div className="settings-header-row">
        <div>
          <h2 className="settings-title">Gestion de l'Équipe</h2>
          <p className="settings-subtitle">Gérez les membres et leurs accès à l'application.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAddUser}><MdAdd /> Ajouter</button>
      </div>
      <div className="card settings-card">
        <div className="card-header-icon">
          <MdPeople className="section-icon" />
          <h3>Membres ({members.length})</h3>
        </div>
        <table className="data-table team-table mt-3">
          <thead>
            <tr>
              <th>NOM</th>
              <th>EMAIL</th>
              <th>RÔLE</th>
              <th>STATUT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan="5" style={{textAlign:'center',padding:'30px',color:'#9CA3AF'}}>Aucun membre trouvé.</td></tr>
            )}
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="team-member">
                    <div className="avatar bg-muted">{getInitials(m.name)}</div>
                    <div className="member-info">
                      <div className="member-name">{m.name} {m.id === currentUser.id && <span style={{color:'#10b981',fontSize:'11px'}}>(vous)</span>}</div>
                    </div>
                  </div>
                </td>
                <td style={{color:'#9CA3AF',fontSize:'13px'}}>{m.email}</td>
                <td>{m.role}</td>
                <td><span className="badge badge-success"><div className="dot"></div> {m.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="icon-btn" style={{ color: '#ef4444' }} title="Supprimer" onClick={() => handleDelete(m.id)}>
                      <MdDelete size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── TAB: Security ───────────────────────────────────────────────────────────
const SecurityTab = () => {
  const [twoFactor, setTwoFactor] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState(null); // { type: 'ok'|'err', text: '' }
  const [isSaving, setIsSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwMsg({ type: 'err', text: 'Please fill in all fields.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'err', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: 'err', text: 'New password must be at least 6 characters.' });
      return;
    }

    setIsSaving(true);
    setPwMsg(null);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch('http://localhost:3001/api/users/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setPwMsg({ type: 'ok', text: '✓ Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwMsg({ type: 'err', text: data.message || 'Failed to update password.' });
      }
    } catch (err) {
      setPwMsg({ type: 'err', text: 'Could not connect to server.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setPwMsg(null), 4000);
    }
  };

  return (
    <div>
      <div className="settings-header-row">
        <div>
          <h2 className="settings-title">Security Settings</h2>
          <p className="settings-subtitle">Manage your password and account security options.</p>
        </div>
      </div>
      <div className="card settings-card">
        <div className="card-header-icon">
          <MdLock className="section-icon" />
          <h3>Change Password</h3>
        </div>
        <div className="form-group mt-3">
          <label>CURRENT PASSWORD</label>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="grid-2-col mt-3">
          <div className="form-group">
            <label>NEW PASSWORD</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>CONFIRM NEW PASSWORD</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        {pwMsg && (
          <div style={{ marginTop: '12px', color: pwMsg.type === 'ok' ? '#10b981' : '#ef4444', fontSize: '13px' }}>
            {pwMsg.text}
          </div>
        )}
        <div className="settings-card-footer mt-4">
          <span></span>
          <button className="btn btn-primary btn-sm" onClick={handleChangePassword} disabled={isSaving}>
            <MdLock /> {isSaving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
      <div className="card settings-card mt-4">
        <div className="card-header-icon">
          <MdLock className="section-icon text-secondary" />
          <h3>Two-Factor Authentication</h3>
        </div>
        <div className="security-toggle-row">
          <div>
            <div className="member-name">Enable 2FA</div>
            <div className="member-email">Adds an extra layer of security to your account.</div>
          </div>
          <div
            className={`toggle-switch ${twoFactor ? 'on' : ''}`}
            onClick={() => setTwoFactor(!twoFactor)}
          >
            <div className="toggle-thumb"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── TAB: Profil ─────────────────────────────────────────────────────────────
const ProfileTab = () => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const handleSave = async () => {
    if (!name || !email) {
      setSaveMsg({ type: 'err', text: 'Veuillez remplir tous les champs' });
      return;
    }
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('http://localhost:3001/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, name, email }) 
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg({ type: 'ok', text: 'Profil mis à jour' });
        // Update local storage
        currentUser.name = name;
        currentUser.email = email;
        localStorage.setItem('user', JSON.stringify(currentUser));
      } else {
        setSaveMsg({ type: 'err', text: data.error || 'Erreur de mise à jour' });
      }
    } catch {
      setSaveMsg({ type: 'err', text: 'Erreur réseau' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  return (
    <div>
      <div className="settings-header-row">
        <div>
          <h2 className="settings-title">Profil</h2>
          <p className="settings-subtitle">Gérez vos informations personnelles.</p>
        </div>
      </div>
      <div className="card settings-card">
        <div className="card-header-icon">
          <MdPeople className="section-icon" />
          <h3>Informations Personnelles</h3>
        </div>
        <div className="form-group mt-3">
          <label>NOM COMPLET</label>
          <input
            type="text"
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="form-group mt-3">
          <label>EMAIL</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div className="settings-card-footer mt-4">
          <div>
            {saveMsg && (
              <span style={{ color: saveMsg.type === 'ok' ? '#10b981' : '#ef4444', fontSize: '13px' }}>
                {saveMsg.type === 'ok' ? '✓ ' : '✗ '} {saveMsg.text}
              </span>
            )}
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving}>
            <MdSave /> {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── TAB: Theme ───────────────────────────────────────────────────────────────
const ThemeTab = () => {
  const [themeColor, setThemeColor] = useState('#10B981');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/settings')
      .then(r => r.json())
      .then(data => {
        const s = data.settings || {};
        if (s.theme_color) setThemeColor(s.theme_color);
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      await fetch('http://localhost:3001/api/settings/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { theme_color: themeColor } }),
      });
      document.documentElement.style.setProperty('--accent-primary', themeColor);
      setSaveMsg('ok');
    } catch {
      setSaveMsg('err');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  return (
    <div>
      <div className="settings-header-row">
        <div>
          <h2 className="settings-title">Apparence</h2>
          <p className="settings-subtitle">Personnalisez la couleur de l'application.</p>
        </div>
      </div>
      <div className="card settings-card">
        <div className="card-header-icon">
          <MdSettings className="section-icon" />
          <h3>Couleur Principale</h3>
        </div>
        <div className="form-group mt-3" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <input
            type="color"
            value={themeColor}
            onChange={e => setThemeColor(e.target.value)}
            style={{ width: '50px', height: '50px', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: 0 }}
          />
          <input
            type="text"
            className="input"
            value={themeColor}
            onChange={e => setThemeColor(e.target.value)}
            style={{ width: '120px' }}
          />
        </div>
        <div className="settings-card-footer mt-4">
          <div>
            {saveMsg === 'ok' && <span style={{ color: '#10b981', fontSize: '13px' }}>✓ Enregistré avec succès!</span>}
            {saveMsg === 'err' && <span style={{ color: '#ef4444', fontSize: '13px' }}>✗ Échec de l'enregistrement</span>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving}>
            <MdSave /> {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN Settings Component ──────────────────────────────────────────────────
const Settings = () => {
  // Get logged-in user role from localStorage
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isDev = currentUser.role === 'Developer';
  const isAdmin = currentUser.role === 'Administrator';

  const [activeTab, setActiveTab] = useState(isDev ? 'api' : 'general');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [teamRefreshKey, setTeamRefreshKey] = useState(0);

  // Add User Modal state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Viewer');
  const [addMsg, setAddMsg] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddUser = async () => {
    if (!newName || !newEmail || !newPassword) {
      setAddMsg({ type: 'err', text: 'Veuillez remplir tous les champs.' });
      return;
    }
    setIsAdding(true);
    setAddMsg(null);
    try {
      const res = await fetch('http://localhost:3001/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddUserModalOpen(false);
        setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('Viewer');
        setTeamRefreshKey(k => k + 1);
      } else {
        setAddMsg({ type: 'err', text: data.error || 'Erreur lors de la création.' });
      }
    } catch {
      setAddMsg({ type: 'err', text: 'Impossible de contacter le serveur.' });
    } finally {
      setIsAdding(false);
    }
  };

  // Visibility rules
  const allTabs = [
    { id: 'general', label: 'Général', visibleTo: ['Administrator'] },
    { id: 'api', label: 'API WhatsApp', visibleTo: ['Developer'] },
    { id: 'theme', label: 'Apparence', visibleTo: ['Developer'] },
    { id: 'team', label: 'Équipe', visibleTo: ['Administrator'] },
    { id: 'profile', label: 'Profil', visibleTo: ['Administrator', 'Developer', 'Viewer'] },
    { id: 'security', label: 'Sécurité', visibleTo: ['Administrator', 'Developer', 'Viewer'] },
  ];
  const tabs = allTabs.filter(t => t.visibleTo.includes(currentUser.role || 'Viewer'));

  return (
    <div className="settings-page">
      <Header title="Paramètres" />
      
      <div className="content-area settings-layout">
        <div className="settings-sidebar">
          <ul className="settings-nav">
            {tabs.map(tab => (
              <li
                key={tab.id}
                className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {activeTab === tab.id && <span className="nav-arrow">&gt;</span>}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="settings-content">
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'api' && isDev && <ApiTab />}
          {activeTab === 'theme' && <ThemeTab />}
          {activeTab === 'team' && <TeamTab openAddUser={() => { setAddMsg(null); setIsAddUserModalOpen(true); }} refreshKey={teamRefreshKey} />}
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'api' && !isDev && (
            <div className="card settings-card" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
              <h3 style={{ color: '#F1F5F9', marginBottom: '8px' }}>Accès Restreint</h3>
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>Cette section est réservée au développeur.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ padding: 0, maxWidth: '460px', width: '90%' }}>
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Ajouter un Membre</h3>
              <button className="icon-btn" onClick={() => setIsAddUserModalOpen(false)}><MdClose /></button>
            </div>
            <div className="modal-form" style={{ padding: '24px' }}>
              <div className="form-group mb-3">
                <label>NOM COMPLET</label>
                <input type="text" className="input" placeholder="Ex: Ahmed Benali" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="form-group mb-3">
                <label>EMAIL (pour connexion)</label>
                <input type="email" className="input" placeholder="ahmed@monentreprise.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div className="form-group mb-3">
                <label>MOT DE PASSE</label>
                <input type="password" className="input" placeholder="Min. 6 caractères" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="form-group mb-3">
                <label>RÔLE</label>
                <select className="input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="Administrator">Administrateur</option>
                  <option value="Viewer">Viewer (lecture seule)</option>
                </select>
              </div>
              {addMsg && (
                <div style={{ color: addMsg.type === 'err' ? '#ef4444' : '#10b981', fontSize: '13px', marginBottom: '12px' }}>
                  {addMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setIsAddUserModalOpen(false)}>Annuler</button>
                <button className="btn btn-primary" onClick={handleAddUser} disabled={isAdding}>
                  {isAdding ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
