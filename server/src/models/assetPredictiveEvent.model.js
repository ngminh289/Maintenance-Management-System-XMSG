/**
 * assetPredictiveEvent.model.js — Nhật ký sự kiện dự báo PM theo tài sản (luồng 1.1 / 2.1).
 * Dùng trong: services/assetCounter.service.js; routes asset (đọc lịch sử).
 */
import { getPool } from '../config/database.js';

export async function create({ assetId, eventType, detail = null, relatedWOId = null }) {
  const [result] = await getPool().query(
    `INSERT INTO AssetPredictiveEventLog (AssetID, EventType, Detail, RelatedWOId)
     VALUES (?, ?, ?, ?)`,
    [assetId, eventType, detail, relatedWOId],
  );
  return result.insertId;
}

export async function findByAsset(assetId, limit = 50) {
  const [rows] = await getPool().query(
    `SELECT LogID AS logId, EventType AS eventType, Detail AS detail,
            RelatedWOId AS relatedWOId, CreatedAt AS createdAt
     FROM AssetPredictiveEventLog
     WHERE AssetID = ?
     ORDER BY CreatedAt DESC
     LIMIT ?`,
    [assetId, limit],
  );
  return rows;
}
