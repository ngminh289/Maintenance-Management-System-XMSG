-- ============================================================
-- 041_asset_extended_fields.sql
-- Thêm các trường kỹ thuật & thời gian mở rộng cho bảng Assets:
--   Model, YearOfManufacture, TechnicalSpecs,
--   PurchaseDate, WarrantyDate, DecommissionDate
-- Liên quan: models/asset.model.js, validators/asset.validator.js
-- ============================================================

ALTER TABLE Assets
  ADD COLUMN Model              VARCHAR(100)  NULL AFTER SerialNumber,
  ADD COLUMN YearOfManufacture  YEAR          NULL AFTER Model,
  ADD COLUMN TechnicalSpecs     TEXT          NULL AFTER YearOfManufacture,
  ADD COLUMN PurchaseDate       DATE          NULL AFTER CommissionDate,
  ADD COLUMN WarrantyDate       DATE          NULL AFTER PurchaseDate,
  ADD COLUMN DecommissionDate   DATE          NULL AFTER WarrantyDate;
