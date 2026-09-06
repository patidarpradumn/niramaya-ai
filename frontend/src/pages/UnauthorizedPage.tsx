import { useNavigate } from 'react-router-dom';
import { ShieldOff, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-5">
        <ShieldOff size={28} className="text-red-400" />
      </div>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">You do not have the required permissions to view this page. Please contact your system administrator if you believe this is an error.</p>
      <div className="flex gap-3">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Home size={16} /> Go to Dashboard
        </button>
        <button onClick={() => navigate('/login')} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Login Again
        </button>
      </div>
    </div>
  );
}
