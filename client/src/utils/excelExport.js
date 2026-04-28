/**
 * excelExport.js — Helper xuất Excel dùng chung cho các trang danh sách.
 * Chuẩn hóa tên sheet/file, auto-fit cột cơ bản, giảm lặp code ở nhiều page.
 */
import * as XLSX from "xlsx";

function clampSheetName(name) {
  const raw = String(name || "Sheet1").replace(/[\\/?*[\]:]/g, " ").trim();
  return (raw || "Sheet1").slice(0, 31);
}

function buildColumnsWidth(rows) {
  const keys = Object.keys(rows[0] ?? {});
  return keys.map((key) => {
    const headerLen = String(key).length;
    const maxCellLen = rows.reduce((maxLen, row) => {
      const len = String(row?.[key] ?? "").length;
      return Math.max(maxLen, len);
    }, 0);
    return { wch: Math.min(60, Math.max(12, headerLen, maxCellLen + 2)) };
  });
}

export function exportRowsToExcel({ rows, sheetName, fileName }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return false;
  }
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = buildColumnsWidth(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, clampSheetName(sheetName));
  XLSX.writeFile(workbook, fileName || "export.xlsx");
  return true;
}
