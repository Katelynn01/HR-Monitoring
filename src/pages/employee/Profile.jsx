import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, Mail, Building2, Phone, MapPin, HeartPulse, Save, Shield } from 'lucide-react';
import ErrorModal from '../../components/ErrorModal';
import ProfilePicture from '../../components/ProfilePicture';

export default function Profile() {
    const { user, userProfile } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [errorModal, setErrorModal] = useState({ isOpen: false, text: '' });

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        emergencyContactName: '',
        emergencyContactNumber: ''
    });

    // Update form data when userProfile loads
    useEffect(() => {
        if (userProfile) {
            setFormData({
                name: userProfile.name || '',
                phone: userProfile.phone || '',
                address: userProfile.address || '',
                emergencyContactName: userProfile.emergencyContactName || '',
                emergencyContactNumber: userProfile.emergencyContactNumber || ''
            });
        }
    }, [userProfile]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'phone' || name === 'emergencyContactNumber') {
            // Restrict to numbers and the plus symbol only
            const sanitizedValue = value.replace(/[^0-9+]/g, '');
            setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
            return;
        }

        if (name === 'name' || name === 'emergencyContactName') {
            // Restrict numbers: Remove any digits
            const sanitizedValue = value.replace(/[0-9]/g, '');
            setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate Philippine mobile number format
        const phPhoneRegex = /^(09\d{9}|\+639\d{9})$/;

        if (formData.phone && !phPhoneRegex.test(formData.phone)) {
            setErrorModal({ isOpen: true, text: 'Invalid Phone Number format.\nMust be 11 digits (e.g. 09123456789) or start with +63 (e.g. +639123456789).' });
            return;
        }

        if (formData.emergencyContactNumber && !phPhoneRegex.test(formData.emergencyContactNumber)) {
            setErrorModal({ isOpen: true, text: 'Invalid Emergency Contact Number format.\nMust be 11 digits (e.g. 09123456789) or start with +63 (e.g. +639123456789).' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                name: formData.name,
                phone: formData.phone,
                address: formData.address,
                emergencyContactName: formData.emergencyContactName,
                emergencyContactNumber: formData.emergencyContactNumber
            });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setIsEditing(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Failed to update profile.' });
        } finally {
            setLoading(false);

            // Clear success message after 3 seconds
            setTimeout(() => {
                setMessage({ type: '', text: '' });
            }, 3000);
        }
    };

    if (!userProfile) return (
        <div className="flex justify-center items-center h-full">
            <div className="loading-spinner"></div>
        </div>
    );

    return (
        <div className="page-container" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>My Profile</h1>
                    <p className="page-subtitle" style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Manage your personal information and contact details</p>
                </div>
                {!isEditing && (
                    <button
                        className="btn btn-primary"
                        onClick={() => setIsEditing(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <User size={18} /> Edit Profile
                    </button>
                )}
            </div>

            {message.text && (
                <div
                    className={`alert alert-${message.type}`}
                    style={{
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        marginBottom: '1.5rem',
                        background: message.type === 'success' ? '#def7ec' : '#fde8e8',
                        color: message.type === 'success' ? '#03543f' : '#9b1c1c',
                        border: `1px solid ${message.type === 'success' ? '#31c48d' : '#f8b4b4'}`
                    }}
                >
                    {message.text}
                </div>
            )}

            <div className="profile-grid">
                <div className="card">
                    <div className="card-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', borderTopLeftRadius: '0.5rem', borderTopRightRadius: '0.5rem' }}>
                        <h2 className="card-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Account Details</h2>
                    </div>
                    <div className="card-body" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderBottomLeftRadius: '0.5rem', borderBottomRightRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3.5rem', marginTop: '1.5rem' }}>
                            <div style={{ transform: 'scale(3.2)', transformOrigin: 'center' }}>
                                <ProfilePicture userProfile={userProfile} />
                            </div>
                        </div>
                        <div className="info-group">
                            <label className="info-label">
                                <Mail size={16} /> Email Address
                            </label>
                            <p className="info-value">{userProfile.email}</p>
                            <small className="info-help">Email cannot be changed.</small>
                        </div>
                        <div className="info-group">
                            <label className="info-label">
                                <Shield size={16} /> Role
                            </label>
                            <p className="info-value capitalize">{userProfile.role}</p>
                        </div>
                        <div className="info-group">
                            <label className="info-label">
                                <Building2 size={16} /> Department
                            </label>
                            <p className="info-value">{userProfile.department || 'Not Assigned'}</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', borderTopLeftRadius: '0.5rem', borderTopRightRadius: '0.5rem' }}>
                        <h2 className="card-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Personal Information</h2>
                    </div>
                    <div className="card-body" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderBottomLeftRadius: '0.5rem', borderBottomRightRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        {isEditing ? (
                            <form onSubmit={handleSubmit} className="profile-form">
                                <div className="form-group">
                                    <label>Full Name</label>
                                    <div className="input-with-icon">
                                        <User size={18} />
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="form-control"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Phone Number</label>
                                    <div className="input-with-icon">
                                        <Phone size={18} />
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="form-control"
                                            placeholder="e.g. 09123456789 or +639123456789"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Address</label>
                                    <div className="input-with-icon">
                                        <MapPin size={18} style={{ top: '1rem', transform: 'none' }} />
                                        <textarea
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            className="form-control"
                                            rows="3"
                                            placeholder="Your full address"
                                            style={{ paddingTop: '0.75rem' }}
                                        />
                                    </div>
                                </div>

                                <h3 className="section-subtitle mt-4">Emergency Contact</h3>
                                <div className="form-group">
                                    <label>Contact Name</label>
                                    <div className="input-with-icon">
                                        <HeartPulse size={18} />
                                        <input
                                            type="text"
                                            name="emergencyContactName"
                                            value={formData.emergencyContactName}
                                            onChange={handleChange}
                                            className="form-control"
                                            placeholder="e.g. Jane Doe"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Contact Number</label>
                                    <div className="input-with-icon">
                                        <Phone size={18} />
                                        <input
                                            type="tel"
                                            name="emergencyContactNumber"
                                            value={formData.emergencyContactNumber}
                                            onChange={handleChange}
                                            className="form-control"
                                            placeholder="e.g. 09123456789 or +639123456789"
                                        />
                                    </div>
                                </div>

                                <div className="form-actions mt-4">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setIsEditing(false);
                                            // Reset form data to current profile
                                            setFormData({
                                                name: userProfile?.name || '',
                                                phone: userProfile?.phone || '',
                                                address: userProfile?.address || '',
                                                emergencyContactName: userProfile?.emergencyContactName || '',
                                                emergencyContactNumber: userProfile?.emergencyContactNumber || ''
                                            });
                                            setMessage({ type: '', text: '' });
                                        }}
                                        disabled={loading}
                                        style={{ padding: '0.75rem 1.5rem' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={loading}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', opacity: loading ? 0.7 : 1 }}
                                    >
                                        <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="profile-details-view">
                                <div className="info-group">
                                    <label className="info-label">
                                        <User size={16} /> Full Name
                                    </label>
                                    <p className="info-value">{userProfile.name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}</p>
                                </div>
                                <div className="info-group">
                                    <label className="info-label">
                                        <Phone size={16} /> Phone Number
                                    </label>
                                    <p className="info-value">{userProfile.phone || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}</p>
                                </div>
                                <div className="info-group">
                                    <label className="info-label">
                                        <MapPin size={16} /> Address
                                    </label>
                                    <p className="info-value">{userProfile.address || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}</p>
                                </div>

                                <h3 className="section-subtitle mt-4">Emergency Contact</h3>
                                <div className="info-group">
                                    <label className="info-label">
                                        <HeartPulse size={16} /> Contact Name
                                    </label>
                                    <p className="info-value">{userProfile.emergencyContactName || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}</p>
                                </div>
                                <div className="info-group">
                                    <label className="info-label">
                                        <Phone size={16} /> Contact Number
                                    </label>
                                    <p className="info-value">{userProfile.emergencyContactNumber || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .profile-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 1.5rem;
                }
                @media (min-width: 768px) {
                    .profile-grid {
                        grid-template-columns: 1fr 2fr;
                    }
                }
                .info-group {
                    margin-bottom: 1.25rem;
                }
                .info-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    margin-bottom: 0.35rem;
                }
                .info-value {
                    font-size: 1rem;
                    color: var(--text-primary);
                    margin: 0;
                    padding-left: 1.75rem;
                }
                .info-help {
                    color: var(--text-muted);
                    font-size: 0.75rem;
                    margin-top: 0.25rem;
                    display: block;
                    padding-left: 1.75rem;
                }
                .section-subtitle {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 1rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid var(--border-color);
                }
                .mt-4 {
                    margin-top: 2rem;
                }
                .capitalize {
                    text-transform: capitalize;
                }
                .profile-form .form-group {
                    margin-bottom: 1.25rem;
                }
                .profile-form label {
                    display: block;
                    margin-bottom: 0.5rem;
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 0.875rem;
                }
                .profile-form .form-control {
                    width: 100%;
                    padding: 0.75rem;
                    padding-left: 2.5rem;
                    border: 1px solid var(--border-color);
                    border-radius: 0.5rem;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    transition: all 0.2s;
                    font-family: inherit;
                    font-size: 1rem;
                    box-sizing: border-box;
                }
                .profile-form .form-control:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 3px rgba(132, 204, 22, 0.2);
                }
                .input-with-icon {
                    position: relative;
                }
                .input-with-icon svg {
                    position: absolute;
                    left: 0.75rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                    pointer-events: none;
                }
                .input-with-icon textarea {
                    resize: vertical;
                    min-height: 80px;
                }
                .form-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border-color);
                }
            `}</style>

            <ErrorModal
                isOpen={errorModal.isOpen}
                onClose={() => setErrorModal({ isOpen: false, text: '' })}
                title="Validation Error"
                message={errorModal.text}
            />
        </div>
    );
}
