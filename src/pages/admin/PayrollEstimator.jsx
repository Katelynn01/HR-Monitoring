import { useState, useCallback, useEffect } from 'react';
import {
    Calculator,
    DollarSign,
    Clock,
    Sun,
    Star,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Info,
    TrendingUp,
    Banknote,
    CalendarDays,
    ListChecks,
    Wallet
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import LoadingScreen from '../../components/LoadingScreen';

const DAY_TYPES = [
    { value: 'regular', label: 'Regular Day', icon: '📅', color: 'var(--green-600)' },
    { value: 'restday', label: 'Rest Day / Day-off', icon: '🏖️', color: 'var(--info)' },
    { value: 'special', label: 'Special Holiday (Worked)', icon: '⭐', color: 'var(--accent-dark)' },
    { value: 'legal', label: 'Legal Holiday (Worked)', icon: '🏛️', color: 'var(--danger)' },
];

function fmt(num) {
    if (isNaN(num) || num === null || num === undefined) return '—';
    return `₱${Number(num).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcPayroll({ dailyRate, hoursWorked, overtimeHours, dayType }) {
    const dr = parseFloat(dailyRate) || 0;
    const hw = parseFloat(hoursWorked) || 0;
    const ot = parseFloat(overtimeHours) || 0;

    const result = {
        dayType, dailyRate: dr, hoursWorked: hw, overtimeHours: ot,
        basePay: 0, perHourRate: 0, holidayBonus: 0, otRate: 0, otPay: 0, totalPay: 0, breakdown: []
    };

    if (dr <= 0) return result;

    if (dayType === 'regular') {
        const perHour = dr / 8;
        const basePay = perHour * Math.min(hw, 8);
        const otRate = perHour * 1.25;
        const otPay = ot > 0 ? otRate * Math.max(ot, 1) : 0;
        const total = basePay + otPay;
        result.perHourRate = perHour; result.basePay = basePay;
        result.otRate = otRate; result.otPay = otPay; result.totalPay = total;
        result.breakdown = [
            { label: 'Per Hour Rate', value: fmt(perHour), note: 'Daily Rate ÷ 8 hrs' },
            { label: 'Base Pay', value: fmt(basePay), note: `${Math.min(hw, 8)} hrs × ${fmt(perHour)}` },
            ...(ot > 0 ? [
                { label: 'OT Rate (125%)', value: fmt(otRate), note: 'Per Hour × 125%' },
                { label: 'Overtime Pay', value: fmt(otPay), note: `${Math.max(ot, 1)} hrs × ${fmt(otRate)} (min. 1 hr)` },
            ] : []),
            { label: 'TOTAL', value: fmt(total), note: '', isTotal: true },
        ];
    }
    if (dayType === 'restday') {
        const perHour = dr / 8;
        const basePay = perHour * hw;
        const otRate = perHour * 1.25;
        const otPay = ot > 0 ? otRate * Math.max(ot, 1) : 0;
        const total = basePay + otPay;
        result.perHourRate = perHour; result.basePay = basePay;
        result.otRate = otRate; result.otPay = otPay; result.totalPay = total;
        result.breakdown = [
            { label: 'Rest Day Per Hour', value: fmt(perHour), note: 'Daily Rate ÷ 8 hrs' },
            { label: 'Base Pay', value: fmt(basePay), note: `${hw} hrs × ${fmt(perHour)}` },
            ...(ot > 0 ? [
                { label: 'OT Rate (125%)', value: fmt(otRate), note: 'Per Hour × 125%' },
                { label: 'Overtime Pay', value: fmt(otPay), note: `${Math.max(ot, 1)} hrs × ${fmt(otRate)} (min. 1 hr)` },
            ] : []),
            { label: 'TOTAL', value: fmt(total), note: '', isTotal: true },
        ];
    }
    if (dayType === 'special') {
        const specialDayRate = dr * 1.30;
        const perHour = specialDayRate / 8;
        const basePay = perHour * Math.min(hw, 8);
        const holidayBonus = dr * 0.30;
        const otRate = perHour * 1.30;
        const otPay = ot > 0 ? otRate * Math.max(ot, 1) : 0;
        const total = basePay + otPay;
        result.perHourRate = perHour; result.basePay = basePay;
        result.holidayBonus = holidayBonus; result.otRate = otRate; result.otPay = otPay; result.totalPay = total;
        result.breakdown = [
            { label: 'Special Holiday Rate (+30%)', value: fmt(specialDayRate), note: 'Daily Rate × 130%' },
            { label: 'Holiday Premium', value: fmt(holidayBonus), note: 'Daily Rate × 30%' },
            { label: 'Per Hour Rate', value: fmt(perHour), note: 'Special Rate ÷ 8 hrs' },
            { label: 'Base Pay', value: fmt(basePay), note: `${Math.min(hw, 8)} hrs × ${fmt(perHour)}` },
            ...(ot > 0 ? [
                { label: 'OT Rate (130%)', value: fmt(otRate), note: 'Special Per Hour × 130%' },
                { label: 'Overtime Pay', value: fmt(otPay), note: `${Math.max(ot, 1)} hrs × ${fmt(otRate)} (min. 1 hr)` },
            ] : []),
            { label: 'TOTAL', value: fmt(total), note: '', isTotal: true },
        ];
    }
    if (dayType === 'legal') {
        const legalDayRate = dr * 2.0;
        const perHour = legalDayRate / 8;
        const basePay = perHour * Math.min(hw, 8);
        const otRate = perHour * 1.30;
        const otPay = ot > 0 ? otRate * Math.max(ot, 1) : 0;
        const total = basePay + otPay;
        result.perHourRate = perHour; result.basePay = basePay;
        result.otRate = otRate; result.otPay = otPay; result.totalPay = total;
        result.breakdown = [
            { label: 'Legal Holiday Rate (200%)', value: fmt(legalDayRate), note: 'Daily Rate × 200%' },
            { label: 'Per Hour Rate', value: fmt(perHour), note: 'Legal Rate ÷ 8 hrs' },
            { label: 'Base Pay', value: fmt(basePay), note: `${Math.min(hw, 8)} hrs × ${fmt(perHour)}` },
            ...(ot > 0 ? [
                { label: 'OT Rate (130%)', value: fmt(otRate), note: 'Legal Per Hour × 130%' },
                { label: 'Overtime Pay', value: fmt(otPay), note: `${Math.max(ot, 1)} hrs × ${fmt(otRate)} (min. 1 hr)` },
            ] : []),
            { label: 'TOTAL', value: fmt(total), note: '', isTotal: true },
        ];
    }
    return result;
}

function RuleCard({ icon, title, children }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-100)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ flex: 1, fontWeight: 600, color: 'var(--gray-800)', fontSize: 15 }}>{title}</span>
                {open ? <ChevronUp size={16} color="var(--gray-400)" /> : <ChevronDown size={16} color="var(--gray-400)" />}
            </button>
            {open && (
                <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                    {children}
                </div>
            )}
        </div>
    );
}

function FormulaRow({ label, formula, highlight }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--gray-200)', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--gray-600)', fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 13, color: highlight ? 'var(--green-700)' : 'var(--gray-700)', fontWeight: highlight ? 700 : 400, textAlign: 'right', fontFamily: 'monospace', background: highlight ? 'var(--green-50)' : 'transparent', padding: highlight ? '2px 8px' : 0, borderRadius: 4 }}>{formula}</span>
        </div>
    );
}

// ── My Pay Summary (Employee only) ─────────────────────────────────────────
function MyPaySummary({ userId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dailyRate, setDailyRate] = useState(() => localStorage.getItem('pay_summary_daily_rate') || '');
    const [monthFilter, setMonthFilter] = useState('');

    useEffect(() => {
        async function fetchAttendance() {
            try {
                const snap = await getDocs(query(collection(db, 'attendance'), where('userId', '==', userId)));
                const list = [];
                snap.forEach(d => {
                    const data = d.data();
                    const dateObj = data.date?.toDate?.() || new Date(0);
                    list.push({
                        id: d.id,
                        dateObj,
                        month: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`,
                        monthLabel: dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                        date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
                        totalHours: data.totalHours != null ? parseFloat(data.totalHours) : 0,
                        type: data.type || 'regular',
                    });
                });
                list.sort((a, b) => b.dateObj - a.dateObj);
                setRecords(list);
            } catch (err) {
                console.error('Pay summary fetch error:', err);
            }
            setLoading(false);
        }
        if (userId) fetchAttendance();
    }, [userId]);

    const handleRateChange = (val) => {
        setDailyRate(val);
        if (val) localStorage.setItem('pay_summary_daily_rate', val);
        else localStorage.removeItem('pay_summary_daily_rate');
    };

    const months = [...new Set(records.map(r => r.month))].sort().reverse();
    const filtered = monthFilter ? records.filter(r => r.month === monthFilter) : records;
    const dr = parseFloat(dailyRate) || 0;
    const perHour = dr > 0 ? dr / 8 : 0;

    // Aggregate per unique date (a date might have multiple shifts)
    const byDate = {};
    filtered.forEach(r => {
        if (!byDate[r.date]) byDate[r.date] = { date: r.date, dayName: r.dayName, dateObj: r.dateObj, totalHours: 0 };
        byDate[r.date].totalHours += r.totalHours;
    });
    const days = Object.values(byDate).sort((a, b) => b.dateObj - a.dateObj);

    const totalHours = days.reduce((s, d) => s + d.totalHours, 0);
    const workingDays = days.length;
    // Estimated pay using regular rate: hours worked × (daily rate / 8)
    const estimatedPay = perHour * totalHours;
    // Full-day equivalent
    const fullDayEquiv = totalHours / 8;

    if (loading) return <LoadingScreen message="Loading your attendance..." />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Input Row */}
            <div className="content-card">
                <div className="card-header">
                    <h3><Wallet size={18} /> My Pay Summary</h3>
                </div>
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ color: 'var(--gray-500)', fontSize: 14, margin: 0 }}>
                        Enter your <strong>daily rate</strong> and select a period to estimate your total pay based on your actual attendance hours.
                    </p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {/* Daily Rate */}
                        <div style={{ flex: '1 1 200px' }}>
                            <label style={{ display: 'block', fontWeight: 600, color: 'var(--gray-700)', fontSize: 13, marginBottom: 6 }}>
                                Your Daily Rate (₱)
                            </label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontWeight: 600 }}>₱</span>
                                <input
                                    id="summary-daily-rate"
                                    type="number" min="0" step="0.01" placeholder="e.g. 500.00"
                                    value={dailyRate}
                                    onChange={e => handleRateChange(e.target.value)}
                                    className="form-input"
                                    style={{ paddingLeft: 28 }}
                                />
                            </div>
                        </div>
                        {/* Month Filter */}
                        <div style={{ flex: '1 1 200px' }}>
                            <label style={{ display: 'block', fontWeight: 600, color: 'var(--gray-700)', fontSize: 13, marginBottom: 6 }}>
                                Period
                            </label>
                            <select
                                id="summary-month-filter"
                                className="form-input"
                                value={monthFilter}
                                onChange={e => setMonthFilter(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="">All Time</option>
                                {months.map(m => {
                                    const label = records.find(r => r.month === m)?.monthLabel || m;
                                    return <option key={m} value={m}>{label}</option>;
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Stat chips */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {[
                            { label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, icon: <Clock size={14} />, color: 'var(--green-600)', bg: 'var(--green-50)' },
                            { label: 'Days Worked', value: `${workingDays}d`, icon: <CalendarDays size={14} />, color: 'var(--info)', bg: 'var(--info-light)' },
                            { label: 'Full-Day Equiv.', value: `${fullDayEquiv.toFixed(1)} days`, icon: <ListChecks size={14} />, color: 'var(--accent-dark)', bg: 'var(--accent-light)' },
                        ].map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: s.bg, borderRadius: 8, padding: '8px 14px', border: `1.5px solid ${s.color}20` }}>
                                <span style={{ color: s.color }}>{s.icon}</span>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-800)' }}>{s.value}</div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{s.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Estimated Pay Hero */}
            <div style={{
                background: dr > 0 ? 'var(--gradient-primary)' : 'linear-gradient(135deg, var(--gray-600), var(--gray-500))',
                borderRadius: 'var(--radius-lg)', padding: '28px 28px',
                color: 'white', boxShadow: dr > 0 ? '0 8px 32px rgba(22,163,74,0.28)' : 'var(--shadow-md)',
                position: 'relative', overflow: 'hidden', transition: 'background 0.3s ease'
            }}>
                <div style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
                <div style={{ position: 'absolute', right: 50, bottom: -40, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 4 }}>
                    {monthFilter ? records.find(r => r.month === monthFilter)?.monthLabel : 'All Time'} — Estimated Gross Pay
                </div>
                <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.05 }}>
                    {dr > 0 ? fmt(estimatedPay) : <span style={{ fontSize: 22, opacity: 0.6 }}>Enter your daily rate above</span>}
                </div>
                {dr > 0 && (
                    <div style={{ fontSize: 13, opacity: 0.7, marginTop: 10 }}>
                        {totalHours.toFixed(1)}h &times; {fmt(perHour)}/hr &nbsp;·&nbsp; Based on regular rate (Daily ÷ 8)
                    </div>
                )}
            </div>

            {/* Per-Day Breakdown Table */}
            <div className="content-card">
                <div className="card-header">
                    <h3><ListChecks size={18} /> Daily Attendance Log</h3>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{days.length} day{days.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="card-body-flush">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Day</th>
                                <th>Date</th>
                                <th>Hours Worked</th>
                                <th style={{ textAlign: 'right' }}>Est. Pay (Regular)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {days.length === 0 ? (
                                <tr><td colSpan={4}><div className="empty-state"><p>No attendance records found</p></div></td></tr>
                            ) : (
                                days.map((d, i) => {
                                    const dayPay = perHour * d.totalHours;
                                    return (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 600, color: 'var(--gray-600)' }}>{d.dayName}</td>
                                            <td>{d.date}</td>
                                            <td>
                                                <span className="badge badge-success">{d.totalHours.toFixed(1)}h</span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color: dr > 0 ? 'var(--green-700)' : 'var(--gray-400)' }}>
                                                {dr > 0 ? fmt(dayPay) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {days.length > 0 && dr > 0 && (
                            <tfoot>
                                <tr style={{ background: 'var(--green-50)', fontWeight: 800 }}>
                                    <td colSpan={2} style={{ color: 'var(--green-700)', fontWeight: 700 }}>TOTAL</td>
                                    <td><span className="badge badge-success">{totalHours.toFixed(1)}h</span></td>
                                    <td style={{ textAlign: 'right', color: 'var(--green-700)', fontSize: 15 }}>{fmt(estimatedPay)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Note */}
            <div style={{ background: 'var(--yellow-50)', borderRadius: 'var(--radius-md)', padding: '14px 18px', border: '1px solid var(--yellow-200)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Info size={16} color="var(--yellow-700)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--yellow-800)', lineHeight: 1.6 }}>
                    <strong>Note:</strong> This summary uses the <strong>regular day rate</strong> (Daily Rate ÷ 8 hrs) for all shifts.
                    For holiday or overtime pay, use the <strong>Single Day Calculator</strong> tab for precise calculations.
                </p>
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function PayrollEstimator() {
    const { user, isAdmin } = useAuth();
    const isEmployee = !isAdmin;
    const [activeTab, setActiveTab] = useState(isEmployee ? 'summary' : 'calculator');
    const [form, setForm] = useState({ dailyRate: '', hoursWorked: '8', overtimeHours: '0', dayType: 'regular' });
    const [result, setResult] = useState(null);
    const [showBreakdown, setShowBreakdown] = useState(true);

    const handleChange = useCallback((field, value) => {
        setForm(f => ({ ...f, [field]: value }));
        setResult(null);
    }, []);

    const handleCalculate = () => { setResult(calcPayroll(form)); setShowBreakdown(true); };
    const handleReset = () => { setForm({ dailyRate: '', hoursWorked: '8', overtimeHours: '0', dayType: 'regular' }); setResult(null); };
    const selectedType = DAY_TYPES.find(d => d.value === form.dayType);

    const tabs = [
        ...(isEmployee ? [{ key: 'summary', label: 'My Pay Summary', icon: <Wallet size={15} /> }] : []),
        { key: 'calculator', label: 'Single Day Calculator', icon: <Calculator size={15} /> },
    ];

    return (
        <div>
            {/* Page Header */}
            <div className="section-header">
                <div>
                    <h1 className="page-title"><Calculator size={28} /> Payroll Estimator</h1>
                    <p className="page-subtitle">
                        {isEmployee ? 'Estimate your total pay or calculate pay for a specific day' : 'Calculate employee pay based on company payroll rules'}
                    </p>
                </div>
            </div>

            {/* Tabs — only show for employees */}
            {isEmployee && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--white)', borderRadius: 'var(--radius-md)', padding: 6, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--gray-100)', width: 'fit-content' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            id={`tab-${tab.key}`}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 20px', borderRadius: 8, border: 'none',
                                background: activeTab === tab.key ? 'var(--gradient-primary)' : 'transparent',
                                color: activeTab === tab.key ? 'white' : 'var(--gray-600)',
                                fontWeight: activeTab === tab.key ? 700 : 500,
                                fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                                transition: 'all var(--transition-fast)',
                                boxShadow: activeTab === tab.key ? '0 2px 8px rgba(22,163,74,0.25)' : 'none',
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* My Pay Summary Tab (employees only) */}
            {activeTab === 'summary' && isEmployee && (
                <MyPaySummary userId={user?.uid} />
            )}

            {/* Single Day Calculator Tab */}
            {activeTab === 'calculator' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
                    {/* ── LEFT: Form ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div className="content-card">
                            <div className="card-header">
                                <h3><Banknote size={18} /> {isEmployee ? 'Single Day Pay' : 'Employee Pay Details'}</h3>
                            </div>
                            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                                {/* Daily Rate */}
                                <div className="form-group">
                                    <label htmlFor="daily-rate" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--gray-700)', fontSize: 14 }}>
                                        <DollarSign size={15} color="var(--green-500)" /> Daily Rate (₱)
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontWeight: 600, fontSize: 15 }}>₱</span>
                                        <input id="daily-rate" type="number" min="0" step="0.01" placeholder="e.g. 500.00"
                                            value={form.dailyRate} onChange={e => handleChange('dailyRate', e.target.value)}
                                            className="form-input" style={{ paddingLeft: 32 }} />
                                    </div>
                                </div>
                                {/* Day Type */}
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--gray-700)', fontSize: 14 }}>
                                        <Sun size={15} color="var(--green-500)" /> Day Type
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        {DAY_TYPES.map(dt => (
                                            <button key={dt.value} id={`day-type-${dt.value}`} type="button"
                                                onClick={() => handleChange('dayType', dt.value)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                                                    borderRadius: 'var(--radius-sm)', fontFamily: 'inherit',
                                                    border: form.dayType === dt.value ? `2px solid ${dt.color}` : '2px solid var(--gray-200)',
                                                    background: form.dayType === dt.value ? `${dt.color}14` : 'var(--white)',
                                                    color: form.dayType === dt.value ? dt.color : 'var(--gray-600)',
                                                    fontWeight: form.dayType === dt.value ? 700 : 500,
                                                    fontSize: 13, cursor: 'pointer', transition: 'all var(--transition-fast)', textAlign: 'left',
                                                }}
                                            >
                                                <span style={{ fontSize: 16 }}>{dt.icon}</span>
                                                <span>{dt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Hours Worked */}
                                <div className="form-group">
                                    <label htmlFor="hours-worked" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--gray-700)', fontSize: 14 }}>
                                        <Clock size={15} color="var(--green-500)" /> Hours Worked (Regular)
                                    </label>
                                    <input id="hours-worked" type="number" min="0" max="24" step="0.5" placeholder="e.g. 8"
                                        value={form.hoursWorked} onChange={e => handleChange('hoursWorked', e.target.value)} className="form-input" />
                                </div>
                                {/* Overtime */}
                                <div className="form-group">
                                    <label htmlFor="overtime-hours" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--gray-700)', fontSize: 14 }}>
                                        <TrendingUp size={15} color="var(--green-500)" /> Overtime Hours
                                        <span style={{ fontSize: 11, background: 'var(--yellow-100)', color: 'var(--yellow-700)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>Min. 1 hr billed</span>
                                    </label>
                                    <input id="overtime-hours" type="number" min="0" max="12" step="0.5" placeholder="e.g. 2"
                                        value={form.overtimeHours} onChange={e => handleChange('overtimeHours', e.target.value)} className="form-input" />
                                </div>
                                {/* Buttons */}
                                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                    <button id="calculate-payroll-btn" className="btn btn-primary btn-full"
                                        onClick={handleCalculate} disabled={!form.dailyRate || parseFloat(form.dailyRate) <= 0}
                                        style={{ flex: 2, fontSize: 15 }}>
                                        <Calculator size={17} /> Calculate Pay
                                    </button>
                                    <button id="reset-payroll-btn" className="btn btn-secondary" onClick={handleReset} style={{ flex: 1 }} title="Reset">
                                        <RefreshCw size={16} /> Reset
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Rate Reference */}
                        <div className="content-card">
                            <div className="card-header"><h3><Info size={18} /> Payroll Rate Reference</h3></div>
                            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <RuleCard icon="📅" title="Regular Day">
                                    <div style={{ paddingTop: 12 }}>
                                        <FormulaRow label="Per Hour" formula="Daily Rate ÷ 8" />
                                        <FormulaRow label="Overtime" formula="Per Hour × 125% (min. 1 hr)" />
                                    </div>
                                </RuleCard>
                                <RuleCard icon="🏖️" title="Rest Day / Day-off">
                                    <div style={{ paddingTop: 12 }}>
                                        <FormulaRow label="Per Hour" formula="Daily Rate ÷ 8" />
                                    </div>
                                </RuleCard>
                                <RuleCard icon="⭐" title="Special Holiday (Worked)">
                                    <div style={{ paddingTop: 12 }}>
                                        <FormulaRow label="Holiday Rate" formula="Daily Rate × 130%" highlight />
                                        <FormulaRow label="Per Hour" formula="Holiday Rate ÷ 8" />
                                        <FormulaRow label="Overtime" formula="Special Per Hour × 130%" />
                                    </div>
                                </RuleCard>
                                <RuleCard icon="🏛️" title="Legal Holiday (Worked)">
                                    <div style={{ paddingTop: 12 }}>
                                        <FormulaRow label="Holiday Rate" formula="Daily Rate × 200%" highlight />
                                        <FormulaRow label="Per Hour" formula="Holiday Rate ÷ 8" />
                                        <FormulaRow label="Overtime" formula="Legal Per Hour × 130%" />
                                    </div>
                                </RuleCard>
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: Results ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {result ? (
                            <>
                                {/* Hero */}
                                <div style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)', padding: '32px 28px', color: 'white', boxShadow: '0 8px 32px rgba(22,163,74,0.30)', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                                    <div style={{ position: 'absolute', right: 40, bottom: -50, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, position: 'relative' }}>
                                        <span style={{ fontSize: 24 }}>{selectedType?.icon}</span>
                                        <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.85 }}>{selectedType?.label}</span>
                                    </div>
                                    <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 4, position: 'relative' }}>Estimated Total Pay</div>
                                    <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, position: 'relative' }}>{fmt(result.totalPay)}</div>
                                    <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8, position: 'relative' }}>
                                        Daily Rate: {fmt(result.dailyRate)} &nbsp;|&nbsp; {result.hoursWorked}h worked{result.overtimeHours > 0 ? ` + ${result.overtimeHours}h OT` : ''}
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                    {[
                                        { label: 'Per Hour Rate', value: fmt(result.perHourRate), icon: <Clock size={16} />, color: 'var(--green-600)', bg: 'var(--green-50)' },
                                        { label: 'Base Pay', value: fmt(result.basePay), icon: <DollarSign size={16} />, color: 'var(--info)', bg: 'var(--info-light)' },
                                        { label: 'Overtime Pay', value: result.overtimeHours > 0 ? fmt(result.otPay) : '—', icon: <TrendingUp size={16} />, color: 'var(--accent-dark)', bg: 'var(--accent-light)' },
                                    ].map((s, i) => (
                                        <div key={i} style={{ background: s.bg, borderRadius: 'var(--radius-md)', padding: '14px 16px', border: `1.5px solid ${s.color}20` }}>
                                            <div style={{ color: s.color, marginBottom: 6 }}>{s.icon}</div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)' }}>{s.value}</div>
                                            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Breakdown */}
                                <div className="content-card">
                                    <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowBreakdown(b => !b)}>
                                        <h3><Calculator size={18} /> Pay Breakdown</h3>
                                        {showBreakdown ? <ChevronUp size={16} color="var(--gray-400)" /> : <ChevronDown size={16} color="var(--gray-400)" />}
                                    </div>
                                    {showBreakdown && (
                                        <div className="card-body-flush">
                                            <table className="data-table">
                                                <thead><tr><th>Component</th><th>Formula</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                                                <tbody>
                                                    {result.breakdown.map((row, i) => (
                                                        <tr key={i} style={row.isTotal ? { background: 'var(--green-50)', fontWeight: 700 } : {}}>
                                                            <td style={{ fontWeight: row.isTotal ? 700 : 500, color: row.isTotal ? 'var(--green-700)' : 'var(--gray-700)' }}>{row.label}</td>
                                                            <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{row.note || ''}</td>
                                                            <td style={{ textAlign: 'right', fontWeight: row.isTotal ? 800 : 500, color: row.isTotal ? 'var(--green-700)' : 'var(--gray-800)', fontSize: row.isTotal ? 16 : 14 }}>{row.value}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Rate Summary */}
                                <div className="content-card">
                                    <div className="card-header"><h3><Star size={18} /> Rate Summary</h3></div>
                                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {[
                                            { label: 'Daily Rate', value: fmt(result.dailyRate) },
                                            { label: 'Per Hour Rate', value: fmt(result.perHourRate) },
                                            ...(result.otPay > 0 ? [
                                                { label: 'OT Rate per Hour', value: fmt(result.otRate) },
                                                { label: 'Overtime Hours Billed', value: `${Math.max(result.overtimeHours, 1)} hrs` },
                                            ] : []),
                                            { label: 'Day Type Applied', value: selectedType?.label },
                                        ].map((item, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
                                                <span style={{ color: 'var(--gray-500)', fontSize: 13 }}>{item.label}</span>
                                                <span style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 14 }}>{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--gray-200)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center', minHeight: 360 }}>
                                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 4px 16px rgba(34,197,94,0.15)' }}>
                                    <Calculator size={32} color="var(--green-500)" />
                                </div>
                                <h3 style={{ color: 'var(--gray-700)', marginBottom: 8, fontSize: 18 }}>Ready to Calculate</h3>
                                <p style={{ color: 'var(--gray-400)', fontSize: 14, maxWidth: 260, lineHeight: 1.6 }}>
                                    Fill in the daily rate, select the day type, and enter hours worked to get the pay estimate.
                                </p>
                                <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                                    {DAY_TYPES.map(dt => (
                                        <span key={dt.value} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--gray-100)', color: 'var(--gray-600)' }}>
                                            {dt.icon} {dt.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
