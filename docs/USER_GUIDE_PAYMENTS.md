# Guide Utilisateur — Module de Gestion des Paiements

## Présentation

Le module **Paiements** permet aux écoles de gérer la facturation et le suivi des paiements des frais de scolarité. Il couvre :

- La gestion des filiales (branches)
- La configuration de facturation par filiale
- L'inscription des enfants avec génération automatique des périodes de facturation
- L'enregistrement des paiements reçus (espèces, CCP, BaridiMob)
- Les corrections et remboursements
- Le tableau de bord des retards
- Le rapprochement comptable
- Un portail parent en lecture seule

Toutes les sommes sont en **Dinars Algériens (DZD)** avec 2 décimales.

---

## Accès au module

### Depuis la barre latérale (Portail Admin)

Un seul menu **Paiements** dans la barre latérale ouvre une page à onglets :

| Onglet | Contenu |
|--------|---------|
| **Inscriptions** | Gérer les inscriptions de facturation |
| **Encaissements** | Enregistrer et consulter les paiements |
| **Retards** | Tableau de bord des périodes en retard |
| **Rapprochement** | Rapport de réconciliation par canal |
| **Configuration** | Filiales, paramètres de facturation, calendrier |

### Rôles et permissions

| Rôle | Accès |
|------|-------|
| **Admin / Super Admin** | Accès complet : configuration, inscriptions, paiements, rapports |
| **Enseignant** | Aucun accès au module paiements |
| **Parent** | Lecture seule : voir les périodes, l'historique et les soldes |

---

## 1. Gestion des filiales

### Accéder aux filiales

Menu **Paiements** → onglet **Configuration**

La section **Filiales** affiche la liste de toutes les filiales de votre école.

### Créer une filiale

1. Cliquez le bouton **Nouvelle filiale**
2. Remplissez le formulaire :

| Champ | Description | Obligatoire |
|-------|-------------|-------------|
| Nom | Nom de la filiale (ex: "Filiale Centre") | Oui |
| Adresse | Adresse physique | Non |

3. Cliquez **Créer**

La nouvelle filiale apparaît immédiatement dans la liste et dans tous les menus déroulants du module.

### Informations affichées

Chaque filiale affiche :
- Son nom
- Son adresse (si renseignée)
- Son statut (Active / Inactive)

---

## 2. Configuration de la facturation

### Accéder à la configuration

Menu **Paiements** → onglet **Configuration** → section **Configuration de facturation**

La configuration s'applique à la filiale sélectionnée.

### Paramètres disponibles

| Champ | Description | Valeurs acceptées |
|-------|-------------|-------------------|
| Cycle de facturation | Fréquence des périodes | Mensuel, Trimestriel, Personnalisé |
| Jour d'échéance | Jour du mois pour la date d'échéance | 1 à 28 |
| Jours de grâce | Délai après échéance avant marquage en retard | 0 à 60 (défaut : 5) |
| Frais récurrents par défaut | Montant par défaut pour les nouvelles inscriptions | 0,00 à 9 999 999,99 DZD |
| Notifications | Activer/désactiver les alertes de retard aux parents | Activé / Désactivé |

**Important :** Modifier la configuration n'affecte PAS les périodes de facturation déjà générées. Seules les nouvelles inscriptions utiliseront les nouvelles valeurs.

---

## 3. Calendrier de facturation (Trimestriel / Personnalisé)

### Accéder au calendrier

Menu **Paiements** → onglet **Configuration** → section **Calendrier académique**

Sélectionnez la filiale et l'année scolaire, puis ajoutez les périodes.

### Ajouter une période

| Champ | Description |
|-------|-------------|
| Libellé | Nom de la période (ex: "1er Trimestre") — 1 à 100 caractères |
| Début de période | Date de début |
| Fin de période | Date de fin (doit être ≥ début) |
| Date d'échéance | Date de paiement attendue (doit être ≥ début de période) |

