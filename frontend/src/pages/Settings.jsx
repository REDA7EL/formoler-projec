import React, { useState } from 'react';
import Header from '../components/Header';
import { 
  MdVpnKey, MdWebhook, MdPeople, MdVisibilityOff, MdVisibility, 
  MdSync, MdAdd, MdClose, MdSettings, MdLock, MdDelete, MdEdit
} from 'react-icons/md';
import './Settings.css';

// ─── TAB: General ────────────────────────────────────────────────────────────
const GeneralTab = () => (
  <div>
    <div className="settings-header-row">
      <div>
        <h2 className="settings-title">General Settings</h2>
        <p className="settings-subtitle">Manage your application name, timezone and notification preferences.</p>
      </div>
    </div>
    <div className="card settings-card">
      <div className="card-header-icon">
        <MdSettings className="section-icon" />
        <h3>Application Info</h3>
      </div>
      <div className="form-group mt-3">
        <label>APP NAME</label>
        <input type="text" className="input" defaultValue="WhatsApp Campaign Manager" />
      </div>
      <div className="form-group mt-3">
        <label>TIMEZONE</label>
        <select className="input">
          <option>UTC +01:00 — West Africa Time</option>
          <option>UTC +00:00 — GMT</option>
          <option>UTC -05:00 — EST</option>
        </select>
      </div>
      <div className="form-group mt-3">
        <label>LANGUAGE</label>
        <select className="input">
          <option>English</option>
          <option>French</option>
          <option>Arabic</option>
        </select>
      </div>
      <div className="settings-card-footer mt-4">
        <span></span>
        <button className="btn btn-primary btn-sm" onClick={() => alert("General settings saved!")}>Save Changes</button>
      </div>
    </div>
  </div>
);

// ─── TAB: API Connection ──────────────────────────────────────────────────────
const ApiTab = ({ showToken, setShowToken, isTesting, setIsTesting, testResult, setTestResult }) => {
  const handleTestConnection = () => {
    setIsTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult('success');
      setTimeout(() => setTestResult(null), 3000);
    }, 1500);
  };

  return (
    <div>
      <div className="settings-header-row">
        <div>
          <h2 className="settings-title">WhatsApp Business API</h2>
          <p className="settings-subtitle">Configure your credentials to enable messaging capabilities.</p>
        </div>
        <div className="status-badge connected">
          <div className="dot"></div> CONNECTED
        </div>
      </div>
      <div className="card settings-card">
        <div className="card-header-icon">
          <MdVpnKey className="section-icon" />
          <h3>API Credentials</h3>
        </div>
        <div className="form-group mt-3">
          <label>PERMANENT ACCESS TOKEN</label>
          <div className="input-wrapper" style={{ position: 'relative' }}>
            <input type={showToken ? "text" : "password"} value="EAAOl7ZA6qZBHgBO7yZC..." readOnly className="input" style={{ width: '100%' }} />
            <button className="icon-btn" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94A3B8' }} onClick={() => setShowToken(!showToken)}>
              {showToken ? <MdVisibility /> : <MdVisibilityOff />}
            </button>
          </div>
        </div>
        <div className="grid-2-col mt-3">
          <div className="form-group">
            <label>PHONE NUMBER ID</label>
            <input type="text" value="102938475610293" readOnly className="input" />
          </div>
          <div className="form-group">
            <label>BUSINESS ACCOUNT ID</label>
            <input type="text" value="883746291038475" readOnly className="input" />
          </div>
        </div>
        <div className="settings-card-footer mt-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleTestConnection} disabled={isTesting}>
              <MdSync className={isTesting ? "spin" : ""} /> {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
            {testResult === 'success' && <span style={{ color: '#10b981', fontSize: '13px' }}>✓ Connection Successful!</span>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => alert("API settings saved!")}>Save Changes</button>
        </div>
      </div>
      <div className="card settings-card mt-4">
        <div className="card-header-icon">
          <MdWebhook className="section-icon text-secondary" />
          <h3>Webhook Configuration</h3>
        </div>
        <div className="form-group mt-3">
          <label>CALLBACK URL</label>
          <input type="text" value="https://api.yourdomain.com/v1/whatsapp/webhook" readOnly className="input" />
        </div>
        <div className="form-group mt-3">
          <label>VERIFY TOKEN</label>
          <input type="text" value="secret_token_12345" readOnly className="input" />
        </div>
      </div>
    </div>
  );
};

