import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { BarChart3, Download, Filter, ChevronDown, ChevronRight, Sunrise, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

export default function Reports() {
    const [reportType, setReportType] = useState('daily');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [reportData, setReportData] = useState([]);
    const [departmentData, setDepartmentData] = useState({});
    const [daysPresent, setDaysPresent] = useState({});
    const [expandedEmployee, setExpandedEmployee] = useState(null);
    const [earlyBirdsData, setEarlyBirdsData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    useEffect(() => {
        const today = new Date();
        const from = new Date(today);
        if (reportType === 'daily') {
            setDateFrom(today.toISOString().split('T')[0]);
            setDateTo(today.toISOString().split('T')[0]);
        } else if (reportType === 'weekly') {
            from.setDate(from.getDate() - 7);
            setDateFrom(from.toISOString().split('T')[0]);
            setDateTo(today.toISOString().split('T')[0]);
        } else {
            from.setDate(1);
            setDateFrom(from.toISOString().split('T')[0]);
            setDateTo(today.toISOString().split('T')[0]);
        }
    }, [reportType]);

    useEffect(() => {
        if (dateFrom && dateTo && initialLoad) {
            generateReport();
            setInitialLoad(false);
        }
    }, [dateFrom, dateTo, initialLoad]);

    async function generateReport() {
        setLoading(true);
        try {
            const from = new Date(dateFrom + 'T00:00:00');
            from.setHours(0, 0, 0, 0);
            const to = new Date(dateTo + 'T00:00:00');
            to.setHours(23, 59, 59, 999);

            const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'employee')));
            const usersMap = {};
            usersSnap.forEach(d => { usersMap[d.id] = d.data(); });

            const attSnap = await getDocs(
                query(collection(db, 'attendance'),
                    where('date', '>=', Timestamp.fromDate(from)),
                    where('date', '<=', Timestamp.fromDate(to)))
            );

            const records = [];
            const deptCount = {};
            const daysPerEmployee = {};
            const earlyBirds = {};
            attSnap.forEach(d => {
                const data = d.data();
                const emp = usersMap[data.userId];
                if (!emp) return; // skip if user was deleted
                records.push({
                    id: d.id,
                    name: emp.name,
                    department: emp.department || '—',
                    date: data.date?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '—',
                    timeIn: data.timeIn?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    timeOut: data.timeOut?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—',
                    totalHours: data.totalHours?.toFixed(1) || '0'
                });
                const dept = emp?.department || 'Other';
                deptCount[dept] = (deptCount[dept] || 0) + 1;

                // Count days present per employee
                const uid = data.userId;
                if (!daysPerEmployee[uid]) {
                    daysPerEmployee[uid] = { name: emp?.name || 'Unknown', days: 0 };
                }
                daysPerEmployee[uid].days += 1;

                // Early bird detection (before 8:30 AM)
                const WORK_HOUR = 8, WORK_MINUTE = 30;
                if (data.timeIn) {
                    const timeInDate = data.timeIn.toDate?.() || new Date(data.timeIn);
                    const h = timeInDate.getHours();
                    const m = timeInDate.getMinutes();
                    const isEarly = h < WORK_HOUR || (h === WORK_HOUR && m < WORK_MINUTE);
                    if (isEarly) {
                        const minsEarly = (WORK_HOUR * 60 + WORK_MINUTE) - (h * 60 + m);
                        if (!earlyBirds[uid]) {
                            earlyBirds[uid] = { name: emp?.name || 'Unknown', department: emp?.department || '—', earlyDays: 0, totalMinsEarly: 0, earliestTime: timeInDate };
                        }
                        earlyBirds[uid].earlyDays += 1;
                        earlyBirds[uid].totalMinsEarly += minsEarly;
                        if (timeInDate < earlyBirds[uid].earliestTime) earlyBirds[uid].earliestTime = timeInDate;
                    }
                }
            });

            records.sort((a, b) => a.date > b.date ? -1 : 1);
            setReportData(records);
            setDepartmentData(deptCount);
            setDaysPresent(daysPerEmployee);

            // Build sorted early birds list
            const earlyList = Object.values(earlyBirds).map(e => ({
                ...e,
                avgMinsEarly: Math.round(e.totalMinsEarly / e.earlyDays),
                earliestTimeStr: e.earliestTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })).sort((a, b) => b.earlyDays - a.earlyDays);
            setEarlyBirdsData(earlyList);
        } catch (err) {
            console.error('Report error:', err);
        }
        setLoading(false);
    }

    function exportCSV() {
        if (reportData.length === 0) return;
        const headers = 'Name,Department,Date,Time In,Time Out,Total Hours\n';
        const rows = reportData.map(r => `${r.name},${r.department},${r.date},${r.timeIn},${r.timeOut},${r.totalHours}`).join('\n');
        const blob = new Blob([headers + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_report_${dateFrom}_${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportEarlyBirdsCSV() {
        if (earlyBirdsData.length === 0) return;
        const headers = 'Name,Department,Early Days,Avg Mins Early,Earliest Arrival\n';
        const rows = earlyBirdsData.map(r =>
            `${r.name},${r.department},${r.earlyDays},${r.avgMinsEarly},${r.earliestTimeStr}`
        ).join('\n');
        const blob = new Blob([headers + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `early_birds_report_${dateFrom}_${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportPDF() {
        if (reportData.length === 0) return;
        const doc = new jsPDF();

        // ── Section 1: Attendance Report ──
        doc.setFontSize(18);
        doc.setTextColor(22, 101, 52);
        doc.text('Attendance Report', 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Period: ${dateFrom}  to  ${dateTo}`, 14, 28);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);

        const attendanceData = reportData.map(r => [r.name, r.department, r.date, r.timeIn, r.timeOut, `${r.totalHours}h`]);
        autoTable(doc, {
            startY: 42,
            head: [['Name', 'Department', 'Date', 'Time In', 'Time Out', 'Total Hours']],
            body: attendanceData,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            styles: { fontSize: 9 }
        });

        // ── Section 2: Early Birds Summary ──
        if (earlyBirdsData.length > 0) {
            const afterAttendanceY = doc.lastAutoTable.finalY + 14;
            doc.setFontSize(14);
            doc.setTextColor(22, 101, 52);
            doc.text('🌅  Early Birds Summary', 14, afterAttendanceY);
            doc.setFontSize(9);
            doc.setTextColor(120);
            doc.text('Official start time: 8:30 AM', 14, afterAttendanceY + 6);

            const earlyData = earlyBirdsData.map((r, i) => [
                `#${i + 1}`,
                r.name,
                r.department,
                `${r.earlyDays} day${r.earlyDays !== 1 ? 's' : ''}`,
                r.avgMinsEarly >= 60 ? `${Math.floor(r.avgMinsEarly / 60)}h ${r.avgMinsEarly % 60}m` : `${r.avgMinsEarly}m`,
                r.earliestTimeStr,
                r.earlyDays >= 5 ? 'Consistent' : r.earlyDays >= 3 ? 'Regular' : 'Occasional'
            ]);
            autoTable(doc, {
                startY: afterAttendanceY + 10,
                head: [['#', 'Name', 'Department', 'Early Days', 'Avg Early', 'Earliest', 'Status']],
                body: earlyData,
                theme: 'grid',
                headStyles: { fillColor: [234, 179, 8], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [254, 252, 232] },
                styles: { fontSize: 9 }
            });
        }

        doc.save(`attendance_report_${dateFrom}_${dateTo}.pdf`);
    }

    function exportEarlyBirdsPDF() {
        if (earlyBirdsData.length === 0) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setTextColor(22, 101, 52);
        doc.text('Early Birds Summary', 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Period: ${dateFrom}  to  ${dateTo}`, 14, 28);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);
        const tableData = earlyBirdsData.map((r, i) => [
            `#${i + 1}`,
            r.name,
            r.department,
            `${r.earlyDays} day${r.earlyDays !== 1 ? 's' : ''}`,
            r.avgMinsEarly >= 60 ? `${Math.floor(r.avgMinsEarly / 60)}h ${r.avgMinsEarly % 60}m` : `${r.avgMinsEarly}m`,
            r.earliestTimeStr,
            r.earlyDays >= 5 ? 'Consistent Early Bird' : r.earlyDays >= 3 ? 'Regular Early Bird' : 'Occasional'
        ]);
        autoTable(doc, {
            startY: 42,
            head: [['#', 'Name', 'Department', 'Early Days', 'Avg Early', 'Earliest Time', 'Status']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            styles: { fontSize: 9 }
        });
        doc.save(`early_birds_report_${dateFrom}_${dateTo}.pdf`);
    }

    const deptChartData = {
        labels: Object.keys(departmentData),
        datasets: [{
            data: Object.values(departmentData),
            backgroundColor: ['#22c55e', '#eab308', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899'],
            borderWidth: 0,
            borderRadius: 4,
        }]
    };

    const daysPresentEntries = Object.values(daysPresent).sort((a, b) => b.days - a.days).slice(0, 20);
    const daysPresentChartData = {
        labels: daysPresentEntries.map(e => e.name.split(' ')[0]),
        datasets: [{
            label: 'Days Present',
            data: daysPresentEntries.map(e => e.days),
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderRadius: 6,
        }]
    };

    return (
        <div>
            <div className="section-header">
                <div>
                    <h1 className="page-title"><BarChart3 size={28} /> Reports & Analytics</h1>
                    <p className="page-subtitle">Generate attendance reports and view analytics</p>
                </div>
            </div>

            <div className="content-card" style={{ marginBottom: 24 }}>
                <div className="card-body">
                    <div className="filters-bar">
                        {['daily', 'weekly', 'monthly'].map(t => (
                            <button
                                key={t}
                                className={`btn btn-sm ${reportType === t ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setReportType(t)}
                            >
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Filter size={16} style={{ color: 'var(--gray-400)' }} />
                            <input type="date" className="filter-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                            <span style={{ color: 'var(--gray-400)' }}>to</span>
                            <input type="date" className="filter-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={generateReport} disabled={loading}>
                            {loading ? 'Generating...' : 'Generate Analytics'}
                        </button>
                        {reportData.length > 0 && (
                            <>
                                <button className="btn btn-accent btn-sm" onClick={exportCSV}>
                                    <Download size={14} /> Export CSV
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={exportPDF} style={{ borderColor: '#dc2626', color: '#dc2626' }}>
                                    <FileText size={14} /> Export PDF
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {reportData.length > 0 && (
                <>
                    <div className="charts-grid">
                        <div className="content-card">
                            <div className="card-header"><h3>Days Present by Employee</h3></div>
                            <div className="chart-container">
                                <Bar data={daysPresentChartData} options={{
                                    responsive: true, maintainAspectRatio: false,
                                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} day(s)` } } },
                                    scales: {
                                        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } },
                                        x: { grid: { display: false } }
                                    }
                                }} />
                            </div>
                        </div>
                        <div className="content-card">
                            <div className="card-header"><h3>Attendance by Department</h3></div>
                            <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Doughnut data={deptChartData} options={{
                                    responsive: true, maintainAspectRatio: false,
                                    plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } }
                                }} />
                            </div>
                        </div>
                    </div>

                    <div className="content-card">
                        <div className="card-header">
                            <h3>Detailed Records</h3>
                            <span className="badge badge-success">{Object.keys((() => { const g = {}; reportData.forEach(r => { if (!g[r.name]) g[r.name] = []; g[r.name].push(r); }); return g; })()).length} employees</span>
                        </div>
                        <div className="card-body-flush">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 32 }}></th>
                                        <th>Employee</th>
                                        <th>Department</th>
                                        <th>Days Present</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const grouped = {};
                                        reportData.forEach(r => {
                                            if (!grouped[r.name]) grouped[r.name] = { department: r.department, records: [] };
                                            grouped[r.name].records.push(r);
                                        });
                                        return Object.entries(grouped).map(([name, { department, records }]) => (
                                            <>
                                                <tr
                                                    key={name}
                                                    onClick={() => setExpandedEmployee(expandedEmployee === name ? null : name)}
                                                    style={{ cursor: 'pointer', backgroundColor: expandedEmployee === name ? 'var(--green-50)' : undefined, transition: 'background-color 0.15s ease' }}
                                                >
                                                    <td style={{ color: 'var(--primary)' }}>
                                                        {expandedEmployee === name ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </td>
                                                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{name}</td>
                                                    <td>{department}</td>
                                                    <td><span className="badge badge-info">{records.length} day{records.length !== 1 ? 's' : ''}</span></td>
                                                </tr>
                                                {expandedEmployee === name && records.map(r => (
                                                    <tr key={r.id} style={{ backgroundColor: 'var(--gray-50)' }}>
                                                        <td></td>
                                                        <td style={{ paddingLeft: 24, fontSize: 13, color: 'var(--gray-600)' }}>{r.date}</td>
                                                        <td><span className="badge badge-success" style={{ fontSize: 12 }}>{r.timeIn}</span></td>
                                                        <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span className="badge badge-warning" style={{ fontSize: 12 }}>{r.timeOut}</span>
                                                            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{r.totalHours}h</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* Early Birds Summary */}
                    <div className="content-card" style={{ marginTop: 24 }}>
                        <div className="card-header">
                            <h3><Sunrise size={18} /> Early Birds Summary</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Official start: 8:30 AM</span>
                                {earlyBirdsData.length > 0 && (
                                    <>
                                        <button className="btn btn-accent btn-sm" onClick={exportEarlyBirdsCSV}>
                                            <Download size={14} /> Export CSV
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={exportEarlyBirdsPDF} style={{ borderColor: '#dc2626', color: '#dc2626' }}>
                                            <FileText size={14} /> Export PDF
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="card-body-flush">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Employee</th>
                                        <th>Department</th>
                                        <th>Early Days</th>
                                        <th>Avg Minutes Early</th>
                                        <th>Earliest Arrival</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {earlyBirdsData.length === 0 ? (
                                        <tr><td colSpan={7}><div className="empty-state"><p>No early arrivals in this period</p></div></td></tr>
                                    ) : (
                                        earlyBirdsData.map((r, i) => (
                                            <tr key={r.name}>
                                                <td style={{ color: 'var(--gray-400)', fontWeight: 600 }}>#{i + 1}</td>
                                                <td style={{ fontWeight: 600 }}>{r.name}</td>
                                                <td>{r.department}</td>
                                                <td><span className="badge badge-info">{r.earlyDays} day{r.earlyDays !== 1 ? 's' : ''}</span></td>
                                                <td style={{ color: 'var(--green-600)', fontWeight: 600 }}>
                                                    {r.avgMinsEarly >= 60
                                                        ? `${Math.floor(r.avgMinsEarly / 60)}h ${r.avgMinsEarly % 60}m`
                                                        : `${r.avgMinsEarly}m`}
                                                </td>
                                                <td><span className="badge badge-success">{r.earliestTimeStr}</span></td>
                                                <td>
                                                    {r.earlyDays >= 5
                                                        ? <span className="badge badge-success">🌟 Consistent Early Bird</span>
                                                        : r.earlyDays >= 3
                                                            ? <span className="badge badge-info">🌱 Regular Early Bird</span>
                                                            : <span className="badge badge-warning">⏰ Occasional</span>}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {reportData.length === 0 && !loading && (
                <div className="content-card">
                    <div className="empty-state">
                        <BarChart3 size={48} />
                        <p>Select a date range and click "Generate Analytics" to view analytics</p>
                    </div>
                </div>
            )}
        </div>
    );
}
