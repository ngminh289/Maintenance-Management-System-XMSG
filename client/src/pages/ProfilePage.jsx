/**
 * ProfilePage.jsx — Trang hồ sơ cá nhân.
 * Hiển thị thông tin tài khoản + đổi mật khẩu.
 */
import { useState } from 'react';
import { useAuth }   from '../contexts/AuthContext.jsx';
import { authApi }   from '../api/auth.api.js';
import { Button }    from '../components/ui/Button.jsx';
import { Input }     from '../components/ui/Input.jsx';
import { Badge }     from '../components/ui/Badge.jsx';
import { getRoleKey } from '../utils/rbac.js';
import toast from 'react-hot-toast';
import { User, Lock, Mail, Phone, Building2, Briefcase, ShieldCheck } from 'lucide-react';

const ROLE_BADGE_MAP = {
  admin:      { label: 'Admin',        color: 'red'    },
  director:   { label: 'Ban GĐ',       color: 'purple' },
  manager:    { label: 'Trưởng phòng', color: 'blue'   },
  supervisor: { label: 'Trưởng ca',    color: 'blue'   },
  cvkts:      { label: 'CVKTS',        color: 'green'  },
  ktv:        { label: 'KTV',          color: 'green'  },
  operator:   { label: 'Vận hành',     color: 'gray'   },
};

export function ProfilePage() {
  const { user }  = useAuth();
  const roleKey = getRoleKey(user);
  const badge   = ROLE_BADGE_MAP[roleKey] ?? { label: roleKey, color: 'gray' };

  const [pwForm,  setPwForm]  = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving,  setSaving]  = useState(false);

  const handleChangePw = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      toast.error('Mật khẩu xác nhận không khớp'); return;
    }
    if (pwForm.newPassword.length < 8) {
      toast.error('Mật khẩu mới phải ít nhất 8 ký tự'); return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword:     pwForm.newPassword,
      });
      toast.success('Đổi mật khẩu thành công');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Đổi mật khẩu thất bại');
    } finally { setSaving(false); }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Avatar + tên */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
          {user.fullName?.[0] ?? 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900">{user.fullName}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge color={badge.color}>{badge.label}</Badge>
            <span className="text-sm text-gray-600">{user.positionName}</span>
          </div>
        </div>
      </div>

      {/* Thông tin tài khoản */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <User size={16} className="text-blue-500" /> Thông tin tài khoản
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: User,      label: 'Họ và tên',    value: user.fullName },
            { icon: ShieldCheck,label: 'Tên đăng nhập', value: user.username },
            { icon: Mail,      label: 'Email',         value: user.email },
            { icon: Phone,     label: 'Điện thoại',    value: user.phone ?? '—' },
            { icon: Briefcase, label: 'Chức vụ',       value: user.positionName },
            { icon: Building2, label: 'Phòng ban',     value: user.departmentName ?? '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
              <Icon size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
          <ShieldCheck size={12} className="text-green-500" />
          Email đã xác thực — Tài khoản đang hoạt động
        </div>
      </div>

      {/* Đổi mật khẩu */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Lock size={16} className="text-blue-500" /> Đổi mật khẩu
        </h3>
        <form onSubmit={handleChangePw} className="space-y-4">
          <Input
            label="Mật khẩu hiện tại"
            type="password"
            value={pwForm.currentPassword}
            onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
            placeholder="Nhập mật khẩu hiện tại"
            required
          />
          <Input
            label="Mật khẩu mới"
            type="password"
            value={pwForm.newPassword}
            onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
            placeholder="Tối thiểu 8 ký tự"
            required
          />
          <Input
            label="Xác nhận mật khẩu mới"
            type="password"
            value={pwForm.confirm}
            onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
            placeholder="Nhập lại mật khẩu mới"
            required
          />
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              <Lock size={14} /> Đổi mật khẩu
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
