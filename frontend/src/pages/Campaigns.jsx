import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { MdSearch, MdFilterList, MdAdd, MdEdit, MdDelete, MdClose, MdContentCopy, MdSend, MdSync } from 'react-icons/md';
import './Campaigns.css';

const Campaigns = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sendingId, setSendingId]     = useState(null); // campaign id currently being sent
  const [sendResult, setSendResult]   = useState(null); // { id, success, message }
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, campaign: null });
  
  // Search and Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '', status: 'Draft' });

  const fetchCampaigns = () => {
    let url = 'http://localhost:3001/api/campaigns';
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (statusFilter && statusFilter !== 'All') params.append('status', statusFilter);
    if (params.toString()) url += `?${params.toString()}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.campaigns) setCampaigns(data.campaigns);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchCampaigns();
  }, [search, statusFilter]);

  // Selection Logic
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(campaigns.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (e, id) => {
    if (e.target.checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    }
  };

  // Delete Logic
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this campaign?")) {
      try {
        await fetch(`http://localhost:3001/api/campaigns/${id}`, { method: 'DELETE' });
        fetchCampaigns();
        setSelectedIds(selectedIds.filter(itemId => itemId !== id));
      } catch (err) {
        console.error("Failed to delete", err);
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} campaigns?`)) {
      try {
        await fetch('http://localhost:3001/api/campaigns', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds })
        });
        fetchCampaigns();
        setSelectedIds([]);
      } catch (err) {
        console.error("Failed to bulk delete", err);
      }
    }
  };

  // Duplicate Logic
  const handleDuplicate = async (campaign) => {
    try {
      await fetch('http://localhost:3001/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${campaign.name} (Copy)`,
          message: campaign.message,
          status: 'Draft',
          progress: 0,
          sent: 0,
          openRate: '0%',
          clickRate: '0%',
          deliveryFail: '0%',
          recipients: campaign.recipients
        })
      });
      fetchCampaigns();
    } catch (err) {
      console.error("Failed to duplicate", err);
    }
  };

  // Send Campaign via WhatsApp API - Trigger Modal
  const handleSendNow = (campaign) => {
    setConfirmModal({ isOpen: true, campaign });
  };

  // Actually Send
  const confirmSend = async () => {
    const campaign = confirmModal.campaign;
    setConfirmModal({ isOpen: false, campaign: null });
    
    setSendingId(campaign.id);
    setSendResult(null);
    try {
      const res = await fetch(`http://localhost:3001/api/campaigns/${campaign.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setSendResult({ id: campaign.id, success: data.success, message: data.success ? data.message : data.error });
      fetchCampaigns();
    } catch (err) {
      setSendResult({ id: campaign.id, success: false, message: err.message });
    } finally {
      setSendingId(null);
      setTimeout(() => setSendResult(null), 6000);
    }
  };

  // Modal / Edit Logic
  const openEditModal = (campaign) => {
    setFormData({ id: campaign.id, name: campaign.name, status: campaign.status });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await fetch(`http://localhost:3001/api/campaigns/${formData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, status: formData.status })
      });
      setIsModalOpen(false);
      fetchCampaigns();
    } catch (err) {
      console.error("Failed to save", err);
    }
  };

  return (
    <div className="campaigns-page">
      <div className="page-header header-with-actions">
        <div>
          <h1 className="page-title">Campaign Manager</h1>
          <p className="page-subtitle">Manage, create, and organize your broadcast campaigns.</p>
        </div>
        <div className="header-actions-right">
          {selectedIds.length > 0 && (
            <button className="btn btn-secondary text-danger" onClick={handleDeleteSelected}>
              <MdDelete /> Delete Selected ({selectedIds.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => navigate('/campaigns/new')}>
            <MdAdd /> Create Campaign
          </button>
        </div>
      </div>

      <div className="content-area">
        {/* Filters and Search */}
        <div className="filter-bar">
          <div className="search-bar">
            <MdSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="Search campaigns..." 
              className="search-input" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <select 
            className="dropdown-select filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">Status: All</option>
            <option value="Draft">Draft</option>
            <option value="Sending">Sending</option>
            <option value="Completed">Completed</option>
            <option value="Scheduled">Scheduled</option>
          </select>
        </div>

        {/* Table */}
        <div className="table-container mt-4">
          <table className="data-table campaigns-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input 
                    type="checkbox" 
                    className="custom-checkbox" 
                    checked={campaigns.length > 0 && selectedIds.length === campaigns.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>CAMPAIGN NAME</th>
                <th>STATUS</th>
                <th>RECIPIENTS</th>
                <th>PERFORMANCE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length > 0 ? campaigns.map((camp) => (
                <tr key={camp.id} className={selectedIds.includes(camp.id) ? 'selected-row' : ''}>
                  <td className="checkbox-col">
                    <input 
                      type="checkbox" 
                      className="custom-checkbox" 
                      checked={selectedIds.includes(camp.id)}
                      onChange={(e) => handleSelectOne(e, camp.id)}
                    />
                  </td>
                  <td>
                    <div className="campaign-name-cell">
                      <div className="campaign-name">{camp.name}</div>
                      <div className="campaign-date">Created: {camp.date}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${camp.status === 'Completed' ? 'success' : camp.status === 'Sending' ? 'dark' : camp.status === 'Scheduled' ? 'primary' : 'warning'}`}>
                      <div className="dot"></div> {camp.status}
                    </span>
                  </td>
                  <td>{camp.recipients ? camp.recipients.toLocaleString() : '0'}</td>
                  <td>
                    {camp.status === 'Draft' || camp.status === 'Scheduled' ? (
                      <span style={{color: '#64748b', fontSize: '12px'}}>N/A</span>
                    ) : (
                      <div className="perf-bars">
                        <div className="perf-row">
                          <span className="perf-val">{camp.openRate}</span>
                          <div className="mini-bar-bg"><div className="mini-bar bg-success" style={{width: camp.openRate}}></div></div>
                        </div>
                        <div className="perf-row">
                          <span className="perf-val">{camp.clickRate}</span>
                          <div className="mini-bar-bg"><div className="mini-bar bg-primary" style={{width: camp.clickRate}}></div></div>
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="icon-btn" title="Edit" onClick={() => openEditModal(camp)}><MdEdit /></button>
                      <button className="icon-btn" title="Duplicate" onClick={() => handleDuplicate(camp)}><MdContentCopy /></button>
                      {camp.status !== 'Completed' && (
                        <button
                          className="icon-btn"
                          style={{ color: '#10b981' }}
                          title="Send via WhatsApp"
                          onClick={() => handleSendNow(camp)}
                          disabled={sendingId === camp.id}
                        >
                          {sendingId === camp.id ? <MdSync style={{ animation: 'spin 1s linear infinite' }} /> : <MdSend />}
                        </button>
                      )}
                      <button className="icon-btn text-danger" title="Delete" onClick={() => handleDelete(camp.id)}><MdDelete /></button>
                    </div>
                    {sendResult && sendResult.id === camp.id && (
                      <div style={{
                        fontSize: '11px',
                        marginTop: '4px',
                        color: sendResult.success ? '#10b981' : '#ef4444',
                        maxWidth: '180px'
                      }}>
                        {sendResult.success ? '✓' : '✗'} {sendResult.message}
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>
                    No campaigns found. Try adjusting filters or create a new one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <div className="modal-header">
              <h3>Edit Campaign</h3>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleSave} className="modal-form">
              <div className="form-group mb-4">
                <label>Campaign Name</label>
                <input 
                  type="text" 
                  className="input" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group mb-4">
                <label>Status</label>
                <select 
                  className="input" 
                  value={formData.status} 
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="Draft">Draft</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Sending">Sending</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444' }}>Confirm Sending</h3>
              <button className="icon-btn" onClick={() => setConfirmModal({ isOpen: false, campaign: null })}><MdClose /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <p>Are you sure you want to send <strong>"{confirmModal.campaign?.name}"</strong> to all active recipients?</p>
              <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px' }}>
                <strong>⚠ Warning:</strong> Sending marketing messages via Meta Cloud API incurs a cost per message. There is no free tier for marketing templates.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmModal({ isOpen: false, campaign: null })}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }} onClick={confirmSend}>Yes, Send Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
