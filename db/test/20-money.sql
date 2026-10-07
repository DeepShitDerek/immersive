-- TEST ONLY. The money ledger's invariants, checked against the real
-- schema in a throwaway container by scripts/test-db.mjs.
--
-- Runs after 10-policies.sql and reuses its harness (schema `t`) and its
-- owner account. Writes go through the RPCs the app uses, which run the
-- deferred checks before returning — so a refused write shows up here as a
-- raised error, the same as the app would see it.

\set ON_ERROR_STOP on
SET client_min_messages = warning;

TRUNCATE t.results RESTART IDENTITY;

BEGIN;
SELECT t.act_as('owner');

-- ── Fixtures ────────────────────────────────────────────────────────────────

INSERT INTO money_rate (base, quote, as_of, rate, source)
VALUES ('CAD', 'INR', '2026-02-20', 61.0, 'test');

INSERT INTO money_settings (user_id, base_currency, home_currency)
VALUES ('00000000-0000-0000-0000-00000000000a', 'CAD', 'INR');

INSERT INTO money_institution (id, name, country) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Maple Bank', 'CA'),
  ('30000000-0000-0000-0000-000000000002', 'Ganga Bank', 'IN');

INSERT INTO money_account (id, institution_id, name, kind, registration, country, currency, opening_balance_minor, opening_date, credit_limit_minor) VALUES
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Chequing', 'chequing', 'none', 'CA', 'CAD', 100000, '2026-01-01', NULL),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Visa', 'credit_card', 'none', 'CA', 'CAD', 0, '2026-01-01', 500000),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'NRO savings', 'savings', 'nro', 'IN', 'INR', 0, '2026-01-01', NULL),
  ('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'TFSA', 'savings', 'tfsa', 'CA', 'CAD', 0, '2026-01-01', NULL),
  ('31000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 'Future', 'savings', 'none', 'CA', 'CAD', 5000, '2026-01-01', NULL);

INSERT INTO money_category (id, name, bucket) VALUES
  ('32000000-0000-0000-0000-000000000001', 'Food', 'want'),
  ('32000000-0000-0000-0000-000000000003', 'Salary', 'income'),
  ('32000000-0000-0000-0000-000000000004', 'Bank fees', 'need');
INSERT INTO money_category (id, parent_id, name, bucket) VALUES
  ('32000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', 'Groceries', 'need');

-- ── Accounts ────────────────────────────────────────────────────────────────

SELECT t.refuses($q$INSERT INTO money_account (name, kind, registration, country, currency) VALUES ('Bad TFSA', 'savings', 'tfsa', 'IN', 'INR')$q$,
  'a TFSA can only be a Canadian account', 'money_account_registration_country');
SELECT t.refuses($q$INSERT INTO money_account (name, kind, registration, country, currency) VALUES ('Bad NRE', 'savings', 'nre', 'CA', 'CAD')$q$,
  'an NRE account can only be Indian', 'money_account_registration_country');
SELECT t.refuses($q$INSERT INTO money_account (name, kind, currency, credit_limit_minor) VALUES ('Chq', 'chequing', 'CAD', 1000)$q$,
  'only cards and lines of credit have a credit limit', 'money_account_credit_fields');
SELECT t.refuses($q$INSERT INTO money_account (name, kind, registration, currency) VALUES ('Card TFSA', 'credit_card', 'tfsa', 'CAD')$q$,
  'a credit card cannot be registered', 'money_account_registration_kind');

-- ── Categories ──────────────────────────────────────────────────────────────

SELECT t.check((SELECT bucket FROM money_category WHERE id = '32000000-0000-0000-0000-000000000002') = 'want',
  'a subcategory takes its parent''s bucket');
SELECT t.refuses($q$INSERT INTO money_category (parent_id, name) VALUES ('32000000-0000-0000-0000-000000000002', 'Too deep')$q$,
  'categories go two levels deep at most', 'two levels');
SELECT t.refuses($q$INSERT INTO money_category (name) VALUES ('food')$q$,
  'category names are unique per level, ignoring case', 'money_category_name_key');
UPDATE money_category SET bucket = 'need' WHERE id = '32000000-0000-0000-0000-000000000001';
SELECT t.check((SELECT bucket FROM money_category WHERE id = '32000000-0000-0000-0000-000000000002') = 'need',
  're-bucketing a parent carries its subcategories');

-- ── Transactions by kind ────────────────────────────────────────────────────

SELECT public.money_record_transaction(
  '{"date":"2026-02-03","kind":"expense","description":"Groceries"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000001","category_id":"32000000-0000-0000-0000-000000000002","amount_minor":-4500}]');
SELECT t.check((SELECT fx_rate = 1 AND base_amount_minor = -4500 FROM money_posting WHERE amount_minor = -4500),
  'a base-currency posting is priced at 1 without being told');

SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-03","kind":"expense","description":"Wrong way"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":4500}]')$q$,
  'an expense has to take money out', 'has to take money out');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-03","kind":"expense","description":"Two accounts"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-100},{"account_id":"31000000-0000-0000-0000-000000000002","amount_minor":-100}]')$q$,
  'an expense comes out of one account', 'one account');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-03","kind":"income","description":"Negative pay"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-100}]')$q$,
  'income has to bring money in', 'bring money in');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2025-12-31","kind":"expense","description":"Too early"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-100}]')$q$,
  'nothing is dated before its account opened', 'before its account was opened');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-03","kind":"expense","description":"Nothing"}', '[]')$q$,
  'a transaction needs at least one posting', 'at least one posting');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-03","kind":"adjustment","description":"Two"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-1},{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-1}]')$q$,
  'an adjustment is a single posting', 'one uncategorised posting');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-03","kind":"expense","description":"Zero"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":0}]')$q$,
  'a zero posting is refused', 'amount_minor');

