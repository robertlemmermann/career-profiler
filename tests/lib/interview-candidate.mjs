// Deterministic candidate shared across hosts; never exposed to the agent under test.
export function candidateReply(persona, text, used = []) {
const det = persona.deterministic || { answers: [], default: 'Nothing more on that.', confirm: 'Yes.' };
const usedAnswers = new Set(used);
/** The deterministic candidate: the first unused answer whose regex matches the agent's message; a confirm when asked to confirm; else the default. */
function deterministicReply(agentText) {
  const t = agentText.toLowerCase();
  for (let i = 0; i < det.answers.length; i++) {
    const a = det.answers[i];
    if (usedAnswers.has(i)) continue;
    if (new RegExp(a.match, 'i').test(t)) { usedAnswers.add(i); return a.reply; }
  }
  if (/is (?:that|this|everything|it) (?:all )?(?:right|correct|exact|accurate)|confirm|does (?:that|this|everything) look|looks? (?:right|correct|good|accurate)|shall i (?:save|record|commit)|can i (?:record|save|commit)|ok(?:ay)? to (?:save|record|commit)|anything (?:wrong|to correct|to change|to fix|to add or change)|pending your (?:yes|ok|confirmation)|your (?:yes|go-ahead|okay)|say yes|reply yes|yes or no|before i (?:save|record|commit)|(?:save|record|commit) (?:it|them|these|this|that)\?/i.test(agentText)) return det.confirm;
  return det.default;
}
const CONFIRM_ASK = /\b(?:is|are) (?:[\w'’-]+ ){0,5}(?:right|correct|exact|accurate)\b|yes to (?:all|both|each)|right as (?:worded|written)|ok(?:ay)? as (?:worded|written)|as I(?:'|’)ll (?:record|save|add) (?:it|them|this|these)|(?:a )?yes saves it|confirm|does (?:that|this|everything) look|looks? (?:right|correct|good|accurate)|shall i (?:save|record|commit)|can i (?:record|save|commit)|ok(?:ay)? to (?:save|record|commit)|anything (?:wrong|to correct|to change|to fix|to add or change)|pending your (?:yes|ok|confirmation)|your (?:yes|go-ahead|okay)|say yes|reply yes|yes or no|before i (?:save|record|commit)|(?:save|record|commit) (?:it|them|these|this|that)\?/i;
/** The deterministic candidate confirms first when asked to, then answers the new question in the same message (a real person does both). */
function deterministicTurn(agentText) {
  const asked = CONFIRM_ASK.test(agentText);
  const reply = deterministicReply(agentText);
  if (asked && reply === det.default) return det.confirm; // asked for a yes with nothing new to add: say yes
  if (asked && reply !== det.confirm) return `${det.confirm} ${reply}`;
  return reply;
}
const reply = deterministicTurn(text);
return { reply, used: [...usedAnswers] };
}
