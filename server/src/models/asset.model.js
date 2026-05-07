/**
 * asset.model.js — SQL thuần cho bảng Assets (JOIN AssetTypes + Locations + ProductionLines).
 * Dùng trong: services/asset.service.js.
 * Liên quan: migrations/041, 047, 048 (ProductionLine FK, AssetType hierarchy).
 * Trường mở rộng: model, yearOfManufacture, technicalSpecs,
 *                 purchaseDate, warrantyDate, decommissionDate, productionLine
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
  a.Description          AS description,
  a.ProductionLine       AS productionLineId,
  pl.LineName            AS productionLineName`;

const BASE_JOIN = `
  FROM Assets a
  JOIN AssetTypes at ON at.AssetTypeID = a.AssetTypeID
  JOIN Locations  l  ON l.LocationID   = a.LocationID
  LEFT JOIN ProductionLines pl ON pl.LineID = a.ProductionLine`;

/**
 * Soft-delete: tài sản DECOMMISSIONED bị ẩn ở danh sách mặc định để hành vi
 * "Xoá" (chuyển trạng thái) trông giống xoá thật. Người dùng vẫn có thể chọn
 * filter Status = DECOMMISSIONED để xem lại lịch sử.
 */
function appendStatusFilter(where, params, status) {
  if (status) {
    where += ' AND a.Status = ?';
    params.push(status);
  } else {
    where += " AND a.Status <> 'DECOMMISSIONED'";
  }
  return where;
}

export async function findAll({ limit, offset, status, assetTypeId, locationId, search, productionLine } = {}) {
  const params = [];
  let where = 'WHERE 1=1';

  where = appendStatusFilter(where, params, status);
  if (assetTypeId)    { where += ' AND a.AssetTypeID = ?';    params.push(assetTypeId); }
  if (locationId)     { where += ' AND a.LocationID = ?';     params.push(locationId); }
  if (productionLine) { where += ' AND a.ProductionLine = ?'; params.push(Number(productionLine)); }
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

export async function count({ status, assetTypeId, locationId, search, productionLine } = {}) {
  const params = [];
  const join  = 'FROM Assets a';
  let where = 'WHERE 1=1';
  where = appendStatusFilter(where, params, status);
  if (assetTypeId)    { where += ' AND a.AssetTypeID = ?';    params.push(assetTypeId); }
  if (locationId)     { where += ' AND a.LocationID = ?';     params.push(locationId); }
  if (productionLine) { where += ' AND a.ProductionLine = ?'; params.push(Number(productionLine)); }
  if (search) {
    where += ' AND (a.AssetName LIKE ? OR a.SerialNumber LIKE ? OR a.Manufacturer LIKE ? OR a.Model LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  const [rows] = await getPool().query(`SELECT COUNT(*) AS cnt ${join} ${where}`, params);
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
  photo, qrCodePath, description, productionLine,
}) {
  const [result] = await getPool().query(
    `INSERT INTO Assets (
      AssetName, AssetTypeID, LocationID, Status,
      CommissionDate, Manufacturer, SerialNumber,
      Model, YearOfManufacture, TechnicalSpecs,
      PurchaseDate, WarrantyDate, DecommissionDate,
      Photo, QRCodePath, Description, ProductionLine
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assetName, assetTypeId, locationId,
      status || 'AVAILABLE',
      commissionDate || null,
      manufacturer || null, serialNumber || null,
      model || null, yearOfManufacture || null, technicalSpecs || null,
      purchaseDate || null, warrantyDate || null, decommissionDate || null,
      photo || null, qrCodePath || null, description || null,
      productionLine || null,
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
    productionLine:     'ProductionLine',
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
