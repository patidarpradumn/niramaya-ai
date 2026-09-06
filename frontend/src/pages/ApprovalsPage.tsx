import { useState, useEffect } from 'react';
import { Shield, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { userAPI } from '../services/api/userService';
import type { User } from '../types';

export default function ApprovalsPage() {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      setIsLoading(true);
      const data = await userAPI.getPendingUsers();
      setPendingUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load pending approvals');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      setActionLoading(userId);
      await userAPI.approveUser(userId);
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      setError(err.message || 'Failed to approve user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!window.confirm('Are you sure you want to reject this registration?')) return;
    
    try {
      setActionLoading(userId);
      await userAPI.rejectUser(userId);
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      setError(err.message || 'Failed to reject user');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve registration requests within your jurisdiction.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
            <p>Loading pending requests...</p>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-600">No Pending Approvals</p>
            <p className="text-sm text-gray-500">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingUsers.map((user) => (
              <div key={user.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{user.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                      <span>{user.email}</span>
                      <span>•</span>
                      <span className="font-medium text-blue-600">{user.role.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReject(user.id)}
                    disabled={actionLoading === user.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                    title="Reject Request"
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={() => handleApprove(user.id)}
                    disabled={actionLoading === user.id}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {actionLoading === user.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
