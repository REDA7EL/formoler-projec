import React from 'react';
import { MdSearch, MdNotifications } from 'react-icons/md';
import './Header.css';

const Header = ({ title, searchQuery, setSearchQuery }) => {
  return (
    <div className="page-header">
      <div className="header-title">
        {typeof title === 'string' ? <h1 className="page-title">{title}</h1> : title}
      </div>
      
      <div className="header-actions">
        <div className="search-bar">
          <MdSearch size={20} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search campaigns..." 
            className="search-input" 
            value={searchQuery}
            onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
          />
        </div>
        
        <button className="icon-btn">
          <MdNotifications size={22} />
          <span className="notification-dot"></span>
        </button>
        
        <div className="profile-pic">
          <img src="https://ui-avatars.com/api/?name=Admin&background=10B981&color=fff" alt="Profile" />
        </div>
      </div>
    </div>
  );
};

export default Header;
