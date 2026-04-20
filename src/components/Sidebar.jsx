import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    ClipboardList,
    CalendarCheck,
    BarChart3,
    Shield,
    Clock,
    TreePine,
    Leaf,
    Sun,
    LogOut,
    User,
    Briefcase,
    Calculator
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from './Logo';
import ProfilePicture from './ProfilePicture';

const adminMenuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { path: '/admin/employees', icon: Users, label: 'Employees' },
    { path: '/admin/bidding', icon: Briefcase, label: 'Bidding Events' },
    { path: '/admin/attendance', icon: ClipboardList, label: 'Attendance' },
    { path: '/admin/leave-requests', icon: CalendarCheck, label: 'Leave Requests' },
    { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
    { path: '/admin/audit-trail', icon: Shield, label: 'Audit Trail' },
];

const employeeMenuItems = [
    { path: '/employee', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { path: '/employee/time-log', icon: Clock, label: 'Time Log' },
    { path: '/employee/my-attendance', icon: ClipboardList, label: 'My Attendance' },
    { path: '/employee/leave-balance', icon: CalendarCheck, label: 'Leave Balance' },
    { path: '/employee/payroll', icon: Calculator, label: 'Payroll Estimator' },
    { path: '/employee/profile', icon: User, label: 'My Profile' },
];

export default function Sidebar({ collapsed, setCollapsed }) {
    const { isAdmin, logout, userProfile } = useAuth();
    const navigate = useNavigate();
    const menuItems = isAdmin ? adminMenuItems : employeeMenuItems;

    return (
        <>
            <div className={`sidebar-overlay ${!collapsed ? 'active' : ''}`} onClick={() => setCollapsed(true)} />
            <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
                <div
                    className="sidebar-top"
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    style={{ cursor: 'pointer' }}
                >
                    <Logo collapsed={collapsed} />
                </div>

                <div className="sidebar-decoration">
                    <TreePine size={16} className="deco-icon" />
                    <Leaf size={12} className="deco-icon" />
                    <Sun size={14} className="deco-icon" />
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-label">{isAdmin ? 'HR Administration' : 'My Workspace'}</div>
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => window.innerWidth < 768 && setCollapsed(true)}
                        >
                            <item.icon size={20} />
                            {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    {!collapsed && userProfile && (
                        <div 
                            className="user-info"
                            style={{ cursor: 'pointer', transition: 'background-color 0.2s', padding: '0.5rem', borderRadius: '0.5rem' }}
                            onClick={() => {
                                navigate(isAdmin ? '/admin/profile' : '/employee/profile');
                                if (window.innerWidth < 768) setCollapsed(true);
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title="Go to Profile"
                        >
                            <ProfilePicture userProfile={userProfile} />
                            <div className="user-details">
                                <span className="user-name">{userProfile.name}</span>
                                <span className="user-role">{isAdmin ? 'HR Staff' : 'Employee'}</span>
                            </div>
                        </div>
                    )}
                    <button className="nav-item logout-btn" onClick={logout}>
                        <LogOut size={20} />
                        {!collapsed && <span>Logout</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}
