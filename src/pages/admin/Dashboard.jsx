import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, getDocs, where, Timestamp } from 'firebase/firestore';
import { Users, UserCheck, Clock, CalendarOff, TrendingUp, Sprout, Sunrise, PartyPopper, X } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';
import AnnouncementsHolidays from '../../components/AnnouncementsHolidays';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalEmployees: 0,
        presentToday: 0,
        onLeave: 0,
        pendingRequests: 0
    });
    const [weeklyData, setWeeklyData] = useState({ labels: [], present: [], absent: [] });
    const [recentAttendance, setRecentAttendance] = useState([]);
    const [earlyArrivals, setEarlyArrivals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAllPresentPopup, setShowAllPresentPopup] = useState(false);
    const allPresentShownRef = useRef(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    async function fetchDashboardData() {
        try {
            // Get total employees
            const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'employee')));
            const totalEmployees = usersSnap.size;

            // Get today's attendance
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStart = Timestamp.fromDate(today);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStart = Timestamp.fromDate(tomorrow);

            const attendanceSnap = await getDocs(
                query(collection(db, 'attendance'),
                    where('date', '>=', todayStart),
                    where('date', '<', tomorrowStart))
            );
            const presentToday = attendanceSnap.size;

            // Get pending leave requests
            const leaveSnap = await getDocs(
                query(collection(db, 'leaveRequests'), where('status', '==', 'pending'))
            );
            const pendingRequests = leaveSnap.size;

            // Get current leaves
            const approvedLeaves = await getDocs(
                query(collection(db, 'leaveRequests'), where('status', '==', 'approved'))
            );
            let onLeave = 0;
            const now = new Date();
            approvedLeaves.forEach((doc) => {
                const data = doc.data();
                const start = data.startDate?.toDate?.() || new Date(data.startDate);
                const end = data.endDate?.toDate?.() || new Date(data.endDate);
                if (now >= start && now <= end) onLeave++;
            });

            setStats({ totalEmployees, presentToday, onLeave, pendingRequests });

            // Show popup if all employees are present
            if (totalEmployees > 0 && presentToday >= totalEmployees && !allPresentShownRef.current) {
                allPresentShownRef.current = true;
                setShowAllPresentPopup(true);
            }

            // Build weekly data
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
            const present = [0, 0, 0, 0, 0];
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            const weekAttendance = await getDocs(
                query(collection(db, 'attendance'),
                    where('date', '>=', Timestamp.fromDate(weekStart)),
                    where('date', '<', Timestamp.fromDate(weekEnd)))
            );

            weekAttendance.forEach((doc) => {
                const data = doc.data();
                const d = data.date?.toDate?.() || new Date(data.date);
                const dayIndex = (d.getDay() + 6) % 7;
                if (dayIndex < 7) present[dayIndex]++;
            });

            setWeeklyData({ labels: days, present, absent: present.map(p => Math.max(0, totalEmployees - p)) });

            // Recent attendance (Only Present Activity / Today)
            const recentSnap = await getDocs(
                query(collection(db, 'attendance'),
                    where('date', '>=', todayStart),
                    where('date', '<', tomorrowStart))
            );

            const usersMap = {};
            usersSnap.forEach(d => { usersMap[d.id] = d.data().name; });

            const recent = [];
            recentSnap.forEach(d => {
                const data = d.data();
                if (!usersMap[data.userId]) return; // skip deleted accounts
                recent.push({
                    id: d.id,
                    name: usersMap[data.userId] || 'Unknown',
                    date: data.date?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '—',
                    timeIn: data.timeIn?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    timeOut: data.timeOut?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    totalHours: data.totalHours?.toFixed(1) || '—'
                });
            });
            // Sort to show the latest activity first
            recent.sort((a, b) => {
                const aTime = a.timeIn === '—' ? '' : a.timeIn;
                const bTime = b.timeIn === '—' ? '' : b.timeIn;
                return bTime > aTime ? 1 : -1;
            });
            setRecentAttendance(recent.slice(0, 10));

            // Identify early arrivals (clocked in before 8:30 AM)
            const WORK_HOUR = 8;
            const WORK_MINUTE = 30;
            const earlyList = [];
            recentSnap.forEach(d => {
                const data = d.data();
                if (!data.timeIn) return;
                if (!usersMap[data.userId]) return; // skip deleted accounts
                const timeIn = data.timeIn.toDate?.() || new Date(data.timeIn);
                const h = timeIn.getHours();
                const m = timeIn.getMinutes();
                const isEarly = h < WORK_HOUR || (h === WORK_HOUR && m < WORK_MINUTE);
                if (isEarly) {
                    const minutesEarly = (WORK_HOUR * 60 + WORK_MINUTE) - (h * 60 + m);
                    earlyList.push({
                        id: d.id,
                        name: usersMap[data.userId] || 'Unknown',
                        timeIn: timeIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        minutesEarly
                    });
                }
            });
            earlyList.sort((a, b) => a.minutesEarly - b.minutesEarly);
            setEarlyArrivals(earlyList);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        }
        setLoading(false);
    }

    const chartData = {
        labels: weeklyData.labels,
        datasets: [
            {
                label: 'Present',
                data: weeklyData.present,
                borderColor: 'rgba(34, 197, 94, 1)',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                tension: 0.3,
                borderWidth: 3,
                pointBackgroundColor: 'rgba(34, 197, 94, 1)',
                fill: true
            },
            {
                label: 'Absent',
                data: weeklyData.absent,
                borderColor: 'rgba(234, 179, 8, 1)',
                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                tension: 0.3,
                borderWidth: 3,
                pointBackgroundColor: 'rgba(234, 179, 8, 1)',
                fill: true
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, padding: 20, font: { family: 'Inter' } } },
            title: { display: false }
        },
        scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Inter' } }, grid: { color: 'rgba(0,0,0,0.04)' } },
            x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }
        }
    };

    if (loading) return <LoadingScreen message="Loading dashboard..." />;

    return (
        <div>
            {/* All Employees Present Popup */}
            {showAllPresentPopup && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, animation: 'fadeIn 0.25s ease'
                }}>
                    <div style={{
                        background: '#fff', borderRadius: 20, padding: '40px 36px',
                        width: '90%', maxWidth: 440, textAlign: 'center',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
                        position: 'relative', animation: 'slideUp 0.3s ease'
                    }}>
                        <button
                            onClick={() => setShowAllPresentPopup(false)}
                            style={{
                                position: 'absolute', top: 14, right: 14,
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--gray-400)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <X size={20} />
                        </button>
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(34,197,94,0.35)'
                        }}>
                            <PartyPopper size={34} color="#fff" />
                        </div>
                        <h2 style={{ margin: '0 0 10px', fontSize: '1.5rem', color: '#1a2e1a', fontWeight: 700 }}>
                            Full House! 🎉
                        </h2>
                        <p style={{ color: '#4b5563', fontSize: '0.95rem', margin: '0 0 8px', lineHeight: 1.6 }}>
                            All <strong style={{ color: '#16a34a' }}>{stats.totalEmployees} employees</strong> are present today.
                        </p>
                        <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginBottom: 28 }}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowAllPresentPopup(false)}
                            style={{ minWidth: 140 }}
                        >
                            Awesome!
                        </button>
                    </div>
                    <style>{`
                        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                        @keyframes slideUp { from { transform: translateY(30px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
                    `}</style>
                </div>
            )}
            <div className="section-header">
                <div>
                    <h1 className="page-title"><Sprout size={28} /> HR Dashboard</h1>
                    <p className="page-subtitle">Overview of attendance and employee activity</p>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon green"><Users size={24} /></div>
                        <span className="stat-card-change positive">Active</span>
                    </div>
                    <div className="stat-card-value">{stats.totalEmployees}</div>
                    <div className="stat-card-label">Total Employees</div>
                </div>
                <div
                    className="stat-card clickable"
                    onClick={() => navigate('/admin/attendance')}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                >
                    <div className="stat-card-header">
                        <div className="stat-card-icon yellow"><UserCheck size={24} /></div>
                        <span className="stat-card-change positive">Today</span>
                    </div>
                    <div className="stat-card-value">{stats.presentToday}</div>
                    <div className="stat-card-label">Present Today</div>
                </div>
                <div
                    className="stat-card clickable"
                    onClick={() => navigate('/admin/leave-requests')}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                >
                    <div className="stat-card-header">
                        <div className="stat-card-icon blue"><CalendarOff size={24} /></div>
                    </div>
                    <div className="stat-card-value">{stats.onLeave}</div>
                    <div className="stat-card-label">On Leave</div>
                </div>
                <div
                    className="stat-card clickable"
                    onClick={() => navigate('/admin/leave-requests')}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                >
                    <div className="stat-card-header">
                        <div className="stat-card-icon orange"><Clock size={24} /></div>
                        {stats.pendingRequests > 0 && <span className="stat-card-change negative">{stats.pendingRequests} new</span>}
                    </div>
                    <div className="stat-card-value">{stats.pendingRequests}</div>
                    <div className="stat-card-label">Pending Requests</div>
                </div>
            </div>

            <div className="charts-grid">
                <div className="content-card">
                    <div className="card-header">
                        <h3><TrendingUp size={18} /> Weekly Attendance</h3>
                    </div>
                    <div className="chart-container">
                        <Line data={chartData} options={chartOptions} />
                    </div>
                </div>

                <div className="content-card">
                    <div className="card-header">
                        <h3><Clock size={18} /> Recent Activity</h3>
                    </div>
                    <div className="card-body-flush">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Date</th>
                                    <th>In</th>
                                    <th>Out</th>
                                    <th>Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentAttendance.length === 0 ? (
                                    <tr><td colSpan={5}><div className="empty-state"><p>No attendance records yet</p></div></td></tr>
                                ) : (
                                    recentAttendance.map((r) => (
                                        <tr key={r.id}>
                                            <td style={{ fontWeight: 600 }}>{r.name}</td>
                                            <td>{r.date}</td>
                                            <td><span className="badge badge-success">{r.timeIn}</span></td>
                                            <td><span className="badge badge-warning">{r.timeOut}</span></td>
                                            <td>{r.totalHours}h</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Announcements & Holidays */}
            <AnnouncementsHolidays isAdmin />

            {/* Early Arrivals */}
            <div className="content-card" style={{ marginTop: 24 }}>
                <div className="card-header">
                    <h3><Sunrise size={18} /> Early Arrivals Today</h3>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Official start: 8:30 AM</span>
                </div>
                <div className="card-body-flush">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Time In</th>
                                <th>Early By</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {earlyArrivals.length === 0 ? (
                                <tr><td colSpan={4}><div className="empty-state"><p>No early arrivals recorded today</p></div></td></tr>
                            ) : (
                                earlyArrivals.map(r => (
                                    <tr key={r.id}>
                                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                                        <td><span className="badge badge-success">{r.timeIn}</span></td>
                                        <td style={{ color: 'var(--green-600)', fontWeight: 600 }}>
                                            {r.minutesEarly >= 60
                                                ? `${Math.floor(r.minutesEarly / 60)}h ${r.minutesEarly % 60}m early`
                                                : `${r.minutesEarly}m early`}
                                        </td>
                                        <td><span className="badge badge-success">Early Bird 🌱</span></td>
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
