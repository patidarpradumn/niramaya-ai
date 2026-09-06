import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { NiramayaLogo } from '../assets/Logo';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <NiramayaLogo size={40} className="mb-6" />
      <div className="text-7xl font-bold text-gray-200 mb-4">404</div>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Page Not Found</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">The page you requested could not be found in the NIRAMAYA AI system.</p>
      <div className="flex gap-3">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Home size={16} /> Go to Dashboard
        </button>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Go Back
        </button>
      </div>
    </div>
  );
}
