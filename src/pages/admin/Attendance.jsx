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
    const [dateFilter, setDateFilter] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
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
                    locked: data.locked !== false,
                    type: data.type || 'regular'
                });
            });
            list.sort((a, b) => (a.department || '').localeCompare(b.department || '') || (b.date || 0) - (a.date || 0));
            setRecords(list);
        } catch (err) {
            console.error('Error fetching attendance:', err);
        }
        setLoading(false);
    }

    // Group records: one row per employee per day, with multiple shifts shown inline
    const grouped = {};
    records.forEach(r => {
        const key = `${r.userId}_${r.dateStr}`;
        if (!grouped[key]) {
            grouped[key] = {
                ...r,
                shifts: [r]
            };
        } else {
            grouped[key].shifts.push(r);
            // Sum up total hours across all shifts for the day
            const totalHoursNum = grouped[key].shifts.reduce((acc, s) => acc + (parseFloat(s.totalHours) || 0), 0);
            grouped[key].totalHours = totalHoursNum.toFixed(1);
        }
    });

    const groupedList = Object.values(grouped).sort((a, b) =>
        (a.department || '').localeCompare(b.department || '') || (b.date || 0) - (a.date || 0)
    );

    const filtered = groupedList.filter(r => {
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
                                <th>Office In</th>
                                <th>Office Out</th>
                                <th>Bidding In</th>
                                <th>Bidding Out</th>
                                <th>Total Hours</th>
                                <th>OT</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={9}><div className="empty-state"><p>No records found</p></div></td></tr>
                            ) : (
                                (() => {
                                    let lastDepartment = null;
                                    const rows = [];
                                    filtered.forEach(r => {
                                        if (r.department !== lastDepartment) {
                                            rows.push(
                                                <tr key={`dept-${r.department}`} style={{ backgroundColor: 'var(--green-50)' }}>
                                                    <td colSpan={9} style={{ fontWeight: 600, color: 'var(--green-800)', padding: '12px 16px', borderTop: '1px solid var(--green-200)' }}>
                                                        {r.department} Department
                                                    </td>
                                                </tr>
                                            );
                                            lastDepartment = r.department;
                                        }
                                rows.push(
                                            <tr 
                                                key={`${r.userId}_${r.dateStr}`}
                                                onClick={() => setSelectedHistoryUser({ id: r.userId, name: r.name, department: r.department })}
                                                style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                title="Click to view employee details"
                                            >
                                                <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>
                                                    {r.name}
                                                </td>
                                                <td style={{ color: 'var(--gray-500)' }}>{r.dateStr}</td>
                                                
                                                {/* Office In */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {r.shifts.filter(s => s.type !== 'bidding').map(s => (
                                                            <span key={`in-${s.id}`} className="badge badge-success" style={{ fontSize: '0.75rem', width: 'fit-content' }}>
                                                                {s.timeIn}
                                                            </span>
                                                        ))}
                                                        {r.shifts.filter(s => s.type !== 'bidding').length === 0 && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                                    </div>
                                                </td>
                                                {/* Office Out */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {r.shifts.filter(s => s.type !== 'bidding').map(s => (
                                                            <span key={`out-${s.id}`} className={`badge ${s.timeOut === 'Active' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '0.75rem', width: 'fit-content' }}>
                                                                {s.timeOut}
                                                            </span>
                                                        ))}
                                                        {r.shifts.filter(s => s.type !== 'bidding').length === 0 && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                                    </div>
                                                </td>
                                                {/* Bidding In */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {r.shifts.filter(s => s.type === 'bidding').map(s => (
                                                            <span key={`bin-${s.id}`} className="badge badge-success" style={{ fontSize: '0.75rem', width: 'fit-content', backgroundColor: 'var(--blue-100)', color: 'var(--blue-700)' }}>
                                                                {s.timeIn}
                                                            </span>
                                                        ))}
                                                        {r.shifts.filter(s => s.type === 'bidding').length === 0 && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                                    </div>
                                                </td>
                                                {/* Bidding Out */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {r.shifts.filter(s => s.type === 'bidding').map(s => (
                                                            <span key={`bout-${s.id}`} className={`badge ${s.timeOut === 'Active' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '0.75rem', width: 'fit-content', outline: s.timeOut !== 'Active' ? '1px solid var(--blue-200)' : '' }}>
                                                                {s.timeOut}
                                                            </span>
                                                        ))}
                                                        {r.shifts.filter(s => s.type === 'bidding').length === 0 && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                                    </div>
                                                </td>
                                                
                                                <td style={{ fontWeight: 600 }}>{r.totalHours}h</td>
                                                <td style={{ fontWeight: 600, color: parseFloat(r.totalHours) > 8 ? 'var(--yellow-700)' : 'inherit' }}>{parseFloat(r.totalHours) > 8 ? `${(parseFloat(r.totalHours) - 8).toFixed(1)}h` : '—'}</td>
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
