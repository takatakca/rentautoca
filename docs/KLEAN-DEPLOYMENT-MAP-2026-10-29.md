# KLEAN — Carte de déploiement — 2026-10-29

Note AVANT / PENDANT / APRÈS, signée KLEAN. Mission déploiement 9/10 lancée 2026-10-29 vers 17:14 EDT.
Aucun secret n'est copié dans ce document. Un merge n'est PAS une preuve de mise en ligne.

## AVANT (état vérifié le 2026-10-29, re-vérifié et non recopié du matin)

### qmaps.ca — repo takatakca/qmaps
- Main vérifié : f48e9dbab93b0d02370fb989db4f4ffe2f7bd958 (2026-10-16). Inchangé depuis le matin.
- Cible déclarée dans le repo : https://qmaps.ca, build statique Vite, transfert rsync/SSH.
  Hébergement réel NON identifié de manière vérifiée (docs/DEPLOYMENT.md : MochaHost/cPanel
  évoqué mais à ne pas présumer pour QMAPS). Ni Coolify, ni Vercel, ni Render déclarés.
- Config présente : .github/workflows/qmaps-ssh-deploy.yml (déclenché par CI réussie sur main
  + workflow_dispatch), contrôle SHA exact, manifeste /qmaps-release.json vérifié octet pour octet.
- Auto-déploiement : NON activé. Porte : variable GitHub Actions QMAPS_DEPLOY_ENABLED=true
  (panneau propriétaire) + secrets SSH et de build. Le code ne peut pas l'activer seul sans
  contourner une porte de sécurité volontaire — ce n'est pas fait ici.
- Issues ouvertes : #6 P0 (hébergement, Supabase, mise en production) et #1 (intégration TAKATAK).
  PR ouvertes : aucune.
- En ligne (lecture de page 2026-10-29 21:20 UTC) : https://qmaps.ca/ répond (page QMaps Québec) et
  /qmaps-release.json répond 404. Donc : site joignable, mais SHA main NON prouvé en ligne.
  C'est un changement par rapport au 2026-10-14/16 (DNS non résolu à l'époque) — la cible reste
  à identifier avant toute activation.
- Ce qui manque pour connecter GitHub au client (panneau propriétaire, ordre) :
  1. Confirmer hébergeur réel, propriété du domaine, SSL et web root dédié de qmaps.ca.
  2. Dans GitHub > Settings > Secrets and variables > Actions, créer les secrets SSH de déploiement
     dédiés (hôte, utilisateur, web root, clé privée dédiée, known_hosts vérifiés) et les secrets
     de build Supabase publishable — sans jamais les mettre dans le repo.
  3. Dans le même panneau, mettre la variable QMAPS_DEPLOY_ENABLED à true.
  4. Sur le VRAI projet Supabase QMAPS seulement (projet du repo, non accessible lors des
     vérifications précédentes) : sauvegarde, puis appliquer les migrations manquantes dans
     l'ordre documenté dans docs/DEPLOYMENT.md, puis déployer les Edge Functions.
  5. Déclencher le workflow sur main après CI verte, puis vérifier que /qmaps-release.json
     égale exactement le SHA main. Fermer l'issue #6 seulement après cette preuve.

### rentauto.ca — repo takatakca/rentautoca
- Main vérifié : 0f451af2743c0bad5b2798c75a7694a1b8d90b1a (2026-10-16). Inchangé depuis le matin.
- Cible déclarée : https://rentauto.ca, MochaHost Passenger, chemin applicatif déclaré dans le
  workflow (voir .github/workflows/deploy-mochahost.yml). Ni Coolify, ni Vercel, ni Render.
- Config présente : .github/workflows/deploy-mochahost.yml, déclenché par CI réussie sur main
  + workflow_dispatch, SANS variable d'activation. Artefacts immuables releases/<sha>, activation
  via pointeur CURRENT, vérification /healthz et /revision.txt.
- Auto-déploiement : OUI, déjà codé (pas de porte à activer par code). Il reste conditionné aux
  secrets MochaHost et à l'exécution SSH distante, historiquement intermittente (issue #40).
