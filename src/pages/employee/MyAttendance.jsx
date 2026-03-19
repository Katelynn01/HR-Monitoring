import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ClipboardList, Lock } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';

export default function MyAttendance() {
    const { user } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [monthFilter, setMonthFilter] = useState('');

    useEffect(() => {
        if (user) fetchRecords();
    }, [user]);

    async function fetchRecords() {
        try {
            const snap = await getDocs(
                query(collection(db, 'attendance'), where('userId', '==', user.uid))
            );
            const list = [];
            snap.forEach(d => {
                const data = d.data();
                const dateObj = data.date?.toDate?.() || new Date(0);
                list.push({
                    id: d.id,
                    dateObj,
                    date: dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                    month: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`,
                    day: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
                    timeIn: data.timeIn?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    timeOut: data.timeOut?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Active',
                    totalHours: data.totalHours?.toFixed(1) || '—',
                    locked: data.locked !== false
                });
            });
            list.sort((a, b) => b.dateObj - a.dateObj);
            setRecords(list);
        } catch (err) {
            console.error('Error:', err);
        }
        setLoading(false);
    }

    const months = [...new Set(records.map(r => r.month))].sort().reverse();
    const filtered = monthFilter ? records.filter(r => r.month === monthFilter) : records;
    const totalHours = filtered.reduce((sum, r) => sum + (parseFloat(r.totalHours) || 0), 0);

    if (loading) return <LoadingScreen message="Loading records..." />;

    return (
        <div>
            <div className="section-header">
                <div>
                    <h1 className="page-title"><ClipboardList size={28} /> My Attendance</h1>
                    <p className="page-subtitle">Your complete time-in and time-out history</p>
                </div>
            </div>

            <div className="filters-bar">
                <select className="filter-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                    <option value="">All Months</option>
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <span className="badge badge-success">{filtered.length} records</span>
                <span className="badge badge-info">{totalHours.toFixed(1)}h total</span>
            </div>

            <div className="content-card">
                <div className="card-body-flush">
                    <table className="data-table">
                        <thead>
                            <tr><th>Day</th><th>Date</th><th>Time In</th><th>Time Out</th><th>Hours</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty-state"><p>No attendance records</p></div></td></tr>
                            ) : filtered.map(r => (
                                <tr key={r.id}>
                                    <td style={{ fontWeight: 600 }}>{r.day}</td>
                                    <td>{r.date}</td>
                                    <td><span className="badge badge-success">{r.timeIn}</span></td>
                                    <td><span className={`badge ${r.timeOut === 'Active' ? 'badge-warning' : 'badge-info'}`}>{r.timeOut}</span></td>
                                    <td>{r.totalHours}h</td>
                                    <td>
                                        <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <Lock size={11} /> Locked
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
