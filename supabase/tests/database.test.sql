begin;

select plan(8);

select is(
  (select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'profile_access_codes' and column_name in ('access_code', 'code', 'plaintext_code')),
  0,
  'profile access code is not stored in a plaintext column'
);

select is(
  (select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'provider_credentials' and column_name in ('api_key', 'secret_key', 'plaintext_key')),
  0,
  'provider credentials have no plaintext key column'
);

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles'
);

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.provider_credentials'::regclass),
  'RLS is enabled on provider credentials'
);

select is(
  (select count(*)::integer from information_schema.role_table_grants where table_schema = 'public' and table_name = 'provider_credentials' and grantee in ('anon', 'authenticated')),
  0,
  'browser roles have no provider credential grants'
);

select is(
  (select count(*)::integer from information_schema.role_table_grants where table_schema = 'public' and table_name = 'profile_access_codes' and grantee in ('anon', 'authenticated')),
  0,
  'browser roles have no access-code grants'
);

select ok(
  to_regprocedure('public.consume_sylc_rate_limit(text,text,integer,integer)') is not null,
  'atomic rate-limit function exists'
);

select is(
  (select count(*)::integer from public.provider_credentials),
  0,
  'fresh database contains no credentials'
);

select * from finish();
rollback;
