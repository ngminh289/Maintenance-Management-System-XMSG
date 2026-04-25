/**
 * AssetIdSearchPicker.jsx — Chọn tài sản bằng gõ tìm (debounce), gọi GET /assets?search=&limit=…
 * Dùng khi danh sách tài sản lớn; không load full vào <select>.
 * Liên quan: asset.api.js, asset.model.js (findAll search).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { assetApi } from '../api/asset.api.js';

const DEBOUNCE_MS = 280;
const MIN_CHARS = 1;
const PAGE_LIMIT = 30;

export function AssetIdSearchPicker({
  value,
  onChange,
  label = 'Gắn với tài sản',
  disabled = false,
  id,
}) {
  const idStr = value === null || value === undefined || value === '' ? '' : String(value);
  const [hintLabel, setHintLabel] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!idStr) {
      setHintLabel('');
      return;
    }
    let cancelled = false;
    assetApi
      .getById(idStr)
      .then((r) => {
        if (cancelled) return;
        const a = r.data?.data;
        setHintLabel(a?.assetName ? `${a.assetName} (#${a.assetId})` : `#${idStr}`);
      })
      .catch(() => {
        if (!cancelled) setHintLabel(`#${idStr}`);
      });
    return () => {
      cancelled = true;
    };
  }, [idStr]);

  useEffect(() => {
    if (!open || disabled) return;
    const term = q.trim();
    if (term.length < MIN_CHARS) {
      setList([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await assetApi.getAll({ search: term, limit: PAGE_LIMIT, page: 1 });
        if (!cancelled) setList(r.data?.data?.items ?? []);
      } catch {
        if (!cancelled) setList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, disabled]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = useCallback(
    (row) => {
      onChange(String(row.assetId));
      setHintLabel(`${row.assetName} (#${row.assetId})`);
      setQ('');
      setOpen(false);
      setList([]);
    },
    [onChange],
  );

  const clear = useCallback(() => {
    onChange('');
    setHintLabel('');
    setQ('');
    setList([]);
    setOpen(false);
  }, [onChange]);

  return (
    <div ref={wrapRef} className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-gray-700 block">
          {label}
        </label>
      )}
      {idStr ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm">
          <span className="text-gray-800 font-medium truncate flex-1 min-w-0" title={hintLabel}>
            {hintLabel || 'Đang tải…'}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={clear}
            className="shrink-0 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
          >
            Bỏ gắn
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen(true);
              setQ('');
              setList([]);
            }}
            className="shrink-0 text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
          >
            Đổi
          </button>
        </div>
      ) : null}

      {(!idStr || open) && (
        <div className="relative">
          <input
            id={id}
            type="text"
            disabled={disabled}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={idStr ? 'Gõ tên / serial / model…' : 'Gõ để tìm tài sản (tên, serial, hãng, model)…'}
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900
              placeholder:text-gray-500 placeholder:opacity-90
              focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500
              disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {open && q.trim().length >= MIN_CHARS && (
            <ul
              className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
              role="listbox"
            >
              {loading && (
                <li className="px-3 py-2 text-gray-500">Đang tìm…</li>
              )}
              {!loading && list.length === 0 && (
                <li className="px-3 py-2 text-gray-500">Không có kết quả</li>
              )}
              {!loading &&
                list.map((row) => (
                  <li key={row.assetId}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 font-medium text-gray-900"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(row)}
                    >
                      <span className="block truncate">{row.assetName}</span>
                      <span className="block text-xs text-gray-500 font-normal truncate">
                        #{row.assetId}
                        {row.serialNumber ? ` · ${row.serialNumber}` : ''}
                        {row.locationName ? ` · ${row.locationName}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
