import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { Sprout, Clock, CalendarCheck, TreePine, TrendingUp } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';
import AnnouncementsHolidays from '../../components/AnnouncementsHolidays';
import AnnouncementPopup from '../../components/AnnouncementPopup';

export default function EmployeeDashboard() {
    const { user, userProfile } = useAuth();
    const [stats, setStats] = useState({ totalDays: 0, totalHours: 0, totalOT: 0, todayStatus: 'Not Clocked In' });
    const [recentRecords, setRecentRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    async function fetchData() {
        try {
            const attSnap = await getDocs(
                query(collection(db, 'attendance'), where('userId', '==', user.uid))
            );
            let totalHours = 0;
            let totalOT = 0;
            const records = [];
            attSnap.forEach(d => {
                const data = d.data();
                const th = data.totalHours || 0;
                totalHours += th;
                if (th > 11) totalOT += (th - 11);
                records.push({
                    id: d.id,
                    type: data.type || 'regular',
                    date: data.date?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '—',
                    timeIn: data.timeIn?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    timeOut: data.timeOut === 'Active'
                        ? 'Active'
                        : data.timeOut?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    totalHours: data.totalHours != null ? parseFloat(data.totalHours) : 0,
                    dateObj: data.date?.toDate?.() || new Date(0)
                });
            });
            records.sort((a, b) => b.dateObj - a.dateObj);

            // Check today status
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const todayRecord = records.find(r => {
                const rd = r.dateObj;
                return rd.toDateString() === today.toDateString();
            });

            // Check if assigned to bidding event today
            const biddingSnap = await getDocs(
                query(collection(db, 'biddingEvents'),
                    where('date', '>=', Timestamp.fromDate(today)),
                    where('date', '<', Timestamp.fromDate(tomorrow))
                )
            );
            const isAssignedBidding = biddingSnap.docs.some(doc => 
                doc.data().assignedEmployees?.includes(user.uid)
            );

            let currentStatus = 'Not Clocked In';
            if (isAssignedBidding) {
                currentStatus = 'Assigned to Bidding';
            }
            if (todayRecord) {
                if (todayRecord.timeOut === 'Active') {
                    currentStatus = todayRecord.type === 'bidding' ? 'On Bidding' : 'Clocked In';
                } else {
                    currentStatus = todayRecord.type === 'bidding' ? 'Bidding Completed' : 'Completed';
                }
            }

            const uniqueDays = new Set(records.map(r => r.dateObj.toDateString())).size;

            setStats({
                totalDays: uniqueDays,
                totalHours: totalHours.toFixed(1),
                totalOT: totalOT.toFixed(1),
                todayStatus: currentStatus
            });
            // Group by date, take last 5 unique days
            const dateGroups = {};
            records.forEach(r => {
                if (!dateGroups[r.date]) dateGroups[r.date] = { date: r.date, dateObj: r.dateObj, shifts: [] };
                dateGroups[r.date].shifts.push(r);
            });
            Object.values(dateGroups).forEach(g =>
                g.shifts.sort((a, b) => (a.type === 'bidding') - (b.type === 'bidding'))
            );
            const recentGroups = Object.values(dateGroups)
                .sort((a, b) => b.dateObj - a.dateObj)
                .slice(0, 5);
            setRecentRecords(recentGroups);
        } catch (err) {
            console.error('Error:', err);
        }
        setLoading(false);
    }

    if (loading) return <LoadingScreen message="Loading dashboard..." />;

    const credits = userProfile?.leaveCredits || { vacation: 15, sick: 10, personal: 5 };

    return (
        <div>
            <AnnouncementPopup />
            <div className="section-header">
                <div>
                    <h1 className="page-title"><Sprout size={28} /> My Dashboard</h1>
                    <p className="page-subtitle">Your personal attendance overview</p>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon green"><Clock size={24} /></div>
                        <span className={`stat-card-change ${stats.todayStatus === 'Clocked In' ? 'positive' : ''}`}>
                            {stats.todayStatus}
                        </span>
                    </div>
                    <div className="stat-card-value">{stats.totalHours}</div>
                    <div className="stat-card-label">Total Hours Worked</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon orange"><TrendingUp size={24} /></div>
                    </div>
                    <div className="stat-card-value">{stats.totalOT}</div>
                    <div className="stat-card-label">Total OT Hours</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon yellow"><CalendarCheck size={24} /></div>
                    </div>
                    <div className="stat-card-value">{stats.totalDays}</div>
                    <div className="stat-card-label">Days Attended</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon blue"><TreePine size={24} /></div>
                    </div>
                    <div className="stat-card-value">{credits.vacation + credits.sick + credits.personal}</div>
                    <div className="stat-card-label">Total Leave Credits</div>
                </div>
            </div>

            <div className="leave-balances">
                <div className="leave-balance-card">
                    <div className="balance-icon"><TreePine size={24} /></div>
                    <div className="leave-balance-value">{credits.vacation}</div>
                    <div className="leave-balance-label">Vacation Leave</div>
                </div>
                <div className="leave-balance-card">
                    <div className="balance-icon"><Sprout size={24} /></div>
                    <div className="leave-balance-value">{credits.sick}</div>
                    <div className="leave-balance-label">Sick Leave</div>
                </div>
                <div className="leave-balance-card">
                    <div className="balance-icon"><CalendarCheck size={24} /></div>
                    <div className="leave-balance-value">{credits.personal}</div>
                    <div className="leave-balance-label">Personal Leave</div>
                </div>
            </div>

            <AnnouncementsHolidays />

            <div className="content-card" style={{ marginTop: 24 }}>
                <div className="card-header">
                    <h3><Clock size={18} /> Recent Attendance</h3>
                </div>
                <div className="card-body-flush">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Shift</th>
                                <th>Time In</th>
                                <th>Time Out</th>
                                <th>Hours</th>
                                <th>OT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentRecords.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty-state"><p>No attendance records yet</p></div></td></tr>
                            ) : recentRecords.map(group =>
                                group.shifts.map((shift, idx) => (
                                    <tr key={shift.id} style={{
                                        borderTop: idx === 0 ? '2px solid var(--border-color)' : undefined
                                    }}>
                                        {idx === 0 && (
                                            <td
                                                rowSpan={group.shifts.length}
                                                style={{ fontWeight: 600, verticalAlign: 'middle', color: 'var(--gray-700)' }}
                                            >
                                                {group.date}
                                            </td>
                                        )}
                                        <td>
                                            {shift.type === 'bidding' ? (
                                                <span className="badge" style={{
                                                    background: 'var(--blue-100)', color: 'var(--blue-700)',
                                                    fontSize: '0.73rem'
                                                }}>Bidding</span>
                                            ) : (
                                                <span className="badge badge-success" style={{ fontSize: '0.73rem' }}>Office</span>
                                            )}
                                        </td>
                                        <td><span className="badge badge-success">{shift.timeIn}</span></td>
                                        <td><span className={`badge ${shift.timeOut === 'Active' ? 'badge-warning' : 'badge-info'}`}>{shift.timeOut}</span></td>
                                        <td>{shift.totalHours > 0 ? `${shift.totalHours.toFixed(1)}h` : '—'}</td>
                                        <td>{shift.totalHours > 11 ? <span className="badge badge-warning" style={{color: 'var(--yellow-700)'}}>{(shift.totalHours - 11).toFixed(1)}h</span> : '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
