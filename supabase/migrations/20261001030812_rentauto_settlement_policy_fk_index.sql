create index if not exists settlement_policy_updated_by_idx
  on rentauto.settlement_policy(updated_by_user_id)
  where updated_by_user_id is not null;
