/**
 * checklistTemplate.model.js — SQL thuần cho ChecklistTemplates + ChecklistTemplateItems.
 * Dùng trong: services/checklist.service.js.
 */
import { getPool } from '../config/database.js';

export async function findAll(assetTypeId) {
  const params = [];
  let where = '';
  if (assetTypeId) { where = 'WHERE ct.AssetTypeID = ?'; params.push(assetTypeId); }
  const [rows] = await getPool().query(
    `SELECT ct.TemplateID AS templateId, ct.AssetTypeID AS assetTypeId,
            at.TypeName AS assetTypeName, ct.TemplateName AS templateName, ct.Description AS description
     FROM ChecklistTemplates ct
     JOIN AssetTypes at ON at.AssetTypeID = ct.AssetTypeID
     ${where} ORDER BY ct.TemplateName`,
    params,
  );
  return rows;
}

export async function findById(id) {
  const [[template], items] = await Promise.all([
    getPool().query(
      `SELECT ct.TemplateID AS templateId, ct.AssetTypeID AS assetTypeId,
              at.TypeName AS assetTypeName, ct.TemplateName AS templateName, ct.Description AS description
       FROM ChecklistTemplates ct
       JOIN AssetTypes at ON at.AssetTypeID = ct.AssetTypeID
       WHERE ct.TemplateID = ?`,
      [id],
    ).then(([r]) => r),
    getPool().query(
      `SELECT ItemID AS itemId, QuestionText AS questionText, InputType AS inputType,
              RangeMin AS rangeMin, RangeMax AS rangeMax,
              SafeNumericMin AS safeNumericMin, SafeNumericMax AS safeNumericMax,
              OutOfRangeSuggest AS outOfRangeSuggest, PassFailFailSuggest AS passFailFailSuggest,
              Unit AS unit, SortOrder AS sortOrder, IsRequired AS isRequired
       FROM ChecklistTemplateItems WHERE TemplateID = ? ORDER BY SortOrder`,
      [id],
    ).then(([r]) => r),
  ]);
  if (!template) return null;
  return { ...template, items };
}

/** Lấy template phù hợp nhất cho một tài sản (dùng khi quét QR) */
export async function findByAssetTypeId(assetTypeId) {
  const [rows] = await getPool().query(
    'SELECT TemplateID AS templateId, TemplateName AS templateName FROM ChecklistTemplates WHERE AssetTypeID = ? ORDER BY TemplateID LIMIT 1',
    [assetTypeId],
  );
  return rows[0] || null;
}

/** Lấy toàn bộ template của một loại tài sản (dùng cho chọn mẫu lúc nộp checklist). */
export async function findAllByAssetTypeId(assetTypeId) {
  const [rows] = await getPool().query(
    `SELECT TemplateID AS templateId,
            AssetTypeID AS assetTypeId,
            TemplateName AS templateName,
            Description AS description
     FROM ChecklistTemplates
     WHERE AssetTypeID = ?
     ORDER BY TemplateName ASC, TemplateID ASC`,
    [assetTypeId],
  );
  return rows;
}

export async function createTemplate({ assetTypeId, templateName, description }) {
  const [result] = await getPool().query(
    'INSERT INTO ChecklistTemplates (AssetTypeID, TemplateName, Description) VALUES (?, ?, ?)',
    [assetTypeId, templateName, description || null],
  );
  return result.insertId;
}

export async function updateTemplate(id, { templateName, description }) {
  await getPool().query(
    'UPDATE ChecklistTemplates SET TemplateName = ?, Description = ? WHERE TemplateID = ?',
    [templateName, description || null, id],
  );
}

export async function removeTemplate(id) {
  const [result] = await getPool().query('DELETE FROM ChecklistTemplates WHERE TemplateID = ?', [id]);
  return result.affectedRows;
}

export async function addItem({
  templateId, questionText, inputType, rangeMin, rangeMax,
  safeNumericMin, safeNumericMax, outOfRangeSuggest, passFailFailSuggest,
  unit, sortOrder, isRequired,
}) {
  const [result] = await getPool().query(
    `INSERT INTO ChecklistTemplateItems (
       TemplateID, QuestionText, InputType, RangeMin, RangeMax,
       SafeNumericMin, SafeNumericMax, OutOfRangeSuggest, PassFailFailSuggest,
       Unit, SortOrder, IsRequired
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      templateId, questionText, inputType || 'PASS_FAIL', rangeMin ?? null, rangeMax ?? null,
      safeNumericMin ?? null, safeNumericMax ?? null, outOfRangeSuggest ?? null, passFailFailSuggest ?? null,
      unit || null, sortOrder || 0, isRequired !== false,
    ],
  );
  return result.insertId;
}

export async function updateItem(itemId, data) {
  const map = {
    questionText: 'QuestionText', inputType: 'InputType', rangeMin: 'RangeMin', rangeMax: 'RangeMax',
    safeNumericMin: 'SafeNumericMin', safeNumericMax: 'SafeNumericMax',
    outOfRangeSuggest: 'OutOfRangeSuggest', passFailFailSuggest: 'PassFailFailSuggest',
    unit: 'Unit', sortOrder: 'SortOrder', isRequired: 'IsRequired',
  };
  const setClauses = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) { setClauses.push(`${col} = ?`); params.push(data[key] ?? null); }
  }
  if (!setClauses.length) return 0;
  params.push(itemId);
  const [result] = await getPool().query(
    `UPDATE ChecklistTemplateItems SET ${setClauses.join(', ')} WHERE ItemID = ?`, params,
  );
  return result.affectedRows;
}

export async function removeItem(itemId) {
  await getPool().query('DELETE FROM ChecklistTemplateItems WHERE ItemID = ?', [itemId]);
}
