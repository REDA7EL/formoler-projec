import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Customers from './pages/Customers';
import Campaigns from './pages/Campaigns';
import CreateCampaign from './pages/CreateCampaign';
import History from './pages/History';
import Settings from './pages/Settings';
import Templates from './pages/Templates';

const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const DeveloperRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.role === 'Developer' ? children : <Navigate to="/" replace />;
};

function App() {
  useEffect(() => {
    fetch('http://localhost:3001/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings && data.settings.theme_color) {
          document.documentElement.style.setProperty('--accent-primary', data.settings.theme_color);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/new" element={<CreateCampaign />} />
          <Route path="history" element={<History />} />
          <Route path="templates" element={<Templates />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/whatsapp-connection" element={<DeveloperRoute><Navigate to="/settings?tab=connection" replace /></DeveloperRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
