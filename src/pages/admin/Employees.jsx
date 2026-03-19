import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, updateDoc, query, where, deleteDoc, writeBatch } from 'firebase/firestore';
import { Users, Search, Edit3, X, Save, Leaf, Trash2 } from 'lucide-react';
import EmployeeHistoryModal from '../../components/EmployeeHistoryModal';
import LoadingScreen from '../../components/LoadingScreen';

export default function Employees() {
    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [selectedHistoryUser, setSelectedHistoryUser] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => { fetchEmployees(); }, []);

    async function fetchEmployees() {
        try {
            const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'employee')));
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            // Newest registrants first
            list.sort((a, b) => {
                const ta = a.createdAt?.toDate?.() || new Date(0);
                const tb = b.createdAt?.toDate?.() || new Date(0);
                return tb - ta;
            });
            setEmployees(list);
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
        setLoading(false);
    }

    function startEdit(emp) {
        setEditingId(emp.id);
        setEditData({
            name: emp.name,
            department: emp.department,
            vacation: emp.leaveCredits?.vacation ?? 15,
            sick: emp.leaveCredits?.sick ?? 10,
            personal: emp.leaveCredits?.personal ?? 5
        });
    }

    async function saveEdit() {
        try {
            await updateDoc(doc(db, 'users', editingId), {
                name: editData.name,
                department: editData.department,
                leaveCredits: {
                    vacation: Number(editData.vacation),
                    sick: Number(editData.sick),
                    personal: Number(editData.personal)
                }
            });
            setEditingId(null);
            fetchEmployees();
        } catch (err) {
            console.error('Error updating employee:', err);
        }
    }

    async function confirmDelete() {
        if (!deletingId) return;
        try {
            // 1. Attempt to delete user from Firebase Auth via backend API (best-effort)
            try {
                const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                const response = await fetch(`${backendUrl}/delete-user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: deletingId })
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.warn('Backend could not delete user from Auth:', errorData);
                }
            } catch (backendErr) {
                // Backend unavailable (e.g. local dev without server) — continue with Firestore cleanup
                console.warn('Backend unreachable, skipping Auth deletion:', backendErr.message);
            }

            // 2. Delete all related history records in batches
            const collections = ['attendance', 'leaveRequests', 'auditLogs'];
            for (const col of collections) {
                const snap = await getDocs(query(collection(db, col), where('userId', '==', deletingId)));
                if (!snap.empty) {
                    const batch = writeBatch(db);
                    snap.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
            }

            // 3. Delete user document from Firestore
            await deleteDoc(doc(db, 'users', deletingId));

            setDeletingId(null);
            fetchEmployees();
        } catch (err) {
            console.error('Error deleting employee:', err);
        }
    }

    const filtered = employees.filter(e =>
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.email?.toLowerCase().includes(search.toLowerCase()) ||
        e.department?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <LoadingScreen message="Loading employees..." />;

    return (
        <div>
            <div className="section-header">
                <div>
                    <h1 className="page-title"><Users size={28} /> Employees</h1>
                    <p className="page-subtitle">Manage employee profiles and leave credits</p>
                </div>
            </div>

            <div className="filters-bar">
                <div className="header-search" style={{ flex: 1, maxWidth: 400 }}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search employees..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <span className="badge badge-info">{filtered.length} employees</span>
            </div>

            <div className="content-card">
                <div className="card-body-flush">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Department</th>
                                <th>Vacation</th>
                                <th>Sick</th>
                                <th>Personal</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7}>
                                    <div className="empty-state"><Leaf size={40} /><p>No employees found</p></div>
                                </td></tr>
                            ) : (
                                filtered.map(emp => (
                                            <tr 
                                                key={emp.id}
                                                onClick={(e) => {
                                                    if (editingId === emp.id) return;
                                                    if (e.target.closest('button, input, select, a')) return;
                                                    setSelectedHistoryUser(emp);
                                                }}
                                                style={{ cursor: editingId === emp.id ? 'default' : 'pointer', transition: 'background-color 0.2s' }}
                                                onMouseEnter={(e) => { if (editingId !== emp.id) e.currentTarget.style.backgroundColor = '#f0fdf4'; }}
                                                onMouseLeave={(e) => { if (editingId !== emp.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                title={editingId === emp.id ? "" : "Click to view employee history"}
                                            >
                                                {editingId === emp.id ? (
                                                    <>
                                                        <td><input className="filter-input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} /></td>
                                                        <td>{emp.email}</td>
                                                        <td>
                                                            <select
                                                                className="filter-input"
                                                                value={editData.department}
                                                                onChange={e => setEditData({ ...editData, department: e.target.value })}
                                                            >
                                                                <option value="">Select Department</option>
                                                                <option value="Agriculture">Agriculture</option>
                                                                <option value="Operations">Operations</option>
                                                                <option value="Accounting">Accounting</option>
                                                                <option value="Human Resources">Human Resources</option>
                                                                <option value="Business Solutions">Business Solutions</option>
                                                                <option value="Marketing">Marketing</option>
                                                            </select>
                                                        </td>
                                                        <td><input className="filter-input" type="number" style={{ width: 60 }} value={editData.vacation} onChange={e => setEditData({ ...editData, vacation: e.target.value })} /></td>
                                                        <td><input className="filter-input" type="number" style={{ width: 60 }} value={editData.sick} onChange={e => setEditData({ ...editData, sick: e.target.value })} /></td>
                                                        <td><input className="filter-input" type="number" style={{ width: 60 }} value={editData.personal} onChange={e => setEditData({ ...editData, personal: e.target.value })} /></td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: 8 }}>
                                                                <button className="btn btn-primary btn-sm" onClick={saveEdit}><Save size={14} /> Save</button>
                                                                <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}><X size={14} /></button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{emp.name}</td>
                                                        <td>{emp.email}</td>
                                                        <td><span className="badge badge-success">{emp.department || '—'}</span></td>
                                                        <td>{emp.leaveCredits?.vacation ?? 15}</td>
                                                        <td>{emp.leaveCredits?.sick ?? 10}</td>
                                                        <td>{emp.leaveCredits?.personal ?? 5}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: 8 }}>
                                                                <button className="btn btn-secondary btn-sm" onClick={() => startEdit(emp)}><Edit3 size={14} /> Edit</button>
                                                                <button className="btn btn-danger btn-sm" onClick={() => setDeletingId(emp.id)}><Trash2 size={14} /> Delete</button>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <EmployeeHistoryModal
                isOpen={!!selectedHistoryUser}
                onClose={() => setSelectedHistoryUser(null)}
                employee={selectedHistoryUser}
            />

            {deletingId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff', borderRadius: '12px', width: '90%', maxWidth: '400px',
                        padding: '24px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
                    }}>
                        <h2 style={{ marginTop: 0, color: '#1f2937', fontSize: '1.25rem' }}>Confirm Delete</h2>
                        <p style={{ color: '#4b5563', margin: '16px 0 24px' }}>Are you sure you want to delete this employee? This action cannot be undone.</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setDeletingId(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
