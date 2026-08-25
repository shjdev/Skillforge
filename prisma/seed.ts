import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SkillForge database seeding...');

  // 1. Initial User Profile
  const user = await prisma.userProfile.upsert({
    where: { id: 'default-user' },
    update: {},
    create: {
      id: 'default-user',
      name: 'Apprenant SkillForge',
      sessionMode: 'TWO_SESSIONS',
      morningTime: '07:30',
      eveningTime: '20:00',
      totalXp: 0,
      currentStreak: 0,
      notificationSettings: {
        create: {
          desktopEnabled: true,
          soundEnabled: true,
          morningReminderMins: 5,
          eveningReminderMins: 5,
          accumulationReminder: true,
          streakReminder: true,
        },
      },
    },
  });

  console.log(`👤 User profile created: ${user.name}`);

  // 2. Initial Domains
  const domains = [
    {
      id: 'domain-networking',
      name: 'Réseau (Networking)',
      slug: 'networking',
      description: 'Architectures réseau, modèles OSI & TCP/IP, protocoles, routage et sécurité informatique des données.',
      icon: 'Network',
      color: '#3b82f6', // Blue
      order: 1,
    },
    {
      id: 'domain-security',
      name: 'Sécurité (Cybersecurity)',
      slug: 'security',
      description: 'Cybersécurité, cryptographie, sécurité des applications web (OWASP), firewalls et tests d’intrusion (Pentesting).',
      icon: 'Shield',
      color: '#ef4444', // Red
      order: 2,
    },
    {
      id: 'domain-software-engineering',
      name: 'Génie Logiciel (Software Engineering)',
      slug: 'software-engineering',
      description: 'Patrons de conception (Design Patterns), architectures propres (Clean & Hexagonal Architecture), CI/CD et DevOps.',
      icon: 'Cpu',
      color: '#8b5cf6', // Purple
      order: 3,
    },
    {
      id: 'domain-development',
      name: 'Développement (Development)',
      slug: 'development',
      description: 'Développement Web moderne (Frontend React/Next.js, Backend Node.js/Python), APIs REST & GraphQL, et Bases de Données SQL/NoSQL.',
      icon: 'Code',
      color: '#10b981', // Green
      order: 4,
    },
    {
      id: 'domain-general-it',
      name: 'Informatique Générale (General IT)',
      slug: 'general-it',
      description: 'Systèmes d’exploitation (Linux & Windows Internals), Cloud Computing (AWS/Azure), Virtualisation (Docker/K8s) et Scripting.',
      icon: 'Terminal',
      color: '#f59e0b', // Amber
      order: 5,
    },
  ];

  for (const domainData of domains) {
    const domain = await prisma.domain.upsert({
      where: { slug: domainData.slug },
      update: domainData,
      create: domainData,
    });
    console.log(`🌐 Domain ready: ${domain.name}`);
  }

  // 3. Initial Topics for Networking
  const networkingTopics = [
    {
      id: 'topic-net-fundamentals',
      domainId: 'domain-networking',
      name: 'Fondamentaux Réseau & Modèle OSI',
      slug: 'networking-fundamentals',
      description: 'Comprendre l’empilement des couches du Modèle OSI (Open Systems Interconnection) et de la suite TCP/IP.',
      maxDifficultyLevel: 5,
      estimatedWeeks: 1,
      prerequisites: '[]',
    },
    {
      id: 'topic-net-protocols',
      domainId: 'domain-networking',
      name: 'Protocoles de Communication (TCP, UDP, IP, DNS, HTTP)',
      slug: 'network-protocols',
      description: 'Étude détaillée des protocoles de la couche transport et application.',
      maxDifficultyLevel: 5,
      estimatedWeeks: 2,
      prerequisites: '["networking-fundamentals"]',
    },
  ];

  for (const topicData of networkingTopics) {
    await prisma.topic.upsert({
      where: { slug: topicData.slug },
      update: topicData,
      create: topicData,
    });
  }

  // 4. Sample Book Reference
  const bookRef = await prisma.bookReference.upsert({
    where: { id: 'book-tcpip-vol1' },
    update: {},
    create: {
      id: 'book-tcpip-vol1',
      title: 'TCP/IP Illustrated, Volume 1: The Protocols',
      author: 'W. Richard Stevens',
      isbn: '978-0201633467',
      description: 'La référence absolue sur les protocoles de communication et le fonctionnement interne de la pile TCP/IP.',
    },
  });

  // 5. Sample Lessons for Networking Level 1 Day 1
  await prisma.lesson.upsert({
    where: { id: 'lesson-net-fund-d1-m' },
    update: {},
    create: {
      id: 'lesson-net-fund-d1-m',
      topicId: 'topic-net-fundamentals',
      title: 'Introduction au Modèle OSI (Open Systems Interconnection)',
      contentMd: `# 🌐 Le Modèle OSI (Open Systems Interconnection)

Le **Modèle OSI** (*Open Systems Interconnection — Interconnexion de Systèmes Ouverts*) est un standard de référence théorique décrivant comment les données circulent sur un réseau à travers 7 couches d'abstraction.

---

### 📚 Référence Bibliographique
> Contenu issu et enrichi d'après l'ouvrage de référence :  
> **${bookRef.title}** de *${bookRef.author}* (Chapitre 1 : *Introduction to Networking Architecture*).

---

## 🔑 Les 7 Couches du Modèle OSI

1. **Couche Application (Application Layer)** : Interface avec l'utilisateur et les logiciels (HTTP, FTP, SMTP, DNS).
2. **Couche Présentation (Presentation Layer)** : Formatage, chiffrement (Encryption) et compression des données.
3. **Couche Session (Session Layer)** : Gestion et maintien des sessions de communication entre applications.
4. **Couche Transport (Transport Layer)** : Contrôle d'acheminement, segmentation et fiabilité (TCP, UDP).
5. **Couche Réseau (Network Layer)** : Adressage logique (Logical Addressing) et routage des paquets (IP, ICMP).
6. **Couche Liaison de données (Data Link Layer)** : Adressage physique (MAC Address) et détection d'erreurs (Ethernet, Wi-Fi).
7. **Couche Physique (Physical Layer)** : Transmission binaire (Bits) sur le support physique (Câbles cuivre, Fibre optique, Ondes radio).

---

### 💡 Concept Clé : L'Encapsulation (Encapsulation)
Lorsque des données sont envoyées, chaque couche ajoute un en-tête (Header) spécifique avant de transmettre les données à la couche inférieure. Ce processus s'appelle l'**Encapsulation** (*Encapsulation*). À la réception, le processus inverse s'appelle le **Désencapsulation** (*Decapsulation*).
`,
      dayNumber: 1,
      sessionType: 'MORNING',
      difficultyLevel: 1,
      durationMinutes: 30,
      keyConcepts: JSON.stringify(['Modèle OSI', 'Encapsulation (Encapsulation)', 'Couche Réseau (Network Layer)', 'Désencapsulation (Decapsulation)']),
      bookReferenceId: bookRef.id,
      chapterCitation: 'Chapitre 1, pp. 1-24',
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-net-fund-d1-e' },
    update: {},
    create: {
      id: 'lesson-net-fund-d1-e',
      topicId: 'topic-net-fundamentals',
      title: 'Pratique : Encapsulation & Analyse de Trames (Frame Analysis)',
      contentMd: `# 🌙 Pratique : L'Encapsulation & Structure des Trames

Ce soir, nous appliquons la théorie sur la circulation des Unités de Données de Protocole (*Protocol Data Units — PDU*).

---

### 🛠️ Exercice Pratique : Identification des PDU

Chaque couche OSI manipulée possède son propre nom d'unité de donnée (*Protocol Data Unit — PDU*) :

- **Couche 7, 6, 5** : Données (*Data*)
- **Couche 4 (Transport)** : Segment (*Segment*) pour TCP / Datagramme (*Datagram*) pour UDP
- **Couche 3 (Réseau)** : Paquet (*Packet*)
- **Couche 2 (Liaison)** : Trame (*Frame*)
- **Couche 1 (Physique)** : Bits (*Bits*)

---

### 💻 Scénario d'Analyse :
Imaginons un navigateur Web qui formule une requête HTTP vers un serveur Web.

1. La requête HTTP forme la **Donnée** (*Data*).
2. La couche Transport ajoute l'en-tête TCP (Port Source & Port Destination) -> Forme le **Segment TCP**.
3. La couche Réseau ajoute l'en-tête IP (Adresse IP Source & Adresse IP Destination) -> Forme le **Paquet IP**.
4. La couche Liaison ajoute l'en-tête Ethernet (Adresse MAC Source & Destination) -> Forme la **Trame Ethernet**.
`,
      dayNumber: 1,
      sessionType: 'EVENING',
      difficultyLevel: 1,
      durationMinutes: 30,
      keyConcepts: JSON.stringify(['Protocol Data Unit (PDU)', 'Segment TCP', 'Paquet IP (IP Packet)', 'Trame Ethernet (Ethernet Frame)']),
      bookReferenceId: bookRef.id,
      chapterCitation: 'Chapitre 1, pp. 25-32',
    },
  });

  // 6. Placement Test for Networking
  const placementTestNet = await prisma.placementTest.upsert({
    where: { id: 'placement-test-networking' },
    update: {},
    create: {
      id: 'placement-test-networking',
      domainId: 'domain-networking',
      title: 'Test de Placement Initial — Domaine Réseau',
      description: 'Évaluation rapide de vos connaissances en réseaux informatiques pour déterminer votre niveau de départ (Débutant à Spécialiste).',
      questionCount: 5,
      levelThresholds: JSON.stringify({ '1': 0, '2': 40, '3': 60, '4': 80, '5': 90 }),
    },
  });

  const sampleQuestions = [
    {
      id: 'q-net-1',
      placementTestId: placementTestNet.id,
      questionText: 'À quelle couche du modèle OSI appartient le protocole IP (Internet Protocol) ?',
      options: JSON.stringify([
        'Couche 2 — Liaison de données (Data Link Layer)',
        'Couche 3 — Réseau (Network Layer)',
        'Couche 4 — Transport (Transport Layer)',
        'Couche 7 — Application (Application Layer)',
      ]),
      correctAnswer: 'Couche 3 — Réseau (Network Layer)',
      explanation: 'Le protocole IP s’occupe de l’adressage logique et du routage des paquets à la couche 3 (Network Layer).',
      points: 20,
      questionType: 'MCQ',
    },
    {
      id: 'q-net-2',
      placementTestId: placementTestNet.id,
      questionText: 'Quel est le rôle du Three-Way Handshake (Poignée de main en trois étapes) dans TCP ?',
      options: JSON.stringify([
        'Fermer une connexion réseau de manière sécurisée',
        'Établir une connexion fiable orientée connexion entre un client et un serveur',
        'Crypter les paquets réseau échangés',
        'Résoudre un nom de domaine en adresse IP',
      ]),
      correctAnswer: 'Établir une connexion fiable orientée connexion entre un client et un serveur',
      explanation: 'Le Three-Way Handshake utilise les paquets SYN, SYN-ACK, et ACK pour synchroniser les numéros de séquence et établir la connexion TCP.',
      points: 20,
      questionType: 'MCQ',
    },
  ];

  for (const q of sampleQuestions) {
    await prisma.quizQuestion.upsert({
      where: { id: q.id },
      update: q,
      create: q,
    });
  }

  // 7. Sécurité (Cybersecurity) — Topic, Book, Lessons, Placement Test, Weekly Quiz
  await prisma.topic.upsert({
    where: { slug: 'security-fundamentals' },
    update: {},
    create: {
      id: 'topic-sec-fundamentals',
      domainId: 'domain-security',
      name: 'Fondamentaux de la Cybersécurité',
      slug: 'security-fundamentals',
      description: 'Les piliers de la sécurité de l’information et les grandes familles de vecteurs d’attaque (Attack Vectors).',
      maxDifficultyLevel: 5,
      estimatedWeeks: 1,
      prerequisites: '[]',
    },
  });

  const bookSecRef = await prisma.bookReference.upsert({
    where: { id: 'book-web-hacker-handbook' },
    update: {},
    create: {
      id: 'book-web-hacker-handbook',
      title: "The Web Application Hacker's Handbook",
      author: 'Dafydd Stuttard & Marcus Pinto',
      isbn: '978-1118026472',
      description: 'Référence incontournable sur les techniques d’attaque et de défense des applications web.',
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-sec-fund-d1-m' },
    update: {},
    create: {
      id: 'lesson-sec-fund-d1-m',
      topicId: 'topic-sec-fundamentals',
      title: 'La Triade CIA (Confidentialité, Intégrité, Disponibilité)',
      contentMd: `# 🛡️ La Triade CIA (CIA Triad)

La **Triade CIA** (*Confidentiality, Integrity, Availability*) est le modèle fondateur de toute analyse de sécurité de l'information. Chaque décision de sécurité vise à protéger un ou plusieurs de ces trois piliers.

---

### 📚 Référence Bibliographique
> Contenu issu et enrichi d'après l'ouvrage de référence :
> **${bookSecRef.title}** de *${bookSecRef.author}* (Chapitre 1 : *Web Application (In)security*).

---

## 🔑 Les 3 Piliers

1. **Confidentialité (Confidentiality)** : Seules les personnes autorisées peuvent accéder à l'information (ex. chiffrement — *Encryption*, contrôle d'accès — *Access Control*).
2. **Intégrité (Integrity)** : Les données ne doivent pas être altérées de façon non autorisée (ex. fonctions de hachage — *Hash Functions*, signatures numériques — *Digital Signatures*).
3. **Disponibilité (Availability)** : Les systèmes et données doivent rester accessibles aux utilisateurs légitimes (ex. protection contre le déni de service — *Denial of Service, DoS*).

---

### 💡 Concept Clé : La Surface d'Attaque (Attack Surface)
La **Surface d'Attaque** (*Attack Surface*) désigne l'ensemble des points d'entrée par lesquels un attaquant pourrait tenter de compromettre un système. Réduire la surface d'attaque (désactiver les services inutiles, limiter les permissions) est un principe central de la défense en profondeur (*Defense in Depth*).
`,
      dayNumber: 1,
      sessionType: 'MORNING',
      difficultyLevel: 1,
      durationMinutes: 30,
      keyConcepts: JSON.stringify(['Triade CIA (CIA Triad)', 'Confidentialité (Confidentiality)', 'Intégrité (Integrity)', 'Surface d’Attaque (Attack Surface)']),
      bookReferenceId: bookSecRef.id,
      chapterCitation: 'Chapitre 1, pp. 1-18',
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-sec-fund-d1-e' },
    update: {},
    create: {
      id: 'lesson-sec-fund-d1-e',
      topicId: 'topic-sec-fundamentals',
      title: 'Pratique : Identifier les Vecteurs d’Attaque (Attack Vectors)',
      contentMd: `# 🌙 Pratique : Les Vecteurs d'Attaque Courants

Ce soir, nous classons les familles d'attaques les plus fréquentes sur les applications web, en lien avec le classement **OWASP Top 10**.

---

### 🛠️ Exercice Pratique : Reconnaître une Famille de Vulnérabilité

- **Injection (Injection)** : Insertion de code malveillant via une entrée non validée (ex. Injection SQL — *SQL Injection*).
- **Cross-Site Scripting (XSS)** : Injection de script côté client exécuté dans le navigateur d'une victime.
- **Authentification Défaillante (Broken Authentication)** : Mauvaise gestion des sessions ou des mots de passe.
- **Exposition de Données Sensibles (Sensitive Data Exposure)** : Absence de chiffrement des données au repos ou en transit.

---

### 💻 Scénario d'Analyse :
Un formulaire de connexion accepte l'entrée utilisateur directement dans une requête SQL sans validation.

1. Un attaquant saisit \`' OR '1'='1\` dans le champ mot de passe.
2. La requête SQL générée devient toujours vraie, contournant l'authentification.
3. C'est une **Injection SQL (SQL Injection)** classée dans le Top 10 OWASP.
4. La défense : utiliser des requêtes préparées (*Prepared Statements*) et valider les entrées (*Input Validation*).
`,
      dayNumber: 1,
      sessionType: 'EVENING',
      difficultyLevel: 1,
      durationMinutes: 30,
      keyConcepts: JSON.stringify(['OWASP Top 10', 'Injection SQL (SQL Injection)', 'Cross-Site Scripting (XSS)', 'Requêtes Préparées (Prepared Statements)']),
      bookReferenceId: bookSecRef.id,
      chapterCitation: 'Chapitre 2, pp. 19-45',
    },
  });

  const placementTestSec = await prisma.placementTest.upsert({
    where: { id: 'placement-test-security' },
    update: {},
    create: {
      id: 'placement-test-security',
      domainId: 'domain-security',
      title: 'Test de Placement Initial — Domaine Sécurité',
      description: 'Évaluation rapide de vos connaissances en cybersécurité pour déterminer votre niveau de départ.',
      questionCount: 5,
      levelThresholds: JSON.stringify({ '1': 0, '2': 40, '3': 60, '4': 80, '5': 90 }),
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'q-sec-1' },
    update: {},
    create: {
      id: 'q-sec-1',
      placementTestId: placementTestSec.id,
      questionText: 'Quel pilier de la Triade CIA est directement menacé par une attaque par déni de service (DDoS) ?',
      options: JSON.stringify(['Confidentialité (Confidentiality)', 'Intégrité (Integrity)', 'Disponibilité (Availability)', 'Non-répudiation (Non-repudiation)']),
      correctAnswer: 'Disponibilité (Availability)',
      explanation: 'Une attaque DDoS vise à rendre un service indisponible pour ses utilisateurs légitimes, ciblant donc la Disponibilité.',
      points: 20,
      questionType: 'MCQ',
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'q-sec-2' },
    update: {},
    create: {
      id: 'q-sec-2',
      placementTestId: placementTestSec.id,
      questionText: 'Quelle contre-mesure protège le mieux contre une Injection SQL (SQL Injection) ?',
      options: JSON.stringify(['Chiffrer le mot de passe de l’utilisateur', 'Utiliser des requêtes préparées (Prepared Statements)', 'Activer un pare-feu réseau (Firewall)', 'Compresser les réponses HTTP']),
      correctAnswer: 'Utiliser des requêtes préparées (Prepared Statements)',
      explanation: 'Les requêtes préparées séparent le code SQL des données fournies par l’utilisateur, neutralisant l’injection.',
      points: 20,
      questionType: 'MCQ',
    },
  });

  const weeklyQuizSec = await prisma.quiz.upsert({
    where: { id: 'quiz-sec-fundamentals-weekly' },
    update: {},
    create: {
      id: 'quiz-sec-fundamentals-weekly',
      topicId: 'topic-sec-fundamentals',
      title: 'Quiz Hebdomadaire — Fondamentaux de la Cybersécurité',
      difficultyLevel: 1,
      passingScore: 80,
      quizType: 'WEEKLY',
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'q-sec-quiz-1' },
    update: {},
    create: {
      id: 'q-sec-quiz-1',
      quizId: weeklyQuizSec.id,
      questionText: 'Quels sont les trois piliers de la Triade CIA ?',
      options: JSON.stringify([
        'Confidentialité, Intégrité, Disponibilité',
        'Chiffrement, Authentification, Autorisation',
        'Prévention, Détection, Réponse',
        'Réseau, Application, Données',
      ]),
      correctAnswer: 'Confidentialité, Intégrité, Disponibilité',
      explanation: 'La Triade CIA (Confidentiality, Integrity, Availability) est le modèle fondateur de la sécurité de l’information.',
      points: 50,
      questionType: 'MCQ',
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'q-sec-quiz-2' },
    update: {},
    create: {
      id: 'q-sec-quiz-2',
      quizId: weeklyQuizSec.id,
      questionText: 'Le Cross-Site Scripting (XSS) permet principalement de :',
      options: JSON.stringify([
        'Ralentir un serveur par surcharge de requêtes',
        'Exécuter un script malveillant dans le navigateur d’une victime',
        'Deviner un mot de passe par force brute',
        'Intercepter le trafic réseau chiffré',
      ]),
      correctAnswer: 'Exécuter un script malveillant dans le navigateur d’une victime',
      explanation: 'Le XSS injecte du script côté client qui s’exécute dans le contexte du navigateur de la victime.',
      points: 50,
      questionType: 'MCQ',
    },
  });

  console.log('🛡️ Domain seeded: Sécurité (Cybersecurity)');

  // 8. Génie Logiciel (Software Engineering)
  await prisma.topic.upsert({
    where: { slug: 'software-engineering-fundamentals' },
    update: {},
    create: {
      id: 'topic-se-fundamentals',
      domainId: 'domain-software-engineering',
      name: 'Principes SOLID & Design Patterns',
      slug: 'software-engineering-fundamentals',
      description: 'Les principes de conception orientée objet qui rendent un code maintenable, extensible et testable.',
      maxDifficultyLevel: 5,
      estimatedWeeks: 1,
      prerequisites: '[]',
    },
  });

  const bookSeRef = await prisma.bookReference.upsert({
    where: { id: 'book-design-patterns-gof' },
    update: {},
    create: {
      id: 'book-design-patterns-gof',
      title: 'Design Patterns: Elements of Reusable Object-Oriented Software',
      author: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
      isbn: '978-0201633610',
      description: 'L’ouvrage fondateur des patrons de conception (Design Patterns), dit « Gang of Four ».',
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-se-fund-d1-m' },
    update: {},
    create: {
      id: 'lesson-se-fund-d1-m',
      topicId: 'topic-se-fundamentals',
      title: 'Introduction aux Principes SOLID',
      contentMd: `# 🧱 Les Principes SOLID

**SOLID** est un acronyme regroupant cinq principes de conception orientée objet (*Object-Oriented Design*) qui aident à produire du code maintenable et évolutif.

---

### 📚 Référence Bibliographique
> Contenu issu et enrichi d'après l'ouvrage de référence :
> **${bookSeRef.title}** de *${bookSeRef.author}* (Introduction : *What Is a Design Pattern?*).

---

## 🔑 Les 5 Principes

1. **S — Responsabilité Unique (Single Responsibility Principle)** : Une classe ne doit avoir qu'une seule raison de changer.
2. **O — Ouvert/Fermé (Open/Closed Principle)** : Ouvert à l'extension, fermé à la modification.
3. **L — Substitution de Liskov (Liskov Substitution Principle)** : Une sous-classe doit pouvoir remplacer sa classe mère sans casser le programme.
4. **I — Ségrégation des Interfaces (Interface Segregation Principle)** : Préférer plusieurs interfaces spécifiques à une seule interface générale.
5. **D — Inversion de Dépendances (Dependency Inversion Principle)** : Dépendre d'abstractions, pas d'implémentations concrètes.

---

### 💡 Concept Clé : La Dette Technique (Technical Debt)
Ignorer ces principes accumule de la **Dette Technique** (*Technical Debt*) : le code devient plus coûteux à faire évoluer avec le temps, comme un emprunt dont les intérêts s'accumulent.
`,
      dayNumber: 1,
      sessionType: 'MORNING',
      difficultyLevel: 1,
      durationMinutes: 30,
      keyConcepts: JSON.stringify(['Principes SOLID (SOLID Principles)', 'Responsabilité Unique (Single Responsibility)', 'Inversion de Dépendances (Dependency Inversion)', 'Dette Technique (Technical Debt)']),
      bookReferenceId: bookSeRef.id,
      chapterCitation: 'Introduction, pp. 1-15',
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-se-fund-d1-e' },
    update: {},
    create: {
      id: 'lesson-se-fund-d1-e',
      topicId: 'topic-se-fundamentals',
      title: 'Pratique : Repérer une Violation du Principe de Responsabilité Unique (SRP)',
      contentMd: `# 🌙 Pratique : Refactoriser vers le SRP

Ce soir, nous apprenons à repérer une classe qui viole le **Principe de Responsabilité Unique** (*Single Responsibility Principle — SRP*).

---

### 🛠️ Exercice Pratique : Repérer les Responsabilités Multiples

Une classe \`UserManager\` qui valide un email, sauvegarde l'utilisateur en base de données, ET envoie un email de bienvenue viole le SRP : elle a trois raisons de changer.

---

### 💻 Scénario de Refactorisation :

1. Extraire la validation dans une classe \`UserValidator\`.
2. Extraire la persistance dans un dépôt de données (*Repository*) \`UserRepository\`.
3. Extraire l'envoi d'email dans un service \`NotificationService\`.
4. \`UserManager\` orchestre désormais ces trois collaborateurs sans porter leurs responsabilités.

Ce découpage rend chaque classe testable indépendamment (*Unit Testing*) et facilite les évolutions futures.
`,
      dayNumber: 1,
      sessionType: 'EVENING',
      difficultyLevel: 1,
      durationMinutes: 30,
      keyConcepts: JSON.stringify(['SRP (Single Responsibility Principle)', 'Refactorisation (Refactoring)', 'Dépôt de Données (Repository)', 'Tests Unitaires (Unit Testing)']),
      bookReferenceId: bookSeRef.id,
      chapterCitation: 'Chapitre 1, pp. 16-30',
    },
  });

  const placementTestSe = await prisma.placementTest.upsert({
    where: { id: 'placement-test-software-engineering' },
    update: {},
    create: {
      id: 'placement-test-software-engineering',
      domainId: 'domain-software-engineering',
      title: 'Test de Placement Initial — Domaine Génie Logiciel',
      description: 'Évaluation rapide de vos connaissances en conception logicielle pour déterminer votre niveau de départ.',
      questionCount: 5,
      levelThresholds: JSON.stringify({ '1': 0, '2': 40, '3': 60, '4': 80, '5': 90 }),
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'q-se-1' },
    update: {},
    create: {
      id: 'q-se-1',
      placementTestId: placementTestSe.id,
      questionText: 'Le "O" de SOLID (Open/Closed Principle) signifie qu\'une classe doit être :',
      options: JSON.stringify([
        'Ouverte à la modification, fermée à l’extension',
        'Ouverte à l’extension, fermée à la modification',
        'Toujours publique dans son module',
        'Testée à 100% avant chaque déploiement',
      ]),
      correctAnswer: 'Ouverte à l’extension, fermée à la modification',
      explanation: 'On doit pouvoir étendre le comportement d’une classe sans modifier son code source existant.',
      points: 20,
      questionType: 'MCQ',
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'q-se-2' },
    update: {},
    create: {
      id: 'q-se-2',
      placementTestId: placementTestSe.id,
      questionText: 'Quel patron de conception (Design Pattern) garantit qu’une classe n’a qu’une seule instance ?',
      options: JSON.stringify(['Factory Method', 'Singleton', 'Observer', 'Adapter']),
      correctAnswer: 'Singleton',
      explanation: 'Le patron Singleton restreint l’instanciation d’une classe à un seul objet partagé.',
      points: 20,
      questionType: 'MCQ',
    },
  });

  console.log('🧱 Domain seeded: Génie Logiciel (Software Engineering)');

  // 9. Développement (Development)
  await prisma.topic.upsert({
    where: { slug: 'web-development-fundamentals' },
    update: {},
    create: {
      id: 'topic-dev-fundamentals',
      domainId: 'domain-development',
      name: 'Fondamentaux du Développement Web Moderne',
      slug: 'web-development-fundamentals',
      description: 'Le fonctionnement d’une requête HTTP et les bases de la conception d’API REST.',
      maxDifficultyLevel: 5,
      estimatedWeeks: 1,
      prerequisites: '[]',
    },
  });

  const bookDevRef = await prisma.bookReference.upsert({
    where: { id: 'book-restful-web-apis' },
    update: {},
    create: {
      id: 'book-restful-web-apis',
      title: 'RESTful Web APIs',
      author: 'Leonard Richardson & Mike Amundsen',
      isbn: '978-1449358068',
      description: 'Référence pour concevoir des APIs web propres et respectueuses des standards HTTP et REST.',
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-dev-fund-d1-m' },
    update: {},
    create: {
      id: 'lesson-dev-fund-d1-m',
      topicId: 'topic-dev-fundamentals',
      title: 'Le Cycle de Vie d’une Requête HTTP (HTTP Request Lifecycle)',
      contentMd: `# 🌐 Le Cycle de Vie d'une Requête HTTP

Comprendre le trajet d'une requête **HTTP** (*HyperText Transfer Protocol*) entre un client et un serveur est la base de tout développement web moderne.

---

### 📚 Référence Bibliographique
> Contenu issu et enrichi d'après l'ouvrage de référence :
> **${bookDevRef.title}** de *${bookDevRef.author}* (Chapitre 1 : *The Programmable Web*).

---

## 🔑 Les Étapes du Cycle

1. **Résolution DNS (DNS Resolution)** : Le nom de domaine est traduit en adresse IP.
2. **Connexion TCP (TCP Handshake)** : Établissement de la connexion avec le serveur.
3. **Requête HTTP (HTTP Request)** : Le client envoie une méthode (GET, POST...), des en-têtes (*Headers*) et parfois un corps (*Body*).
4. **Traitement Serveur (Server Processing)** : Le serveur route la requête, exécute la logique métier, interroge éventuellement une base de données.
5. **Réponse HTTP (HTTP Response)** : Le serveur renvoie un code de statut (*Status Code*), des en-têtes et un corps de réponse.

---

### 💡 Concept Clé : L'Idempotence (Idempotency)
Une méthode HTTP est dite **idempotente** (*Idempotent*) si répéter la même requête plusieurs fois produit toujours le même effet (ex. GET, PUT, DELETE). POST, en revanche, n'est généralement pas idempotent.
`,
      dayNumber: 1,
      sessionType: 'MORNING',
      difficultyLevel: 1,
      durationMinutes: 30,
      keyConcepts: JSON.stringify(['HTTP (HyperText Transfer Protocol)', 'Résolution DNS (DNS Resolution)', 'Code de Statut (Status Code)', 'Idempotence (Idempotency)']),
      bookReferenceId: bookDevRef.id,
      chapterCitation: 'Chapitre 1, pp. 3-22',
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-dev-fund-d1-e' },
    update: {},
    create: {
      id: 'lesson-dev-fund-d1-e',
      topicId: 'topic-dev-fundamentals',
      title: 'Pratique : Requêtes REST & Codes de Statut HTTP (HTTP Status Codes)',
      contentMd: `# 🌙 Pratique : Concevoir un Endpoint REST

Ce soir, nous appliquons les conventions **REST** (*Representational State Transfer*) à la conception d'un point d'accès API (*Endpoint*).

---

### 🛠️ Exercice Pratique : Choisir le Bon Verbe et le Bon Code

Pour une ressource \`/users/:id\` :

- **GET /users/42** → Lire l'utilisateur → **200 OK** si trouvé, **404 Not Found** sinon.
- **POST /users** → Créer un utilisateur → **201 Created** avec l'URL de la nouvelle ressource dans l'en-tête *Location*.
- **PUT /users/42** → Remplacer entièrement l'utilisateur → **200 OK** ou **204 No Content**.
- **DELETE /users/42** → Supprimer l'utilisateur → **204 No Content**.

---

### 💻 Scénario d'Analyse :
Un client envoie \`POST /users\` avec un email déjà utilisé par un autre compte. Le serveur doit répondre **409 Conflict** (et non 500), car la requête est valide mais entre en conflit avec l'état actuel du serveur — l'erreur est une erreur client, pas serveur.
`,
      dayNumber: 1,
      sessionType: 'EVENING',
      difficultyLevel: 1,
      durationMinutes: 30,
      keyConcepts: JSON.stringify(['REST (Representational State Transfer)', 'Endpoint', 'Codes de Statut HTTP (HTTP Status Codes)', '409 Conflict']),
      bookReferenceId: bookDevRef.id,
      chapterCitation: 'Chapitre 3, pp. 45-60',
    },
  });

  const placementTestDev = await prisma.placementTest.upsert({
    where: { id: 'placement-test-development' },
    update: {},
    create: {
      id: 'placement-test-development',
      domainId: 'domain-development',
      title: 'Test de Placement Initial — Domaine Développement',
      description: 'Évaluation rapide de vos connaissances en développement web pour déterminer votre niveau de départ.',
      questionCount: 5,
      levelThresholds: JSON.stringify({ '1': 0, '2': 40, '3': 60, '4': 80, '5': 90 }),
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'q-dev-1' },
    update: {},
    create: {
      id: 'q-dev-1',
      placementTestId: placementTestDev.id,
      questionText: 'Quel code de statut HTTP indique qu’une ressource a été créée avec succès ?',
      options: JSON.stringify(['200 OK', '201 Created', '204 No Content', '301 Moved Permanently']),
      correctAnswer: '201 Created',
      explanation: '201 Created signale explicitement la création réussie d’une nouvelle ressource, généralement en réponse à un POST.',
      points: 20,
      questionType: 'MCQ',
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'q-dev-2' },
    update: {},
    create: {
      id: 'q-dev-2',
      placementTestId: placementTestDev.id,
      questionText: 'Parmi ces méthodes HTTP, laquelle est considérée comme idempotente (Idempotent) ?',
      options: JSON.stringify(['POST', 'PUT', 'CONNECT', 'PATCH (dans le cas général)']),
      correctAnswer: 'PUT',
      explanation: 'PUT remplace entièrement une ressource : répéter la requête produit toujours le même état final.',
      points: 20,
      questionType: 'MCQ',
    },
  });

  console.log('💻 Domain seeded: Développement (Development)');

  // 10. Informatique Générale (General IT)
  await prisma.topic.upsert({
    where: { slug: 'linux-fundamentals' },
    update: {},
    create: {
      id: 'topic-it-fundamentals',
      domainId: 'domain-general-it',
      name: 'Fondamentaux Linux & Ligne de Commande',
      slug: 'linux-fundamentals',
      description: 'Le système de fichiers Linux et les commandes essentielles du terminal (Shell).',
      maxDifficultyLevel: 5,
      estimatedWeeks: 1,
      prerequisites: '[]',
    },
  });

  const bookItRef = await prisma.bookReference.upsert({
    where: { id: 'book-linux-command-line' },
    update: {},
    create: {
      id: 'book-linux-command-line',
      title: 'The Linux Command Line',
      author: 'William Shotts',
      isbn: '978-1593273897',
      description: 'Introduction complète et pratique à l’utilisation du terminal Linux.',
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-it-fund-d1-m' },
    update: {},
    create: {
      id: 'lesson-it-fund-d1-m',
      topicId: 'topic-it-fundamentals',
      title: 'Le Système de Fichiers Linux (Linux Filesystem Hierarchy)',
      contentMd: `# 🐧 Le Système de Fichiers Linux

Contrairement à Windows, Linux organise tout — y compris les périphériques — dans une arborescence unique partant de la racine (*Root*) \`/\`.

---

### 📚 Référence Bibliographique
> Contenu issu et enrichi d'après l'ouvrage de référence :
> **${bookItRef.title}** de *${bookItRef.author}* (Chapitre 2 : *Navigation*).

---

## 🔑 Répertoires Essentiels

1. **/ (Root)** : Racine de l'arborescence, point de départ de tous les chemins absolus (*Absolute Paths*).
2. **/home** : Répertoires personnels des utilisateurs (*Home Directories*).
3. **/etc** : Fichiers de configuration système (*Configuration Files*).
4. **/var** : Données variables (journaux — *Logs*, caches, files d'attente).
5. **/usr** : Programmes et bibliothèques partagées installés par l'utilisateur.

---

### 💡 Concept Clé : Chemin Absolu vs Relatif (Absolute vs Relative Path)
Un **Chemin Absolu** (*Absolute Path*) part toujours de la racine \`/\` (ex. \`/home/user/docs\`). Un **Chemin Relatif** (*Relative Path*) part du répertoire courant (ex. \`./docs\` ou \`../docs\`).
`,
      dayNumber: 1,
      sessionType: 'MORNING',
      difficultyLevel: 1,
      durationMinutes: 30,
      keyConcepts: JSON.stringify(['Arborescence Linux (Filesystem Hierarchy)', 'Répertoire Racine (Root Directory)', 'Chemin Absolu (Absolute Path)', 'Chemin Relatif (Relative Path)']),
      bookReferenceId: bookItRef.id,
      chapterCitation: 'Chapitre 2, pp. 21-35',
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-it-fund-d1-e' },
    update: {},
    create: {
      id: 'lesson-it-fund-d1-e',
      topicId: 'topic-it-fundamentals',
      title: 'Pratique : Commandes Essentielles du Terminal (Shell Commands)',
      contentMd: `# 🌙 Pratique : Naviguer et Manipuler des Fichiers

Ce soir, nous pratiquons les commandes de base du terminal (*Shell*) Linux.

---

### 🛠️ Exercice Pratique : Les Commandes du Quotidien

- \`pwd\` (*Print Working Directory*) : afficher le répertoire courant.
- \`ls -la\` (*List*) : lister le contenu d'un répertoire, y compris les fichiers cachés (*Hidden Files*), en format détaillé.
- \`cd\` (*Change Directory*) : se déplacer dans l'arborescence.
- \`cp\` / \`mv\` / \`rm\` (*Copy / Move / Remove*) : copier, déplacer, supprimer des fichiers.
- \`chmod\` (*Change Mode*) : modifier les permissions (*Permissions*) d'un fichier.

---

### 💻 Scénario d'Analyse :
Un script \`deploy.sh\` refuse de s'exécuter avec l'erreur *Permission denied*.

1. Vérifier les permissions avec \`ls -l deploy.sh\`.
2. Constater l'absence du bit d'exécution (*Execute Bit*) pour le propriétaire.
3. Corriger avec \`chmod +x deploy.sh\`.
4. Relancer le script avec \`./deploy.sh\`.
`,
      dayNumber: 1,
      sessionType: 'EVENING',
      difficultyLevel: 1,
      durationMinutes: 30,
      keyConcepts: JSON.stringify(['Shell', 'Permissions', 'Bit d’Exécution (Execute Bit)', 'chmod']),
      bookReferenceId: bookItRef.id,
      chapterCitation: 'Chapitre 3, pp. 36-52',
    },
  });

  const placementTestIt = await prisma.placementTest.upsert({
    where: { id: 'placement-test-general-it' },
    update: {},
    create: {
      id: 'placement-test-general-it',
      domainId: 'domain-general-it',
      title: 'Test de Placement Initial — Domaine Informatique Générale',
      description: 'Évaluation rapide de vos connaissances système et Linux pour déterminer votre niveau de départ.',
      questionCount: 5,
      levelThresholds: JSON.stringify({ '1': 0, '2': 40, '3': 60, '4': 80, '5': 90 }),
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'q-it-1' },
    update: {},
    create: {
      id: 'q-it-1',
      placementTestId: placementTestIt.id,
      questionText: 'Quelle commande affiche le répertoire de travail actuel (Working Directory) ?',
      options: JSON.stringify(['ls', 'cd', 'pwd', 'whoami']),
      correctAnswer: 'pwd',
      explanation: '`pwd` (Print Working Directory) affiche le chemin absolu du répertoire courant.',
      points: 20,
      questionType: 'MCQ',
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'q-it-2' },
    update: {},
    create: {
      id: 'q-it-2',
      placementTestId: placementTestIt.id,
      questionText: 'Dans quel répertoire trouve-t-on typiquement les fichiers de configuration système sous Linux ?',
      options: JSON.stringify(['/home', '/var', '/etc', '/usr']),
      correctAnswer: '/etc',
      explanation: '/etc regroupe traditionnellement l’ensemble des fichiers de configuration système sous Linux.',
      points: 20,
      questionType: 'MCQ',
    },
  });

  console.log('🐧 Domain seeded: Informatique Générale (General IT)');

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