-- A split: one purchase, two categories, one account.
SELECT public.money_record_transaction(
  '{"date":"2026-02-04","kind":"expense","description":"Costco"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000002","category_id":"32000000-0000-0000-0000-000000000002","amount_minor":-8000},
    {"account_id":"31000000-0000-0000-0000-000000000002","category_id":"32000000-0000-0000-0000-000000000004","amount_minor":-1500}]');
SELECT t.check(t.count_of($q$SELECT id FROM money_posting WHERE account_id = '31000000-0000-0000-0000-000000000002'$q$) = 2,
  'a split expense keeps both postings');

SELECT public.money_record_transaction(
  '{"date":"2026-02-06","kind":"refund","description":"Returned item"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000002","category_id":"32000000-0000-0000-0000-000000000002","amount_minor":2000}]');

SELECT public.money_record_transaction(
  '{"date":"2026-02-15","kind":"income","description":"Pay"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000001","category_id":"32000000-0000-0000-0000-000000000003","amount_minor":250000}]');

-- ── Transfers ───────────────────────────────────────────────────────────────

SELECT public.money_record_transaction(
  '{"date":"2026-02-16","kind":"transfer","description":"Pay the card"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-7500},
    {"account_id":"31000000-0000-0000-0000-000000000002","amount_minor":7500}]');

SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-16","kind":"transfer","description":"Leaky"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-7500},{"account_id":"31000000-0000-0000-0000-000000000004","amount_minor":7400}]')$q$,
  'a transfer in one currency must balance', 'must balance');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-16","kind":"transfer","description":"Self"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-100},{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":100}]')$q$,
  'a transfer needs two different accounts', 'two different accounts');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-16","kind":"transfer","description":"Fee in"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-100},{"account_id":"31000000-0000-0000-0000-000000000004","amount_minor":100},{"account_id":"31000000-0000-0000-0000-000000000004","category_id":"32000000-0000-0000-0000-000000000004","amount_minor":5}]')$q$,
  'a transfer fee takes money out', 'fee takes money out');

-- Home: CAD 1,000.00 leaves, ₹60,000.00 arrives, a $4.99 fee, mid-market 61.00.
SELECT public.money_record_transaction(
  '{"date":"2026-02-20","kind":"transfer","description":"Send home","provider":"Wise","market_rate":"61.0"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-100000},
    {"account_id":"31000000-0000-0000-0000-000000000003","amount_minor":6000000,"fx_rate":"0.0163934","base_amount_minor":98360},
    {"account_id":"31000000-0000-0000-0000-000000000001","category_id":"32000000-0000-0000-0000-000000000004","amount_minor":-499}]');
SELECT t.check((SELECT currency FROM money_posting WHERE amount_minor = 6000000) = 'INR',
  'a cross-currency transfer keeps both real amounts, each in its account''s currency');

SELECT t.check((SELECT fx_rate = 0.0163934 AND base_amount_minor = 98360 FROM money_posting WHERE amount_minor = 6000000),
  'a foreign posting keeps the rate frozen onto it');
