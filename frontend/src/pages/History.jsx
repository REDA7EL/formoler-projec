import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { MdFilterList, MdSend, MdMarkEmailRead, MdTouchApp, MdErrorOutline, MdClose } from 'react-icons/md';
import './History.css';

const History = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({
    totalSent: 0,
    avgOpenRate: '0%',
    avgClickRate: '0%',
    failedDelivery: '0%'
  });
  const [selectedReport, setSelectedReport] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:3001/api/campaigns')
      .then(res => res.json())
      .then(data => setCampaigns(data.campaigns))
      .catch(err => console.error(err));

    fetch('http://localhost:3001/api/history/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="history-page">
      <div className="page-header header-with-actions">
        <div>
          <h1 className="page-title">Campaign History</h1>
          <p className="page-subtitle">Review performance and status of previous broadcasts.</p>
        </div>
        <div className="header-actions-right">
          <select className="dropdown-select mr-2 history-dropdown">
            <option>Last 30 Days</option>
          </select>
          <button className="btn history-filter-btn"><MdFilterList /> Filter</button>
        </div>
      </div>

      <div className="content-area">
        {/* Top Stats */}
        <div className="history-stats">
          <div className="history-stat-item">
            <div className="stat-label">TOTAL SENT</div>
            <MdSend className="stat-bg-icon" />
            <div className="stat-value">{stats.totalSent >= 1000 ? (stats.totalSent / 1000).toFixed(1) + 'k' : stats.totalSent}</div>
            <div className="stat-growth positive">↗ 0% vs last mo</div>
          </div>
          
          <div className="history-stat-item">
            <div className="stat-label">AVG OPEN RATE</div>
            <MdMarkEmailRead className="stat-bg-icon" />
            <div className="stat-value">{stats.avgOpenRate}</div>
            <div className="stat-growth positive">↗ 0% vs last mo</div>
          </div>
          
          <div className="history-stat-item">
            <div className="stat-label">AVG CLICK RATE</div>
            <MdTouchApp className="stat-bg-icon" />
            <div className="stat-value">{stats.avgClickRate}</div>
            <div className="stat-growth neutral">→ 0% vs last mo</div>
          </div>
          
          <div className="history-stat-item">
            <div className="stat-label">FAILED DELIVERY</div>
            <MdErrorOutline className="stat-danger-icon" />
            <div className="stat-value">{stats.failedDelivery}</div>
            <div className="stat-growth positive">↘ 0% vs last mo</div>
          </div>
        </div>

        {/* Table */}
        <div className="table-container history-table-wrapper mt-4">
          <table className="data-table history-table">
            <thead>
              <tr>
                <th>CAMPAIGN DETAILS</th>
                <th>STATUS</th>
                <th>RECIPIENTS</th>
                <th>PERFORMANCE (OPEN / CLICK)</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length > 0 ? campaigns.map((camp, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="campaign-name">{camp.name}</div>
                    <div className="campaign-date">Sent: {camp.date} • 09:00 AM</div>
                  </td>
                  <td>
                    <span className={`badge badge-${camp.status === 'Completed' ? 'success' : camp.status === 'Sending' ? 'dark' : 'warning'}`}>
                      <div className="dot"></div> {camp.status}
                    </span>
                  </td>
                  <td className="recipient-col">{camp.sent ? camp.sent.toLocaleString() : '0'}</td>
                  <td>
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
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {camp.status !== 'Scheduled' && <button className="action-link" style={{ background:'none', border:'none', cursor:'pointer' }} onClick={() => setSelectedReport(camp)}>Report</button>}
                      <button className="action-link" style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF' }} onClick={() => navigate('/campaigns/new', { state: { duplicate: camp } })}>Dupliquer</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" style={{textAlign: 'center', padding: '40px', color: '#9CA3AF'}}>No campaigns found in history.</td>
                </tr>
              )}
            </tbody>
          </table>
          
          <div className="pagination">
            <span>Showing {campaigns.length > 0 ? 1 : 0}-{campaigns.length} of {campaigns.length} campaigns</span>
            <div className="page-controls">
              <button className="page-btn">&lt;</button>
              <button className="page-btn active">1</button>
              <button className="page-btn">&gt;</button>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Report Modal */}
      {selectedReport && (
        <div className="modal-overlay" style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex: 1000 }}>
          <div className="modal-content card" style={{ width: '500px', padding: 0 }}>
            <div className="modal-header" style={{ padding: '20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Campaign Report: {selectedReport.name}</h3>
              <button className="icon-btn" onClick={() => setSelectedReport(null)}><MdClose /></button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                <span style={{ color:'#9CA3AF' }}>Status</span>
                <span className={`badge badge-${selectedReport.status === 'Completed' ? 'success' : 'warning'}`}>{selectedReport.status}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                <span style={{ color:'#9CA3AF' }}>Date</span>
                <span style={{ color:'#fff' }}>{selectedReport.date}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                <span style={{ color:'#9CA3AF' }}>Recipients targeted</span>
                <span style={{ color:'#fff' }}>{selectedReport.recipients}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                <span style={{ color:'#9CA3AF' }}>Messages Sent</span>
                <span style={{ color:'#fff' }}>{selectedReport.sent}</span>
              </div>
              
              <hr style={{ borderColor: '#334155', margin: '20px 0' }} />
              
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div style={{ background:'#1E293B', padding:'16px', borderRadius:'8px', textAlign:'center' }}>
                  <div style={{ fontSize:'24px', fontWeight:'bold', color:'#10B981' }}>{selectedReport.openRate}</div>
                  <div style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'4px' }}>Open Rate</div>
                </div>
                <div style={{ background:'#1E293B', padding:'16px', borderRadius:'8px', textAlign:'center' }}>
                  <div style={{ fontSize:'24px', fontWeight:'bold', color:'#3B82F6' }}>{selectedReport.clickRate}</div>
                  <div style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'4px' }}>Click Rate</div>
                </div>
                <div style={{ background:'#1E293B', padding:'16px', borderRadius:'8px', textAlign:'center', gridColumn:'span 2' }}>
                  <div style={{ fontSize:'20px', fontWeight:'bold', color:'#EF4444' }}>{selectedReport.deliveryFail}</div>
                  <div style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'4px' }}>Failed Delivery Rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