**Règles :**
- Cycle trimestriel : exactement **3 entrées** par année scolaire
- Cycle personnalisé : au moins **1 entrée**
- Les plages de dates ne doivent pas se chevaucher

---

## 4. Inscriptions de facturation

### Accéder aux inscriptions

Menu **Paiements** → onglet **Inscriptions**

Le tableau affiche toutes les inscriptions de votre école avec : nom de l'enfant, année scolaire, statut, frais récurrents, date de début.

### Créer une inscription

Cliquez le bouton **Nouvelle inscription** puis remplissez :

| Champ | Description |
|-------|-------------|
| Enfant | Sélectionnez l'enfant à inscrire |
| Branche | Filiale de facturation (doit avoir une config active) |
| Année scolaire | Année scolaire concernée |
| Date de début | Date d'effet de l'inscription |
| Frais récurrents | Montant par période (optionnel — utilise le défaut si vide) |
| Frais d'inscription | Montant unique (optionnel — génère une période supplémentaire) |
| Montant 1ère période | Montant ajusté pour inscription en milieu de période (optionnel) |

### Ce qui se passe à la création

1. L'inscription est créée
2. Les périodes de facturation sont générées automatiquement :
   - **Mensuel** : une période par mois calendaire (septembre → juin = 10 périodes)
   - **Trimestriel** : 3 périodes selon le calendrier de la filiale
   - **Personnalisé** : N périodes selon le calendrier
3. Si un frais d'inscription est renseigné, une période supplémentaire est créée
4. Un résumé s'affiche : nombre de périodes, plage de dates, montant total

### Contraintes

- Un seul enregistrement par enfant par année scolaire
- La date de début doit être dans la plage de l'année scolaire
- La filiale doit avoir une configuration de facturation active

### Retrait

Si un enfant quitte l'école en cours d'année :

1. Cliquez sur l'inscription dans le tableau
2. Dans le détail, cliquez **Retirer**
3. Indiquez la date de retrait
4. Optionnellement, ajustez le montant de la période en cours

**Effet :** Les périodes futures sont annulées. Les périodes passées et la période d'inscription restent intactes.

---

## 5. Enregistrement des paiements

### Accéder aux encaissements

Menu **Paiements** → onglet **Encaissements**

### Enregistrer un paiement

Cliquez **Nouvelle دفعة / Nouveau paiement** puis remplissez :

| Champ | Description |
|-------|-------------|
| Enfant | L'enfant concerné |
| Montant total | Somme reçue en DZD |
| Canal | Espèces, CCP, ou BaridiMob |
| Date de valeur | Date effective du paiement (pas dans le futur) |
| Référence / Note | Obligatoire pour CCP et BaridiMob — référence du transfert |
| Allocations | Répartition du montant sur les périodes de facturation |

### Allocations

Vous devez indiquer comment le montant est réparti sur les périodes :

1. Cliquez **Ajouter une allocation**
2. Sélectionnez la période de facturation
3. Indiquez le montant alloué

**Règle clé :** La somme des allocations doit être **exactement égale** au montant total.

Un indicateur visuel affiche : `مجموع التخصيصات: 3000 / 5000 د.ج`

### Après l'enregistrement

- Un **numéro de reçu** est généré automatiquement (format : `CODE-ANNÉE-SÉQUENCE`)
- Le statut des périodes concernées est mis à jour
- Une entrée d'audit est créée

---

## 6. Corrections et remboursements

Les paiements sont **immuables** (append-only). On ne modifie jamais un paiement existant.

### Enregistrer une correction

Dans l'onglet **Encaissements**, cliquez **Correction** :

| Champ | Description |
|-------|-------------|
| Paiement original | Sélectionnez le paiement à corriger |
| Montant total | Montant **négatif** (ex: -1000) |
| Canal | Même canal ou autre |
| Référence / Note | **Obligatoire** — raison de la correction |
| Allocations | Montants négatifs par période (limités au montant original) |

