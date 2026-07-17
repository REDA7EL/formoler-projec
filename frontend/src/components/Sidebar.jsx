import React from 'react';
import { NavLink } from 'react-router-dom';
import { MdDashboard, MdPeople, MdCampaign, MdHistory, MdSettings, MdAdd } from 'react-icons/md';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">WA</div>
        <div className="brand-text">
          <div className="brand-title">WA Business</div>
          <div className="brand-subtitle">Campaign Manager</div>
        </div>
      </div>

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
      </nav>

      <div className="sidebar-bottom">
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <MdSettings size={20} /> Settings
        </NavLink>
      </div>
    </div>
  );
};

export default Sidebar;
