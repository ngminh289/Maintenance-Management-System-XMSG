/**
 * ProfilePage.jsx — Trang hồ sơ cá nhân.
 * Hiển thị thông tin tài khoản + đổi mật khẩu + cập nhật ảnh đại diện.
 * Dùng trong: App.jsx (route /profile).
 * Liên quan: employee.api.js (uploadPhoto, getPhotoUrl), AuthContext.jsx (refetchMe).
 */
import { useState, useRef } from 'react';
import { useAuth }    from '../contexts/AuthContext.jsx';
import { authApi }    from '../api/auth.api.js';
import { employeeApi } from '../api/employee.api.js';
import { Button }     from '../components/ui/Button.jsx';
import { Input }      from '../components/ui/Input.jsx';
import { Badge }      from '../components/ui/Badge.jsx';
import { getRoleKey, ROLE_COLORS, getRoleLabel } from '../utils/rbac.js';

import toast from 'react-hot-toast';
import { User, Lock, Mail, Phone, Building2, Briefcase, ShieldCheck, Camera, Wrench, Star } from 'lucide-react';

const BADGE_COLOR = {
  gray: 'gray', green: 'green', blue: 'blue', indigo: 'indigo', red: 'red', purple: 'purple',
};

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

export function ProfilePage() {
  const { user, refetchMe } = useAuth();
  const roleKey = getRoleKey(user);
  const rc      = ROLE_COLORS[roleKey] ?? 'gray';
  const roleLabel = getRoleLabel(user);
  const badge   = {
    label: roleLabel,
    color: BADGE_COLOR[rc] ?? 'gray',
  };

  const [pwForm,       setPwForm]       = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving,       setSaving]       = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile,    setPhotoFile]    = useState(null);
  const [photoSaving,  setPhotoSaving]  = useState(false);
  const fileRef = useRef(null);

  const photoUrl = user?.photoPath ? employeeApi.getPhotoUrl(user.photoPath) : null;
  const displayPhoto = photoPreview ?? photoUrl;

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

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Chỉ chấp nhận JPG, PNG, WEBP'); return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Ảnh tối đa ${MAX_MB}MB`); return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleUploadPhoto = async () => {
    if (!photoFile || !user?.employeeId) return;
    setPhotoSaving(true);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      await employeeApi.uploadPhoto(user.employeeId, fd);
      toast.success('Đã cập nhật ảnh đại diện');
      await refetchMe();
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Tải ảnh thất bại');
    } finally { setPhotoSaving(false); }
  };

  const handleCancelPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Avatar + tên */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center gap-5">
        {/* Avatar với nút đổi ảnh */}
        <div className="relative group flex-shrink-0">
          {displayPhoto ? (
            <img
              src={displayPhoto}
              alt={user.fullName}
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-3xl font-bold text-white">
              {user.fullName?.[0] ?? 'U'}
            </div>
          )}
          <button
            type="button"
            title="Đổi ảnh đại diện"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Camera size={20} className="text-white" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900">{user.fullName}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge color={badge.color}>{badge.label}</Badge>
            {user.departmentName ? (
              <span className="text-sm text-gray-600">{user.departmentName}</span>
            ) : null}
          </div>
          {/* Thông tin kỹ năng */}
          {(user.specialty || user.craftLevel) && (
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
              {user.craftLevel && (
                <span className="flex items-center gap-1 text-blue-700 font-semibold">
                  <Star size={11} /> Bậc thợ {user.craftLevel}
                </span>
              )}
              {user.specialty && (
                <span className="flex items-center gap-1 text-indigo-700 font-medium">
                  <Wrench size={11} /> {user.specialty}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Banner xác nhận đổi ảnh */}
      {photoFile && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-4">
          <img
            src={photoPreview}
            alt="preview"
            className="w-16 h-16 rounded-full object-cover border-2 border-blue-300 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900">Ảnh mới đã chọn</p>
            <p className="text-xs text-blue-700 truncate">{photoFile.name}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="secondary" onClick={handleCancelPhoto} className="text-xs py-1.5 px-3">
              Hủy
            </Button>
            <Button onClick={handleUploadPhoto} loading={photoSaving} className="text-xs py-1.5 px-3">
              <Camera size={13} /> Lưu ảnh
            </Button>
          </div>
        </div>
      )}

      {/* Thông tin tài khoản */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <User size={16} className="text-blue-500" /> Thông tin tài khoản
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: User,       label: 'Họ và tên',     value: user.fullName },
            { icon: ShieldCheck, label: 'Tên đăng nhập', value: user.username },
            { icon: Mail,       label: 'Email',          value: user.email },
            { icon: Phone,      label: 'Điện thoại',     value: user.phone ?? '—' },
            { icon: Briefcase,  label: 'Chức vụ',        value: roleLabel },
            { icon: Building2,  label: 'Phòng ban',      value: user.departmentName ?? '—' },
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

        {user.experienceNotes && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
            <ShieldCheck size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kinh nghiệm / chứng chỉ</p>
              <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-line">{user.experienceNotes}</p>
            </div>
          </div>
        )}

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
