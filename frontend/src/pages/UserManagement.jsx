import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

export default function UserManagement() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });

  const roleMut = useMutation({
    mutationFn: ({ userId, role }) => api.updateRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  if (isLoading) return <p className="text-gray-400 mt-10 text-center">Loading users…</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">User Management</h1>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">Role</th>
              <th className="text-left px-5 py-3">Member Since</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users?.map(user => (
              <tr key={user.id}>
                <td className="px-5 py-3 text-gray-800 font-medium">
                  {user.full_name || <span className="text-gray-400 italic">No name</span>}
                  {user.id === session?.user?.id && <span className="ml-2 text-xs text-blue-500">(you)</span>}
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${user.role === 'EDITOR' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-400">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-right">
                  {user.id !== session?.user?.id && (
                    <button
                      onClick={() => roleMut.mutate({ userId: user.id, role: user.role === 'EDITOR' ? 'VIEWER' : 'EDITOR' })}
                      disabled={roleMut.isPending}
                      className="text-xs border border-gray-300 hover:border-blue-400 hover:text-blue-600 px-3 py-1 rounded transition disabled:opacity-50"
                    >
                      Make {user.role === 'EDITOR' ? 'Viewer' : 'Editor'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