SELECT public.money_record_transaction(
  '{"date":"2026-02-21","kind":"expense","description":"Unpriced chai"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000003","amount_minor":-5000}]');
SELECT t.check((SELECT fx_rate IS NULL AND base_amount_minor IS NULL FROM money_posting WHERE amount_minor = -5000),
  'a foreign posting with no known rate is stored unpriced, not at parity');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-21","kind":"expense","description":"Half priced"}', '[{"account_id":"31000000-0000-0000-0000-000000000003","amount_minor":-100,"fx_rate":"0.016"}]')$q$,
  'a rate without a base amount is refused', 'money_posting_priced_together');

-- ── Editing ─────────────────────────────────────────────────────────────────

SELECT t.refuses($q$SELECT public.money_update_transaction((SELECT id FROM money_transaction WHERE description = 'Pay the card'), '{"date":"2026-02-16","kind":"transfer","description":"Pay the card"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-7500},{"account_id":"31000000-0000-0000-0000-000000000002","amount_minor":7000}]')$q$,
  'an edit that would unbalance a transfer is refused', 'must balance');
SELECT t.check((SELECT sum(amount_minor) FROM money_posting p JOIN money_transaction x ON x.id = p.transaction_id WHERE x.description = 'Pay the card') = 0
           AND (SELECT count(*) FROM money_posting p JOIN money_transaction x ON x.id = p.transaction_id WHERE x.description = 'Pay the card') = 2,
  'a refused edit leaves the original untouched');
SELECT public.money_update_transaction(
  (SELECT id FROM money_transaction WHERE description = 'Pay the card'),
  '{"date":"2026-02-17","kind":"transfer","description":"Pay the card"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-8000},
    {"account_id":"31000000-0000-0000-0000-000000000002","amount_minor":8000}]');
SELECT t.check((SELECT date FROM money_transaction WHERE description = 'Pay the card') = '2026-02-17'
           AND (SELECT max(amount_minor) FROM money_posting p JOIN money_transaction x ON x.id = p.transaction_id WHERE x.description = 'Pay the card') = 8000,
  'an edit replaces the header and the postings together');
SELECT t.refuses($q$UPDATE money_transaction SET kind = 'income' WHERE description = 'Groceries'$q$ ||
  $q$; SET CONSTRAINTS money_transaction_consistent IMMEDIATE$q$, 'a kind change that no longer fits the postings is refused', 'bring money in');

-- ── Balances ────────────────────────────────────────────────────────────────

-- Chequing: 1000.00 − 45.00 + 2500.00 − 80.00 − 1000.00 − 4.99 = 2370.01
SELECT t.check((SELECT balance_minor FROM public.money_balances('2026-12-31') WHERE account_id = '31000000-0000-0000-0000-000000000001') = 237001,
  'chequing balance = opening + every posting');
-- Visa: −80.00 − 15.00 + 20.00 + 80.00 = 5.00 (a small credit)
SELECT t.check((SELECT balance_minor FROM public.money_balances('2026-12-31') WHERE account_id = '31000000-0000-0000-0000-000000000002') = 500,
  'a card balance nets purchases, refunds and payments');
SELECT t.check((SELECT balance_minor FROM public.money_balances('2026-02-10') WHERE account_id = '31000000-0000-0000-0000-000000000001') = 95500,
  'a balance as of a date ignores later postings');
SELECT t.check((SELECT balance_minor FROM public.money_balances('2026-12-31') WHERE account_id = '31000000-0000-0000-0000-000000000005') = 5000,
  'an account with no postings still reports its opening balance');

SELECT public.money_record_transaction(
  '{"date":"2026-03-01","kind":"expense","description":"Pending coffee","status":"pending"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-500}]');
SELECT t.check((SELECT balance_minor - cleared_minor FROM public.money_balances('2026-12-31') WHERE account_id = '31000000-0000-0000-0000-000000000001') = -500,
  'pending postings count in the balance but not the cleared balance');

-- ── Account history is protected ────────────────────────────────────────────

SELECT t.refuses($q$DELETE FROM money_account WHERE id = '31000000-0000-0000-0000-000000000001'$q$,
  'an account with history cannot be deleted', 'foreign key');
SELECT t.refuses($q$UPDATE money_account SET currency = 'USD' WHERE id = '31000000-0000-0000-0000-000000000001'$q$,
  'an account with transactions cannot change currency', 'change currency');
SELECT t.refuses($q$UPDATE money_account SET opening_date = '2026-03-01' WHERE id = '31000000-0000-0000-0000-000000000001'$q$,
  'an opening date cannot move past existing history', 'has transactions before');

