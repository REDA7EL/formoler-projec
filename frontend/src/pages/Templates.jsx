import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { MdAdd, MdClose, MdDelete, MdContentCopy } from 'react-icons/md';

const Templates = () => {
  const [templates, setTemplates] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', bodyText: '', language: 'fr_FR' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = () => {
    fetch('http://localhost:3001/api/templates')
      .then(res => res.json())
      .then(data => setTemplates(data.templates || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.bodyText) return;
    setIsSaving(true);
    try {
      await fetch('http://localhost:3001/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setIsModalOpen(false);
      setFormData({ name: '', bodyText: '', language: 'fr_FR' });
      fetchTemplates();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Supprimer ce modèle ?")) {
      try {
        await fetch(`http://localhost:3001/api/templates/${id}`, { method: 'DELETE' });
        fetchTemplates();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="campaigns-page">
      <div className="page-header header-with-actions">
        <div>
          <h1 className="page-title">Modèles (Templates)</h1>
          <p className="page-subtitle">Gérez vos modèles de messages réutilisables.</p>
        </div>
        <div className="header-actions-right">
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <MdAdd /> Créer un modèle
          </button>
        </div>
      </div>

      <div className="content-area">
        <div className="table-container mt-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>NOM DU MODÈLE</th>
                <th>LANGUE</th>
                <th>STATUT</th>
                <th>CONTENU</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {templates.length > 0 ? templates.map(tpl => (
                <tr key={tpl.id}>
                  <td><strong>{tpl.name}</strong></td>
                  <td>{tpl.language}</td>
                  <td>
                    <span className={`badge badge-${(tpl.status || '').toLowerCase() === 'approved' ? 'success' : 'warning'}`}>
                      {(tpl.status || '').toUpperCase()}
                    </span>
                  </td>
                  <td><div style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.bodyText}</div></td>
                  <td>
                    <div className="action-buttons">
                      <button className="icon-btn text-danger" title="Supprimer" onClick={() => handleDelete(tpl.id)}><MdDelete /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF' }}>Aucun modèle trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Nouveau modèle</h3>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleSave} className="modal-form">
              <div className="form-group mb-3">
                <label>Nom du modèle (sans espaces)</label>
                <input 
                  type="text" 
                  className="input" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  required
                />
              </div>
              <div className="form-group mb-3">
                <label>Langue</label>
                <select className="input" value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })}>
                  <option value="fr_FR">Français (fr_FR)</option>
                  <option value="en_US">Anglais (en_US)</option>
                  <option value="ar">Arabe (ar)</option>
                </select>
              </div>
              <div className="form-group mb-4">
                <label>Contenu du message</label>
                <textarea 
                  className="input" 
                  rows="4"
                  value={formData.bodyText}
                  onChange={e => setFormData({ ...formData, bodyText: e.target.value })}
                  required
                ></textarea>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
