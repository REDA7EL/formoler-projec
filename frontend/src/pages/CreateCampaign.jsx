import React, { useState } from 'react';
import Header from '../components/Header';
import { MdFormatBold, MdFormatItalic, MdFormatStrikethrough, MdEmojiEmotions, MdCode, MdSave, MdSend, MdArrowBack } from 'react-icons/md';
import './CreateCampaign.css';

const CreateCampaign = () => {
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');

  return (
    <div className="create-campaign-page">
      <div className="breadcrumbs">
        <a href="/campaigns">Campaigns</a> &gt; <span>Create New Campaign</span>
      </div>
      <Header title="Create Campaign" />

      <div className="content-area">
        <div className="create-grid">
          <div className="editor-column">
            
            <div className="card mb-4">
              <h3 className="card-title">Campaign Details</h3>
              <div className="form-group mt-3">
                <label>Campaign Name</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g., Summer Sale Promo 2024" 
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-header-flex">
                <h3 className="card-title">Message Content</h3>
                <button className="btn btn-secondary btn-sm"><MdCode /> Use Template</button>
              </div>
              
              <div className="editor-toolbar">
                <div className="toolbar-group">
                  <button className="toolbar-btn"><MdFormatBold /></button>
                  <button className="toolbar-btn"><MdFormatItalic /></button>
                  <button className="toolbar-btn"><MdFormatStrikethrough /></button>
                </div>
                <div className="toolbar-group">
                  <button className="toolbar-btn"><MdEmojiEmotions /></button>
                </div>
                <div className="toolbar-spacer"></div>
                <button className="btn btn-text"><MdCode /> Add Variable</button>
              </div>
              
              <textarea 
                className="message-textarea" 
                placeholder="Type your WhatsApp message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              ></textarea>
              
              <div className="textarea-footer">
                <span>{message.length} / 1024 characters</span>
              </div>
            </div>

          </div>

          <div className="preview-column">
            <h3 className="section-title mb-3">Preview</h3>
            <div className="phone-preview">
              <div className="phone-header">
                <MdArrowBack />
                <div className="phone-contact">
                  <div className="phone-avatar">
                    <img src="https://ui-avatars.com/api/?name=WA&background=10B981&color=fff" alt="WA" />
                  </div>
                  <span>WA Business</span>
                </div>
              </div>
              
              <div className="phone-body">
                <div className="message-bubble">
                  {message || (
                    <>
                      Hello there! 👋<br/><br/>
                      This is a preview of how your message will appear to customers.
                    </>
                  )}
                  <div className="message-time">12:00 PM ✓✓</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-bar">
        <button className="btn btn-secondary"><MdSave /> Save Draft</button>
        <button className="btn btn-primary"><MdSend /> Send Campaign</button>
      </div>
    </div>
  );
};

export default CreateCampaign;
