import React, { useState, useRef } from 'react';
import Header from '../components/Header';
import { 
  MdFormatBold, MdFormatItalic, MdFormatStrikethrough, MdEmojiEmotions, 
  MdCode, MdSave, MdSend, MdArrowBack, MdImage, MdVideocam, MdMic,
  MdClose, MdCheckCircle, MdUpload
} from 'react-icons/md';
import './CreateCampaign.css';

const CreateCampaign = () => {
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState([]);  // { type, name, url, preview }
  const [uploading, setUploading] = useState(null);        // 'image' | 'video' | 'audio' | null
  const [uploadError, setUploadError] = useState(null);

  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // Upload a file to backend
  const handleUpload = async (file, type) => {
    if (!file) return;
    setUploading(type);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:3001/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      const preview = type === 'image' ? data.url : null;
      setUploadedMedia(prev => [...prev, {
        id: data.id,
        type: data.type,
        name: data.originalName,
        url: data.url,
        preview,
        size: formatSize(data.size),
      }]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(null);
    }
  };

  const removeMedia = (idx) => {
    setUploadedMedia(prev => prev.filter((_, i) => i !== idx));
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Find the first image for preview
  const previewImage = uploadedMedia.find(m => m.type === 'image');
  const previewAudio = uploadedMedia.find(m => m.type === 'audio');
  const previewVideo = uploadedMedia.find(m => m.type === 'video');

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
                  <button className="toolbar-btn" title="Bold"><MdFormatBold /></button>
                  <button className="toolbar-btn" title="Italic"><MdFormatItalic /></button>
                  <button className="toolbar-btn" title="Strikethrough"><MdFormatStrikethrough /></button>
                </div>
                <div className="toolbar-group">
                  <button className="toolbar-btn" title="Emoji"><MdEmojiEmotions /></button>
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

            {/* ── MEDIA ATTACH SECTION ── */}
            <div className="card mt-4">
              <h3 className="card-title">Attach Media</h3>
              <p className="media-subtitle">Add an image, video, or voice note to your campaign message.</p>

              {/* Upload Buttons */}
              <div className="media-upload-btns">
                {/* IMAGE */}
                <input 
                  ref={imageRef} type="file" hidden 
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={e => { handleUpload(e.target.files[0], 'image'); e.target.value = ''; }}
                />
                <button 
                  className={`media-btn media-btn-image ${uploading === 'image' ? 'loading' : ''}`}
                  onClick={() => imageRef.current.click()}
                  disabled={!!uploading}
                >
                  <div className="media-btn-icon"><MdImage /></div>
                  <div className="media-btn-label">
                    <span className="media-btn-title">{uploading === 'image' ? 'Uploading...' : 'Image'}</span>
                    <span className="media-btn-hint">JPG, PNG, GIF • Max 50MB</span>
                  </div>
                  {uploading === 'image' && <div className="media-spinner"></div>}
                </button>

                {/* VIDEO */}
                <input 
                  ref={videoRef} type="file" hidden 
                  accept="video/mp4,video/webm,video/quicktime,video/avi"
                  onChange={e => { handleUpload(e.target.files[0], 'video'); e.target.value = ''; }}
                />
                <button 
                  className={`media-btn media-btn-video ${uploading === 'video' ? 'loading' : ''}`}
                  onClick={() => videoRef.current.click()}
                  disabled={!!uploading}
                >
                  <div className="media-btn-icon"><MdVideocam /></div>
                  <div className="media-btn-label">
                    <span className="media-btn-title">{uploading === 'video' ? 'Uploading...' : 'Video'}</span>
                    <span className="media-btn-hint">MP4, WebM, MOV • Max 50MB</span>
                  </div>
                  {uploading === 'video' && <div className="media-spinner"></div>}
                </button>

                {/* VOCAL / AUDIO */}
                <input 
                  ref={audioRef} type="file" hidden 
                  accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/aac"
                  onChange={e => { handleUpload(e.target.files[0], 'audio'); e.target.value = ''; }}
                />
                <button 
                  className={`media-btn media-btn-audio ${uploading === 'audio' ? 'loading' : ''}`}
                  onClick={() => audioRef.current.click()}
                  disabled={!!uploading}
                >
                  <div className="media-btn-icon"><MdMic /></div>
                  <div className="media-btn-label">
                    <span className="media-btn-title">{uploading === 'audio' ? 'Uploading...' : 'Voice Note'}</span>
                    <span className="media-btn-hint">MP3, WAV, OGG • Max 50MB</span>
                  </div>
                  {uploading === 'audio' && <div className="media-spinner"></div>}
                </button>
              </div>

              {/* Error */}
              {uploadError && (
                <div className="upload-error">⚠ {uploadError}</div>
              )}

              {/* Uploaded Files List */}
              {uploadedMedia.length > 0 && (
                <div className="uploaded-list">
                  {uploadedMedia.map((m, idx) => (
                    <div key={idx} className={`uploaded-item uploaded-item-${m.type}`}>
                      <div className="uploaded-icon">
                        {m.type === 'image' && <MdImage />}
                        {m.type === 'video' && <MdVideocam />}
                        {m.type === 'audio' && <MdMic />}
                      </div>
                      <div className="uploaded-info">
                        <div className="uploaded-name">{m.name}</div>
                        <div className="uploaded-size">{m.size} • <MdCheckCircle style={{verticalAlign:'middle', color:'#10b981'}} /> Uploaded</div>
                      </div>
                      <button className="uploaded-remove" onClick={() => removeMedia(idx)} title="Remove">
                        <MdClose />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* PREVIEW COLUMN */}
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
                {/* Image preview inside bubble */}
                {previewImage && (
                  <div className="preview-media-bubble">
                    <img src={previewImage.url} alt="Preview" className="preview-media-img" />
                  </div>
                )}
                {/* Video preview inside bubble */}
                {previewVideo && (
                  <div className="preview-media-bubble">
                    <video src={previewVideo.url} controls className="preview-media-video" />
                  </div>
                )}
                {/* Audio preview inside bubble */}
                {previewAudio && (
                  <div className="preview-audio-bubble">
                    <MdMic style={{ color: '#10b981', fontSize: '20px' }} />
                    <div className="preview-audio-bar">
                      <div className="preview-audio-wave"></div>
                    </div>
                    <span className="preview-audio-label">Voice Note</span>
                  </div>
                )}
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
