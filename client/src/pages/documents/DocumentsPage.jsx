/**
 * DocumentsPage.jsx — Kho tài liệu số: upload/tag/danh mục (CV KTS = Trưởng/Phó PKT — 057); thêm phê duyệt + lưu trữ cho PKT/Admin.
 * Danh sách: PENDING/DRAFT/REJECTED của chính user; APPROVED/ARCHIVED công khai; PENDING người khác không hiện.
 * Chọn tài sản khi upload/sửa: AssetIdSearchPicker (tìm server), không giới hạn 200 bản ghi.
 * Deep link: /documents?upload=1&assetId=… — mở modal upload với tài sản gắn sẵn (từ trang chi tiết tài sản).
 *
 * Nguyên tắc Sửa / Xoá / Lưu trữ (đồng bộ digitalAsset.service.js, migration 072):
 *   - DRAFT / REJECTED: tác giả + Admin/PKT đều sửa được (tuỳ role).
 *   - DRAFT: có thể xoá vĩnh viễn khỏi DB (DELETE); REJECTED chỉ sửa/gửi lại — không xoá cứng ở đây.
 *   - PENDING: khoá hết — phải qua "Yêu cầu chỉnh sửa" để về DRAFT.
 *   - APPROVED: chỉ Admin/PKT sửa metadata & lưu trữ; CV KTS chỉ xem.
 *   - Lưu trữ (version hoặc cả tài liệu) chỉ áp dụng sau khi đã duyệt. Archive version
 *     current → fallback current về phiên bản active mới nhất; hết version → archive cả tài liệu.
 *   - Tab "Đã lưu trữ" (Admin + Trưởng/Phó PKT): list version archived + Khôi phục.
 * UI gom hành động vào dropdown "ba chấm" (RowActionMenu).
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/index.js";
import { AssetIdSearchPicker } from "../../components/AssetIdSearchPicker.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Input, Select } from "../../components/ui/Input.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { PageLoader } from "../../components/ui/Spinner.jsx";
import { RowActionMenu } from "../../components/ui/RowActionMenu.jsx";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { DocumentDetailModal } from "../../components/documents/DocumentDetailModal.jsx";
import {
  FileText,
  Upload,
  Send,
  ExternalLink,
  History,
  RefreshCw,
  Tag,
  Pencil,
  Layers,
  Settings2,
  MessageSquare,
  AlertCircle,
  Archive,
  ArchiveRestore,
  Trash2,
  FileSpreadsheet,
  Eye,
} from "lucide-react";
import { fDateTime } from "../../utils/format.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  canDo,
  canAddDocumentVersion,
  canEditDigitalAssetRow,
  canArchiveDigitalAssetRow,
  canHardDeleteDraftDigitalAssetRow,
  canViewArchivedDocuments,
  canRestoreDocument,
} from "../../utils/rbac.js";
import { documentFilePublicUrl } from "../../utils/documentUrl.js";
import { exportRowsToExcel } from "../../utils/excelExport.js";
import toast from "react-hot-toast";

const DA_STATUS_COLOR = {
  DRAFT: "gray",
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  ARCHIVED: "gray",
};
const DA_STATUS_LABEL = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  ARCHIVED: "Lưu trữ",
};

const FILE_BASE = import.meta.env.VITE_API_BASE;
const fileUrl = (filePath) => documentFilePublicUrl(filePath, FILE_BASE);

/** Tooltip yêu cầu chỉnh sửa — dùng portal để thoát overflow-x-auto */
function ReviseTooltip({ reviserName, comment }) {
  const [tooltipPos, setTooltipPos] = useState(null);
  const triggerRef = useRef(null);

  const show = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setTooltipPos({ x: r.left, y: r.top });
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={() => setTooltipPos(null)}
        className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-orange-100 border border-orange-300 cursor-help select-none"
      >
        <AlertCircle size={10} className="text-orange-600 flex-shrink-0" />
        <span className="text-[10px] font-bold text-orange-700 max-w-[160px] truncate">
          Sửa bởi {reviserName}
        </span>
      </span>

      {tooltipPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: tooltipPos.x,
              top: tooltipPos.y - 12,
              transform: "translateY(-100%)",
              zIndex: 9999,
            }}
            className="w-80 bg-gray-900 text-white rounded-xl shadow-2xl pointer-events-none overflow-hidden"
          >
            <div className="px-4 py-2 bg-orange-600/20 border-b border-orange-500/30 flex items-center gap-2">
              <AlertCircle
                size={13}
                className="text-orange-400 flex-shrink-0"
              />
              <span className="text-xs font-bold text-orange-300">
                Yêu cầu chỉnh sửa
              </span>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-300">
                Người yêu cầu
              </p>
              <p className="text-sm font-bold text-white">{reviserName}</p>
              <p className="text-[11px] font-semibold text-gray-300 mt-2">
                Lý do
              </p>
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {comment}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function DocumentsPage() {
  const { user } = useAuth();
  const canUpload = canDo(user, "DOCUMENT:CREATE");
  const canSubmitDoc = canDo(user, "DOCUMENT:SUBMIT");
  const canNewVersion = canDo(user, "DOCUMENT:UPDATE");
  const canTagCreate = canDo(user, "TAG:CREATE");
  const canTagUpdate = canDo(user, "TAG:UPDATE");
  const canTagDelete = canDo(user, "TAG:DELETE");
  const canReadCategories = canDo(user, "DOCUMENT_CATEGORY:READ");
  const canSubmitDocFeedback = canDo(user, "DOCUMENT_FEEDBACK:CREATE");
  const canReviewDocFeedback = canDo(user, "DOCUMENT_FEEDBACK:REVIEW");
  const canCatCreate = canDo(user, "DOCUMENT_CATEGORY:CREATE");
  const canCatUpdate = canDo(user, "DOCUMENT_CATEGORY:UPDATE");
  const canCatDelete = canDo(user, "DOCUMENT_CATEGORY:DELETE");
  const canManageCatalog = canTagCreate || canCatCreate;
  const canSeeArchived = canViewArchivedDocuments(user);
  const canRestoreDocs = canRestoreDocument(user);
  const [tab, setTab] = useState("active");

  const [docs, setDocs] = useState([]);
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchQ(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchQ, filterCategoryId, filterStatus]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState({
    description: "",
    assetId: "",
    tagIds: [],
    documentCategoryId: "",
    customFileName: "",
  });
  const [uploading, setUploading] = useState(false);

  const [verDoc, setVerDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [verLoading, setVerLoading] = useState(false);
  const [newVerFile, setNewVerFile] = useState(null);
  const [changeNote, setChangeNote] = useState("");
  const [verUploading, setVerUploading] = useState(false);

  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState("tags");
  const [newTagName, setNewTagName] = useState("");
  const [tagEditing, setTagEditing] = useState(null);
  const [tagEditName, setTagEditName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [catEditing, setCatEditing] = useState(null);
  const [catEditName, setCatEditName] = useState("");
  const [catEditDesc, setCatEditDesc] = useState("");

  const [editDoc, setEditDoc] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  // Confirm popup khi nhấn "Lưu" trong modal sửa (theo pattern Asset/WO).
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);

  // Xem chi tiết (read-only).
  const [viewDoc, setViewDoc] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Lưu trữ thay xoá cứng (072): chọn cả tài liệu hoặc 1 phiên bản.
  const [archiveTarget, setArchiveTarget] = useState(null); // doc đang chọn để archive
  const [archiveScope, setArchiveScope] = useState("DOCUMENT"); // 'DOCUMENT' | 'VERSION'
  const [archiveVersions, setArchiveVersions] = useState([]); // versions còn active
  const [archiveSelectedId, setArchiveSelectedId] = useState(null); // VersionID khi scope=VERSION
  const [archiveVersionsLoading, setArchiveVersionsLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [deleteDraftTarget, setDeleteDraftTarget] = useState(null);
  const [deleteDraftLoading, setDeleteDraftLoading] = useState(false);

  // Tab "Đã lưu trữ" (Admin/PKT) — list version archived.
  const [archivedItems, setArchivedItems] = useState([]);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [archivedPage, setArchivedPage] = useState(1);
  const [archivedSearchInput, setArchivedSearchInput] = useState("");
  const [archivedSearch, setArchivedSearch] = useState("");
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null); // version archived đang chọn khôi phục
  const [restoring, setRestoring] = useState(false);

  const [fbDoc, setFbDoc] = useState(null);
  const [fbList, setFbList] = useState([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbBody, setFbBody] = useState("");
  const [fbSending, setFbSending] = useState(false);

  const LIMIT = 15;
  const [searchParams, setSearchParams] = useSearchParams();

  const refreshTags = useCallback(() => {
    api
      .get("/tags")
      .then((r) => setTags(r.data.data?.items ?? r.data.data ?? []))
      .catch(() => {});
  }, []);

  const refreshCategories = useCallback(() => {
    if (!canReadCategories) return;
    api
      .get("/document-categories")
      .then((r) => setCategories(Array.isArray(r.data.data) ? r.data.data : []))
      .catch(() => setCategories([]));
  }, [canReadCategories]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      const q = searchQ.trim();
      if (q) params.q = q;
      if (filterCategoryId) params.documentCategoryId = filterCategoryId;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get("/digital-assets", { params });
      setDocs(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, searchQ, filterCategoryId, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    refreshTags();
    refreshCategories();
  }, [refreshTags, refreshCategories]);

  /** Mở upload từ URL (?upload=1&assetId=) — ví dụ từ AssetDetailPage */
  useEffect(() => {
    if (searchParams.get("upload") !== "1") return;
    const aid = searchParams.get("assetId");
    if (canUpload) {
      setUploadOpen(true);
      if (aid && /^\d+$/.test(aid)) setMeta((m) => ({ ...m, assetId: aid }));
    }
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("upload");
        n.delete("assetId");
        return n;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, canUpload]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Chọn file trước");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const displayName = meta.customFileName.trim() || file.name;
    fd.append("customFileName", displayName);
    if (meta.description) fd.append("description", meta.description);
    if (meta.assetId) fd.append("assetId", meta.assetId);
    if (meta.documentCategoryId)
      fd.append("documentCategoryId", meta.documentCategoryId);
    if (meta.tagIds?.length) fd.append("tagIds", JSON.stringify(meta.tagIds));
    try {
      await api.post("/digital-assets", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Đã upload tài liệu");
      setUploadOpen(false);
      setFile(null);
      setMeta({
        description: "",
        assetId: "",
        tagIds: [],
        documentCategoryId: "",
        customFileName: "",
      });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitApproval = async (docId) => {
    try {
      await api.post(`/digital-assets/${docId}/submit`, {});
      toast.success("Đã gửi yêu cầu phê duyệt");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi gửi phê duyệt");
    }
  };

  const openFeedback = async (doc) => {
    setFbDoc(doc);
    setFbBody("");
    setFbLoading(true);
    setFbList([]);
    try {
      const res = await api.get(
        `/digital-assets/${doc.digitalAssetId}/feedback`,
      );
      setFbList(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      toast.error("Không tải được danh sách phản hồi");
    } finally {
      setFbLoading(false);
    }
  };

  const sendFeedback = async (e) => {
    e.preventDefault();
    if (!fbDoc || !canSubmitDocFeedback) return;
    const t = fbBody.trim();
    if (!t) {
      toast.error("Nhập nội dung góp ý");
      return;
    }
    setFbSending(true);
    try {
      await api.post(`/digital-assets/${fbDoc.digitalAssetId}/feedback`, {
        body: t,
      });
      toast.success("Đã gửi phản hồi");
      setFbBody("");
      const res = await api.get(
        `/digital-assets/${fbDoc.digitalAssetId}/feedback`,
      );
      setFbList(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không gửi được phản hồi");
    } finally {
      setFbSending(false);
    }
  };

  const openVersions = async (doc) => {
    setVerDoc(doc);
    setVerLoading(true);
    setVersions([]);
    setNewVerFile(null);
    setChangeNote("");
    try {
      const res = await api.get(
        `/digital-assets/${doc.digitalAssetId}/versions`,
      );
      setVersions(res.data.data ?? []);
    } catch {
      toast.error("Không tải được lịch sử phiên bản");
    } finally {
      setVerLoading(false);
    }
  };

  const handleUploadVersion = async (e) => {
    e.preventDefault();
    if (!newVerFile) {
      toast.error("Chọn file mới trước");
      return;
    }
    setVerUploading(true);
    const fd = new FormData();
    fd.append("file", newVerFile);
    if (changeNote) fd.append("changeNote", changeNote);
    try {
      await api.post(`/digital-assets/${verDoc.digitalAssetId}/versions`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Đã upload phiên bản mới — tài liệu về DRAFT");
      setNewVerFile(null);
      setChangeNote("");
      await openVersions(verDoc);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi upload phiên bản");
    } finally {
      setVerUploading(false);
    }
  };

  const openViewDoc = useCallback(async (doc, opts = {}) => {
    setViewDoc({ digitalAssetId: doc.digitalAssetId });
    setViewLoading(true);
    try {
      const params = opts.forApproval ? { forApproval: "1" } : {};
      const res = await api.get(`/digital-assets/${doc.digitalAssetId}`, { params });
      setViewDoc(res.data.data);
    } catch (err) {
      toast.error(
        err.response?.data?.message ?? "Không mở được chi tiết tài liệu",
      );
      setViewDoc(null);
    } finally {
      setViewLoading(false);
    }
  }, []);

  /** Deep-link từ phê duyệt / thông báo: /documents?docId= */
  useEffect(() => {
    const raw = searchParams.get("docId");
    if (!raw || !/^\d+$/.test(raw)) return;
    openViewDoc({ digitalAssetId: Number(raw) }, { forApproval: true });
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("docId");
        return n;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, openViewDoc]);

  // ── Lưu trữ (072) ────────────────────────────────────────────────────────
  /**
   * Mở popup chọn lưu trữ. Tự fetch versions còn active để hiển thị radio
   * cho user chọn nếu họ muốn archive theo phiên bản cụ thể.
   */
  const openArchiveDoc = async (doc) => {
    setArchiveTarget(doc);
    setArchiveScope("DOCUMENT");
    setArchiveSelectedId(null);
    setArchiveVersions([]);
    setArchiveVersionsLoading(true);
    try {
      const res = await api.get(
        `/digital-assets/${doc.digitalAssetId}/versions`,
      );
      const list = Array.isArray(res.data.data) ? res.data.data : [];
      setArchiveVersions(list);
    } catch {
      toast.error("Không tải được danh sách phiên bản");
    } finally {
      setArchiveVersionsLoading(false);
    }
  };

  const closeArchiveDoc = () => {
    if (archiving) return;
    setArchiveTarget(null);
    setArchiveScope("DOCUMENT");
    setArchiveSelectedId(null);
    setArchiveVersions([]);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      if (archiveScope === "VERSION") {
        if (!archiveSelectedId) {
          toast.error("Chọn phiên bản cần lưu trữ");
          setArchiving(false);
          return;
        }
        const res = await api.post(
          `/digital-assets/${archiveTarget.digitalAssetId}/versions/${archiveSelectedId}/archive`,
        );
        toast.success(res.data?.data?.message ?? "Đã lưu trữ phiên bản");
      } else {
        await api.post(
          `/digital-assets/${archiveTarget.digitalAssetId}/archive-document`,
        );
        toast.success("Đã lưu trữ cả tài liệu");
      }
      closeArchiveDoc();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không thể lưu trữ");
    } finally {
      setArchiving(false);
    }
  };

  const handleHardDeleteDraft = async () => {
    if (!deleteDraftTarget) return;
    setDeleteDraftLoading(true);
    try {
      await api.delete(`/digital-assets/${deleteDraftTarget.digitalAssetId}`);
      toast.success("Đã xoá vĩnh viễn tài liệu khỏi hệ thống");
      setDeleteDraftTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không xoá được tài liệu");
    } finally {
      setDeleteDraftLoading(false);
    }
  };

  // ── Khôi phục (Admin / PKT) ─────────────────────────────────────────────
  const loadArchived = useCallback(async () => {
    if (!canSeeArchived) return;
    setArchivedLoading(true);
    try {
      const params = { page: archivedPage, limit: LIMIT };
      const q = archivedSearch.trim();
      if (q) params.q = q;
      const res = await api.get("/digital-assets/archived-versions", { params });
      setArchivedItems(res.data.data?.items ?? []);
      setArchivedTotal(res.data.data?.total ?? 0);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không tải được kho lưu trữ");
    } finally {
      setArchivedLoading(false);
    }
  }, [archivedPage, archivedSearch, canSeeArchived]);

  useEffect(() => {
    if (tab !== "archived") return;
    const t = setTimeout(() => setArchivedSearch(archivedSearchInput), 400);
    return () => clearTimeout(t);
  }, [archivedSearchInput, tab]);

  useEffect(() => {
    setArchivedPage(1);
  }, [archivedSearch]);

  useEffect(() => {
    if (tab === "archived") loadArchived();
  }, [tab, loadArchived]);

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await api.post(
        `/digital-assets/${restoreTarget.digitalAssetId}/versions/${restoreTarget.versionId}/restore`,
      );
      toast.success("Đã khôi phục phiên bản");
      setRestoreTarget(null);
      loadArchived();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Không thể khôi phục");
    } finally {
      setRestoring(false);
    }
  };

  // Submit form sửa: chỉ mở popup xác nhận, gọi API sau khi user chọn "Có".
  const saveEditDoc = (e) => {
    e.preventDefault();
    if (!editDoc) return;
    setEditConfirmOpen(true);
  };

  const confirmSaveEditDoc = async () => {
    if (!editDoc) return;
    setEditSaving(true);
    try {
      await api.put(`/digital-assets/${editDoc.digitalAssetId}`, {
        description: editDoc.description || null,
        assetId: editDoc.assetId ? Number(editDoc.assetId) : null,
        documentCategoryId: editDoc.documentCategoryId
          ? Number(editDoc.documentCategoryId)
          : null,
        tagIds: Array.isArray(editDoc.tagIds) ? editDoc.tagIds : [],
      });
      toast.success("Đã cập nhật tài liệu");
      setEditConfirmOpen(false);
      setEditDoc(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi cập nhật");
    } finally {
      setEditSaving(false);
    }
  };

  const addTag = async () => {
    const name = newTagName.trim();
    if (!name) {
      toast.error("Nhập tên thẻ");
      return;
    }
    try {
      await api.post("/tags", { tagName: name });
      setNewTagName("");
      refreshTags();
      toast.success("Đã thêm thẻ");
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const saveTagEdit = async (id) => {
    const name = tagEditName.trim();
    if (!name) {
      toast.error("Tên thẻ không được để trống");
      return;
    }
    try {
      await api.put(`/tags/${id}`, { tagName: name });
      setTagEditing(null);
      refreshTags();
      toast.success("Đã cập nhật thẻ");
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const deleteTag = async (id) => {
    if (
      !window.confirm(
        "Xóa thẻ khỏi danh mục? (Tài liệu sẽ gỡ liên kết thẻ này.)",
      )
    )
      return;
    try {
      await api.delete(`/tags/${id}`);
      refreshTags();
      load();
      toast.success("Đã xóa thẻ");
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi xóa");
    }
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) {
      toast.error("Nhập tên phân loại");
      return;
    }
    try {
      await api.post("/document-categories", {
        categoryName: name,
        description: newCatDesc.trim() || null,
      });
      setNewCatName("");
      setNewCatDesc("");
      refreshCategories();
      toast.success("Đã thêm phân loại");
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const saveCategoryEdit = async (id) => {
    const name = catEditName.trim();
    if (!name) {
      toast.error("Tên không được để trống");
      return;
    }
    try {
      await api.put(`/document-categories/${id}`, {
        categoryName: name,
        description: catEditDesc.trim() || null,
      });
      setCatEditing(null);
      refreshCategories();
      load();
      toast.success("Đã cập nhật phân loại");
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi");
    }
  };

  const deleteCategory = async (id) => {
    if (
      !window.confirm(
        "Xóa phân loại? Tài liệu gắn loại này sẽ để trống phân loại.",
      )
    )
      return;
    try {
      await api.delete(`/document-categories/${id}`);
      refreshCategories();
      if (filterCategoryId === String(id)) setFilterCategoryId("");
      load();
      toast.success("Đã xóa phân loại");
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Lỗi xóa");
    }
  };

  const handleExportExcel = () => {
    const ok = exportRowsToExcel({
      rows: docs.map((doc) => ({
        "ID tài liệu": doc.digitalAssetId,
        "Tên tài liệu": doc.fileName ?? "",
        "Mô tả": doc.description ?? "",
        "Phân loại": doc.documentCategoryName ?? "",
        "Thẻ": (doc.tags ?? []).map((t) => t.tagName).join(", "),
        "Tài sản": doc.assetName ?? "",
        "Phiên bản hiện tại": doc.currentVersion ?? "",
        "Ngày upload": fDateTime(doc.uploadDate) ?? "",
        "Trạng thái": DA_STATUS_LABEL[doc.status] ?? doc.status ?? "",
      })),
      sheetName: "Tai lieu so",
      fileName: `tai-lieu-so-trang-${page}.xlsx`,
    });
    if (!ok) {
      toast.error("Không có dữ liệu để xuất Excel");
      return;
    }
    toast.success("Đã xuất Excel danh sách tài liệu số");
  };

  return (
    <div className="space-y-5">
      {canSeeArchived && (
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
              tab === "active"
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Đang dùng
          </button>
          <button
            type="button"
            onClick={() => setTab("archived")}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 ${
              tab === "archived"
                ? "bg-amber-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Archive size={13} /> Đã lưu trữ
          </button>
        </div>
      )}

      {tab === "archived" && canSeeArchived && (
        <ArchivedVersionsPanel
          items={archivedItems}
          total={archivedTotal}
          loading={archivedLoading}
          page={archivedPage}
          limit={LIMIT}
          searchInput={archivedSearchInput}
          onSearchChange={setArchivedSearchInput}
          onPageChange={setArchivedPage}
          canRestore={canRestoreDocs}
          onRestore={(item) =>
            setRestoreTarget({
              digitalAssetId: item.digitalAssetId,
              versionId: item.versionId,
              versionNumber: item.versionNumber,
              fileName: item.fileName,
            })
          }
          fileUrlOf={(p) => fileUrl(p)}
        />
      )}

      {tab === "active" && (
        <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 flex-1 min-w-[240px]">
          <div className="flex-1 min-w-[200px] max-w-md">
            <Input
              label="Tìm kiếm tài liệu"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tên file, mô tả, tài sản, người upload, phân loại, thẻ…"
            />
          </div>
          {canReadCategories && (
            <div className="w-44">
              <Select
                label="Phân loại"
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
              >
                <option value="">— Tất cả —</option>
                {categories.map((c) => (
                  <option
                    key={c.documentCategoryId}
                    value={c.documentCategoryId}
                  >
                    {c.categoryName}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="w-40">
            <Select
              label="Trạng thái"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">— Tất cả —</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="PENDING">Chờ duyệt (của tôi)</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
              <option value="ARCHIVED">Lưu trữ</option>
            </Select>
          </div>
          <div className="flex items-end pb-0.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchInput("");
                setFilterCategoryId("");
                setFilterStatus("");
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            onClick={handleExportExcel}
            disabled={loading || docs.length === 0}
            title={
              docs.length === 0
                ? "Không có dữ liệu để xuất"
                : "Xuất Excel theo danh sách đang hiển thị"
            }
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </Button>
          {canManageCatalog && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setManageOpen(true);
                setManageTab("tags");
              }}
            >
              <Settings2 size={15} /> Quản lý thẻ & phân loại
            </Button>
          )}
          {canUpload && (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload size={15} /> Upload tài liệu
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Không có tài liệu"
            description="Thử đổi từ khóa / bộ lọc, hoặc upload tài liệu mới."
          />
        ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                  {[
                    "Tài liệu",
                    "Phân loại",
                    "Thẻ",
                    "Tài sản",
                    "Phiên bản",
                    "Ngày upload",
                    "Trạng thái",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-4 py-3"
                    >
                      {h}
                    </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                {docs.map((doc) => (
                  <tr
                    key={doc.digitalAssetId}
                    id={`doc-${doc.digitalAssetId}`}
                    className="hover:bg-blue-50/30"
                  >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                        <FileText
                          size={16}
                          className="text-blue-400 flex-shrink-0"
                        />
                            <div>
                          <p className="font-semibold text-gray-900 truncate max-w-[200px]">
                            {doc.fileName}
                          </p>
                          {doc.description && (
                            <p className="text-xs font-medium text-gray-500 truncate max-w-[200px]">
                              {doc.description}
                            </p>
                          )}
                          {doc.status === "DRAFT" && doc.lastReviseComment && (
                            <ReviseTooltip
                              reviserName={doc.lastReviserName}
                              comment={doc.lastReviseComment}
                            />
                          )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                      {doc.documentCategoryName ? (
                        <Badge color="indigo">{doc.documentCategoryName}</Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[140px]">
                        {(doc.tags ?? []).length === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          doc.tags.map((t) => (
                            <span
                              key={t.tagId}
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700"
                            >
                              #{t.tagName}
                            </span>
                          ))
                        )}
                          </div>
                        </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {doc.assetName ?? "—"}
                    </td>
                        <td className="px-4 py-3 text-center">
                          <Badge color="blue">v{doc.currentVersion}</Badge>
                        </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700">
                      {fDateTime(doc.uploadDate)}
                    </td>
                        <td className="px-4 py-3">
                      <Badge color={DA_STATUS_COLOR[doc.status]}>
                        {DA_STATUS_LABEL[doc.status] ?? doc.status}
                      </Badge>
                        </td>
                        <td className="px-4 py-3">
                      <DocRowActions
                        doc={doc}
                        user={user}
                        canSubmitDoc={canSubmitDoc}
                        fileUrl={fileUrl(doc.filePath)}
                        onView={() => openViewDoc(doc)}
                        onEdit={() =>
                          setEditDoc({
                                  digitalAssetId: doc.digitalAssetId,
                            description: doc.description ?? "",
                            assetId: doc.assetId ?? "",
                            documentCategoryId: doc.documentCategoryId ?? "",
                            tagIds: (doc.tags ?? []).map((t) => t.tagId),
                          })
                        }
                        onArchive={() => openArchiveDoc(doc)}
                        onHardDelete={() => setDeleteDraftTarget(doc)}
                        onFeedback={() => openFeedback(doc)}
                        onVersions={() => openVersions(doc)}
                        onSubmit={() => handleSubmitApproval(doc.digitalAssetId)}
                      />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / LIMIT) || 1}
        onChange={setPage}
      />
        </>
      )}

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload tài liệu kỹ thuật"
        size="md"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">
              Chọn file *
            </label>
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files[0] ?? null;
                setFile(f);
                if (f) setMeta((p) => ({ ...p, customFileName: f.name }));
              }}
              className="w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:font-medium hover:file:bg-blue-100 transition-colors"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.mp4,.dwg,.zip"
            />
            <p className="text-xs text-gray-500 mt-1">
              Hỗ trợ: PDF, Word, Excel, CSV, ảnh, MP4, DWG, ZIP.
            </p>
          </div>
          <Input
            label="Tên hiển thị"
            value={meta.customFileName}
            onChange={(e) =>
              setMeta((p) => ({ ...p, customFileName: e.target.value }))
            }
            placeholder="Tự điền từ file — có thể sửa thủ công"
          />
          {canReadCategories && (
            <Select
              label="Phân loại (1 tài liệu — 1 loại)"
              value={meta.documentCategoryId}
              onChange={(e) =>
                setMeta((p) => ({ ...p, documentCategoryId: e.target.value }))
              }
            >
              <option value="">— Chưa chọn —</option>
              {categories.map((c) => (
                <option key={c.documentCategoryId} value={c.documentCategoryId}>
                  {c.categoryName}
                </option>
              ))}
            </Select>
          )}
          <AssetIdSearchPicker
            id="doc-upload-asset"
            value={meta.assetId}
            onChange={(assetId) => setMeta((p) => ({ ...p, assetId }))}
          />
          <Input
            label="Mô tả"
            value={meta.description}
            onChange={(e) =>
              setMeta((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="VD: Bản vẽ kỹ thuật lò nung #1"
          />
          {tags.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-1.5">
                <Tag size={13} /> Gắn thẻ (nhiều thẻ được phép)
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => {
                  const sel = meta.tagIds.includes(t.tagId);
                  return (
                    <button
                      key={t.tagId}
                      type="button"
                      onClick={() =>
                        setMeta((p) => ({
                        ...p,
                          tagIds: sel
                            ? p.tagIds.filter((x) => x !== t.tagId)
                            : [...p.tagIds, t.tagId],
                        }))
                      }
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        sel
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                      }`}
                    >
                      #{t.tagName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setUploadOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" loading={uploading}>
              <Upload size={14} /> Upload
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Quản lý thẻ & phân loại"
        size="lg"
      >
        <div className="flex gap-2 border-b border-gray-200 pb-3 mb-4">
          <button
            type="button"
            onClick={() => setManageTab("tags")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${manageTab === "tags" ? "bg-blue-100 text-blue-800" : "text-gray-600 hover:bg-gray-50"}`}
          >
            <Tag size={14} className="inline mr-1" /> Thẻ (tags)
          </button>
          <button
            type="button"
            onClick={() => setManageTab("categories")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${manageTab === "categories" ? "bg-blue-100 text-blue-800" : "text-gray-600 hover:bg-gray-50"}`}
          >
            <Layers size={14} className="inline mr-1" /> Phân loại
          </button>
        </div>

        {manageTab === "tags" && (
          <div className="space-y-4">
            {canTagCreate && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    label="Thêm thẻ mới"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="VD: BanVe, AnToan"
                  />
                </div>
                <Button type="button" onClick={addTag}>
                  Thêm
                </Button>
              </div>
            )}
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
              {tags.map((t) => (
                <li
                  key={t.tagId}
                  className="px-3 py-2 flex items-center justify-between gap-2"
                >
                  {tagEditing === t.tagId ? (
                    <>
                      <Input
                        value={tagEditName}
                        onChange={(e) => setTagEditName(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveTagEdit(t.tagId)}
                      >
                        Lưu
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setTagEditing(null)}
                      >
                        Hủy
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-gray-800">
                        #{t.tagName}
                      </span>
                      <div className="flex gap-1">
                        {canTagUpdate && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setTagEditing(t.tagId);
                              setTagEditName(t.tagName);
                            }}
                          >
                            Sửa
                          </Button>
                        )}
                        {canTagDelete && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => deleteTag(t.tagId)}
                          >
                            Xóa
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {manageTab === "categories" && (
          <div className="space-y-4">
            {canCatCreate && (
              <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                <Input
                  label="Tên phân loại"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="VD: SOP, CAD, Video"
                />
                <Input
                  label="Mô tả (tuỳ chọn)"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                />
                <Button type="button" onClick={addCategory}>
                  Thêm phân loại
                </Button>
              </div>
            )}
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
              {categories.map((c) => (
                <li key={c.documentCategoryId} className="px-3 py-2 space-y-2">
                  {catEditing === c.documentCategoryId ? (
                    <div className="space-y-2">
                      <Input
                        value={catEditName}
                        onChange={(e) => setCatEditName(e.target.value)}
                      />
                      <Input
                        value={catEditDesc}
                        onChange={(e) => setCatEditDesc(e.target.value)}
                        placeholder="Mô tả"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => saveCategoryEdit(c.documentCategoryId)}
                        >
                          Lưu
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setCatEditing(null)}
                        >
                          Hủy
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {c.categoryName}
                        </p>
                        {c.description && (
                          <p className="text-xs text-gray-500">
                            {c.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {canCatUpdate && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setCatEditing(c.documentCategoryId);
                              setCatEditName(c.categoryName);
                              setCatEditDesc(c.description ?? "");
                            }}
                          >
                            Sửa
                          </Button>
                        )}
                        {canCatDelete && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => deleteCategory(c.documentCategoryId)}
                          >
                            Xóa
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      <Modal
        open={!!editDoc}
        onClose={() => setEditDoc(null)}
        title="Sửa thông tin tài liệu"
        size="md"
      >
        {editDoc && (
          <form onSubmit={saveEditDoc} className="space-y-4">
            <Input
              label="Mô tả"
              value={editDoc.description}
              onChange={(e) =>
                setEditDoc((d) => ({ ...d, description: e.target.value }))
              }
            />
            <AssetIdSearchPicker
              id="doc-edit-asset"
              value={
                editDoc.assetId === null || editDoc.assetId === undefined
                  ? ""
                  : String(editDoc.assetId)
              }
              onChange={(assetId) => setEditDoc((d) => ({ ...d, assetId }))}
              label="Tài sản"
            />
            {canReadCategories && (
              <Select
                label="Phân loại"
                value={
                  editDoc.documentCategoryId === null ||
                  editDoc.documentCategoryId === undefined
                    ? ""
                    : String(editDoc.documentCategoryId)
                }
                onChange={(e) =>
                  setEditDoc((d) => ({
                    ...d,
                    documentCategoryId: e.target.value,
                  }))
                }
              >
                <option value="">— Chưa chọn —</option>
                {categories.map((c) => (
                  <option
                    key={c.documentCategoryId}
                    value={c.documentCategoryId}
                  >
                    {c.categoryName}
                  </option>
                ))}
              </Select>
            )}
            {tags.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-1.5">
                  <Tag size={13} /> Thẻ (có thể chọn nhiều)
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => {
                    const selected = (editDoc.tagIds ?? []).includes(t.tagId);
                    return (
                      <button
                        key={t.tagId}
                        type="button"
                        onClick={() =>
                          setEditDoc((d) => ({
                            ...d,
                            tagIds: selected
                              ? (d.tagIds ?? []).filter((x) => x !== t.tagId)
                              : [...(d.tagIds ?? []), t.tagId],
                          }))
                        }
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          selected
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                        }`}
                      >
                        #{t.tagName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditDoc(null)}
              >
                Hủy
              </Button>
              <Button type="submit" loading={editSaving}>
                Lưu
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!fbDoc}
        onClose={() => {
          setFbDoc(null);
          setFbList([]);
          setFbBody("");
        }}
        title={fbDoc ? `Phản hồi: ${fbDoc.fileName}` : ""}
        size="lg"
      >
        {fbDoc && (
          <div className="space-y-4">
            {canReviewDocFeedback && (
              <p className="text-sm bg-teal-50 border border-teal-200 text-teal-900 rounded-lg px-3 py-2">
                Bạn đang xem toàn bộ phản hồi cho tài liệu này. Cập nhật trạng
                thái tại{" "}
                <Link
                  to="/documents/feedback-inbox"
                  className="font-bold underline"
                >
                  hàng đợi Chuyên viên KTS
                </Link>
                .
              </p>
            )}
            {canSubmitDocFeedback && (
              <form
                onSubmit={sendFeedback}
                className="space-y-2 border-b border-gray-200 pb-4"
              >
                <label className="text-sm font-semibold text-gray-800 block">
                  Gửi góp ý / báo sai nội dung
                </label>
                <textarea
                  value={fbBody}
                  onChange={(e) => setFbBody(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900
                    placeholder:text-gray-600 placeholder:opacity-100
                    focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  placeholder="Mô tả vấn đề hoặc đề xuất cập nhật…"
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" loading={fbSending}>
                    <MessageSquare size={13} /> Gửi phản hồi
                  </Button>
                </div>
              </form>
            )}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                {canReviewDocFeedback ? "Tất cả phản hồi" : "Phản hồi của bạn"}
              </h4>
              {fbLoading ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  Đang tải…
                </p>
              ) : fbList.length === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Chưa có phản hồi nào.
                </p>
              ) : (
                <ul className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {fbList.map((f) => (
                    <li
                      key={f.feedbackId}
                      className="border border-gray-100 rounded-lg p-3 bg-gray-50/80"
                    >
                      <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500 mb-1">
                        <span className="font-semibold text-gray-800">
                          {f.authorName}
                        </span>
                        <span>{fDateTime(f.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {f.body}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        <Badge
                          color={
                            f.status === "RESOLVED"
                              ? "green"
                              : f.status === "DISMISSED"
                                ? "gray"
                                : f.status === "IN_REVIEW"
                                  ? "blue"
                                  : "yellow"
                          }
                        >
                          {f.status === "OPEN"
                            ? "Chờ xử lý"
                            : f.status === "IN_REVIEW"
                              ? "Đang xem xét"
                              : f.status === "RESOLVED"
                                ? "Đã xử lý"
                                : f.status === "DISMISSED"
                                  ? "Không xử lý"
                                  : f.status}
                        </Badge>
                        {f.reviewNote && (
                          <span className="text-xs text-gray-600">
                            <span className="font-semibold">KT:</span>{" "}
                            {f.reviewNote}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!verDoc}
        onClose={() => setVerDoc(null)}
        title={`Phiên bản: ${verDoc?.fileName ?? ""}`}
        size="lg"
      >
        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Lịch sử phiên bản
            </h4>
            {verLoading ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Đang tải...
              </p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
                Chưa có lịch sử phiên bản nào.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {[
                        "Phiên bản",
                        "Ngày thay đổi",
                        "Người thay đổi",
                        "Ghi chú",
                        "",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-bold text-gray-600 px-3 py-2"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {versions.map((v) => (
                      <tr key={v.versionId} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <Badge
                            color={
                              v.versionNumber === verDoc?.currentVersion
                                ? "green"
                                : "gray"
                            }
                          >
                            v{v.versionNumber}
                            {v.versionNumber === verDoc?.currentVersion
                              ? " (hiện tại)"
                              : ""}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {fDateTime(v.changeDate)}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">
                          {v.changedByName}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[200px] truncate">
                          {v.changeNote ?? "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <a
                            href={fileUrl(v.filePath)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline font-medium"
                          >
                            Tải về
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {verDoc?.status === "PENDING" && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Tài liệu đang <strong>chờ phê duyệt</strong> — không thể upload
              phiên bản mới hay sửa metadata cho đến khi Trưởng ca/Trưởng phòng
              xử lý.
            </p>
          )}

          {canAddDocumentVersion(user, verDoc) && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <RefreshCw size={14} /> Upload phiên bản mới
              </h4>
              <form onSubmit={handleUploadVersion} className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    File mới *
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setNewVerFile(e.target.files[0] ?? null)}
                    className="w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:font-medium hover:file:bg-blue-100"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.mp4,.dwg,.zip"
                  />
                </div>
                <Input
                  label="Ghi chú thay đổi"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="VD: Cập nhật theo tiêu chuẩn mới"
                />
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                  Sau khi upload, tài liệu về <strong>DRAFT</strong> và cần gửi
                  phê duyệt lại. Tên tài liệu trong kho giữ nguyên (chỉ đổi file
                  và số phiên bản); có thể đổi tên/mô tả sau khi về bản nháp.
                </p>
                <div className="flex justify-end">
                  <Button type="submit" loading={verUploading} size="sm">
                    <Upload size={13} /> Upload v
                    {(verDoc?.currentVersion ?? 0) + 1}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal xem chi tiết (read-only) — đồng bộ pattern Asset/WO. */}
      <DocumentDetailModal
        open={!!viewDoc}
        onClose={() => setViewDoc(null)}
        doc={viewDoc && !viewLoading ? viewDoc : null}
        loading={viewLoading}
        fileUrl={viewDoc?.filePath ? fileUrl(viewDoc.filePath) : null}
      />

      {/* Confirm xác nhận lưu chỉnh sửa metadata. */}
      <ConfirmDialog
        open={editConfirmOpen}
        title="Xác nhận chỉnh sửa"
        message="Bạn có muốn lưu chi tiết chỉnh sửa không?"
        confirmLabel="Có, lưu"
        cancelLabel="Không"
        loading={editSaving}
        onConfirm={confirmSaveEditDoc}
        onCancel={() => setEditConfirmOpen(false)}
      />

      {/* Modal Lưu trữ — chọn cả tài liệu hoặc 1 phiên bản (072). */}
      <Modal
        open={!!archiveTarget}
        onClose={closeArchiveDoc}
        title="Lưu trữ tài liệu"
        size="md"
      >
        {archiveTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs font-semibold text-amber-800">
                <Archive size={12} className="inline mr-1" />
                Tài liệu sẽ được đem vào kho lưu trữ — không xoá cứng. Có thể
                khôi phục bởi Quản trị viên hoặc Trưởng/Phó phòng KT-CN.
              </p>
    </div>

            <div>
              <p className="text-sm font-semibold text-gray-700">
                {archiveTarget.fileName}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Phiên bản hiện tại:{" "}
                <strong>v{archiveTarget.currentVersion}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">
                <input
                  type="radio"
                  name="archive-scope"
                  value="DOCUMENT"
                  checked={archiveScope === "DOCUMENT"}
                  onChange={() => setArchiveScope("DOCUMENT")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Lưu trữ cả tài liệu
                  </p>
                  <p className="text-xs text-gray-500">
                    Toàn bộ phiên bản sẽ chuyển vào kho lưu trữ; tài liệu biến
                    mất khỏi danh sách chính.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">
                <input
                  type="radio"
                  name="archive-scope"
                  value="VERSION"
                  checked={archiveScope === "VERSION"}
                  onChange={() => setArchiveScope("VERSION")}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Lưu trữ một phiên bản cụ thể
                  </p>
                  <p className="text-xs text-gray-500">
                    Nếu là phiên bản hiện tại, hệ thống tự fallback về phiên
                    bản còn active mới nhất. Hết phiên bản → tài liệu cũng vào
                    kho lưu trữ.
                  </p>
                </div>
              </label>
            </div>

            {archiveScope === "VERSION" && (
              <div className="rounded-lg border border-gray-200 max-h-56 overflow-y-auto">
                {archiveVersionsLoading ? (
                  <p className="text-xs text-gray-500 px-3 py-3">
                    Đang tải phiên bản…
                  </p>
                ) : archiveVersions.length === 0 ? (
                  <p className="text-xs text-gray-500 px-3 py-3">
                    Không còn phiên bản active.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {archiveVersions.map((v) => {
                      const isCurrent =
                        Number(v.versionNumber) ===
                        Number(archiveTarget.currentVersion);
                      return (
                        <li key={v.versionId}>
                          <label className="flex items-start gap-2 cursor-pointer px-3 py-2 hover:bg-blue-50/40">
                            <input
                              type="radio"
                              name="archive-version"
                              value={v.versionId}
                              checked={archiveSelectedId === v.versionId}
                              onChange={() =>
                                setArchiveSelectedId(v.versionId)
                              }
                              className="mt-0.5"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
                                v{v.versionNumber}
                                {isCurrent && (
                                  <Badge color="blue">Hiện tại</Badge>
                                )}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                {fDateTime(v.changeDate)} • {v.changedByName}
                                {v.changeNote ? ` — ${v.changeNote}` : ""}
                              </p>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={closeArchiveDoc}
                disabled={archiving}
              >
                Huỷ
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={archiving}
                onClick={confirmArchive}
                disabled={
                  archiving ||
                  (archiveScope === "VERSION" && !archiveSelectedId)
                }
              >
                <Archive size={14} /> Lưu trữ
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Xoá vĩnh viễn — chỉ bản nháp (DRAFT). */}
      <ConfirmDialog
        open={!!deleteDraftTarget}
        title="Xoá vĩnh viễn"
        message={
          deleteDraftTarget
            ? `Xoá vĩnh viễn bản nháp "${deleteDraftTarget.fileName}" khỏi cơ sở dữ liệu? Thao tác này không thể hoàn tác.`
            : ""
        }
        confirmLabel="Xoá vĩnh viễn"
        cancelLabel="Huỷ"
        variant="danger"
        loading={deleteDraftLoading}
        onConfirm={handleHardDeleteDraft}
        onCancel={() => setDeleteDraftTarget(null)}
      />

      {/* Confirm Khôi phục phiên bản (Admin/PKT). */}
      <ConfirmDialog
        open={!!restoreTarget}
        title="Khôi phục phiên bản"
        message={
          restoreTarget
            ? `Khôi phục v${restoreTarget.versionNumber} của "${restoreTarget.fileName}"? ` +
              "Phiên bản sẽ được đưa lại danh sách chính."
            : ""
        }
        confirmLabel="Khôi phục"
        cancelLabel="Huỷ"
        loading={restoring}
        onConfirm={confirmRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
}

/**
 * DocRowActions — Menu "ba chấm" cho mỗi dòng tài liệu (gom Xem/Sửa/Lưu trữ +
 * các thao tác phụ). Tách function ngoài để DocumentsPage gọn hơn.
 */
function DocRowActions({
  doc,
  user,
  canSubmitDoc,
  fileUrl,
  onView,
  onEdit,
  onArchive,
  onHardDelete,
  onFeedback,
  onVersions,
  onSubmit,
}) {
  const isPending = doc.status === "PENDING";
  const showEdit = canEditDigitalAssetRow(user, doc);
  const showArchive = canArchiveDigitalAssetRow(user, doc);
  const showHardDelete = canHardDeleteDraftDigitalAssetRow(user, doc);
  const items = [
    {
      id: "view",
      icon: Eye,
      label: "Xem chi tiết",
      onClick: onView,
    },
    showEdit && {
      id: "edit",
      icon: Pencil,
      label: "Sửa thông tin",
      onClick: onEdit,
      hint: isPending
        ? "Tài liệu đang chờ duyệt — không sửa được"
        : undefined,
      disabled: isPending,
    },
    showHardDelete && {
      id: "hard-delete",
      icon: Trash2,
      label: "Xoá vĩnh viễn",
      variant: "danger",
      onClick: onHardDelete,
      hint: "Chỉ áp dụng cho bản nháp — xoá khỏi cơ sở dữ liệu",
      disabled: isPending,
    },
    showArchive && {
      id: "archive",
      icon: Archive,
      label: "Lưu trữ",
      variant: "danger",
      onClick: onArchive,
      hint: "Chỉ sau khi đã phê duyệt — đưa vào kho lưu trữ (không xoá cứng)",
      disabled: isPending,
    },
    canSubmitDoc && doc.status === "DRAFT" && {
      id: "submit",
      icon: Send,
      label: "Gửi phê duyệt",
      onClick: onSubmit,
      divider: true,
    },
    {
      id: "feedback",
      icon: MessageSquare,
      label: "Phản hồi / góp ý",
      onClick: onFeedback,
    },
    {
      id: "versions",
      icon: History,
      label: "Lịch sử phiên bản",
      onClick: onVersions,
    },
    fileUrl && {
      id: "open",
      icon: ExternalLink,
      label: "Mở file gốc",
      onClick: () => window.open(fileUrl, "_blank", "noopener,noreferrer"),
    },
  ].filter(Boolean);

  return <RowActionMenu items={items} />;
}

/**
 * ArchivedVersionsPanel — Tab "Đã lưu trữ" (Admin + Trưởng/Phó PKT).
 * List từng phiên bản bị archive kèm thông tin tài liệu gốc + nút Khôi phục.
 */
function ArchivedVersionsPanel({
  items,
  total,
  loading,
  page,
  limit,
  searchInput,
  onSearchChange,
  onPageChange,
  canRestore,
  onRestore,
  fileUrlOf,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[260px] max-w-md">
          <Input
            label="Tìm trong kho lưu trữ"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tên tài liệu, mô tả, tài sản, ghi chú phiên bản…"
          />
        </div>
        {searchInput && (
          <div className="pb-0.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onSearchChange("")}
            >
              Xoá tìm kiếm
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Kho lưu trữ trống"
            description="Chưa có phiên bản nào bị lưu trữ."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "Tài liệu",
                    "Phiên bản",
                    "Tài sản",
                    "Người lưu trữ",
                    "Thời điểm lưu trữ",
                    "Trạng thái tài liệu",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it) => {
                  const url = fileUrlOf(it.filePath);
                  return (
                    <tr key={it.versionId} className="hover:bg-amber-50/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText
                            size={16}
                            className="text-amber-500 flex-shrink-0"
                          />
                          <div>
                            <p className="font-semibold text-gray-900 truncate max-w-[240px]">
                              {it.fileName}
                            </p>
                            {it.changeNote && (
                              <p className="text-xs text-gray-500 truncate max-w-[240px]">
                                {it.changeNote}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color="yellow">v{it.versionNumber}</Badge>
                        {Number(it.versionNumber) ===
                          Number(it.docCurrentVersion) &&
                          it.docStatus !== "ARCHIVED" && (
                            <p className="text-[10px] text-amber-700 mt-1">
                              Là current trước khi lưu trữ
                            </p>
                          )}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {it.assetName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {it.archivedByName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {fDateTime(it.archivedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {it.docStatus === "ARCHIVED" ? (
                          <Badge color="gray">Tài liệu đã lưu trữ</Badge>
                        ) : (
                          <Badge color="green">Tài liệu còn dùng</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                            >
                              <ExternalLink size={12} /> Xem file
                            </a>
                          )}
                          {canRestore && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => onRestore(it)}
                            >
                              <ArchiveRestore size={13} /> Khôi phục
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / limit) || 1}
        onChange={onPageChange}
      />
    </div>
  );
}
