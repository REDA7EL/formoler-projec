import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { MdFilterList, MdSend, MdMarkEmailRead, MdTouchApp, MdErrorOutline } from 'react-icons/md';
import './History.css';

const History = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({
    totalSent: 0,
    avgOpenRate: '0%',
    avgClickRate: '0%',
    failedDelivery: '0%'
  });

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
                  <td><a href="#" className="action-link">{camp.status === 'Scheduled' ? 'Edit' : 'Report'}</a></td>
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
    </div>
  );
};

export default History;
