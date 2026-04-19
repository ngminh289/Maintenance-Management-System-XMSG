/**
 * asset.model.js — SQL thuần cho bảng Assets (JOIN AssetTypes + Locations).
 * Dùng trong: services/asset.service.js.
 * Liên quan: migrations/041_asset_extended_fields.sql
 * Trường mở rộng: model, yearOfManufacture, technicalSpecs,
 *                 purchaseDate, warrantyDate, decommissionDate
 */
import { getPool } from '../config/database.js';

const COLS = `
  a.AssetID              AS assetId,
  a.AssetName            AS assetName,
  a.AssetTypeID          AS assetTypeId,
  at.TypeName            AS assetTypeName,
  a.LocationID           AS locationId,
  l.LocationName         AS locationName,
  a.Status               AS status,
  a.CommissionDate       AS commissionDate,
  a.Manufacturer         AS manufacturer,
  a.SerialNumber         AS serialNumber,
  a.Model                AS model,
  a.YearOfManufacture    AS yearOfManufacture,
  a.TechnicalSpecs       AS technicalSpecs,
  a.PurchaseDate         AS purchaseDate,
  a.WarrantyDate         AS warrantyDate,
  a.DecommissionDate     AS decommissionDate,
  a.Photo                AS photo,
  a.QRCodePath           AS qrCodePath,
  a.Description          AS description`;

const BASE_JOIN = `
  FROM Assets a
  JOIN AssetTypes at ON at.AssetTypeID = a.AssetTypeID
  JOIN Locations  l  ON l.LocationID   = a.LocationID`;

export async function findAll({ limit, offset, status, assetTypeId, locationId, search } = {}) {
  const params = [];
  let where = 'WHERE 1=1';

  if (status)      { where += ' AND a.Status = ?';      params.push(status); }
  if (assetTypeId) { where += ' AND a.AssetTypeID = ?'; params.push(assetTypeId); }
  if (locationId)  { where += ' AND a.LocationID = ?';  params.push(locationId); }
  if (search)      {
    where += ' AND (a.AssetName LIKE ? OR a.SerialNumber LIKE ? OR a.Manufacturer LIKE ? OR a.Model LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const orderBy = 'ORDER BY a.AssetName';
  const pagination = limit !== undefined ? 'LIMIT ? OFFSET ?' : '';
  if (limit !== undefined) params.push(limit, offset);

  const [rows] = await getPool().query(
    `SELECT ${COLS} ${BASE_JOIN} ${where} ${orderBy} ${pagination}`,
    params,
  );
  return rows;
}

export async function count({ status, assetTypeId, locationId, search } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (status)      { where += ' AND Status = ?';      params.push(status); }
  if (assetTypeId) { where += ' AND AssetTypeID = ?'; params.push(assetTypeId); }
  if (locationId)  { where += ' AND LocationID = ?';  params.push(locationId); }
  if (search) {
    where += ' AND (AssetName LIKE ? OR SerialNumber LIKE ? OR Manufacturer LIKE ? OR Model LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  const [rows] = await getPool().query(`SELECT COUNT(*) AS cnt FROM Assets ${where}`, params);
  return Number(rows[0].cnt);
}

export async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${COLS} ${BASE_JOIN} WHERE a.AssetID = ?`,
    [id],
  );
  return rows[0] || null;
}

export async function create({
  assetName, assetTypeId, locationId, status,
  commissionDate, manufacturer, serialNumber,
  model, yearOfManufacture, technicalSpecs,
  purchaseDate, warrantyDate, decommissionDate,
  photo, qrCodePath, description,
}) {
  const [result] = await getPool().query(
    `INSERT INTO Assets (
      AssetName, AssetTypeID, LocationID, Status,
      CommissionDate, Manufacturer, SerialNumber,
      Model, YearOfManufacture, TechnicalSpecs,
      PurchaseDate, WarrantyDate, DecommissionDate,
      Photo, QRCodePath, Description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assetName, assetTypeId, locationId,
      status || 'AVAILABLE',
      commissionDate || null,
      manufacturer || null, serialNumber || null,
      model || null, yearOfManufacture || null, technicalSpecs || null,
      purchaseDate || null, warrantyDate || null, decommissionDate || null,
      photo || null, qrCodePath || null, description || null,
    ],
  );
  return result.insertId;
}

export async function update(id, fields) {
  const map = {
    assetName:          'AssetName',
    assetTypeId:        'AssetTypeID',
    locationId:         'LocationID',
    status:             'Status',
    commissionDate:     'CommissionDate',
    manufacturer:       'Manufacturer',
    serialNumber:       'SerialNumber',
    model:              'Model',
    yearOfManufacture:  'YearOfManufacture',
    technicalSpecs:     'TechnicalSpecs',
    purchaseDate:       'PurchaseDate',
    warrantyDate:       'WarrantyDate',
    decommissionDate:   'DecommissionDate',
    photo:              'Photo',
    qrCodePath:         'QRCodePath',
    description:        'Description',
  };
  const setClauses = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      params.push(fields[key] ?? null);
    }
  }
  if (setClauses.length === 0) return 0;
  params.push(id);
  const [result] = await getPool().query(
    `UPDATE Assets SET ${setClauses.join(', ')} WHERE AssetID = ?`,
    params,
  );
  return result.affectedRows;
}

export async function updateStatus(id, status) {
  const [result] = await getPool().query(
    'UPDATE Assets SET Status = ? WHERE AssetID = ?',
    [status, id],
  );
  return result.affectedRows;
}

export async function updateQRCode(id, qrCodePath) {
  await getPool().query('UPDATE Assets SET QRCodePath = ? WHERE AssetID = ?', [qrCodePath, id]);
}

export async function remove(id) {
  const [result] = await getPool().query('DELETE FROM Assets WHERE AssetID = ?', [id]);
  return result.affectedRows;
}
