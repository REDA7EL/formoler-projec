import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MdDashboard, MdPeople, MdCampaign, MdHistory, MdSettings, MdAdd, MdLogout, MdArticle } from 'react-icons/md';
import './Sidebar.css';

const Sidebar = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isDev = user.role === 'Developer';

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('sessionToken');
    navigate('/login');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">WA</div>
        <div className="brand-text">
          <div className="brand-title">WA Business</div>
          <div className="brand-subtitle">Campaign Manager</div>
        </div>
      </div>

      {!isDev && (
        <>
          <div className="sidebar-action">
            <NavLink to="/campaigns/new" className="btn btn-primary btn-full">
              <MdAdd size={20} /> New Campaign
            </NavLink>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-section-label">Overview</div>
            <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')} end>
              <MdDashboard size={19} /> Dashboard
            </NavLink>
            <div className="sidebar-section-label">Manage</div>
            <NavLink to="/customers" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <MdPeople size={19} /> Customers
            </NavLink>
            <NavLink to="/campaigns" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')} end>
              <MdCampaign size={19} /> Campaigns
            </NavLink>
            <NavLink to="/templates" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <MdArticle size={19} /> Templates
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <MdHistory size={19} /> History
            </NavLink>
          </nav>
        </>
      )}

      <div className="sidebar-bottom">
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <MdSettings size={20} /> Settings
        </NavLink>
        <button className="nav-item logout-btn" onClick={handleLogout}>
          <MdLogout size={20} /> Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
