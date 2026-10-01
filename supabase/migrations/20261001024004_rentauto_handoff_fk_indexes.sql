create index if not exists trip_handoff_snapshots_submitted_by_idx
  on rentauto.trip_handoff_snapshots(submitted_by);

create index if not exists trip_incident_events_actor_user_idx
  on rentauto.trip_incident_events(actor_user_id)
  where actor_user_id is not null;
