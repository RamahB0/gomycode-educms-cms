import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guards a route behind login and, optionally, a minimum role
// (e.g. <ProtectedRoute minRole="editor">...</ProtectedRoute>).
export default function ProtectedRoute({ children, minRole }) {
  const { user, hasRole } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (minRole && !hasRole(minRole)) return <Navigate to="/" replace />;
  return children;
}
