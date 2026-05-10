/**
 * RowActionMenu.jsx — Dropdown menu hành động dạng "ba chấm" (⋮) cho hàng bảng.
 *
 * Dùng để gom các thao tác Xem / Sửa / Xoá / khác cho mỗi dòng dữ liệu, tránh
 * tràn icon khi có nhiều hành động (Tài liệu số, Phiếu việc, …).
 *
 * Cách dùng:
 *   <RowActionMenu items={[
 *     { id: 'view',   icon: Eye,    label: 'Xem chi tiết', onClick: () => … },
 *     { id: 'edit',   icon: Pencil, label: 'Sửa',          onClick: () => …, hidden: !canEdit },
 *     { id: 'delete', icon: Trash2, label: 'Xoá',          onClick: () => …, variant: 'danger' },
 *   ]} />
 *
 * Item shape:
 *   { id, icon, label, onClick, variant?: 'default'|'danger'|'success',
 *     disabled?, hidden?, hint? (tooltip), divider? (true → tạo separator phía trên) }
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

const VARIANT_CLASSES = {
  default: "text-slate-700 hover:bg-slate-100",
  danger: "text-rose-700 hover:bg-rose-50",
  success: "text-emerald-700 hover:bg-emerald-50",
  warning: "text-amber-700 hover:bg-amber-50",
};

export function RowActionMenu({ items = [], align = "right", title = "Hành động" }) {
  const visibleItems = items.filter((it) => !it?.hidden);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Đóng khi scroll/resize (tránh panel "treo lơ lửng" sai chỗ).
    const onClose = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const PANEL_W = 220;
    // Ước lượng chiều cao panel: ~38px/item + 8px padding (giới hạn cứng để
    // tránh giật layout khi list quá dài).
    const estHeight = Math.min(visibleItems.length * 38 + 8, 360);
    const vh = window.innerHeight;
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    // Mở lên khi không đủ chỗ phía dưới VÀ phía trên rộng hơn.
    const flipUp = spaceBelow < estHeight + 16 && spaceAbove > spaceBelow;
    const top = flipUp ? Math.max(8, r.top - estHeight - 4) : r.bottom + 4;
    const left =
      align === "left" ? r.left : Math.max(8, r.right - PANEL_W);
    setPos({ top, left, maxHeight: flipUp ? spaceAbove - 16 : spaceBelow - 16 });
    setOpen(true);
  };

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        title={title}
        className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors ${
          open ? "bg-slate-100 text-slate-900" : ""
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>
      {open && pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              zIndex: 9999,
              maxHeight: pos.maxHeight ? `${pos.maxHeight}px` : undefined,
              overflowY: pos.maxHeight ? "auto" : undefined,
            }}
            className="min-w-[200px] py-1 rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {visibleItems.map((it, idx) => {
              const Icon = it.icon;
              const variant = VARIANT_CLASSES[it.variant] ?? VARIANT_CLASSES.default;
              return (
                <div key={it.id ?? idx}>
                  {it.divider && idx > 0 && (
                    <div className="my-1 h-px bg-slate-100" />
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={it.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      it.onClick?.(e);
                    }}
                    title={it.hint || undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-left
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent
                      ${variant}`}
                  >
                    {Icon && <Icon size={15} className="shrink-0" aria-hidden />}
                    <span className="truncate">{it.label}</span>
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