-- ── Import ──────────────────────────────────────────────────────────────────

SELECT t.check((SELECT imported = 2 AND duplicates = 0 FROM public.money_import(
  '{"account_id":"31000000-0000-0000-0000-000000000002","file_name":"visa.csv"}',
  '[{"transaction":{"date":"2026-03-02","kind":"expense","description":"TIM HORTONS","import_hash":"h1"},"postings":[{"account_id":"31000000-0000-0000-0000-000000000002","amount_minor":-250}]},
    {"transaction":{"date":"2026-03-03","kind":"expense","description":"PRESTO","import_hash":"h2"},"postings":[{"account_id":"31000000-0000-0000-0000-000000000002","amount_minor":-1000}]}]')),
  'an import writes every new row');
SELECT t.check((SELECT imported = 0 AND duplicates = 2 FROM public.money_import(
  '{"account_id":"31000000-0000-0000-0000-000000000002","file_name":"visa.csv"}',
  '[{"transaction":{"date":"2026-03-02","kind":"expense","description":"TIM HORTONS","import_hash":"h1"},"postings":[{"account_id":"31000000-0000-0000-0000-000000000002","amount_minor":-250}]},
    {"transaction":{"date":"2026-03-03","kind":"expense","description":"PRESTO","import_hash":"h2"},"postings":[{"account_id":"31000000-0000-0000-0000-000000000002","amount_minor":-1000}]}]')),
  're-importing the same file skips every row as a duplicate');
SELECT t.refuses($q$SELECT * FROM public.money_import('{"account_id":"31000000-0000-0000-0000-000000000002"}', '[{"transaction":{"date":"2026-03-04","kind":"expense","description":"ok","import_hash":"h3"},"postings":[{"account_id":"31000000-0000-0000-0000-000000000002","amount_minor":-1}]},{"transaction":{"date":"2026-03-04","kind":"expense","description":"bad","import_hash":"h4"},"postings":[{"account_id":"31000000-0000-0000-0000-000000000002","amount_minor":1}]}]')$q$,
  'one bad row fails the whole import', 'take money out');
SELECT t.check(t.count_of($q$SELECT id FROM money_transaction WHERE import_hash IN ('h3','h4')$q$) = 0,
  'a failed import leaves nothing behind');

-- ── Rules ───────────────────────────────────────────────────────────────────

SELECT t.refuses($q$INSERT INTO money_rule (match, pattern, category_id) VALUES ('regex', '(unclosed', '32000000-0000-0000-0000-000000000002')$q$,
  'a rule with an invalid pattern is refused on save', 'Not a valid pattern');
SELECT t.refuses($q$INSERT INTO money_rule (pattern) VALUES ('noop')$q$,
  'a rule has to set a category or a payee', 'money_rule_does_something');

-- ── Day flows (calendar, dashboard) ─────────────────────────────────────────

SELECT t.check((SELECT earned = 2500 AND spent = 0 FROM public.money_day_flows('2026-02-15', '2026-02-15')),
  'income is earned, in major units');
SELECT t.check((SELECT spent = 4.99 FROM public.money_day_flows('2026-02-20', '2026-02-20')),
  'a transfer home is not spending, but its fee is');
SELECT t.check((SELECT spent = -20 FROM public.money_day_flows('2026-02-06', '2026-02-06')),
  'a refund reduces spending');
SELECT t.check(NOT EXISTS (SELECT 1 FROM public.money_day_flows('2026-03-01', '2026-03-01')),
  'pending rows are left out of day flows');
-- ── Schedules (phase 3) ─────────────────────────────────────────────────────

SELECT t.refuses($q$INSERT INTO money_schedule (name, kind, account_id, amount_minor, frequency, start_date) VALUES ('Pay', 'income', '31000000-0000-0000-0000-000000000001', 100, 'semimonthly', '2026-01-15')$q$,
  'semi-monthly pay needs its two days', 'money_schedule_semimonthly_days');
SELECT t.refuses($q$INSERT INTO money_schedule (name, kind, account_id, amount_minor, start_date) VALUES ('Save', 'transfer', '31000000-0000-0000-0000-000000000001', 100, '2026-01-15')$q$,
  'a scheduled transfer needs somewhere to go', 'money_schedule_transfer_target');
SELECT t.refuses($q$INSERT INTO money_schedule (name, kind, account_id, amount_minor, start_date) VALUES ('Fix', 'adjustment', '31000000-0000-0000-0000-000000000001', 100, '2026-01-15')$q$,
  'only expenses, income and transfers repeat', 'money_schedule_kind');
INSERT INTO money_schedule (id, name, kind, account_id, category_id, amount_minor, frequency, start_date)
VALUES ('33000000-0000-0000-0000-000000000001', 'Rent', 'expense', '31000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', 140000, 'monthly', '2026-02-01');
SELECT public.money_record_transaction(
  '{"date":"2026-02-02","kind":"expense","description":"Rent","schedule_id":"33000000-0000-0000-0000-000000000001","occurrence_date":"2026-02-01"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-140000}]');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-03","kind":"expense","description":"Rent again","schedule_id":"33000000-0000-0000-0000-000000000001","occurrence_date":"2026-02-01"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-140000}]')$q$,
  'an occurrence cannot be recorded twice', 'money_transaction_occurrence_key');
DELETE FROM money_schedule WHERE id = '33000000-0000-0000-0000-000000000001';
SELECT t.check((SELECT schedule_id IS NULL AND occurrence_date IS NULL FROM money_transaction WHERE description = 'Rent'),
  'deleting a schedule keeps its transactions, unlinked');

-- ── Budgets and goals (phase 3) ─────────────────────────────────────────────

SELECT t.refuses($q$INSERT INTO money_budget (category_id, from_month, amount_minor) VALUES ('32000000-0000-0000-0000-000000000002', '2026-02-15', 45000)$q$,
  'a budget starts on the first of a month', 'money_budget_from_month_check');
INSERT INTO money_budget (category_id, from_month, amount_minor) VALUES ('32000000-0000-0000-0000-000000000002', '2026-02-01', 45000);
SELECT t.refuses($q$INSERT INTO money_budget (category_id, from_month, amount_minor) VALUES ('32000000-0000-0000-0000-000000000002', '2026-02-01', 50000)$q$,
  'one budget per category per starting month', 'duplicate key');
INSERT INTO money_goal (id, name, target_minor, currency) VALUES
  ('34000000-0000-0000-0000-000000000001', 'Emergency fund', 1000000, 'CAD'),
  ('34000000-0000-0000-0000-000000000002', 'Trip home', 300000, 'CAD');
INSERT INTO money_goal_account (goal_id, account_id) VALUES ('34000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000004');
SELECT t.refuses($q$INSERT INTO money_goal_account (goal_id, account_id) VALUES ('34000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000004')$q$,
  'an account funds one goal only', 'money_goal_account_once');
SELECT t.refuses($q$SELECT public.money_save_goal('{"id":"34000000-0000-0000-0000-000000000002","name":"Trip home","target_minor":300000,"currency":"CAD"}', ARRAY['31000000-0000-0000-0000-000000000005','31000000-0000-0000-0000-000000000004']::uuid[])$q$,
  'saving a goal with a taken account changes nothing', 'money_goal_account_once');
SELECT t.check(t.count_of($q$SELECT account_id FROM money_goal_account WHERE goal_id = '34000000-0000-0000-0000-000000000002'$q$) = 0,
  'a refused goal save leaves no half-linked accounts');
SELECT public.money_save_goal('{"id":"34000000-0000-0000-0000-000000000002","name":"Trip to Delhi","target_minor":350000,"currency":"CAD","target_date":"2026-12-01"}', ARRAY['31000000-0000-0000-0000-000000000005']::uuid[]);
SELECT t.check((SELECT name = 'Trip to Delhi' AND target_minor = 350000 FROM money_goal WHERE id = '34000000-0000-0000-0000-000000000002')
           AND t.count_of($q$SELECT account_id FROM money_goal_account WHERE goal_id = '34000000-0000-0000-0000-000000000002'$q$) = 1,
  'a goal and its accounts save together');
-- ── Financing (phase 4) ─────────────────────────────────────────────────────

INSERT INTO money_account (id, name, kind, currency, opening_balance_minor, opening_date)
VALUES ('31000000-0000-0000-0000-000000000006', 'Car loan', 'loan', 'CAD', -2000000, '2026-01-01');
INSERT INTO money_loan (account_id, principal_minor, annual_rate, amortization_months, first_payment_date)
VALUES ('31000000-0000-0000-0000-000000000006', 2000000, 6.99, 60, '2026-02-01');
SELECT t.refuses($q$INSERT INTO money_loan (account_id, principal_minor, annual_rate, amortization_months, first_payment_date) VALUES ('31000000-0000-0000-0000-000000000001', 100000, 5, 12, '2026-02-01')$q$,
  'loan terms only go on a debt account', 'belong on a loan');
SELECT t.refuses($q$INSERT INTO money_loan (account_id, principal_minor, annual_rate, amortization_months, first_payment_date) VALUES ('31000000-0000-0000-0000-000000000006', 100000, 5, 12, '2026-02-01')$q$,
  'one set of terms per loan account', 'duplicate key');
SELECT t.refuses($q$UPDATE money_account SET kind = 'savings' WHERE id = '31000000-0000-0000-0000-000000000006'$q$,
  'an account with loan terms stays a debt', 'has loan terms');
SELECT t.refuses($q$UPDATE money_loan SET term_months = 120 WHERE account_id = '31000000-0000-0000-0000-000000000006'$q$,
  'a term cannot outlast the amortization', 'money_loan_term_within_amortization');

-- A payment: principal moves to the loan, interest is spent on the way.
SELECT public.money_record_transaction(
  '{"date":"2026-02-01","kind":"transfer","description":"Car loan payment"}',
  '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-28000},
    {"account_id":"31000000-0000-0000-0000-000000000006","amount_minor":28000},
    {"account_id":"31000000-0000-0000-0000-000000000001","category_id":"32000000-0000-0000-0000-000000000004","amount_minor":-11650}]');
SELECT t.check((SELECT balance_minor FROM public.money_balances('2026-12-31') WHERE account_id = '31000000-0000-0000-0000-000000000006') = -1972000,
  'a loan payment reduces what is owed by its principal only');

SELECT t.refuses($q$INSERT INTO money_credit_score (bureau, score, as_of) VALUES ('equifax', 950, '2026-02-01')$q$,
  'a Canadian credit score is 300 to 900', 'money_credit_score_score_check');
SELECT t.refuses($q$INSERT INTO money_application (lender, product, currency, purchase_price_minor, down_payment_minor) VALUES ('Bank', 'mortgage', 'CAD', 50000000, 60000000)$q$,
  'a down payment cannot exceed the price', 'money_application_down_payment_fits');
INSERT INTO money_application (id, lender, product, currency) VALUES ('35000000-0000-0000-0000-000000000001', 'Maple Bank', 'credit_card', 'CAD');
INSERT INTO money_application_doc (application_id, name) VALUES ('35000000-0000-0000-0000-000000000001', 'PR card');
SELECT t.refuses($q$INSERT INTO money_application_doc (application_id, name) VALUES ('35000000-0000-0000-0000-000000000001', 'PR card')$q$,
  'a document appears once per application', 'duplicate key');
-- Created in its own statement: a statement cannot see rows its own
-- function call inserted, so the count has to come after.
SELECT public.money_create_application(
  '{"lender":"Maple Bank","product":"mortgage","currency":"CAD","purchase_price_minor":45000000,"down_payment_minor":4500000}',
  ARRAY['Passport','Employment letter']) AS new_application \gset
SELECT t.check((SELECT count(*) FROM money_application_doc WHERE application_id = :'new_application') = 2
           AND (SELECT status = 'planning' FROM money_application WHERE id = :'new_application'),
  'an application and its checklist are created together');
SELECT t.refuses($q$SELECT public.money_create_application('{"lender":"Bad","product":"mortgage","currency":"CAD"}', ARRAY['Passport','Passport'])$q$,
  'a refused checklist leaves no application behind', 'duplicate key');
SELECT t.check(t.count_of($q$SELECT id FROM money_application WHERE lender = 'Bad'$q$) = 0,
  'nothing half-created');
COMMIT;

-- ── Investing (phase 5) ─────────────────────────────────────────────────────

BEGIN;
SELECT t.act_as('owner');
INSERT INTO money_account (id, name, kind, registration, currency, opening_balance_minor, opening_date) VALUES
  ('31000000-0000-0000-0000-000000000030', 'Brokerage TFSA', 'investment', 'tfsa', 'CAD', 0, '2026-01-01'),
  ('31000000-0000-0000-0000-000000000031', 'Brokerage USD', 'investment', 'none', 'USD', 0, '2026-01-01');
INSERT INTO money_security (id, symbol, name, currency, asset_class, region) VALUES
  ('35000000-0000-0000-0000-000000000001', 'XEQT', 'iShares Core Equity ETF', 'CAD', 'equity', 'global');
INSERT INTO money_category (id, name, bucket) VALUES ('32000000-0000-0000-0000-000000000030', 'Dividends', 'income');

SELECT t.refuses($q$INSERT INTO money_security (symbol, name, currency) VALUES ('xeqt lower', 'Bad', 'CAD')$q$,
  'a symbol is upper-case letters and digits', 'check constraint');
SELECT t.refuses($q$INSERT INTO money_price (security_id, date, price) VALUES ('35000000-0000-0000-0000-000000000001', '2026-02-01', 0)$q$,
  'a price is above zero', 'check constraint');
INSERT INTO money_price (security_id, date, price) VALUES ('35000000-0000-0000-0000-000000000001', '2026-02-01', 31.25);
SELECT t.refuses($q$INSERT INTO money_price (security_id, date, price) VALUES ('35000000-0000-0000-0000-000000000001', '2026-02-01', 32)$q$,
  'one price per security per day', 'duplicate key');

SELECT public.money_save_trade('{"account_id":"31000000-0000-0000-0000-000000000030","security_id":"35000000-0000-0000-0000-000000000001","date":"2026-02-02","kind":"buy","quantity":"10.5","amount_minor":32813,"fee_minor":999}') AS buy_id \gset
SELECT t.check((SELECT transaction_id IS NULL AND quantity = 10.5 FROM money_trade WHERE id = :'buy_id'),
  'a buy is saved without touching the ledger');
SELECT t.refuses($q$SELECT public.money_save_trade('{"account_id":"31000000-0000-0000-0000-000000000001","security_id":"35000000-0000-0000-0000-000000000001","date":"2026-02-02","kind":"buy","quantity":"1","amount_minor":3000}')$q$,
  'trades belong in an investment account', 'investment account');
SELECT t.refuses($q$SELECT public.money_save_trade('{"account_id":"31000000-0000-0000-0000-000000000031","security_id":"35000000-0000-0000-0000-000000000001","date":"2026-02-02","kind":"buy","quantity":"1","amount_minor":3000}')$q$,
  'a CAD security cannot be bought in a USD account', 'separate account');
SELECT t.refuses($q$SELECT public.money_save_trade('{"account_id":"31000000-0000-0000-0000-000000000030","security_id":"35000000-0000-0000-0000-000000000001","date":"2026-02-02","kind":"buy","amount_minor":3000}')$q$,
  'a buy needs a quantity', 'money_trade_shape');
SELECT t.refuses($q$SELECT public.money_save_trade('{"account_id":"31000000-0000-0000-0000-000000000030","security_id":"35000000-0000-0000-0000-000000000001","date":"2025-12-31","kind":"buy","quantity":"1","amount_minor":3000}')$q$,
  'a trade cannot predate the account', 'opening date');

SELECT public.money_save_trade('{"account_id":"31000000-0000-0000-0000-000000000030","security_id":"35000000-0000-0000-0000-000000000001","date":"2026-03-31","kind":"dividend","amount_minor":1234,"category_id":"32000000-0000-0000-0000-000000000030","description":"XEQT distribution"}') AS div_id \gset
SELECT t.check((SELECT p.amount_minor = 1234 AND p.category_id = '32000000-0000-0000-0000-000000000030' AND x.kind = 'income'
                  FROM money_trade tr JOIN money_transaction x ON x.id = tr.transaction_id
                  JOIN money_posting p ON p.transaction_id = x.id WHERE tr.id = :'div_id'),
  'a dividend writes its own income transaction');
SELECT public.money_save_trade(jsonb_build_object('id', :'div_id', 'account_id', '31000000-0000-0000-0000-000000000030',
  'security_id', '35000000-0000-0000-0000-000000000001', 'date', '2026-03-31', 'kind', 'dividend', 'amount_minor', 2000,
  'category_id', '32000000-0000-0000-0000-000000000030')) AS div_again \gset
SELECT t.check((SELECT count(*) FROM money_transaction x JOIN money_trade tr ON tr.transaction_id = x.id WHERE tr.id = :'div_id') = 1
           AND (SELECT p.amount_minor FROM money_trade tr JOIN money_posting p ON p.transaction_id = tr.transaction_id WHERE tr.id = :'div_id') = 2000,
  'editing a dividend rewrites the same transaction');
SELECT transaction_id AS div_txn FROM money_trade WHERE id = :'div_id' \gset
SELECT public.money_save_trade(jsonb_build_object('id', :'div_id', 'account_id', '31000000-0000-0000-0000-000000000030',
  'security_id', '35000000-0000-0000-0000-000000000001', 'date', '2026-03-31', 'kind', 'return_of_capital', 'amount_minor', 2000)) AS roc_id \gset
SELECT t.check((SELECT transaction_id IS NULL FROM money_trade WHERE id = :'div_id')
           AND t.count_of(format('SELECT id FROM money_transaction WHERE id = %L', :'div_txn')) = 0,
  'a dividend edited into a return of capital leaves the ledger');

SELECT public.money_save_trade('{"account_id":"31000000-0000-0000-0000-000000000030","date":"2026-04-01","kind":"fee","amount_minor":500,"description":"Admin fee"}') AS fee_id \gset
SELECT t.check((SELECT p.amount_minor = -500 FROM money_trade tr JOIN money_posting p ON p.transaction_id = tr.transaction_id WHERE tr.id = :'fee_id'),
  'an account fee is an expense in the ledger');
SELECT transaction_id AS fee_txn FROM money_trade WHERE id = :'fee_id' \gset
SELECT public.money_delete_trade(:'fee_id');
SELECT t.check(t.count_of(format('SELECT id FROM money_transaction WHERE id = %L', :'fee_txn')) = 0,
  'deleting a fee trade deletes its transaction');

INSERT INTO money_security (id, symbol, name, currency, region) VALUES
  ('35000000-0000-0000-0000-000000000002', 'VOO', 'Vanguard S&P 500 ETF', 'USD', 'us');
SELECT public.money_save_trade('{"account_id":"31000000-0000-0000-0000-000000000031","security_id":"35000000-0000-0000-0000-000000000002","date":"2026-03-31","kind":"dividend","amount_minor":1000,"category_id":"32000000-0000-0000-0000-000000000030","fx_rate":"1.4","base_amount_minor":1400}') AS usd_div \gset
SELECT t.check((SELECT p.amount_minor = 1000 AND p.fx_rate = 1.4 AND p.base_amount_minor = 1400
                  FROM money_trade tr JOIN money_posting p ON p.transaction_id = tr.transaction_id WHERE tr.id = :'usd_div'),
  'a US-dollar dividend is posted with its frozen rate and base amount');

SELECT t.refuses($q$UPDATE money_account SET kind = 'savings' WHERE id = '31000000-0000-0000-0000-000000000030'$q$,
  'an account with trades stays an investment account', 'has trades');
SELECT t.refuses($q$UPDATE money_security SET currency = 'USD' WHERE id = '35000000-0000-0000-0000-000000000001'$q$,
  'a traded security keeps its currency', 'has trades');
SELECT t.refuses($q$DELETE FROM money_security WHERE id = '35000000-0000-0000-0000-000000000001'$q$,
  'a traded security cannot be deleted', 'foreign key');

INSERT INTO money_room (registration, year, room_minor) VALUES ('tfsa', 2026, 700000);
SELECT t.refuses($q$INSERT INTO money_room (registration, year, room_minor) VALUES ('nro', 2026, 1)$q$,
  'contribution room is for TFSA, RRSP and FHSA', 'check constraint');
COMMIT;

-- ── Password-only session ───────────────────────────────────────────────────

BEGIN;
SELECT t.act_as('owner_aal1');
SELECT t.check(t.count_of('SELECT id FROM money_account') = 0, 'a password-only session reads no accounts');
SELECT t.refuses($q$SELECT public.money_record_transaction('{"date":"2026-02-03","kind":"expense","description":"x"}', '[{"account_id":"31000000-0000-0000-0000-000000000001","amount_minor":-1}]')$q$,
  'a password-only session cannot write money', 'Not authorised');
COMMIT;

BEGIN;
SELECT t.act_as('anon');
SELECT t.check(t.count_of('SELECT rate FROM money_rate') = 0, 'anon reads no rates');
COMMIT;

-- ── Report ──────────────────────────────────────────────────────────────────

SELECT CASE WHEN ok THEN 'ok     ' ELSE 'NOT OK ' END || n || ' - ' || name AS result
  FROM t.results ORDER BY n;

DO $$
DECLARE failed INT; total INT;
BEGIN
  SELECT count(*) FILTER (WHERE NOT ok), count(*) INTO failed, total FROM t.results;
  IF failed > 0 THEN
    RAISE EXCEPTION '% of % money checks failed', failed, total;
  END IF;
  RAISE WARNING 'all % money checks passed', total;
END $$;
