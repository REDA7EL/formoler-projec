import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdOutlineMailOutline, MdLockOutline, MdVisibilityOff, MdVisibility, MdOutlineCampaign, MdAdminPanelSettings, MdPerson } from 'react-icons/md';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      if (data.success) {
        const user = data.user;
        localStorage.setItem('user', JSON.stringify(user));
        navigate('/');
      } else {
        setError(data.message || 'Email ou mot de passe incorrect.');
      }
    } catch (err) {
      setError('Impossible de contacter le serveur. Vérifiez la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left Hero Panel */}
      <div className="login-hero">
        <div className="hero-content">
          <div className="hero-brand">
            <MdOutlineCampaign className="hero-logo" />
            <span>WA Business</span>
          </div>
          <h1 className="hero-title">Connect globally.<br/>Operate seamlessly.</h1>
          <p className="hero-subtitle">Enterprise-grade campaign management and synchronized global messaging for modern teams.</p>
        </div>
      </div>
      
      {/* Right Form Panel */}
      <div className="login-form-container">
        <div className="login-box">

          <h2 className="login-heading">Bienvenue</h2>
          <p className="login-subheading">Connectez-vous à votre compte.</p>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>ADRESSE EMAIL</label>
              <div className="input-wrapper">
                <MdOutlineMailOutline className="input-icon" />
                <input
                  type="text"
                  className="input"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>MOT DE PASSE</label>
              <div className="input-wrapper">
                <MdLockOutline className="input-icon" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <span className="input-icon-right" onClick={() => setShowPass(!showPass)} style={{cursor:'pointer'}}>
                  {showPass ? <MdVisibility /> : <MdVisibilityOff />}
                </span>
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary btn-full login-btn" disabled={isLoading}>
              {isLoading ? 'Connexion...' : 'Se Connecter'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default Login;
