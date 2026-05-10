/**
 * DocumentDetailModal.jsx — Modal xem chi tiết tài liệu số (read-only).
 *
 * Hiển thị metadata + thẻ + tài sản + trạng thái + người upload + lịch sử
 * phiên bản tóm tắt. Tất cả input đều disabled. Có nút "Mở file" để tải.
 *
 * Liên quan: DocumentsPage.jsx (gọi mở), digitalAsset.service.js (getById).
 */
import { Modal } from "../ui/Modal.jsx";
import { Badge } from "../ui/Badge.jsx";
import { Button } from "../ui/Button.jsx";
import {
  FileText,
  Building2,
  Layers,
  Tag,
  ExternalLink,
  Clock,
  User,
  Hash,
  Loader2,
} from "lucide-react";
import { fDateTime } from "../../utils/format.js";

const STATUS_COLOR = {
  DRAFT: "gray",
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  ARCHIVED: "gray",
};
const STATUS_LABEL = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  ARCHIVED: "Lưu trữ",
};

function ReadOnlyField({ icon: Icon, label, value }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 min-h-[38px]">
        {Icon && <Icon size={14} className="text-slate-400 shrink-0" aria-hidden />}
        <span className="truncate" title={value || ""}>
          {value || <span className="text-slate-400">—</span>}
        </span>
      </div>
    </div>
  );
}

export function DocumentDetailModal({
  open,
  onClose,
  doc,
  loading,
  fileUrl,
}) {
  const status = doc?.status ?? "";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={doc ? `Chi tiết tài liệu: ${doc.fileName ?? `#${doc.digitalAssetId}`}` : "Chi tiết tài liệu"}
      size="lg"
    >
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-slate-400" size={28} />
        </div>
      )}

      {!loading && doc && (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={STATUS_COLOR[status] ?? "gray"}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
            {doc.currentVersion != null && (
              <Badge color="blue">v{doc.currentVersion}</Badge>
            )}
            {doc.fileType && (
              <Badge color="indigo">{String(doc.fileType).toUpperCase()}</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReadOnlyField
              icon={FileText}
              label="Tên hiển thị"
              value={doc.fileName}
            />
            <ReadOnlyField
              icon={Hash}
              label="Mã tài liệu"
              value={doc.digitalAssetId ? `#${doc.digitalAssetId}` : ""}
            />
            <ReadOnlyField
              icon={Layers}
              label="Phân loại"
              value={doc.documentCategoryName}
            />
            <ReadOnlyField
              icon={Building2}
              label="Tài sản gắn"
              value={doc.assetName ?? (doc.assetId ? `#${doc.assetId}` : "")}
            />
            <ReadOnlyField
              icon={User}
              label="Người upload"
              value={doc.uploadedByName}
            />
            <ReadOnlyField
              icon={Clock}
              label="Ngày upload"
              value={doc.uploadDate ? fDateTime(doc.uploadDate) : ""}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block">
              Mô tả
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 min-h-[60px] whitespace-pre-wrap">
              {doc.description || (
                <span className="text-slate-400">Không có mô tả.</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block flex items-center gap-1.5">
              <Tag size={13} aria-hidden /> Thẻ
            </label>
            {(doc.tags ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Chưa gắn thẻ.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {doc.tags.map((t) => (
                  <span
                    key={t.tagId}
                    className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    #{t.tagName}
                  </span>
                ))}
              </div>
            )}
          </div>

          {Array.isArray(doc.versions) && doc.versions.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block">
                Lịch sử phiên bản (mới nhất {doc.versions.length})
              </label>
              <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-44 overflow-y-auto">
                {doc.versions.map((v) => (
                  <li
                    key={v.versionId ?? v.versionNumber}
                    className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-slate-700"
                  >
                    <Badge
                      color={
                        v.versionNumber === doc.currentVersion ? "green" : "gray"
                      }
                    >
                      v{v.versionNumber}
                    </Badge>
                    <span className="text-slate-500">
                      {fDateTime(v.changeDate)}
                    </span>
                    <span className="font-medium text-slate-800">
                      {v.changedByName}
                    </span>
                    {v.changeNote && (
                      <span className="text-slate-600 truncate max-w-[260px]">
                        — {v.changeNote}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === "DRAFT" && doc.lastReviseComment && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="text-xs font-bold text-orange-800 uppercase tracking-wide">
                Yêu cầu chỉnh sửa
              </p>
              <p className="mt-1 text-sm text-orange-900 whitespace-pre-wrap">
                {doc.lastReviseComment}
              </p>
              {doc.lastReviserName && (
                <p className="mt-1 text-xs text-orange-700">
                  — {doc.lastReviserName}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 shadow-sm transition-colors"
              >
                <ExternalLink size={14} /> Mở file
              </a>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
