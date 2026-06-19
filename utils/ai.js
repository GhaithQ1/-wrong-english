const axios = require('axios');

exports.validateTrap = async (sentence, correction) => {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You evaluate English learning traps. A trap has a wrong sentence and its correction.
Check:
1) Does the wrong sentence contain a real grammar/usage error? If it's already correct English → valid=false
2) Is the wrong sentence different from the correction? If they are identical → valid=false
3) Is the correction actually correct English?

Difficulty guide:
- easy: Basic grammar (subject-verb agreement like "he go", simple tense errors like "yesterday I go", a/an, plurals)
- medium: Intermediate concepts (prepositions, conditionals, relative clauses, passive voice, gerunds/infinitives)
- hard: Advanced nuances (third mixed conditionals, subjunctive mood, inversion, complex tense sequences)

Return valid JSON only with no markdown:
{ "valid": true/false, "difficulty": "easy"|"medium"|"hard", "reason": "short reason in Arabic explaining why if invalid, empty string if valid" }`,
        },
        {
          role: 'user',
          content: `Wrong sentence: "${sentence}"\nCorrection: "${correction}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  let text = res.data.choices[0].message.content.trim();
  if (text.startsWith('```')) text = text.replace(/```(json)?/g, '').trim();
  return JSON.parse(text);
};

exports.validateTrapSafe = async (sentence, correction) => {
  try {
    return await exports.validateTrap(sentence, correction);
  } catch (err) {
    console.error('AI validation failed:', err.message);
    return { valid: true, difficulty: 'medium', reason: '' };
  }
};

exports.generateCorrection = async (sentence) => {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You evaluate English sentences for the "Traps" learning game.
A trap = a sentence that contains a grammar/usage/spelling error.

IMPORTANT RULES:
- valid=true  → this sentence HAS an error → it is a good trap → you MUST provide the correction
- valid=false → this sentence is correct English → NOT a trap

EXAMPLES:
Sentence: "He go to school yesterday"
→ {"valid":true,"correction":"He went to school yesterday","difficulty":"easy","reason":""}

Sentence: "He went to school yesterday"
→ {"valid":false,"correction":"","difficulty":"easy","reason":"الجملة صحيحة لا يوجد خطأ"}

Sentence: "He can not to swim when he was young"
→ {"valid":true,"correction":"He could not swim when he was young","difficulty":"medium","reason":""}

Sentence: "When I was a child I can swim very well"
→ {"valid":true,"correction":"When I was a child I could swim very well","difficulty":"medium","reason":""}

Sentence: "He can not swim when he was young"
→ {"valid":true,"correction":"He could not swim when he was young","difficulty":"medium","reason":""}

Sentence: "She can speaks three languages"
→ {"valid":true,"correction":"She can speak three languages","difficulty":"easy","reason":""}

Sentence: "She don't like coffee"
→ {"valid":true,"correction":"She doesn't like coffee","difficulty":"easy","reason":""}

Sentence: "I have been to Paris last year"
→ {"valid":true,"correction":"I went to Paris last year","difficulty":"medium","reason":""}

Difficulty guide:
- easy: Basic grammar (subject-verb agreement like "he go", simple tense errors like "yesterday I go", a/an, plurals, don't/doesn't)
- medium: Intermediate concepts (prepositions, conditionals, relative clauses, passive voice, gerunds/infinitives, can/could, tense mixing)
- hard: Advanced nuances (third mixed conditionals, subjunctive mood, inversion, complex tense sequences)

Return valid JSON only, no markdown, no backticks.`,
        },
        {
          role: 'user',
          content: `Sentence: "${sentence}"`,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );

  let text = res.data.choices[0].message.content.trim();
  if (text.startsWith('```')) text = text.replace(/```(json)?/g, '').trim();
  return JSON.parse(text);
};

exports.generateCorrectionSafe = async (sentence) => {
  try {
    return await exports.generateCorrection(sentence);
  } catch (err) {
    console.error('AI generateCorrection failed:', err.message);
    return { valid: false, correction: '', difficulty: 'medium', reason: 'تعذر الاتصال بالذكاء الاصطناعي، تأكد من مفتاح API' };
  }
};

exports.checkAnswer = async (sentence, correction, userAnswer) => {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You evaluate user answers to English correction traps.
The trap shows a wrong sentence and expects the user to write the correct version.
Compare the user's answer to the expected correction. If they mean the same thing, mark it as correct. Treat these as equivalent:
- Contractions vs full forms (doesn't ↔ does not, don't ↔ do not, it's ↔ it is, etc.)
- Word order in lists with "and"/"or" (John and I ↔ I and John)
- Minor differences in punctuation, articles, or capitalization
Return valid JSON only with no markdown:
{ "correct": true/false, "reason": "short explanation in Arabic" }`,
        },
        {
          role: 'user',
          content: `Wrong sentence: "${sentence}"
Expected correction: "${correction}"
User answer: "${userAnswer}"`,
        },
      ],
      temperature: 0.2,
      max_tokens: 150,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  let text = res.data.choices[0].message.content.trim();
  if (text.startsWith('```')) text = text.replace(/```(json)?/g, '').trim();
  return JSON.parse(text);
};

exports.checkAnswerSafe = async (sentence, correction, userAnswer) => {
  try {
    return await exports.checkAnswer(sentence, correction, userAnswer);
  } catch (err) {
    console.error('AI checkAnswer failed:', err.message);
    const c = correction.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const a = userAnswer.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
    return { correct: c === a, reason: '' };
  }
};