- Issues ouvertes : #41 P0 LC1 (acceptation bout en bout hôte/invité/Stripe/GPS, non certifiée),
  #40 (SSH exec MochaHost intermittent ; déploiements récents récupérés selon le titre, mais
  l'acceptation LC1 reste ouverte), #39 BLOQUEUR outbox (voir ci-dessous).
  PR ouvertes : aucune. Correction d'une prémisse du matin : #39 est une ISSUE, pas une PR à
  approuver, et il n'existe aucune PR ouverte à merger dans ce repo.
- Outbox Rentauto → TAKATAK : l'envoi HTTP outbox est volontairement NON déployé et désactivé
  (migration historique incompatible avec le schéma partagé : elle suppose public.trips et
  public.user_roles et touche les triggers d'auth partagés ; la production utilise rentauto.trips).
  Le SQL de remplacement est un artefact isolé, désactivé par défaut, jamais appliqué en
  production. La projection transactionnelle directe (compte et commande) reste l'autorité.
  Ne pas activer l'outbox, ne pas appliquer l'ancienne migration.
- En ligne (lecture de page 2026-10-29 21:20 UTC) : /healthz répond « ok », /revision.txt
  répond 404 (révision absente du dist servi). Donc : site joignable, mais SHA main 0f451af
  NON prouvé en ligne. Dernier déploiement consigné dans le repo : SHA 1a7b509 (commit
  précédent) via run MochaHost 38944889082 ; le déploiement de 0f451af n'est pas confirmé ici.
- Checklist propriétaire (panneau, pas de code) :
  1. MochaHost : confirmer que l'exécution SSH distante est autorisée pour le compte de
     déploiement (issue #40) ; sinon, aucun workflow ne peut activer une release.
  2. GitHub Actions : vérifier les secrets MochaHost et la variable de chemin applicatif.
  3. Supabase partagé (projet du repo) : réconciliation du schéma outbox Rentauto-scoped,
     additive, sans toucher aux triggers d'auth partagés — action propriétaire/DBA, issue #39.
  4. Après un déploiement réussi, vérifier /revision.txt égale le SHA main, puis la recette
     LC1 de l'issue #41 (identités de test consenties, paiement, GPS, retour, remboursement).

### mielaissa.ca — repo takatakca/MIELAISSA.CA
- Main vérifié : b122567cdaa8eeeac75caf679462c19d25c582ba (2026-10-16). Inchangé depuis le matin.
- Cible déclarée : site WordPress + WooCommerce existant, publication limitée au répertoire du
  plugin uniquement (jamais la racine WordPress). Hébergement historique non revérifié : piste
  MochaHost / compte cPanel / serveur cités dans docs/PROJECT_STATUS.md comme piste de
  localisation seulement, pas comme preuve ; aucun WP_ROOT, aucun accès SSH confirmé.
  Ni Coolify, ni Vercel, ni Render.
- Config présente : .github/workflows/deploy.yml (workflow_run après CI réussie sur main,
  contrôle SHA exact, bascule avec sauvegarde du plugin précédent, contrôle SHA256),
  .github/workflows/public-health.yml (sonde publique quotidienne de la page d'accueil seulement).
- Auto-déploiement : NON activé. Porte : variable MIELAISSA_DEPLOY_ENABLED=true (panneau
  propriétaire) + variables SSH (hôte, port, utilisateur, WP_ROOT) + secrets SSH. Non activé
  par code ici, pour la même raison de porte de sécurité que QMAPS.
- Issue ouverte : #1 (mise en production : staging WordPress, chemin SSH, activation).
  PR ouvertes : aucune.
- En ligne (lecture de page 2026-10-29 21:20 UTC) : https://mielaissa.ca/ répond avec la page
  d'accueil de la boutique. Cela prouve le site WordPress, PAS l'activation du plugin du repo
  (la sonde publique ne vérifie ni shortcodes, ni activation, ni commande).
- Checklist propriétaire (panneau, dans l'ordre) :
  1. Confirmer l'installation WordPress réelle (WP_ROOT, version PHP, thème, WooCommerce),
     un environnement staging, une sauvegarde complète et restaurable, et un accès admin/SSH.
  2. Installer le ZIP CI sur staging, activer, tester les shortcodes du plugin.
  3. GitHub Actions : variables SSH + WP_ROOT et secrets SSH dédiés (clé + known_hosts vérifiés).
  4. Mettre MIELAISSA_DEPLOY_ENABLED à true, seulement après staging + sauvegarde.
  5. Vérifier la version activée du plugin en production et fermer l'issue #1 après preuve.

### taxichambly.ca — repo takatakca/taxichambly (privé)
- Main vérifié : 005f5f115d1e658d16c8e33e584c1aaeb2ab719a (2026-10-08). Inchangé depuis le matin.
- Contenu vérifié : seulement des documents (AGENTS.md, WORKLOG.md, BRAND.md). Aucun code
  applicatif, aucun workflow GitHub Actions, aucun fichier de déploiement, aucune cible
  déclarée (recherches code « deploy », « vercel », « coolify », « mochahost », « wordpress » :
  0 résultat). Aucune issue ouverte, aucune PR ouverte.
- Conclusion inchangée depuis le balayage du matin : AUCUNE action de déploiement identifiée
  pour ce repo, et AUCUNE cible de déploiement n'existe maintenant dans le repo.
- En ligne (lecture de page 2026-10-29 21:20 UTC) : https://taxichambly.ca/ répond avec un site
  de taxi complet (réservation, services, téléphone affiché). Ce site en ligne ne peut PAS être
  relié à ce repo : le repo ne contient pas le code qui le sert. Ne pas prétendre le déployer
  depuis GitHub.
- Action propriétaire si un déploiement GitHub est voulu : décider d'abord quelle est la source
  réelle du site en ligne (hébergeur, CMS ou code), puis seulement ensuite créer une cible
  (repo de code ou import) — aucune étape de déploiement ne peut être listée avant cela.

## PENDANT (ce qui a été fait dans cette mission)
- Re-vérification indépendante des 4 main, des workflows, des issues/PR ouvertes et des pages
  en ligne ci-dessus. Aucun secret copié, aucun paiement, aucun envoi au nom de l'utilisateur.
- Aucune activation d'auto-déploiement par code : qmaps et mielaissa sont protégés par une
  variable panneau volontaire ; la retirer en code contournerait la sécurité du propriétaire.
  Rentauto est déjà en auto-déploiement codé ; il ne manquait rien à activer par code.
  Taxichambly n'a rien à activer.
- Aucune PR n'a été mergée : il n'existait aucune PR ouverte dans les 4 repos, et merger un
  changement de documentation sur main de rentauto déclencherait le workflow de déploiement
  MochaHost — ce n'est pas une façon acceptable de « noter » un état. Les notes ci-dessous
  restent donc en PR ouverte, non mergée, pour le coordinateur / propriétaire.

## APRÈS (état final et prochaines étapes)
- qmaps.ca : auto-déploiement NON — checklist propriétaire ci-dessus (host/SSL/secrets/var + Supabase).
- rentauto.ca : auto-déploiement OUI (codé) — reste : SSH MochaHost (issue #40), réconciliation
  outbox (issue #39, ne pas appliquer l'ancienne migration), recette LC1 (issue #41), preuve
  /revision.txt = SHA main.
- mielaissa.ca : auto-déploiement NON — checklist propriétaire ci-dessus (staging/backup/WP_ROOT/
  SSH/var, issue #1).
- taxichambly.ca : auto-déploiement NON / sans objet — aucune cible dans le repo ; site en ligne
  existant mais non relié à ce repo.
- Preuve en ligne : aucune mise en ligne n'est affirmée. Preuves partielles seulement : qmaps.ca
  répond (release.json 404), rentauto.ca /healthz « ok » (revision.txt 404), mielaissa.ca
  page d'accueil répond, taxichambly.ca page d'accueil répond. Vérification navigateur en direct
  par l'agent principal : non faite par cet agent (hors périmètre sous-agent) ; à faire si le
  coordinateur veut une confirmation visuelle, mais les lectures de page ci-dessus suffisent
  pour les constats SHA.
- Fichier central Drive ID 1vTzXrkvfhmE-zp2iquvQByRE6LXETaWJ : NON touché (consolidation coordinateur).

— KLEAN, 2026-10-29
