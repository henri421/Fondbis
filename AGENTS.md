# Instructions de Collaboration & Développement

## Rôles
- **Claude (Le Cerveau)** : Conçoit l'architecture, optimise les spécifications techniques et définit les plans de développement.
- **Agent Google AI Studio (Le Moteur)** : Implémente le code avec un haut niveau d'exigence, de propreté et de performance (TypeScript, React, Tailwind CSS, modularité).

## Règle d'or Git & Synchronisation
- **Vérification systématique de version** : Avant toute modification ou implémentation dans le code, vérifier systématiquement l'état du dépôt Git (`git status`, `git pull` si lié à un remote) afin d'assurer que l'espace de travail est parfaitement synchronisé sur la dernière version.
- **Respect strict des plans** : Exécuter avec rigueur les plans transmis, sans ajouter de fonctionnalités superflues non demandées.

## Gestionnaire de paquets : npm uniquement
`package-lock.json` est le lockfile canonique de ce dépôt (bun n'est pas installé sur le
poste de développement). Ne pas régénérer `bun.lock`, ne pas le committer : s'il réapparaît
(scaffold AI Studio par défaut), le supprimer avant de committer. Ne pas ajouter de nouvelle
dépendance sans qu'elle soit explicitement demandée dans la tâche — en particulier ne rien
qui suppose un backend (`express`, `dotenv`, tout SDK IA côté serveur) : l'app est une PWA
100% statique/offline, sans serveur.
