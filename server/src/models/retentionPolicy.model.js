/**
 * retentionPolicy.model.js — SQL thuần cho RetentionPolicies.
 * Dùng trong: services/retentionPolicy.service.js.
 */
import { getPool } from '../config/database.js';

const COLS = 'PolicyID AS policyId, PolicyName AS policyName, RetentionDays AS retentionDays, TargetTable AS targetTable, ActionAfter AS actionAfter, Description AS description';

export async function findAll() {
  const [rows] = await getPool().query(`SELECT ${COLS} FROM RetentionPolicies ORDER BY TargetTable`);
  return rows;
}

export async function findById(id) {
  const [rows] = await getPool().query(`SELECT ${COLS} FROM RetentionPolicies WHERE PolicyID = ?`, [id]);
  return rows[0] || null;
}

export async function create({ policyName, retentionDays, targetTable, actionAfter, description }) {
  const [result] = await getPool().query(
    'INSERT INTO RetentionPolicies (PolicyName, RetentionDays, TargetTable, ActionAfter, Description) VALUES (?, ?, ?, ?, ?)',
    [policyName, retentionDays, targetTable, actionAfter || 'DELETE', description || null],
  );
  return result.insertId;
}

export async function update(id, { policyName, retentionDays, actionAfter, description }) {
  const sets = [];
  const params = [];
  if (policyName !== undefined)    { sets.push('PolicyName = ?');    params.push(policyName); }
  if (retentionDays !== undefined) { sets.push('RetentionDays = ?'); params.push(retentionDays); }
  if (actionAfter !== undefined)   { sets.push('ActionAfter = ?');   params.push(actionAfter); }
  if (description !== undefined)   { sets.push('Description = ?');   params.push(description ?? null); }
  if (!sets.length) return 0;
  params.push(id);
  const [result] = await getPool().query(`UPDATE RetentionPolicies SET ${sets.join(', ')} WHERE PolicyID = ?`, params);
  return result.affectedRows;
}

export async function remove(id) {
  const [result] = await getPool().query('DELETE FROM RetentionPolicies WHERE PolicyID = ?', [id]);
  return result.affectedRows;
}
