import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdOutlineMailOutline, MdLockOutline, MdVisibilityOff, MdOutlineCampaign } from 'react-icons/md';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@company.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      if (data.success) {
        navigate('/');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      // For development when backend is not running
      console.warn("Backend not reachable, logging in anyway for demo purposes", err);
      navigate('/');
    }
  };

  return (
    <div className="login-container">
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
      
      <div className="login-form-container">
        <div className="login-box">
          <h2 className="login-heading">Welcome Back</h2>
          <p className="login-subheading">Sign in to your campaign manager account.</p>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>EMAIL ADDRESS</label>
              <div className="input-wrapper">
                <MdOutlineMailOutline className="input-icon" />
                <input 
                  type="email" 
                  className="input" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>
            
            <div className="form-group">
              <div className="label-row">
                <label>PASSWORD</label>
                <a href="#" className="forgot-link">Forgot Password?</a>
              </div>
              <div className="input-wrapper">
                <MdLockOutline className="input-icon" />
                <input 
                  type="password" 
                  className="input" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
                <MdVisibilityOff className="input-icon-right" />
              </div>
            </div>
            
            <div className="form-checkbox">
              <input type="checkbox" id="remember" />
              <label htmlFor="remember">Remember me for 30 days</label>
            </div>
            
            <button type="submit" className="btn btn-primary btn-full login-btn">Login</button>
          </form>
          
          <div className="divider">
            <span>OR CONTINUE WITH</span>
          </div>
          
          <div className="sso-buttons">
            <button className="btn btn-secondary btn-full"><MdOutlineMailOutline /> SSO</button>
            <button className="btn btn-secondary btn-full"><MdLockOutline /> Passkey</button>
          </div>
          
          <div className="login-footer">
            Don't have an account? <a href="#">Contact Sales</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