**Règles :**
- Le montant total doit être négatif
- Chaque allocation ne peut pas dépasser le montant initialement alloué à cette période
- La note est toujours obligatoire pour les corrections

---

## 7. Statuts des périodes

Les statuts sont **dérivés automatiquement** — jamais saisis manuellement :

| Statut | Condition | Couleur |
|--------|-----------|---------|
| **Non payé** | Aucun paiement, dans le délai de grâce | Gris |
| **Partiel** | Paiement partiel, dans le délai de grâce | Bleu |
| **Payé** | Total payé ≥ montant dû | Vert |
| **En retard** | Aucun paiement, délai de grâce dépassé | Rouge |
| **Retard partiel** | Paiement partiel, délai de grâce dépassé | Orange |

**Le statut de paiement ne bloque JAMAIS** la présence, l'accès ou toute autre fonctionnalité. Il est purement informatif.

---

## 8. Solde et périodes d'un enfant

### Consulter

Dans l'onglet **Inscriptions**, cliquez sur une inscription pour voir :
- La liste de toutes les périodes avec leur statut
- Le solde total (somme des montants dus - somme des paiements)
- Un solde négatif indique un trop-perçu

### Annuler une période

Dans le détail d'une inscription, vous pouvez annuler une période individuelle. Les périodes annulées :
- Sont exclues du calcul du solde
- N'apparaissent pas dans le tableau des retards
- Restent visibles avec un indicateur "annulée"

---

## 9. Tableau de bord des retards

### Accéder

Menu **Paiements** → onglet **Retards**

Le tableau affiche toutes les périodes dont le délai de grâce est dépassé :

| Colonne | Description |
|---------|-------------|
| Enfant | Nom de l'enfant |
| Période | Libellé de la période |
| Échéance | Date d'échéance |
| Fin de grâce | Date limite avec grâce |
| Montant dû | Montant de la période |
| Total payé | Somme des paiements reçus |
| Restant | Montant impayé |
| Statut | En retard / Retard partiel |

### Filtres

- **Statut :** Filtrer par "En retard" ou "Retard partiel"
- Tri par défaut : date de fin de grâce (ascendant), puis nom de l'enfant

---

## 10. Rapprochement (Réconciliation)

### Générer un rapport

Menu **Paiements** → onglet **Rapprochement**

1. Sélectionnez une **plage de dates** (début et fin requis)
2. Le rapport affiche :

| Canal | Total | Nb paiements | Nb corrections |
|-------|-------|--------------|----------------|
| Espèces | 150 000,00 DZD | 45 | 2 |
| CCP | 80 000,00 DZD | 20 | 1 |
| BaridiMob | 50 000,00 DZD | 15 | 0 |
| **Grand Total** | **280 000,00 DZD** | **80** | **3** |

Les corrections (montants négatifs) réduisent le total du canal concerné.

---

## 11. Reçus

### Consulter un reçu

Depuis la liste des encaissements, cliquez l'icône **Reçu** sur la ligne du paiement.

Le reçu contient :
- Nom de l'école et de la filiale
- Numéro de reçu unique
- Nom de l'enfant
- Montant et canal de paiement
- Date de valeur
- Enregistré par (nom du personnel)
- Détail des allocations (périodes + montants)
- Indication de correction le cas échéant

### Impression

Cliquez **Imprimer** pour un rendu optimisé. Le reçu respecte la langue de l'utilisateur :
- **Arabe :** mise en page RTL (droite à gauche)
- **Français :** mise en page LTR (gauche à droite)

Les montants utilisent les chiffres arabes occidentaux (1, 2, 3...) quel que soit la langue.

---

## 12. Portail Parent

### Accès

Les parents se connectent avec leur compte et accèdent à la section **المدفوعات / Paiements**.

### Fonctionnalités disponibles

| Onglet | Contenu |
|--------|---------|
| **Périodes** | Liste de toutes les périodes de facturation par enfant avec statut |
| **Historique** | Tous les paiements enregistrés avec numéro de reçu |
| **Soldes** | Solde restant par enfant |

