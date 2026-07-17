import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { MdSearch, MdFilterList, MdFileDownload, MdPersonAdd, MdEdit, MdDelete, MdClose } from 'react-icons/md';
import './Customers.css';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  
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
          <button className="btn btn-secondary"><MdFileDownload /> Import CSV</button>
          <button className="btn btn-primary" onClick={openAddModal}><MdPersonAdd /> Add Customer</button>
        </div>
      </div>

      <div className="content-area">
        {/* Filters and Search */}
        <div className="filter-bar">
          <div className="search-bar filter-search">
            <MdSearch className="search-icon" />
            <input type="text" placeholder="Search by name or phone..." className="search-input" />
          </div>
          
          <select className="dropdown-select filter-select">
            <option>Status: All</option>
            <option>Active</option>
            <option>Opt-out</option>
          </select>
          
          <select className="dropdown-select filter-select">
            <option>Date Added: Any</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
          </select>
          
          <button className="btn btn-secondary filter-more-btn"><MdFilterList /> More Filters</button>
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
              {customers.length > 0 ? customers.map((customer) => (
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
                <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>No customers found.</td></tr>
              )}
            </tbody>
          </table>
          
          <div className="pagination">
            <div className="rows-per-page">
              Rows per page: <strong>10</strong> <span>v</span>
            </div>
            <div className="page-info">
              <span>1-{customers.length} of {customers.length}</span>
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
    </div>
  );
};

export default Customers;
