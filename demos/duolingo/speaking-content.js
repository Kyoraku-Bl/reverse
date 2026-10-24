// Authored practice prompts and a deliberately local, rule-based conversation bot.
// No model or remote AI API is called, and text matching is not acoustic scoring.
export const SPEAKING_LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const drill = (text, focus, tip) => ({ text, focus, tip });
const course = (goal, starter, challenge, questions, drills) => ({
  goal,
  starter,
  challenge,
  questions,
  drills,
});
export const SPEAKING_COURSES = {
  en: {
    A1: course(
      "Introduce yourself and use short, clear sentences.",
      "Hello! I’m Pip, your practice bot. What is your name?",
      "Introduce yourself: name, home town, and one thing you like. Aim for 20–30 seconds.",
      [
        "What do you like?",
        "Where do you live?",
        "What do you do in the morning?",
        "Can you tell me one more thing?",
      ],
      [
        drill(
          "Hello, my name is Sam. I live in a small city.",
          "Word stress · HEL-lo, CI-ty",
          "Give the stressed syllable a little more time. Do not rush the final /m/ in “Sam”.",
        ),
        drill(
          "I would like a cup of tea, please.",
          "Polite requests · would like",
          "Say “would like” as a smooth group. Keep the /t/ at the start of “tea” clear.",
        ),
        drill(
          "This is my friend. We study English together.",
          "The voiced th /ð/ in this",
          "For “this”, gently place your tongue between your teeth and let your voice vibrate. Accents vary; focus on being understood.",
        ),
      ],
    ),
    A2: course(
      "Describe routines, past events, and future plans.",
      "Hello again! What did you do last weekend?",
      "Describe a recent day out. Say where you went, what happened, and what you plan to do next. Aim for 45 seconds.",
      [
        "What happened next?",
        "Who did you go with?",
        "How was it different from your usual day?",
        "What are you going to do next?",
      ],
      [
        drill(
          "Last weekend, I visited my family and cooked dinner.",
          "Past -ed · visited and cooked",
          "“Visited” ends with an extra /ɪd/ syllable. “Cooked” ends with /t/, not a separate “ed” syllable.",
        ),
        drill(
          "I am going to take the train tomorrow morning.",
          "Thought groups · future plans",
          "Try two groups: “I am going to take the train” / “tomorrow morning”. Pause at the boundary, not after every word.",
        ),
        drill(
          "This jacket is cheaper, but that one is more comfortable.",
          "Comparison · sentence stress",
          "Stress “cheaper” and “more comfortable” to make the contrast easy to hear.",
        ),
      ],
    ),
    B1: course(
      "Tell a connected story and support an opinion.",
      "Let’s exchange ideas. What is something you have learned recently?",
      "Tell a short story about a problem you solved. Set the scene, explain your choice, and say what you learned. Aim for 60–90 seconds.",
      [
        "Why do you think that happened?",
        "Can you give a specific example?",
        "What would you do differently?",
        "How did that change your opinion?",
      ],
      [
        drill(
          "I was walking home when I noticed an old friend across the street.",
          "Narrative rhythm · background and event",
          "Group the background first, then highlight “noticed”. Keep the final consonants in “old friend” audible without adding a vowel.",
        ),
        drill(
          "Although the idea is expensive, it could help our community.",
          "Contrast · although",
          "Place a brief pause after “expensive”. Let the second clause carry the main point.",
        ),
        drill(
          "If I had more free time, I would join a conversation group.",
          "Conditional · weak forms",
          "Keep the stressed words “time”, “join”, and “group” prominent. Unstressed “would” may be reduced naturally.",
        ),
      ],
    ),
    B2: course(
      "Develop an argument, compare viewpoints, and negotiate.",
      "Let’s look at both sides. What change would improve life in your community?",
      "Argue for a change at work or in your community. Acknowledge a drawback and propose a compromise. Aim for 90 seconds.",
      [
        "What is the strongest argument against your position?",
        "What evidence would support that?",
        "Under what circumstances would you change your mind?",
        "What compromise could address both concerns?",
      ],
      [
        drill(
          "Despite the convenience of remote work, informal contact still matters.",
          "Contrastive stress · despite",
          "Highlight “convenience” and “informal contact”. Speak in meaningful groups rather than at a constant speed.",
        ),
        drill(
          "The results may suggest a pattern, but they do not establish a cause.",
          "Cautious emphasis · suggest versus establish",
          "Make the distinction audible: “suggest a pattern” / “not establish a cause”. Keep the /ts/ at the end of “results”.",
        ),
        drill(
          "Could we consider a smaller first release, provided that accessibility is preserved?",
          "Diplomatic intonation",
          "Keep the opening question open and unhurried. Pause before the condition so your listener can follow it.",
        ),
      ],
    ),
    C1: course(
      "Express nuanced judgments with precise, flexible delivery.",
      "Let’s explore nuance. Which widely held assumption would you like to question?",
      "Evaluate a complex claim. Distinguish assumptions from evidence, address a counterargument, and give a qualified conclusion. Aim for two minutes.",
      [
        "Which assumption does that conclusion depend on?",
        "How would you reconcile that with an opposing interpretation?",
        "What distinction might a casual observer overlook?",
        "Could you restate your position more cautiously, without making it vague?",
      ],
      [
        drill(
          "The proposal is not without merit; however, its projected benefits remain untested.",
          "Qualified stance · controlled pausing",
          "Give “not without merit” one coherent contour, then pause before “however”. Avoid making every word equally prominent.",
        ),
        drill(
          "Rarely has the need for sustained cooperation been more apparent.",
          "Emphasis · inversion",
          "Let “rarely” set up the emphasis, but save the main stress for the crucial idea: “sustained cooperation”.",
        ),
        drill(
          "What appears contradictory may simply reflect a difference in the outcomes being measured.",
          "Complex phrasing · clarity over speed",
          "Break the sentence into two thought groups after “contradictory”. Keep the unstressed syllables light without swallowing the meaning.",
        ),
      ],
    ),
  },
  fr: {
    A1: course(
      "Introduce yourself and make simple requests in French.",
      "Bonjour ! Je suis Pip, votre bot de pratique. Comment vous appelez-vous ?",
      "Présentez-vous : votre prénom, votre ville et une chose que vous aimez. Aim for 20–30 seconds.",
      [
        "Qu’est-ce que vous aimez ?",
        "Où habitez-vous ?",
        "Que faites-vous le matin ?",
        "Pouvez-vous ajouter une phrase ?",
      ],
      [
        drill(
          "Bonjour, je m’appelle Sam. J’habite dans une petite ville.",
          "French rhythm · groups, not English-style word stress",
          "Say “je m’appelle Sam” as one group. In ordinary French speech, the final e of “petite” is usually not pronounced.",
        ),
        drill(
          "Je voudrais un café et de l’eau, s’il vous plaît.",
          "Rounded /u/ in vous · polite phrasing",
          "“Vous” has /u/, like a rounded “oo”. Round your lips and keep the phrase “s’il vous plaît” smooth. Listen to the model before repeating.",
        ),
        drill(
          "Tu as un livre. Nous avons deux stylos.",
          "Rounded vowels · tu /ty/ and nous /nu/",
          "For the /y/ in “tu”, round your lips while keeping the tongue forward. Compare it with /u/ in “nous”.",
        ),
      ],
    ),
    A2: course(
      "Describe past activities and explain plans in connected French.",
      "Bonjour ! Qu’avez-vous fait le week-end dernier ?",
      "Racontez une sortie récente, puis expliquez un projet pour la semaine prochaine. Aim for 45 seconds.",
      [
        "Que s’est-il passé ensuite ?",
        "Avec qui êtes-vous allé ou allée ?",
        "Qu’est-ce qui était différent ?",
        "Qu’allez-vous faire la prochaine fois ?",
      ],
      [
        drill(
          "Samedi, nous avons visité un musée et acheté des cartes postales.",
          "Linking · nous avons",
          "Use the /z/ liaison in “nous avons”. Do not pronounce the final s in “cartes postales”.",
        ),
        drill(
          "Demain, je vais prendre le train pour retrouver ma famille.",
          "Nasal vowels · demain, prendre, train",
          "Let air pass through the nose for nasal vowels, without adding a separate final /n/. Listen for the different vowel qualities.",
        ),
        drill(
          "Ce sac est moins cher, mais celui-ci est plus solide.",
          "Comparison · smooth thought groups",
          "Pause lightly before “mais”. Keep “moins cher” together; the s of “moins” is not pronounced here.",
        ),
      ],
    ),
    B1: course(
      "Narrate experiences and explain opinions with clear connectors.",
      "Parlons d’une expérience. Qu’avez-vous appris récemment ?",
      "Racontez un problème que vous avez résolu. Présentez la situation, votre décision et le résultat. Aim for 60–90 seconds.",
      [
        "Pourquoi cela s’est-il produit, selon vous ?",
        "Pouvez-vous donner un exemple précis ?",
        "Que feriez-vous autrement ?",
        "Comment cette expérience a-t-elle changé votre opinion ?",
      ],
      [
        drill(
          "Je rentrais chez moi quand j’ai aperçu une amie près de la gare.",
          "Narrative phrasing",
          "Separate the background from the event after “chez moi”. Keep “quand j’ai aperçu” connected.",
        ),
        drill(
          "À mon avis, il faudrait améliorer les transports, même si cela coûte cher.",
          "Opinion · phrase-final prominence",
          "Use the natural prominence at the end of each phrase. Avoid stressing every connector as if it were an English content word.",
        ),
        drill(
          "Si nous avions plus de temps, nous organiserions une rencontre.",
          "Liaison and conditional rhythm",
          "Link “nous avions” with /z/. Divide the sentence after “temps” to make the hypothetical condition clear.",
        ),
      ],
    ),
    B2: course(
      "Defend an argument and negotiate while recognising alternatives.",
      "Examinons plusieurs points de vue. Quel changement améliorerait votre ville ?",
      "Défendez un changement dans votre ville. Reconnaissez une limite et proposez un compromis. Aim for 90 seconds.",
      [
        "Quel serait le principal contre-argument ?",
        "Sur quelles observations repose votre avis ?",
        "Dans quelles conditions changeriez-vous de position ?",
        "Quel compromis permettrait de rapprocher les deux points de vue ?",
      ],
      [
        drill(
          "Bien que le télétravail soit pratique, il ne remplace pas tous les échanges informels.",
          "Concession · grouping and clarity",
          "Group the concession up to “pratique”, then pause. Keep the negation clear without overemphasising every syllable.",
        ),
        drill(
          "Ces résultats suggèrent une tendance sans démontrer un lien de cause à effet.",
          "Evidence · contrastive emphasis",
          "Use intonation to distinguish “suggèrent” from “démontrer”. “Résultats” has a silent final s.",
        ),
        drill(
          "Serait-il possible de lancer un essai, à condition que les fonctions essentielles soient conservées ?",
          "Formal question · inversion",
          "Link “serait-il” smoothly; the t is heard before “il”. Pause before the condition rather than in the middle of it.",
        ),
      ],
    ),
    C1: course(
      "Use nuanced register, synthesis, and precise phrasing in French.",
      "Explorons une idée en profondeur. Quelle opinion répandue souhaiteriez-vous nuancer ?",
      "Évaluez une affirmation complexe. Distinguez les faits des hypothèses, puis formulez une conclusion nuancée. Aim for two minutes.",
      [
        "De quelle hypothèse cette conclusion dépend-elle ?",
        "Comment concilieriez-vous cette lecture avec une interprétation opposée ?",
        "Quelle distinction risque-t-on de négliger ?",
        "Pourriez-vous reformuler cette position avec davantage de prudence, sans la rendre vague ?",
      ],
      [
        drill(
          "La proposition n’est pas dénuée d’intérêt ; ses bénéfices restent toutefois à démontrer.",
          "Measured stance · phrase boundaries",
          "Pause at the semicolon, then let “à démontrer” carry the closing emphasis. Do not rush the contrast.",
        ),
        drill(
          "Ce dont les habitants ont besoin, c’est d’une réponse durable plutôt que d’une annonce ponctuelle.",
          "Cleft structure · controlled emphasis",
          "Keep “ce dont les habitants ont besoin” as a coherent group. The contrast is “réponse durable” versus “annonce ponctuelle”.",
        ),
        drill(
          "Ces constats ne sont pas nécessairement incompatibles, puisqu’ils portent sur des indicateurs distincts.",
          "Synthesis · longer thought groups",
          "Pause after “incompatibles”. Focus on clarity of the two ideas, not maximum speed; preserve the distinction in “indicateurs distincts”.",
        ),
      ],
    ),
  },
};
export const TOPICS = [
  {
    id: "daily",
    en: "Daily life",
    fr: "Vie quotidienne",
    opening: {
      en: "Daily routines can make a good conversation.",
      fr: "Les habitudes quotidiennes offrent de nombreux sujets de conversation.",
    },
    questions: {
      en: [
        "What do you like doing in your free time?",
        "What would you change about your daily routine?",
        "How do routines shape the way we live?",
      ],
      fr: [
        "Qu’aimez-vous faire pendant votre temps libre ?",
        "Que changeriez-vous dans vos habitudes ?",
        "Comment nos habitudes influencent-elles notre manière de vivre ?",
      ],
    },
  },
  {
    id: "travel",
    en: "Travel",
    fr: "Voyages",
    opening: {
      en: "Let’s imagine a journey together.",
      fr: "Imaginons un voyage ensemble.",
    },
    questions: {
      en: [
        "Where would you like to go?",
        "What would make that trip special?",
        "How can travel change our assumptions about other places?",
      ],
      fr: [
        "Où aimeriez-vous aller ?",
        "Qu’est-ce qui rendrait ce voyage particulier ?",
        "Comment les voyages peuvent-ils modifier nos idées sur d’autres lieux ?",
      ],
    },
  },
  {
    id: "food",
    en: "Food & cafés",
    fr: "Cuisine et cafés",
    opening: {
      en: "Let’s talk about food, or role-play a visit to a café.",
      fr: "Parlons de cuisine, ou imaginons une visite au café.",
    },
    questions: {
      en: [
        "What would you like to eat or drink?",
        "How would you describe your favourite dish?",
        "What can food traditions reveal about a community?",
      ],
      fr: [
        "Que voudriez-vous manger ou boire ?",
        "Comment décririez-vous votre plat préféré ?",
        "Que peuvent révéler les traditions culinaires sur une communauté ?",
      ],
    },
  },
  {
    id: "work",
    en: "Work & study",
    fr: "Travail et études",
    opening: {
      en: "Let’s practise talking about work and learning.",
      fr: "Parlons du travail et de l’apprentissage.",
    },
    questions: {
      en: [
        "What do you study or do for work?",
        "Which skill would you like to develop?",
        "How should we balance specialisation with learning broadly?",
      ],
      fr: [
        "Qu’étudiez-vous ou quel travail faites-vous ?",
        "Quelle compétence aimeriez-vous développer ?",
        "Comment concilier spécialisation et ouverture à d’autres domaines ?",
      ],
    },
  },
  {
    id: "culture",
    en: "Films & culture",
    fr: "Films et culture",
    opening: {
      en: "A film, a book, or a song can open a conversation.",
      fr: "Un film, un livre ou une chanson peut ouvrir la discussion.",
    },
    questions: {
      en: [
        "What film or music do you like?",
        "What makes that work memorable for you?",
        "To what extent can a work be understood outside its cultural context?",
      ],
      fr: [
        "Quel film ou quelle musique aimez-vous ?",
        "Qu’est-ce qui rend cette œuvre mémorable pour vous ?",
        "Dans quelle mesure peut-on comprendre une œuvre en dehors de son contexte culturel ?",
      ],
    },
  },
  {
    id: "technology",
    en: "Technology",
    fr: "Technologie",
    opening: {
      en: "Let’s explore how technology fits into our lives.",
      fr: "Explorons la place de la technologie dans nos vies.",
    },
    questions: {
      en: [
        "What app do you use often?",
        "How has technology changed a daily activity for you?",
        "How could a useful technology also create unintended consequences?",
      ],
      fr: [
        "Quelle application utilisez-vous souvent ?",
        "Comment la technologie a-t-elle modifié une activité quotidienne ?",
        "Comment une technologie utile peut-elle avoir des conséquences inattendues ?",
      ],
    },
  },
  {
    id: "environment",
    en: "Our planet",
    fr: "Environnement",
    opening: {
      en: "Let’s discuss the places we live in and care about.",
      fr: "Parlons des lieux où nous vivons et que nous souhaitons préserver.",
    },
    questions: {
      en: [
        "Do you like parks or the sea?",
        "What could your neighbourhood do to reduce waste?",
        "How should responsibility for environmental change be shared?",
      ],
      fr: [
        "Aimez-vous les parcs ou la mer ?",
        "Que pourrait faire votre quartier pour réduire les déchets ?",
        "Comment répartir la responsabilité des changements environnementaux ?",
      ],
    },
  },
];
export function standardSuggestions(text, language) {
  const rules =
    language === "fr"
      ? [
          [
            /\bje suis (\d{1,3}) ans\b/iu,
            (m) => `J’ai ${m[1]} ans.`,
            "In French, age uses avoir: j’ai … ans.",
          ],
          [
            /\bje suis faim\b/iu,
            () => "J’ai faim.",
            "Use avoir with faim: j’ai faim.",
          ],
          [
            /\bje vais à le\b/iu,
            () => "Je vais au…",
            "À + le contracts to au.",
          ],
          [
            /\bje peux de\b/iu,
            () => "Je peux + infinitive",
            "Pouvoir is followed directly by an infinitive, without de.",
          ],
        ]
      : [
          [
            /\bi am agree\b/iu,
            () => "I agree.",
            "Agree is a verb: use “I agree”, not “I am agree”.",
          ],
          [
            /\bi have (\d{1,3}) years(?: old)?(?=\s*(?:[.!?,;]|$))/iu,
            (m) => `I am ${m[1]} years old.`,
            "In standard English, age uses be: I am … years old.",
          ],
          [
            /\bi (?:did not|didn't|didn’t) went\b/iu,
            () => "I didn’t go…",
            "After didn’t, use the base form go.",
          ],
          [
            /\b(she|he) (?:don't|don’t)\b/iu,
            (m) => `${m[1][0].toUpperCase() + m[1].slice(1)} doesn’t…`,
            "Standard third-person singular uses doesn’t with a base verb.",
          ],
        ];
  return rules.flatMap(([pattern, replacement, explanation]) => {
    const match = text.match(pattern);
    return match
      ? [{ original: match[0], suggestion: replacement(match), explanation }]
      : [];
  });
}
export function conversationReply({
  language = "en",
  level = "A1",
  topic = "daily",
  customTopic = "",
  text = "",
  turn = 0,
}) {
  const c = SPEAKING_COURSES[language]?.[level] || SPEAKING_COURSES.en.A1;
  const selected = TOPICS.find((t) => t.id === topic);
  const tier = ["A1", "A2"].includes(level) ? 0 : level === "B1" ? 1 : 2;
  const greetings =
    language === "fr"
      ? [
          "Merci pour votre réponse.",
          "Continuons, à votre rythme.",
          "Essayons de développer cette idée.",
        ]
      : [
          "Thanks for sharing.",
          "Let’s keep exploring at your pace.",
          "Let’s develop that idea a little.",
        ];
  let question =
    turn % 3 === 0 && selected
      ? selected.questions[language][tier]
      : c.questions[turn % c.questions.length];
  let opening = greetings[turn % greetings.length];
  if (topic === "custom" && customTopic && turn % 3 === 0) {
    opening =
      language === "fr"
        ? `Restons sur le sujet « ${customTopic} ».`
        : `Let’s stay with “${customTopic}”.`;
    question =
      language === "fr"
        ? tier === 0
          ? "Qu’aimez-vous dans ce sujet ?"
          : tier === 1
            ? "Pourquoi ce sujet vous intéresse-t-il ?"
            : "Quelles hypothèses mériteraient d’être examinées sur ce sujet ?"
        : tier === 0
          ? "What do you like about this topic?"
          : tier === 1
            ? "Why does this subject interest you?"
            : "Which assumptions about this subject deserve closer examination?";
  }
  if (/\b(?:hello|hi|bonjour|salut)\b/iu.test(text) && text.length < 35)
    opening =
      language === "fr"
        ? "Bonjour ! Prenons le temps de pratiquer."
        : "Hello! Let’s take a little time to practise.";
  if (
    /\b(?:who are you|are you (?:an? )?ai|qui es.tu|êtes.vous une ia)\b/iu.test(
      text,
    )
  )
    opening =
      language === "fr"
        ? "Je suis un bot local à réponses préparées, pas une IA générative."
        : "I’m a local bot with prepared responses, not a generative AI.";
  return {
    text: `${opening} ${question}`,
    suggestions: standardSuggestions(text, language),
  };
}
export function words(text) {
  return (
    String(text)
      .toLocaleLowerCase()
      .normalize("NFC")
      .replace(/[’']/gu, " ")
      .match(/[\p{L}\p{N}]+/gu) || []
  );
}
// Word-level edit alignment for transcript comparison. It never analyses sound.
// Limit input at this boundary to keep the dynamic-programming matrix bounded.
export function compareTranscript(expected, actual) {
  const a = words(expected).slice(0, 120),
    b = words(actual).slice(0, 120);
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  const alignment = [];
  let i = a.length,
    j = b.length;
  while (i || j) {
    if (
      i &&
      j &&
      matrix[i][j] === matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
    ) {
      alignment.unshift({
        expected: a[i - 1],
        heard: b[j - 1],
        kind: a[i - 1] === b[j - 1] ? "match" : "different",
      });
      i--;
      j--;
    } else if (i && matrix[i][j] === matrix[i - 1][j] + 1) {
      alignment.unshift({ expected: a[i - 1], heard: "", kind: "missing" });
      i--;
    } else {
      alignment.unshift({ expected: "", heard: b[j - 1], kind: "extra" });
      j--;
    }
  }
  return {
    alignment,
    matches: alignment.filter((w) => w.kind === "match").length,
    total: a.length,
    hasSpeech: b.length > 0,
  };
}
export const SPEAKING_KEY = "bloom-speaking-v1";
export const freshSpeakingData = () => ({
  threads: {},
  practice: {},
  consent: false,
});
export function normalizeSpeakingData(raw) {
  const data = freshSpeakingData();
  if (!raw || typeof raw !== "object") return data;
  for (const [key, thread] of Object.entries(raw.threads || {})) {
    if (
      !/^(en|fr)-(A1|A2|B1|B2|C1)$/.test(key) ||
      !thread ||
      typeof thread !== "object"
    )
      continue;
    data.threads[key] = {
      topic: TOPICS.some((t) => t.id === thread.topic)
        ? thread.topic
        : thread.topic === "custom"
          ? "custom"
          : "daily",
      turn:
        Number.isSafeInteger(thread.turn) && thread.turn >= 0
          ? thread.turn
          : Math.floor((thread.messages?.length || 0) / 2),
      customTopic:
        typeof thread.customTopic === "string"
          ? thread.customTopic.slice(0, 80)
          : "",
      draft:
        typeof thread.draft === "string" ? thread.draft.slice(0, 1200) : "",
      messages: Array.isArray(thread.messages)
        ? thread.messages
            .filter(
              (m) =>
                m &&
                ["user", "bot"].includes(m.role) &&
                typeof m.text === "string",
            )
            .slice(-50)
            .map((m) => ({
              role: m.role,
              text: m.text.slice(0, 3000),
              suggestions:
                m.role === "bot"
                  ? standardSuggestions(
                      typeof m.source === "string" ? m.source : "",
                      key.slice(0, 2),
                    )
                  : [],
              source:
                typeof m.source === "string" ? m.source.slice(0, 1200) : "",
            }))
        : [],
    };
  }
  for (const [key, value] of Object.entries(raw.practice || {}))
    if (/^(en|fr)-(A1|A2|B1|B2|C1)-[0-2]$/.test(key) && value === true)
      data.practice[key] = true;
  data.consent = raw.consent === true;
  return data;
}
