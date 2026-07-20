import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import { MdSearch, MdFilterList, MdFileDownload, MdPersonAdd, MdEdit, MdDelete, MdClose, MdCheckCircle, MdError } from 'react-icons/md';
import * as XLSX from 'xlsx';
import './Customers.css';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const fileInputRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [importing, setImporting] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('Any');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '', phone: '', status: 'Active' });

  const fetchCustomers = () => {
    fetch('http://localhost:3001/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data.customers))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // ── Filtering logic (client-side, instant) ────────────────────────
  const filteredCustomers = customers.filter(c => {
    // 1. Search
    const q = search.toLowerCase();
    if (q && !c.name.toLowerCase().includes(q) && !c.phone.toLowerCase().includes(q)) return false;

    // 2. Status
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;

    // 3. Date
    if (dateFilter !== 'Any' && c.dateAdded) {
      const added = new Date(c.dateAdded);
      const now   = new Date();
      const days  = dateFilter === 'Last 7 Days' ? 7 : 30;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      if (added < cutoff) return false;
    }

    return true;
  });

  // Selection Logic
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(customers.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (e, id) => {
    if (e.target.checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    }
  };

  // Delete Logic
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this customer?")) {
      try {
        await fetch(`http://localhost:3001/api/customers/${id}`, { method: 'DELETE' });
        fetchCustomers();
        setSelectedIds(selectedIds.filter(itemId => itemId !== id));
      } catch (err) {
        console.error("Failed to delete", err);
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} customers?`)) {
      for (const id of selectedIds) {
        await fetch(`http://localhost:3001/api/customers/${id}`, { method: 'DELETE' });
      }
      fetchCustomers();
      setSelectedIds([]);
    }
  };

  // Modal / Edit Logic
  const openAddModal = () => {
    setEditMode(false);
    setFormData({ id: null, name: '', phone: '', status: 'Active' });
    setIsModalOpen(true);
  };

  const openEditModal = (customer) => {
    setEditMode(true);
    setFormData({ id: customer.id, name: customer.name, phone: customer.phone, status: customer.status });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const url = editMode 
      ? `http://localhost:3001/api/customers/${formData.id}`
      : 'http://localhost:3001/api/customers';
    const method = editMode ? 'PUT' : 'POST';

    try {
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      console.error("Failed to save", err);
    }
  };

  // ── Toast helper ──────────────────────────────────────────────────
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Import Excel / CSV ────────────────────────────────────────────
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Convert to array-of-arrays to inspect headers manually
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!rawRows.length || rawRows.length < 2) {
          showToast('error', 'The file is empty or has no data rows.');
          setImporting(false);
          return;
        }

        // First row = headers
        const headers = rawRows[0].map(h => String(h).trim());

        // Auto-detect column indices (case-insensitive)
        const nameIdx  = headers.findIndex(h => /nom|name|prenom|first/i.test(h));
        const phoneIdx = headers.findIndex(h => /phone|tel|mobile|num|gsm/i.test(h));

        // If no header match, assume col 0 = name, col 1 = phone (or col 0 = phone if only 1 col)
        const resolvedNameIdx  = nameIdx  >= 0 ? nameIdx  : 0;
        const resolvedPhoneIdx = phoneIdx >= 0 ? phoneIdx : (headers.length > 1 ? 1 : 0);

        const list = rawRows.slice(1)
          .map(row => ({
            name:  String(row[resolvedNameIdx]  || '').trim(),
            phone: String(row[resolvedPhoneIdx] || '').trim()
          }))
          .filter(r => r.phone);

        if (!list.length) {
          showToast('error', 'No valid phone numbers found in the file.');
          setImporting(false);
          return;
        }

        const res = await fetch('http://localhost:3001/api/customers/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customers: list })
        });
        const json = await res.json();

        if (json.success) {
          showToast('success', `✅ ${json.inserted} contacts imported successfully!`);
          fetchCustomers();
        } else {
          showToast('error', json.error || 'Import failed.');
        }
      } catch (err) {
        console.error(err);
        showToast('error', 'Error reading file. Make sure it is a valid Excel or CSV file.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="customers-page">
      <div className="page-header header-with-actions">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage and segment your contact list.</p>
        </div>
        <div className="header-actions-right">
          {selectedIds.length > 0 && (
            <button className="btn btn-secondary text-danger" onClick={handleDeleteSelected}>
              <MdDelete /> Delete Selected ({selectedIds.length})
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleImportCSV}
          />
          <button
            className={`btn btn-secondary${importing ? ' btn-loading' : ''}`}
            onClick={() => fileInputRef.current.click()}
            disabled={importing}
          >
            <MdFileDownload /> {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <button className="btn btn-primary" onClick={openAddModal}><MdPersonAdd /> Add Customer</button>
        </div>
      </div>

      <div className="content-area">
        {/* Filters and Search */}
        <div className="filter-bar">
          <div className="search-bar filter-search">
            <MdSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              className="search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="dropdown-select filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">Status: All</option>
            <option value="Active">Active</option>
            <option value="Opt-out">Opt-out</option>
          </select>

          <select
            className="dropdown-select filter-select"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          >
            <option value="Any">Date Added: Any</option>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
          </select>

          {(search || statusFilter !== 'All' || dateFilter !== 'Any') && (
            <button
              className="btn btn-secondary filter-more-btn"
              onClick={() => { setSearch(''); setStatusFilter('All'); setDateFilter('Any'); }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="table-container mt-4">
          <table className="data-table customers-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input 
                    type="checkbox" 
                    className="custom-checkbox" 
                    checked={customers.length > 0 && selectedIds.length === customers.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>CUSTOMER NAME</th>
                <th>PHONE NUMBER</th>
                <th>STATUS</th>
                <th>DATE ADDED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length > 0 ? filteredCustomers.map((customer) => (
                <tr key={customer.id} className={selectedIds.includes(customer.id) ? 'selected-row' : ''}>
                  <td className="checkbox-col">
                    <input 
                      type="checkbox" 
                      className="custom-checkbox" 
                      checked={selectedIds.includes(customer.id)}
                      onChange={(e) => handleSelectOne(e, customer.id)}
                    />
                  </td>
                  <td>
                    <div className="customer-name-cell">
                      <div className="customer-avatar" style={{backgroundColor: customer.status === 'Active' ? '#10B981' : '#0EA5E9'}}>
                        {customer.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span>{customer.name}</span>
                    </div>
                  </td>
                  <td>{customer.phone}</td>
                  <td>
                    <span className={`badge badge-${customer.status === 'Active' ? 'success' : 'danger'}`}>
                      <div className="dot"></div> {customer.status}
                    </span>
                  </td>
                  <td>{customer.dateAdded}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="icon-btn" onClick={() => openEditModal(customer)}><MdEdit /></button>
                      <button className="icon-btn text-danger" onClick={() => handleDelete(customer.id)}><MdDelete /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>
                  {search || statusFilter !== 'All' || dateFilter !== 'Any'
                    ? 'No customers match your filters.'
                    : 'No customers found.'}
                </td></tr>
              )}
            </tbody>
          </table>
          
          <div className="pagination">
            <div className="rows-per-page">
              Rows per page: <strong>10</strong> <span>v</span>
            </div>
            <div className="page-info">
              <span>{filteredCustomers.length === 0 ? '0' : `1-${filteredCustomers.length}`} of {filteredCustomers.length}</span>
              <div className="page-controls">
                <button className="page-btn">&lt;</button>
                <button className="page-btn">&gt;</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <div className="modal-header">
              <h3>{editMode ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><MdClose /></button>
            </div>
            <form onSubmit={handleSave} className="modal-form">
              <div className="form-group mb-3">
                <label>Name</label>
                <input 
                  type="text" 
                  className="input" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group mb-3">
                <label>Phone Number</label>
                <input 
                  type="text" 
                  className="input" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group mb-4">
                <label>Status</label>
                <select 
                  className="input" 
                  value={formData.status} 
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="Active">Active</option>
                  <option value="Opt-out">Opt-out</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editMode ? 'Save Changes' : 'Add Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast notification */}
      {toast && (
        <div className={`import-toast import-toast-${toast.type}`}>
          {toast.type === 'success' ? <MdCheckCircle size={20} /> : <MdError size={20} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default Customers;
