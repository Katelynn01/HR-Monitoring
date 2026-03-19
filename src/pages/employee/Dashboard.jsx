import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { Sprout, Clock, CalendarCheck, TreePine } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';
import AnnouncementsHolidays from '../../components/AnnouncementsHolidays';
import AnnouncementPopup from '../../components/AnnouncementPopup';

export default function EmployeeDashboard() {
    const { user, userProfile } = useAuth();
    const [stats, setStats] = useState({ totalDays: 0, totalHours: 0, todayStatus: 'Not Clocked In' });
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
            const records = [];
            attSnap.forEach(d => {
                const data = d.data();
                totalHours += data.totalHours || 0;
                records.push({
                    id: d.id,
                    date: data.date?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '—',
                    timeIn: data.timeIn?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    timeOut: data.timeOut?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Active',
                    totalHours: data.totalHours?.toFixed(1) || '—',
                    dateObj: data.date?.toDate?.() || new Date(0)
                });
            });
            records.sort((a, b) => b.dateObj - a.dateObj);

            // Check today status
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayRecord = records.find(r => {
                const rd = r.dateObj;
                return rd.toDateString() === today.toDateString();
            });

            setStats({
                totalDays: attSnap.size,
                totalHours: totalHours.toFixed(1),
                todayStatus: todayRecord ? (todayRecord.timeOut === 'Active' ? 'Clocked In' : 'Completed') : 'Not Clocked In'
            });
            setRecentRecords(records.slice(0, 5));
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
                            <tr><th>Date</th><th>Time In</th><th>Time Out</th><th>Hours</th></tr>
                        </thead>
                        <tbody>
                            {recentRecords.length === 0 ? (
                                <tr><td colSpan={4}><div className="empty-state"><p>No attendance records yet</p></div></td></tr>
                            ) : recentRecords.map(r => (
                                <tr key={r.id}>
                                    <td style={{ fontWeight: 600 }}>{r.date}</td>
                                    <td><span className="badge badge-success">{r.timeIn}</span></td>
                                    <td><span className={`badge ${r.timeOut === 'Active' ? 'badge-warning' : 'badge-info'}`}>{r.timeOut}</span></td>
                                    <td>{r.totalHours}h</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