// ─── TAB: Team ───────────────────────────────────────────────────────────────
const TeamTab = ({ openAddUser }) => {
  const [members, setMembers] = useState([
    { initials: 'JD', name: 'Jane Doe', role: 'Administrator', status: 'Active' },
    { initials: 'MS', name: 'Mike Smith', role: 'Developer', status: 'Active' },
  ]);

  return (
    <div>
      <div className="settings-header-row">
        <div>
          <h2 className="settings-title">Team Management</h2>
          <p className="settings-subtitle">Manage team members and their access permissions.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAddUser}><MdAdd /> Add User</button>
      </div>
      <div className="card settings-card">
        <div className="card-header-icon">
          <MdPeople className="section-icon" />
          <h3>API Access Team</h3>
        </div>
        <table className="data-table team-table mt-3">
          <thead>
            <tr>
              <th>NAME</th>
              <th>ROLE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={i}>
                <td>
                  <div className="team-member">
                    <div className="avatar bg-muted">{m.initials}</div>
                    <div className="member-info">
                      <div className="member-name">{m.name}</div>
                      <div className="member-email">{m.role}</div>
                    </div>
                  </div>
                </td>
                <td>{m.role}</td>
                <td><span className="badge badge-success"><div className="dot"></div> {m.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="icon-btn" title="Edit"><MdEdit size={16} /></button>
                    <button className="icon-btn" style={{ color: '#ef4444' }} title="Remove" onClick={() => setMembers(members.filter((_, idx) => idx !== i))}>
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
          <input type="password" className="input" placeholder="••••••••" />
        </div>
        <div className="grid-2-col mt-3">
          <div className="form-group">
            <label>NEW PASSWORD</label>
            <input type="password" className="input" placeholder="••••••••" />
          </div>
          <div className="form-group">
            <label>CONFIRM NEW PASSWORD</label>
            <input type="password" className="input" placeholder="••••••••" />
          </div>
        </div>
        <div className="settings-card-footer mt-4">
          <span></span>
          <button className="btn btn-primary btn-sm" onClick={() => alert("Password updated successfully!")}>Update Password</button>
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

// ─── MAIN Settings Component ──────────────────────────────────────────────────
const Settings = () => {
  const [activeTab, setActiveTab] = useState('api');
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'api', label: 'API Connection' },
    { id: 'team', label: 'Team' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <div className="settings-page">
      <Header title="Application Settings" />
      
      <div className="content-area settings-layout">
        {/* Settings Sidebar */}
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
        
        {/* Settings Content */}
        <div className="settings-content">
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'api' && (
            <ApiTab
              showToken={showToken} setShowToken={setShowToken}
              isTesting={isTesting} setIsTesting={setIsTesting}
              testResult={testResult} setTestResult={setTestResult}
            />
          )}
          {activeTab === 'team' && <TeamTab openAddUser={() => setIsAddUserModalOpen(true)} />}
          {activeTab === 'security' && <SecurityTab />}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ padding: 0 }}>
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Add New Team Member</h3>
              <button className="icon-btn" onClick={() => setIsAddUserModalOpen(false)}><MdClose /></button>
            </div>
            <div className="modal-form" style={{ padding: '24px' }}>
              <div className="form-group mb-3">
                <label>Full Name</label>
                <input type="text" className="input" placeholder="e.g. John Doe" />
              </div>
              <div className="form-group mb-3">
                <label>Role</label>
                <select className="input">
                  <option>Administrator</option>
                  <option>Developer</option>
                  <option>Viewer</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button className="btn btn-secondary" onClick={() => setIsAddUserModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => setIsAddUserModalOpen(false)}>Invite User</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
