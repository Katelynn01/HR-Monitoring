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
                    type: data.type || 'regular',
                    dateObj,
                    date: dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                    month: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`,
                    day: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
                    timeIn: data.timeIn?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    timeOut: data.timeOut === 'Active'
                        ? 'Active'
                        : data.timeOut?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    totalHours: data.totalHours != null ? parseFloat(data.totalHours) : 0,
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

    // Group by date for rowspan rendering
    const groupedByDate = [];
    const seenDates = {};
    [...filtered].sort((a, b) => b.dateObj - a.dateObj).forEach(r => {
        if (!seenDates[r.date]) {
            seenDates[r.date] = { date: r.date, day: r.day, dateObj: r.dateObj, shifts: [] };
            groupedByDate.push(seenDates[r.date]);
        }
        seenDates[r.date].shifts.push(r);
    });
    // Sort each group: office first, bidding second
    groupedByDate.forEach(g => g.shifts.sort((a, b) => (a.type === 'bidding') - (b.type === 'bidding')));

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
                            <tr>
                                <th>Day</th>
                                <th>Date</th>
                                <th>Shift</th>
                                <th>Time In</th>
                                <th>Time Out</th>
                                <th>Hours</th>
                                <th>OT</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedByDate.length === 0 ? (
                                <tr><td colSpan={7}><div className="empty-state"><p>No attendance records</p></div></td></tr>
                            ) : groupedByDate.map(group => (
                                group.shifts.map((shift, idx) => (
                                    <tr key={shift.id} style={{
                                        borderTop: idx === 0 ? '2px solid var(--border-color)' : undefined
                                    }}>
                                        {/* Day and Date only on the first shift row */}
                                        {idx === 0 && (
                                            <>
                                                <td
                                                    rowSpan={group.shifts.length}
                                                    style={{ fontWeight: 700, verticalAlign: 'middle', color: 'var(--gray-700)' }}
                                                >
                                                    {group.day}
                                                </td>
                                                <td
                                                    rowSpan={group.shifts.length}
                                                    style={{ verticalAlign: 'middle', color: 'var(--gray-600)' }}
                                                >
                                                    {group.date}
                                                </td>
                                            </>
                                        )}
                                        {/* Shift type badge */}
                                        <td>
                                            {shift.type === 'bidding' ? (
                                                <span className="badge" style={{
                                                    background: 'var(--blue-100)', color: 'var(--blue-700)',
                                                    fontSize: '0.73rem', display: 'inline-flex', alignItems: 'center', gap: 4
                                                }}>Bidding</span>
                                            ) : (
                                                <span className="badge badge-success" style={{ fontSize: '0.73rem' }}>Office</span>
                                            )}
                                        </td>
                                        <td><span className="badge badge-success">{shift.timeIn}</span></td>
                                        <td><span className={`badge ${shift.timeOut === 'Active' ? 'badge-warning' : 'badge-info'}`}>{shift.timeOut}</span></td>
                                        <td>{shift.totalHours > 0 ? `${shift.totalHours.toFixed(1)}h` : '—'}</td>
                                        <td style={{ color: shift.totalHours > 11 ? 'var(--yellow-700)' : 'inherit', fontWeight: shift.totalHours > 11 ? 600 : 400 }}>{shift.totalHours > 11 ? `${(shift.totalHours - 11).toFixed(1)}h` : '—'}</td>
                                        <td>
                                            <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Lock size={11} /> Locked
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
