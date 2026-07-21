import React, { useState, useEffect, useRef } from 'react';
import { MdSearch, MdNotifications } from 'react-icons/md';
import './Header.css';

import { useNavigate } from 'react-router-dom';

const Header = ({ title, searchQuery, setSearchQuery }) => {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifSearch, setNotifSearch] = useState('');
  const notifRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  useEffect(() => {
    fetch('http://localhost:3001/api/dashboard/activity')
      .then(res => res.json())
      .then(data => setNotifications(data.activity || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifRef]);

  const filteredNotifs = notifications.filter(n => n.message.toLowerCase().includes(notifSearch.toLowerCase()));

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
        
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button className="icon-btn" onClick={() => setShowNotifications(!showNotifications)}>
            <MdNotifications size={22} />
            <span className="notification-dot"></span>
          </button>
          
          {showNotifications && (
            <div className="card" style={{ position: 'absolute', top: '40px', right: '0', width: '320px', zIndex: 1000, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Notifications</h3>
              </div>
              <input 
                type="text" 
                className="input mb-3" 
                placeholder="Chercher..." 
                value={notifSearch}
                onChange={e => setNotifSearch(e.target.value)}
                style={{ padding: '8px', fontSize: '13px' }}
              />
              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredNotifs.length > 0 ? filteredNotifs.map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div className={`activity-dot dot-${n.type === 'danger' ? 'danger' : n.type === 'info' ? 'info' : n.type === 'neutral' ? 'neutral' : 'success'}`} style={{ marginTop: '6px' }}></div>
                    <div>
                      <div style={{ fontSize: '13px', color: '#F1F5F9' }}>{n.message}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Aucune notification</div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="profile-pic" style={{ cursor: 'pointer' }} onClick={handleLogout} title="Logout">
          <img src="https://ui-avatars.com/api/?name=Admin&background=10B981&color=fff" alt="Logout" />
        </div>
      </div>
    </div>
  );
};

export default Header;
