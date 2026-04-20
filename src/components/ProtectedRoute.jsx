import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';

export default function ProtectedRoute({ children, requiredRole }) {
    const { user, userProfile, loading } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (userProfile?.needsDepartment) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole) {
        const currentRole = userProfile?.role || 'employee'; // default to employee if db doc missing
        if (currentRole !== requiredRole) {
            return <Navigate to={currentRole === 'admin' ? '/admin' : '/employee'} replace />;
        }
    }

    return children;
}
