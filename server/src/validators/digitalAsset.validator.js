/**
 * digitalAsset.validator.js — Validate DigitalAsset upload + actions.
 */
const VALID_STATUS = ['DRAFT', 'ARCHIVED'];

export function uploadSchema(body) {
  if (!body.description && !body.assetId) return null; // Cả 2 đều optional khi upload
  return null; // file được validate bởi multer
}

export function updateSchema(body) {
  if (body.assetId !== undefined && body.assetId !== null && isNaN(Number(body.assetId))) {
    return 'AssetID không hợp lệ';
  }
  return null;
}

export function addTagSchema(body) {
  if (!body.tagId || isNaN(Number(body.tagId))) return 'TagID không hợp lệ';
  return null;
}

export function newVersionSchema(body) {
  // file được validate bởi multer; changeNote optional
  return null;
}
