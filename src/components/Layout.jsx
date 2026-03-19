import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { Search } from 'lucide-react';
import Notifications from './Notifications';

export default function Layout() {
    const [collapsed, setCollapsed] = useState(window.innerWidth < 768);
    const { userProfile } = useAuth();

    return (
        <div className="app-layout">
            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
            <main className={`main-content ${collapsed ? 'expanded' : ''}`}>
                <header className="top-header">
                    <button className="mobile-menu-btn" onClick={() => setCollapsed(false)}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <div className="header-left">
                        <h2 className="page-greeting">
                            Welcome back, <span className="greeting-name">{userProfile?.name?.split(' ')[0] || 'User'}</span>
                        </h2>
                    </div>
                    <div className="header-right">
                        <div className="header-search">
                            <Search size={18} />
                            <input type="text" placeholder="Search..." />
                        </div>
                        <Notifications />
                    </div>
                </header>
                <div className="page-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
