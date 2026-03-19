import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { ClipboardList, Search, Lock, Filter } from 'lucide-react';
import EmployeeHistoryModal from '../../components/EmployeeHistoryModal';
import LoadingScreen from '../../components/LoadingScreen';

export default function Attendance() {
    const [records, setRecords] = useState([]);
    const [users, setUsers] = useState({});
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedHistoryUser, setSelectedHistoryUser] = useState(null);

    useEffect(() => { fetchData(); }, []);

    async function fetchData() {
        try {
            // Get users map
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersMap = {};
            usersSnap.forEach(d => { usersMap[d.id] = d.data(); });
            setUsers(usersMap);

            // Get all attendance
            const attSnap = await getDocs(collection(db, 'attendance'));
            const list = [];
            attSnap.forEach(d => {
                const data = d.data();
                if (!usersMap[data.userId]) return; // skip deleted accounts
                list.push({
                    id: d.id,
                    userId: data.userId,
                    name: usersMap[data.userId]?.name || 'Unknown',
                    department: usersMap[data.userId]?.department || '—',
                    date: data.date?.toDate?.() || null,
                    dateStr: data.date?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '—',
                    timeIn: data.timeIn?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    timeOut: data.timeOut?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Active',
                    totalHours: data.totalHours != null ? data.totalHours.toFixed(1) : '—',
                    locked: data.locked !== false
                });
            });
            list.sort((a, b) => (a.department || '').localeCompare(b.department || '') || (b.date || 0) - (a.date || 0));
            setRecords(list);
        } catch (err) {
            console.error('Error fetching attendance:', err);
        }
        setLoading(false);
    }

    const filtered = records.filter(r => {
        const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.department.toLowerCase().includes(search.toLowerCase());
        const matchDate = !dateFilter || r.dateStr === new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return matchSearch && matchDate;
    });

    if (loading) return <LoadingScreen message="Loading records..." />;

    return (
        <div>
            <div className="section-header">
                <div>
                    <h1 className="page-title"><ClipboardList size={28} /> Attendance Records</h1>
                    <p className="page-subtitle">All employee time-in and time-out logs (system-locked)</p>
                </div>
            </div>

            <div className="filters-bar">
                <div className="header-search" style={{ flex: 1, maxWidth: 300 }}>
                    <Search size={18} />
                    <input type="text" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Filter size={16} style={{ color: 'var(--gray-400)' }} />
                    <input type="date" className="filter-input" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
                </div>
                <span className="badge badge-info">{filtered.length} records</span>
            </div>

            <div className="content-card">
                <div className="card-body-flush">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Date</th>
                                <th>Time In</th>
                                <th>Time Out</th>
                                <th>Hours</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty-state"><p>No records found</p></div></td></tr>
                            ) : (
                                (() => {
                                    let lastDepartment = null;
                                    const rows = [];
                                    filtered.forEach(r => {
                                        if (r.department !== lastDepartment) {
                                            rows.push(
                                                <tr key={`dept-${r.department}`} style={{ backgroundColor: 'var(--green-50)' }}>
                                                    <td colSpan={6} style={{ fontWeight: 600, color: 'var(--green-800)', padding: '12px 16px', borderTop: '1px solid var(--green-200)' }}>
                                                        {r.department} Department
                                                    </td>
                                                </tr>
                                            );
                                            lastDepartment = r.department;
                                        }
                                        rows.push(
                                            <tr 
                                                key={r.id}
                                                onClick={() => setSelectedHistoryUser({ id: r.userId, name: r.name, department: r.department })}
                                                style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                title="Click to view employee details"
                                            >
                                                <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{r.name}</td>
                                                <td style={{ color: 'var(--gray-500)' }}>{r.dateStr}</td>
                                                <td><span className="badge badge-success">{r.timeIn}</span></td>
                                                <td><span className={`badge ${r.timeOut === 'Active' ? 'badge-warning' : 'badge-info'}`}>{r.timeOut}</span></td>
                                                <td>{r.totalHours}h</td>
                                                <td>
                                                    <span className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Lock size={12} /> Locked
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    });
                                    return rows;
                                })()
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
        </div>
    );
}
