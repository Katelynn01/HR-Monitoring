import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import { Mail, Lock, LogIn, AlertCircle, Eye, EyeOff, CheckCircle, Building2 } from 'lucide-react';

const DEPARTMENTS = ['Agriculture', 'Operations', 'Accounting', 'Human Resources', 'Business Solutions', 'Marketing'];

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            <path fill="none" d="M0 0h48v48H0z" />
        </svg>
    );
}

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // Department selection for new Google users
    const [selectedDept, setSelectedDept] = useState('');

    const { login, loginWithGoogle, user, userProfile } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await login(email, password);
            const { getDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const profileDoc = await getDoc(doc(db, 'users', result.user.uid));
            const role = profileDoc.data()?.role;
            navigate(role === 'admin' ? '/admin' : '/employee');
        } catch (err) {
            setError(
                err.code === 'auth/invalid-credential'
                    ? 'Invalid email or password'
                    : err.code === 'auth/too-many-requests'
                        ? 'Too many attempts. Please try again later.'
                        : 'Failed to sign in. Please try again.'
            );
        }
        setLoading(false);
    }

    async function handleForgotPassword() {
        if (!email) return setError('Please enter your email address first.');
        try {
            setMessage('');
            setError('');
            setLoading(true);
            const { resetPassword } = useAuth();
            await resetPassword(email);
            setMessage('Check your inbox for password reset instructions.');
        } catch (err) {
            setError('Failed to reset password. Please check your email address.');
        }
        setLoading(false);
    }

    async function handleGoogleSignIn() {
        setError('');
        setLoading(true);
        try {
            await loginWithGoogle();
        } catch (err) {
            if (err.code !== 'auth/popup-closed-by-user') {
                setError('Google sign-in failed. Please try again.');
            }
        }
        setLoading(false);
    }

    async function handleDeptSubmit() {
        if (!selectedDept || !user) return;
        setLoading(true);
        try {
            const { doc, updateDoc, deleteField } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            await updateDoc(doc(db, 'users', user.uid), { 
                department: selectedDept,
                needsDepartment: deleteField()
             });
            // App.jsx will automatically redirect once needsDepartment is gone
        } catch (err) {
            setError('Failed to save department. Please try again.');
        }
        setLoading(false);
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <Logo />
                <h1 className="auth-title">Welcome Back</h1>
                <p className="auth-subtitle">Sign in to your HR monitoring dashboard</p>

                {error && (
                    <div className="auth-error">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {message && (
                    <div className="auth-message" style={{
                        backgroundColor: '#f0fdf4', color: '#166534', padding: '12px',
                        borderRadius: '8px', marginBottom: '16px', display: 'flex',
                        alignItems: 'center', gap: '8px', fontSize: '0.875rem', border: '1px solid #bbf7d0'
                    }}>
                        <CheckCircle size={16} />
                        {message}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label><Mail size={14} /> Email Address</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="you@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label><Lock size={14} /> Password</label>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!email) return setError('Please enter your email address first.');
                                    try {
                                        setMessage(''); setError(''); setLoading(true);
                                        const { useAuth: ua } = await import('../contexts/AuthContext');
                                        const { resetPassword } = useAuth();
                                        await resetPassword(email);
                                        setMessage('Check your inbox for password reset instructions.');
                                    } catch { setError('Failed to reset password. Please check your email address.'); }
                                    setLoading(false);
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--green-600)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                            >
                                Forgot Password?
                            </button>
                        </div>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{ paddingRight: '40px', width: '100%' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        <LogIn size={18} />
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>or continue with</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                </div>

                {/* Google Sign-In Button */}
                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 10, padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
                        background: '#fff', color: '#3c4043', fontSize: '0.9rem', fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer', transition: 'box-shadow 0.2s, background 0.2s',
                        fontFamily: 'inherit', opacity: loading ? 0.7 : 1
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                    <GoogleIcon />
                    Continue with Google
                </button>

                <p className="auth-link">
                    Don't have an account? <Link to="/register">Register here</Link>
                </p>
            </div>

            {/* Department picker modal for new Google users */}
            {(user && userProfile?.needsDepartment) && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <div style={{
                        background: '#fff', borderRadius: 16, padding: 32, width: '90%', maxWidth: 420,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <Building2 size={22} color="var(--green-600)" />
                            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1f2937' }}>Select Your Department</h2>
                        </div>
                        <p style={{ color: '#6b7280', marginBottom: 20, fontSize: '0.875rem' }}>
                            Welcome! Please choose your department to complete your registration.
                        </p>
                        <select
                            className="form-select"
                            value={selectedDept}
                            onChange={e => setSelectedDept(e.target.value)}
                            style={{ width: '100%', marginBottom: 20 }}
                        >
                            <option value="">Select Department</option>
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={async () => {
                                    // Cancel — sign out
                                    const { auth } = await import('../firebase');
                                    await auth.signOut();
                                }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleDeptSubmit}
                                disabled={!selectedDept || loading}
                            >
                                {loading ? 'Saving...' : 'Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
