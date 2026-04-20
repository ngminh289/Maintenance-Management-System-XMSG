/**
 * EmployeeCard.jsx — Thẻ thông tin nhân viên dạng hover popup dùng Portal.
 * Dùng createPortal + fixed positioning từ getBoundingClientRect để không bị clip bởi overflow.
 * Dùng trong: EmployeesPage, WorkOrderDetailPage (danh sách phân công + picker).
 * Props:
 *   emp      : object nhân viên (fullName, positionName, specialty, craftLevel, phone, email, photoPath, ...)
 *   children : trigger element
 *   side     : "right" | "left" | "bottom" | "top" (default "right")
 *   disabled : tắt hover
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Phone, Mail, Wrench, Star, BadgeCheck } from "lucide-react";
import { employeeApi } from "../../api/employee.api.js";

const CARD_W = 240;   // px
const CARD_GAP = 8;   // khoảng cách trigger → card

function EmployeePopup({ emp, triggerRect, side }) {
  const photoUrl = emp?.photoPath ? employeeApi.getPhotoUrl(emp.photoPath) : null;

  // Tính vị trí fixed
  let top, left;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (side === "left") {
    top  = triggerRect.top;
    left = triggerRect.left - CARD_W - CARD_GAP;
    if (left < 4) left = triggerRect.right + CARD_GAP; // flip nếu ra ngoài
  } else if (side === "bottom") {
    top  = triggerRect.bottom + CARD_GAP;
    left = triggerRect.left;
  } else if (side === "top") {
    top  = triggerRect.top - CARD_GAP - 300; // estimate
    left = triggerRect.left;
  } else {
    // right (default)
    top  = triggerRect.top;
    left = triggerRect.right + CARD_GAP;
    if (left + CARD_W > vw - 4) left = triggerRect.left - CARD_W - CARD_GAP; // flip
  }

  // Đảm bảo không tràn xuống màn hình
  if (top + 280 > vh) top = Math.max(4, vh - 290);
  if (top < 4) top = 4;

  return createPortal(
    <div
      className="fixed z-[9999] w-60 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 pointer-events-none"
      style={{ top, left, width: CARD_W }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        {photoUrl ? (
          <img src={photoUrl} alt={emp.fullName} className="w-12 h-12 rounded-full object-cover border border-gray-200 flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
            {emp.fullName?.[0] ?? "?"}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-tight truncate">{emp.fullName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{emp.positionName}</p>
          {emp.departmentName && <p className="text-xs text-gray-400">{emp.departmentName}</p>}
        </div>
      </div>

      {/* Kỹ năng */}
      <div className="space-y-1.5 text-xs">
        {emp.specialty && (
          <div className="flex items-center gap-2 text-indigo-700">
            <Wrench size={11} className="flex-shrink-0" />
            <span className="font-medium truncate">{emp.specialty}</span>
          </div>
        )}
        {emp.craftLevel && (
          <div className="flex items-center gap-2 text-blue-700">
            <Star size={11} className="flex-shrink-0" />
            <span className="font-semibold">Bậc thợ {emp.craftLevel}</span>
          </div>
        )}
        {emp.experienceNotes && (
          <div className="flex items-start gap-2 text-gray-600">
            <BadgeCheck size={11} className="flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">{emp.experienceNotes}</span>
          </div>
        )}
      </div>

      {/* Liên hệ */}
      {(emp.phone || emp.email) && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 text-xs text-gray-600">
          {emp.phone && (
            <div className="flex items-center gap-2">
              <Phone size={11} className="text-gray-400 flex-shrink-0" />
              <span>{emp.phone}</span>
            </div>
          )}
          {emp.email && (
            <div className="flex items-center gap-2">
              <Mail size={11} className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{emp.email}</span>
            </div>
          )}
        </div>
      )}

      {emp.onScheduledLeave && (
        <div className="mt-2 text-xs font-semibold text-orange-600 bg-orange-50 rounded-lg px-2 py-1">
          Đang nghỉ phép có lịch
        </div>
      )}
    </div>,
    document.body,
  );
}

export function EmployeeCard({ emp, children, side = "right", disabled = false }) {
  const [triggerRect, setTriggerRect] = useState(null);
  const triggerRef = useRef(null);
  const timerRef   = useRef(null);

  const show = useCallback(() => {
    if (disabled || !emp) return;
    clearTimeout(timerRef.current);
    if (triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
  }, [disabled, emp]);

  const hide = useCallback(() => {
    timerRef.current = setTimeout(() => setTriggerRect(null), 100);
  }, []);

  // Ẩn khi scroll
  useEffect(() => {
    if (!triggerRect) return;
    const onScroll = () => setTriggerRect(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [triggerRect]);

  return (
    <div
      ref={triggerRef}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {triggerRect && emp && (
        <EmployeePopup emp={emp} triggerRect={triggerRect} side={side} />
      )}
    </div>
  );
}

/**
 * EmpAvatarHover — Avatar nhỏ với hover card, dùng nhanh trong bảng.
 */
export function EmpAvatarHover({ emp, size = "sm", side = "right" }) {
  const photoUrl = emp?.photoPath ? employeeApi.getPhotoUrl(emp.photoPath) : null;
  const szCls = size === "lg"
    ? "w-12 h-12 text-base"
    : size === "md"
    ? "w-9 h-9 text-sm"
    : "w-7 h-7 text-xs";
  return (
    <EmployeeCard emp={emp} side={side}>
      {photoUrl ? (
        <img src={photoUrl} alt={emp?.fullName} className={`${szCls} rounded-full object-cover border border-gray-200 flex-shrink-0 cursor-default`} />
      ) : (
        <div className={`${szCls} rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 flex-shrink-0 cursor-default`}>
          {emp?.fullName?.[0] ?? "?"}
        </div>
      )}
    </EmployeeCard>
  );
}