### Restrictions

- **Aucune action d'écriture** : pas de bouton payer, modifier ou supprimer
- Le parent ne voit que les données de **ses propres enfants** (liés à son compte)
- Les corrections sont affichées avec un label "تصحيح / Correction"
- Les périodes annulées sont visibles avec un indicateur

### Parent sans enfant lié

Un message s'affiche :
> "لا يوجد أطفال مرتبطون بحسابك. تواصل مع المدرسة لربط أطفالك."

---

## 13. Notifications (optionnel)

Si les notifications sont **activées** dans la configuration de la filiale :

- **Retard :** Une notification est envoyée au parent quand une période passe en statut "en retard"
- **Confirmation :** Une notification est envoyée après chaque paiement enregistré
- Maximum **1 notification de retard par période par jour**
- En cas d'échec d'envoi, le paiement est quand même enregistré

---

## 14. Concepts importants

### Registre append-only (immuable)

Les paiements ne sont **jamais modifiés ou supprimés**. Toute correction est un nouvel enregistrement avec un montant négatif. Cela garantit un historique complet et auditable.

### Snapshot des montants

Les montants des périodes sont **figés** au moment de leur génération. Modifier la configuration ou les frais n'affecte pas les périodes déjà créées.

### Isolation des données (multi-tenant)

- Chaque utilisateur ne voit que les données de **son école**
- Le personnel affecté à une filiale ne voit que **sa filiale**
- Le personnel sans filiale assignée voit **toutes les filiales** de son école
- Aucune fuite de données entre écoles ou entre filiales

---

## Flux de travail typique

```
1. Créer une filiale          (Configuration → Nouvelle filiale)
2. Configurer la facturation  (Configuration → Paramètres de la filiale)
3. Définir le calendrier      (Configuration → Calendrier, si trimestriel/personnalisé)
4. Inscrire les enfants       (Inscriptions → Nouvelle inscription)
5. Enregistrer les paiements  (Encaissements → Nouveau paiement)
6. Suivre les retards         (Retards)
7. Générer les rapports       (Rapprochement)
```

---

## FAQ

### Puis-je modifier le montant d'une période déjà générée ?

Non. Les montants sont figés à la création. Pour ajuster :
- Annuler la période et gérer le montant lors du retrait
- Enregistrer une correction si un paiement a déjà été fait

### Un enfant peut-il avoir deux inscriptions pour la même année ?

Non. Le système empêche les doublons (une inscription par enfant par année scolaire).

### Que se passe-t-il si je change le frais récurrent de la filiale ?

Les périodes existantes conservent leur montant original. Seules les nouvelles inscriptions utiliseront le nouveau montant.

### Le statut "en retard" bloque-t-il la présence ?

Non. Le statut de paiement est purement informatif et ne bloque aucune fonctionnalité.

### Comment gérer une inscription en milieu d'année ?

Lors de la création, renseignez le champ "Montant 1ère période" avec le montant proratisé négocié avec les parents.

### Que voit le parent quand un remboursement est effectué ?

Le parent voit la correction dans son historique avec le label "Correction" et le numéro du reçu original. Le solde est recalculé automatiquement.

### Puis-je créer plusieurs filiales ?

Oui. Allez dans l'onglet Configuration, section Filiales, et cliquez "Nouvelle filiale". Chaque filiale a sa propre configuration de facturation, son propre calendrier, et ses propres inscriptions.

---

## Raccourcis et astuces

- **Navigation rapide :** Cliquez sur le nom d'un enfant dans le tableau des retards pour accéder à ses périodes
- **Reçu parent :** Les parents peuvent voir les reçus de leurs enfants via le bouton "عرض الإيصال"
- **Filtre canal :** Dans les encaissements, filtrez par canal pour rapprocher rapidement
- **Export :** Le rapport de rapprochement peut être imprimé directement
- **URL avec onglet :** Ajoutez `?tab=records` ou `?tab=late` à l'URL pour accéder directement à un onglet
