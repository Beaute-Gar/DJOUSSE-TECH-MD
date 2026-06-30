# COGNITIVE OS v2.0 — ARCHITECTURE TRANSITION DOCUMENT

## De Bot WhatsApp à Operating System Conversationnel

**Référence officielle du projet** — Toute évolution future doit respecter cette vision.

---

## Philosophie centrale
WhatsApp devient l'interface principale. Le Dashboard devient uniquement un centre de visualisation secondaire. L'utilisateur ne doit presque jamais avoir besoin d'ouvrir une autre interface que WhatsApp.

## Les 10 réflexions fondatrices

### 1. WhatsApp est l'interface principale
Le Dashboard sert uniquement à visualiser (graphes, Mesh, World Model, stats, métriques, debug). Toutes les opérations quotidiennes passent par WhatsApp.

### 2. Auto-découverte après connexion
Le système ne connaît PAS les groupes/contacts à l'avance. Après connexion WhatsApp, il découvre automatiquement tout l'environnement et construit son univers cognitif. Zéro configuration manuelle.

### 3. Workspace = Univers cognitif personnel
Multi-tenant obligatoire. Chaque utilisateur possède son propre cerveau : mémoire, CRM, World Model, Digital Twin, Knowledge Mesh, agents, missions, politiques, stats. Aucune donnée partagée entre utilisateurs.

### 4. Chaque groupe devient une entité cognitive
Un groupe obtient automatiquement son propre agent spécialisé (ERP Agent, Support Agent, Family Agent, etc.). Tous coordonnés par l'Agent Orchestrator existant.

### 5. Le groupe n'est plus un simple objet
Un groupe possède : mémoire, contexte, chronologie, historique décisions/conflits, objectifs, règles, missions, stats, connaissances, agent, politiques, confiance, identité. C'est une organisation intelligente.

### 6. Préfixe .OS pour tout pilotage
Toutes les commandes d'administration passent par `.OS` dans WhatsApp (`.OS aide`, `.OS groupes`, `.OS missions`, `.OS résumé`, `.OS agents`, etc.). Le Dashboard ne pilote plus le système.

### 7. Contexte de groupe implicite
` .OS ...` dans un groupe = commande concernant CE groupe uniquement. Le système ne doit JAMAIS demander "De quel groupe parlez-vous ?".

### 8. Scale automatique
30 utilisateurs = 30 Workspaces, 30 CRM, 30 World Models, 30 jeux d'agents, etc. Aucune intervention développeur.

### 9. Basé sur les droits réels
Détection automatique des droits (admin/membre groupe, capacités WhatsApp). Fonctionnalités proposées uniquement quand les permissions le permettent.

### 10. 4 niveaux d'autonomie
- **Observation** : observe uniquement
- **Suggestion** : prépare réponses/actions, attend validation
- **Assisté** : exécute auto uniquement actions explicitement autorisées
- **Autonome** : applique politiques définies dans limites des droits

Toutes les actions restent auditables et réversibles.

---

## Nouveaux composants à construire (couche supérieure uniquement)

1. **Workspace Manager** — multi-tenancy, création auto au démarrage
2. **Auto-Discovery Service** — scan groupes/contacts après connexion
3. **Group Agent Factory** — instancie un agent spécialisé par groupe
4. **.OS Command Handler** — parse les commandes `.OS` dans WhatsApp
5. **Context Resolver** — détermine le contexte (utilisateur, groupe) d'une commande
6. **Autonomy Controller** — gère les 4 niveaux par workspace/groupe
7. **Group Cognitive Object** — étend le modèle de groupe avec mémoire, contexte, objectifs, politique

## Ce qui ne change PAS (gelé)
- Tous les moteurs cognitifs (14 engines)
- Cognitive Runtime
- Unified Cognitive API
- Toutes les apps (CRM, Mission Center, Search, Dashboard)
- Tous les agents (Orchestrator, Executive, Research, Communication, Learning)
- Governance Layer (Policy, Permission, Approval, Audit, Trust, Safety)
- Cognitive SDK
- Event Bus
- ~40 tables DB

## Sprint révisé
Jour 1 : Workspace Manager + Auto-Discovery + .OS Command Handler
Jour 2 : Group Cognitive Object + Group Agent Factory
Jour 3 : Context Resolver + Autonomy Controller
Jour 4 : Dashboard adapté (visualisation only) + multimodal essentiel
Jour 5 : Performance + tests multi-tenant
Jour 6 : Tests réels WhatsApp
Jour 7 : Documentation v2.0 + démo stable
