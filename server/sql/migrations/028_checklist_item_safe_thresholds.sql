-- migrations/028_checklist_item_safe_thresholds.sql
-- Ngưỡng an toàn + gợi ý đánh giá tổng thể (WARNING/NG) khi vượt ngưỡng hoặc Pass/Fail không đạt.

ALTER TABLE ChecklistTemplateItems
  ADD COLUMN SafeNumericMin DECIMAL(12,4) NULL DEFAULT NULL AFTER RangeMax,
  ADD COLUMN SafeNumericMax DECIMAL(12,4) NULL DEFAULT NULL AFTER SafeNumericMin,
  ADD COLUMN OutOfRangeSuggest ENUM('WARNING','NG') NULL DEFAULT NULL AFTER SafeNumericMax,
  ADD COLUMN PassFailFailSuggest ENUM('WARNING','NG') NULL DEFAULT NULL AFTER OutOfRangeSuggest;
