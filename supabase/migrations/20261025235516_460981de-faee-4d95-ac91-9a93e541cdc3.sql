CREATE TABLE public.signup_request_limits (request_key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, reset_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.signup_request_limits FROM anon, authenticated;
GRANT ALL ON public.signup_request_limits TO service_role;
ALTER TABLE public.signup_request_limits ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER signup_limits_updated BEFORE UPDATE ON public.signup_request_limits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE FUNCTION public.check_signup_request(p_email text, p_ip text, p_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE k text; n integer; until_time timestamptz; account_state text; cooldown integer; max_attempts integer; window_seconds integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_action NOT IN ('signup','resend','reset') OR length(p_email)>254 OR p_email IS DISTINCT FROM lower(btrim(p_email)) THEN RAISE EXCEPTION 'Invalid input'; END IF;
 -- Serialize the shared global budget and all per-email decisions, including concurrent requests.
 PERFORM pg_advisory_xact_lock(731915);
 DELETE FROM public.signup_request_limits WHERE reset_at < now() - interval '1 day';
 FOREACH k IN ARRAY ARRAY['global', 'ip:' || md5(p_ip), 'email:' || md5(p_email)] LOOP
   max_attempts := CASE WHEN k='global' THEN 200 WHEN k LIKE 'ip:%' THEN 10 ELSE 5 END;
   window_seconds := CASE WHEN k='global' THEN 60 ELSE 900 END;
   INSERT INTO public.signup_request_limits(request_key,attempts,reset_at) VALUES(k,1,now()+make_interval(secs=>window_seconds))
   ON CONFLICT(request_key) DO UPDATE SET attempts=CASE WHEN signup_request_limits.reset_at<=now() THEN 1 ELSE signup_request_limits.attempts+1 END, reset_at=CASE WHEN signup_request_limits.reset_at<=now() THEN now()+make_interval(secs=>window_seconds) ELSE signup_request_limits.reset_at END
   RETURNING attempts,reset_at INTO n,until_time;
   IF n>max_attempts THEN RETURN jsonb_build_object('status','limited','retryAfter',greatest(1,ceil(extract(epoch FROM until_time-now()))::integer)); END IF;
 END LOOP;
 SELECT CASE WHEN email_confirmed_at IS NOT NULL THEN 'confirmed' ELSE 'unconfirmed' END INTO account_state FROM auth.users WHERE lower(btrim(email))=p_email LIMIT 1;
 account_state := coalesce(account_state,'new');
 IF p_action='resend' AND account_state='unconfirmed' THEN
   k := 'resend:' || md5(p_email);
   SELECT greatest(1,ceil(extract(epoch FROM reset_at-now()))::integer) INTO cooldown FROM public.signup_request_limits WHERE request_key=k AND reset_at>now();
   IF cooldown IS NOT NULL THEN RETURN jsonb_build_object('status','limited','retryAfter',cooldown); END IF;
   INSERT INTO public.signup_request_limits(request_key,attempts,reset_at) VALUES(k,1,now()+interval '60 seconds') ON CONFLICT(request_key) DO UPDATE SET attempts=1,reset_at=now()+interval '60 seconds';
 END IF;
 RETURN jsonb_build_object('status',account_state,'retryAfter',0);
END $$;
REVOKE ALL ON FUNCTION public.check_signup_request(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_signup_request(text,text,text) TO service_role;