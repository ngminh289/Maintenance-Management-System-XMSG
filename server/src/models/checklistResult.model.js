/**
 * checklistResult.model.js — SQL thuần cho ChecklistResults + ChecklistDetails.
 * Dùng trong: services/checklist.service.js.
 */
import { getPool } from '../config/database.js';

export async function create({ assetId, woId, checkerId, overallStatus, evidencePhoto, notes, readingValue }) {
  const [result] = await getPool().query(
    `INSERT INTO ChecklistResults (AssetID, WO_ID, CheckerID, OverallStatus, EvidencePhoto, Notes, ReadingValue)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [assetId, woId || null, checkerId, overallStatus, evidencePhoto || null, notes || null, readingValue ?? null],
  );
  return result.insertId;
}

export async function createDetails(checklistId, details) {
  if (!details || details.length === 0) return;
  const values = details.map((d) => [checklistId, d.questionText, d.inputType || 'PASS_FAIL', d.answerValue ?? null, d.isOK !== false]);
  await getPool().query(
    'INSERT INTO ChecklistDetails (ChecklistID, QuestionText, InputType, AnswerValue, IsOK) VALUES ?',
    [values],
  );
}

export async function findById(id) {
  const [[result], details] = await Promise.all([
    getPool().query(
      `SELECT cr.ChecklistID AS checklistId, cr.AssetID AS assetId, a.AssetName AS assetName,
              cr.WO_ID AS woId, cr.CheckerID AS checkerId, e.FullName AS checkerName,
              cr.OverallStatus AS overallStatus, cr.EvidencePhoto AS evidencePhoto,
              cr.Notes AS notes, cr.ReadingValue AS readingValue, cr.CheckTime AS checkTime
       FROM ChecklistResults cr
       JOIN Assets a    ON a.AssetID       = cr.AssetID
       JOIN Employees e ON e.EmployeeID    = cr.CheckerID
       WHERE cr.ChecklistID = ?`,
      [id],
    ).then(([r]) => r),
    getPool().query(
      `SELECT DetailID AS detailId, QuestionText AS questionText, InputType AS inputType,
              AnswerValue AS answerValue, IsOK AS isOK
       FROM ChecklistDetails WHERE ChecklistID = ?`,
      [id],
    ).then(([r]) => r),
  ]);
  if (!result) return null;
  return { ...result, details };
}

export async function findByAsset(assetId, limit = 20) {
  const [rows] = await getPool().query(
    `SELECT cr.ChecklistID AS checklistId, cr.OverallStatus AS overallStatus,
            cr.CheckTime AS checkTime, e.FullName AS checkerName, cr.ReadingValue AS readingValue
     FROM ChecklistResults cr
     JOIN Employees e ON e.EmployeeID = cr.CheckerID
     WHERE cr.AssetID = ? ORDER BY cr.CheckTime DESC LIMIT ?`,
    [assetId, limit],
  );
  return rows;
}
