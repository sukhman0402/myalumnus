-- 0023 · "Left before a decision" as its own outcome (Iteration 3, NEW-5; owner 2026-10-08: walked away ≠ denied).
-- Before: a held visitor who walked away was closed with "Close as denied" and counted as a denial everywhere.
-- Enum values only. A new enum value can't be used in the same transaction it is added in, so the functions that
-- use it are in 0024. Additive; nothing removed.
alter type public.case_status add value if not exists 'left';
alter type public.visit_outcome add value if not exists 'left';
