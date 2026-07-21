import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MdDashboard, MdPeople, MdCampaign, MdHistory, MdSettings, MdAdd, MdLogout } from 'react-icons/md';
import './Sidebar.css';

const Sidebar = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isDev = user.role === 'Developer';

  const handleLogout = () => {
    localStorage.removeItem('user');
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
            <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')} end>
              <MdDashboard size={20} /> Dashboard
            </NavLink>
            <NavLink to="/customers" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <MdPeople size={20} /> Customers
            </NavLink>
            <NavLink to="/campaigns" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')} end>
              <MdCampaign size={20} /> Campaigns
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <MdHistory size={20} /> History
            </NavLink>
            <NavLink to="/templates" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <MdCampaign size={20} /> Templates
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
