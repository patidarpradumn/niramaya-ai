import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRole } from '../utils';

export default function Unauthorized() {
  const { user } = useAuth();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
      <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-4">
        <ShieldAlert className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-bold text-text-primary mb-2">403 - Access Denied</h1>
      <p className="text-text-secondary max-w-md mb-4">
        Your account role <span className="font-semibold text-primary">({formatRole(user?.role)})</span> does not have permission to view or manage this page.
      </p>
      <p className="text-sm text-text-secondary/80 max-w-sm mb-6">
        Frontend route restrictions enforce role awareness, but all operations are securely authorized by the backend server.
      </p>
      <div className="flex gap-3">
        <Link
          to="/dashboard"
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
        >
          <Home className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 text-sm font-medium text-text-secondary bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go Back</span>
        </button>
      </div>
    </div>
  );
}
