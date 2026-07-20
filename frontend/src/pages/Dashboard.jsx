import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { MdPeople, MdMessage, MdCheck, MdCampaign, MdMoreVert } from 'react-icons/md';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalCustomers: '0',
    totalCustomersGrowth: '0%',
    messagesSent: '0',
    messagesSentGrowth: '0%',
    deliveryRate: '0%',
    activeCampaigns: 0,
    chartData: []
  });
  
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentCampaigns, setRecentCampaigns] = useState([]);

  useEffect(() => {
    // Fetch stats
    fetch('http://localhost:3001/api/dashboard/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("Failed to fetch stats", err));
      
    // Fetch campaigns
    fetch('http://localhost:3001/api/campaigns')
      .then(res => res.json())
      .then(data => {
        // Sort by id descending to get most recent
        const sorted = data.campaigns.sort((a, b) => b.id - a.id);
        setRecentCampaigns(sorted);
      })
      .catch(err => console.error("Failed to fetch campaigns", err));

    // Fetch activity
    fetch('http://localhost:3001/api/activity')
      .then(res => res.json())
      .then(data => {
        if (data.activity) setRecentActivity(data.activity);
      })
      .catch(err => console.error("Failed to fetch activity", err));
  }, []);

  // Filter campaigns by search query
  const filteredCampaigns = recentCampaigns.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-page">
      <Header 
        title="Campaign Manager" 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
      />
      
      <div className="content-area">
        {/* Stats Row */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Total Customers</span>
              <MdPeople className="stat-icon" />
            </div>
            <div className="stat-value">{stats.totalCustomers}</div>
            <div className="stat-growth neutral">
              {stats.totalCustomersGrowth} this month
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Messages Sent</span>
              <MdMessage className="stat-icon text-primary" />
            </div>
            <div className="stat-value">{stats.messagesSent}</div>
            <div className="stat-growth neutral">
              {stats.messagesSentGrowth} this week
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Delivery Rate</span>
              <MdCheck className="stat-icon text-success" />
            </div>
            <div className="stat-value">{stats.deliveryRate}</div>
            <div className="stat-growth neutral">Waiting for data</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Active Campaigns</span>
              <MdCampaign className="stat-icon text-primary" />
            </div>
            <div className="stat-value">{stats.activeCampaigns}</div>
            <div className="stat-growth neutral">No active campaigns</div>
          </div>
        </div>
        
        <div className="middle-grid">
          {/* Chart Section */}
          <div className="chart-section card">
            <div className="section-header">
              <h2 className="section-title">Message Volume</h2>
              <select className="dropdown-select">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
              </select>
            </div>
            <div className="chart-container" style={{ height: '300px', width: '100%', marginTop: '20px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData.length > 0 ? stats.chartData : [{name: 'No data', messages: 0}]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#94A3B8" axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} 
                  />
                  <Bar dataKey="messages" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Recent Activity */}
          <div className="activity-section">
            <div className="section-header">
              <h2 className="section-title">Recent Activity</h2>
            </div>
            <div className="activity-list">
              {recentActivity.slice(0, 4).map((activity, idx) => {
                // format date (e.g. "2024-10-24 09:00:00" -> just the time or simple string)
                let timeStr = activity.createdAt;
                try {
                   const d = new Date(activity.createdAt);
                   if (!isNaN(d)) timeStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                } catch(e) {}
                
                return (
                  <div className="activity-item" key={idx}>
                    <div className={`activity-dot dot-${activity.type === 'danger' ? 'danger' : activity.type === 'info' ? 'info' : activity.type === 'neutral' ? 'neutral' : 'success'}`}></div>
                    <div className="activity-content">
                      <div className="activity-text">{activity.message}</div>
                      <div className="activity-time">{timeStr}</div>
                    </div>
                  </div>
                );
              })}
              {recentActivity.length === 0 && (
                <div className="activity-item" style={{justifyContent: 'center', color: '#94A3B8'}}>
                  No recent activity
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Recent Campaigns Table */}
        <div className="recent-campaigns-section">
          <div className="section-header">
            <h2 className="section-title">Recent Campaigns {searchQuery && `(Search: "${searchQuery}")`}</h2>
            <a href="/campaigns" className="view-all-link">View All</a>
          </div>
          
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.length > 0 ? filteredCampaigns.slice(0, 5).map(campaign => (
                  <tr key={campaign.id}>
                    <td>{campaign.name}</td>
                    <td>
                      <span className={`badge badge-${campaign.status === 'Completed' ? 'neutral' : campaign.status === 'Draft' ? 'info' : 'success'}`}>
                        <div className="dot"></div> {campaign.status}
                      </span>
                    </td>
                    <td>
                      <div className="progress-bar-container">
                        <div className={`progress-bar bg-${campaign.status === 'Completed' ? 'neutral' : 'success'}`} style={{width: `${campaign.progress}%`}}></div>
                        <span className="progress-text">{campaign.progress}%</span>
                      </div>
                    </td>
                    <td style={{color: '#94A3B8'}}>{campaign.date}</td>
                    <td><button className="icon-btn"><MdMoreVert /></button></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{textAlign: 'center', padding: '24px', color: '#94A3B8'}}>
                      {searchQuery ? 'No campaigns match your search.' : 'No campaigns created yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
