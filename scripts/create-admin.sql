-- Promouvoir un compte existant en super administrateur — à coller dans Supabase > SQL Editor.
-- Prérequis : le compte existe (Authentication > Users > Add user > Create new user, « Auto Confirm User » coché).
-- 1. Remplacer l'adresse ci-dessous (2 endroits), 2. Run. Idempotent.
-- Résultat attendu : une ligne affichée avec role = super_admin.

UPDATE auth.users
   SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
 WHERE lower(email) = lower('ADRESSE_DE_DAVID@exemple.fr');

INSERT INTO admin_users (user_id, role)
SELECT id, 'super_admin' FROM auth.users WHERE lower(email) = lower('ADRESSE_DE_DAVID@exemple.fr')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

SELECT u.email, a.role FROM admin_users a JOIN auth.users u ON u.id = a.user_id;
