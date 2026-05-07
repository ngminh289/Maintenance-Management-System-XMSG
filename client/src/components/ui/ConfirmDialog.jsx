/**
 * ConfirmDialog.jsx — Popup xác nhận chuẩn cho hành động Sửa / Xoá.
 * Pattern dùng chung: Lưu chỉnh sửa, Xoá tài sản, Xoá nhóm... (theo yêu cầu UX
 * thống nhất Xem/Sửa/Xoá).
 * Liên quan: AssetListPage, AssetDetailPage, AssetForm.
 */
import { Modal } from "./Modal.jsx";
import { Button } from "./Button.jsx";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Có",
  cancelLabel = "Không",
  variant = "primary", // primary | danger
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="space-y-5">
        <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
