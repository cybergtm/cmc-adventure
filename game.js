const virtualPro = "https://events.hubilo.com/cybermarketingcon-2026/login";
const agendaSnapshot = "November 12, 2026";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday"];
const dayLabel = (day, dated = false) => dated ? `${DAY_NAMES[day - 1]}, Nov ${day + 14}` : `Day ${day}`;
const clock = min => `${Math.floor(min / 60) % 12 || 12}:${String(min % 60).padStart(2, "0")} ${min < 720 ? "AM" : "PM"}`;
import {QUIZ, CHARACTERS, profileFrom, characterFor} from "./characters.js";

const app = document.querySelector("#app");
const announce = document.querySelector("#announce");
const restartButton = document.querySelector("#restart");
const KEY = "cmc-game-2026";
const TOUGH = 3; // a time slot needs at least this many sessions to be a real choice
const HALLWAYS = 7; // only the closest calls become hallways; clear winners are picked for you

/* ---------- Data ---------- */

// signals: per session, which side-quest keywords and hint themes its description supports.
// They are worked out ahead of time, so the descriptions themselves are not part of the site.
const [rows, signals] = await Promise.all([
  fetch("assets/agenda.json").then(r => r.json()),
  fetch("assets/session-signals.json").then(r => r.json()).catch(() => ({}))
]);

// Short keys for the agenda's tracks and topic categories.
const CAT = {
  "Brand, Comms, Public Relations, Analyst Relations, Design, Influencer Marketing & Social Media": "BR",
  "Community & Customer Marketing": "CO",
  "Demand Generation, Digital Marketing, MOps, & GTM Engineering": "DG",
  "Field & Channel, Events, Partners": "FI",
  "GTM, Strategy & Exec Leadership": "GT",
  "Networking, Career-Building, & Fun": "NW",
  "Product Marketing, Security Research & Content, & Cybersecurity Perspective": "PR",
  "Mixers": "MX",
  "CyberCMO Summit": "CMO",
  "Cyber CEO, VC & Founder Summit": "CEO",
  "GovCon, Critical Infrastructure, Regulated Industry, Federal & Public Sector": "GOV"
};
const VIBE = {BR:"Brand & social", CO:"Community", DG:"Demand gen", FI:"Field & partners", GT:"Strategy", NW:"Fun & careers", PR:"Product & research", MX:"Mixer", CMO:"CMO summit", CEO:"Founder summit", GOV:"Public sector"};
const HIGHLIGHTS = new Set(["opening-night","resist-comfort","ai-cyber","marquee","social-engineering","closing"]);
const cat = e => CAT[e.track] || "";

function formatOf(e){
  const t = e.title.toLowerCase();
  if (HIGHLIGHTS.has(e.id) || /keynote/.test(t)) return "Keynote";
  if (/workshop|roundtable/.test(t)) return "Workshop";
  if (e.track === "Mixers" || /networking|reception|mixer|meetup|happy hour/.test(t)) return "Networking";
  if (/breakfast|coffee|^lunch|break/.test(t)) return "Break";
  if (/karaoke|movie|outing|mocktails|game show|awards|celebration|signing|tour/.test(t)) return "Social";
  return "Talk";
}

const catalogs = {
  austin: rows.filter(e => !e.onlineOnly && !e.referenceOnly),
  online: rows.filter(e => (e.livestream || e.onlineOnly) && !e.referenceOnly)
};
const byId = Object.fromEntries(rows.map(e => [e.id, e]));

// Summit tracks: their own run of talks for one audience, on one day, in the Summit Room.
const TRACKS = {
  GOV: {name: "GovCon & Public Sector", who: "For public sector, federal and regulated-industry marketers.", badge: 7},
  CMO: {name: "CyberCMO Summit", who: "For CMOs and marketing leaders only.", badge: 5},
  CEO: {name: "Cyber CEO, VC & Founder Summit", who: "For founders, CEOs and investors.", badge: 6}
};
for (const [k, t] of Object.entries(TRACKS)) {
  t.sessions = catalogs.austin.filter(e => cat(e) === k).sort((a, b) => a.start - b.start);
  t.day = t.sessions[0]?.day;
  t.when = t.sessions.length ? `${dayLabel(t.day, true).split(",")[0]}, during the day` : "";
}
const partOfDay = min => min < 720 ? "Morning" : min < 1050 ? "Afternoon" : "Evening";
const overlap = (a, b) => Math.min(a.end, b.end) - Math.max(a.start, b.start);

/* ---------- Quiz ---------- */

// A session is "about" a side quest when the keyword is in its title, or comes up repeatedly
// in its description. A passing mention doesn't count.
function kwHit(e, k){
  const re = KEYWORDS[k];
  if (!re) return false;
  if (re.test(e.title)) return true;
  return (signals[e.id]?.k || []).includes(k);
}
const KW_LABEL = {ai: "AI side quest", buyer: "buyer side quest", research: "market insight", social: "creator side quest", sales: "sales side quest"};
// Plain-language reasons a door suits you, from the same signals as the score.
function reasonList(e, p){
  const out = [];
  const c = cat(e), f = formatOf(e);
  if ((p[c] || 0) >= 2 && VIBE[c]) out.push(VIBE[c]);
  for (const k of p.kw) if (kwHit(e, k) && !out.includes(KW_LABEL[k])) out.push(KW_LABEL[k]);
  if ((p[f] || 0) >= 2) out.push(f.toLowerCase());
  if (e.start >= 1110 && (p.evening || 0) > 0) out.push("evening plans");
  return out;
}
// Short, plain reasons a session suits this character, for the results page.
const KW_WHY = {
  ai: "It lines up with your side quest to make AI actually useful.",
  buyer: "It supports your side quest to decode what buyers really want.",
  research: "It offers the kind of market insight you said you wanted to bring home.",
  social: "It fits your side quest to get famous, or at least followed.",
  sales: "It helps with your side quest to win over sales and partners."
};
const FORMAT_WHY = {
  Talk: "It’s a talk, which suits your front-row, notebook-open style.",
  Keynote: "It’s a big-room talk, which suits your front-row, notebook-open style.",
  Workshop: "It’s hands-on, so you’ll leave with something you can put to use.",
  Networking: "It’s built for meeting people, which you said matters most to you.",
  Social: "It’s meant to be fun, and you asked for some of that."
};
const TOPIC_WHY = {
  BR: "brand, PR and social", CO: "community and customer marketing", DG: "demand gen",
  FI: "field marketing, events and partners", GT: "strategy and leadership",
  NW: "networking and career growth", PR: "product marketing, research and content"
};
function whyList(e, p, who){
  const out = [];
  const c = cat(e), f = formatOf(e);
  const a = /^[AEIOU]/.test(who) ? "an" : "a";
  if (TRACKS[c]) out.push(`It’s part of your ${TRACKS[c].name} track, so it’s on your list automatically.`);
  else if (c === "MX" || (f === "Networking" && (p.Networking || 0) >= 2)) out.push(`It’s a mixer, and you said meeting people is a big part of why you’re here.`);
  else if ((p[c] || 0) >= 2 && TOPIC_WHY[c]) out.push(`It’s about ${TOPIC_WHY[c]}, which matches your character.`);
  for (const k of p.kw) if (kwHit(e, k) && !out.includes(KW_WHY[k])) out.push(KW_WHY[k]);
  if ((p[f] || 0) >= 2 && FORMAT_WHY[f] && !out.includes(FORMAT_WHY[f]) && !(f === "Networking" && out.length)) out.push(FORMAT_WHY[f]);
  if (e.start >= 1110 && (p.evening || 0) > 0) out.push("It fits how you like to spend your evenings.");
  // Every recommendation gets at least one reason, even when the strongest signal is general.
  if (!out.length) out.push("It matches the mix of topics and formats you picked.");
  return out.slice(0, 3);
}
function reasons(e, p){
  const out = reasonList(e, p);
  return out.length ? `Matches: ${out.slice(0, 3).join(" + ")}` : "A change of pace";
}
// Strong enough to add without asking: your badge topic, a side quest named in the title,
// two or more reasons together, or (for evening people) an evening event.
function strongMatch(e, p){
  const c = cat(e);
  if ((p[c] || 0) >= 4) return true;
  if (p.kw.some(k => KEYWORDS[k]?.test(e.title))) return true;
  if (e.start >= 1110) return (p.evening || 0) > 0;
  return reasonList(e, p).length >= 2;
}
const KEYWORDS = {
  ai: /\b(ai|claude|gpt|gpts|agents?|llm)\b/i,
  buyer: /buyer|ciso|buying|win\/loss|research|analyst/i,
  research: /\b(research|analysts?|reports?|survey|benchmark|forrester|gartner|market (insights?|trends?|data))\b/i,
  social: /influenc|creator|social|personal brand|linkedin/i,
  sales: /sales|partner|channel|pipeline|enablement|alliances/i
};

function score(e, p, tracks = []){
  const c = cat(e);
  const f = formatOf(e);
  let s = (p[c] || 0) + (p[f] || 0) * 0.8;
  for (const k of p.kw) if (kwHit(e, k)) s += 2;
  if (TRACKS[c]) s += tracks.includes(c) ? 20 : -15;   // summit talks only for players in that track
  if (e.start >= 1110) s += p.evening || 0;
  if (f === "Break") s -= 3;
  if (e.sponsor) s -= 6;
  return s;
}

/* ---------- Quest: pick the time slots and doors ---------- */

const hash = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);


// Doors only appear for adventures: time slots with 3+ sessions you could attend.
// Easy slots don't need a game. Highlights (and your summit track) go straight on the agenda,
// and the rest wait in "Easy calls" on the last page.
const CHAPTER_SUBTITLES = [
  "The Fork in the Hallway", "Three Doors and a Hunch", "The Plot Thickens", "A Knock, Then a Choice",
  "In Which You Follow Your Curiosity", "The Door Less Opened", "Something Stirs Down the Hall",
  "Decisions, Decisions", "A Twist in the Tale", "The Marketer Hesitates", "Whispers Behind the Door",
  "Where the Carpet Leads"
];
function buildQuest(edition, p, tracks = [], sunday = true){
  const pool = catalogs[edition].filter(e => sunday || e.day !== 1);
  const eligible = e => !TRACKS[cat(e)] || tracks.includes(cat(e));
  const groups = new Map();
  for (const e of pool.filter(eligible)) {
    const k = `${e.day}:${e.start}`;
    if (!groups.has(k)) groups.set(k, {key: k, day: e.day, start: e.start, events: []});
    groups.get(k).events.push(e);
  }
  const trackTimes = pool.filter(e => tracks.includes(cat(e)));
  const duringTrack = slot => trackTimes.some(t => t.day === slot.day && ((slot.start >= t.start && slot.start < t.end) || overlap(t, {start: slot.start, end: slot.start + 15}) > 10));
  const all = [...groups.values()].sort((a, b) => a.day - b.day || a.start - b.start);
  const autos = [];
  const easy = [];
  const tough = [];
  for (const slot of all) {
    const trackEvent = slot.events.find(e => tracks.includes(cat(e)));
    // Summit players are in the Summit Room: their track session is picked for them, no door needed.
    if (!trackEvent && slot.events.length >= TOUGH && !duringTrack(slot)) { tough.push(slot); continue; }
    const auto = trackEvent;   // general sessions (opening, keynotes, awards, closing) are left off: everyone goes anyway
    if (auto) autos.push(auto.id);
    if (!duringTrack(slot) || trackEvent) easy.push(...slot.events.filter(e => e !== auto && formatOf(e) !== "Break" && !HIGHLIGHTS.has(e.id)));
  }
  const ranked = tough.map(slot => ({...slot, ranked: slot.events
    .map(e => ({e, s: score(e, p, tracks)}))
    .sort((a, b) => b.s - a.s || hash(a.e.id) - hash(b.e.id))}));
  // Show the three most compatible sessions; the very best one glows a little.
  const seen = new Map();
  const slots = ranked.map(slot => {
    const doors = slot.ranked.slice(0, 3).map(({e}, i) => ({id: e.id, glow: i === 0, reason: reasons(e, p), gold: HIGHLIGHTS.has(e.id)}));
    const rest = slot.ranked.slice(3);
    if (rest.length) doors.push({id: rest[hash(slot.key) % rest.length].e.id, wild: true});
    const used = new Set();
    for (const d of doors) if (!d.wild) { d.hint = hintFor(byId[d.id], used, seen); used.add(d.hint); }
    // Shuffle the rooms (the same way every time for this slot) so the glowing door isn't always
    // first. The wildcard stays at the end.
    const top = doors[0].id;
    const rooms = doors.filter(d => !d.wild);
    const spot = (Math.imul(hash(slot.key + top), 2654435761) >>> 16) % rooms.length;   // where the glowing door goes
    rooms.splice(spot, 0, rooms.shift());
    doors.splice(0, doors.length, ...rooms, ...doors.filter(d => d.wild));
    return {key: slot.key, day: slot.day, start: slot.start, doors, top, total: slot.events.length, hidden: rest.length, strength: slot.ranked[0].s,
      margin: slot.ranked[0].s - slot.ranked[1].s};
  });
  // Only the closest calls become hallways. Where one session clearly wins, it's picked for you.
  const chrono = (a, b) => a.day - b.day || a.start - b.start;
  const closest = new Set([...slots].sort((a, b) => a.margin - b.margin || chrono(a, b)).slice(0, HALLWAYS).map(x => x.key));
  const hallways = slots.filter(x => closest.has(x.key)).sort(chrono);
  const called = slots.filter(x => !closest.has(x.key)).sort(chrono);
  // Name each hallway like a book chapter, "Chapter 3: Monday Afternoon", with a story-style
  // subtitle. Subtitles are flavour only (they never describe the sessions) and don't repeat in a game.
  const offset = hash(hallways.map(x => x.key).join()) % CHAPTER_SUBTITLES.length;
  hallways.forEach((x, i) => {
    x.title = `${dayLabel(x.day, true).split(",")[0]} ${partOfDay(x.start)}`;   // "Chapter N:" is added when shown
    x.subtitle = CHAPTER_SUBTITLES[(offset + i) % CHAPTER_SUBTITLES.length];
  });
  for (const x of called) x.title = `${dayLabel(x.day, true).split(",")[0]} ${partOfDay(x.start).toLowerCase()}`;
  // Acts follow the conference: one act per day, in time order.
  const days = [...new Set(hallways.map(x => x.day))].sort((a, b) => a - b);
  const ordered = hallways.map(x => ({...x, act: days.indexOf(x.day) + 1}));
  // Easy calls: added for you when they match your character, best matches first.
  const easyFits = easy
    .filter(e => strongMatch(e, p) && !(edition === "austin" && /virtual/i.test(e.title)))
    .sort((a, b) => score(b, p, tracks) - score(a, p, tracks))
    .map(e => e.id);
  return {slots: ordered, called, autos, easy: easyFits};
}

/* ---------- Hints: a vague nudge about what's behind the door, never a quote ---------- */

// [pattern, variants]. Ordered from most to least distinctive. Each session picks one variant,
// so the same theme doesn't read the same way all week.
const HINTS = [
  [/game show|interactive game/i, ["Competitive, interactive and a little loud.", "Buzzers may be involved.", "Audience participation. You’ve been warned."]],
  [/comedy|laugh|humor|funny|joke/i, ["Expect laughs. Possibly at your expense.", "Funny on purpose, for once.", "Bring your sense of humor."]],
  [/govcon|federal|fedramp|public sector|government|water infrastructure|critical infrastructure/i, ["A guided tour of the government maze.", "Acronyms ahead. Bring a decoder ring.", "Selling to the public sector, minus the mystery."]],
  [/threat (report|research)|security research|research content/i, ["Research people actually want to read.", "Turning findings into something worth sharing.", "Reports that don’t gather dust."]],
  [/analyst|forrester|gartner/i, ["What the analysts are really saying.", "A view from the people who draw the quadrants.", "Analyst wisdom, no subscription needed."]],
  [/\bai search|llm|cited|geo\b|answer engine/i, ["Where buyers search now, and how to get found.", "Getting noticed when the search bar talks back.", "Showing up in the answers, not just the results."]],
  [/\b(ai|claude|gpts?|agents?)\b/i, ["Making AI actually pull its weight.", "Robots, but useful ones.", "Putting the machines to work.", "Less AI hype, more AI homework."]],
  [/ciso|buyer|buying|buying committee|win\/loss/i, ["A peek inside the buyer’s head.", "What the people with the budget really think.", "Why they buy, and why they don’t.", "Walking a mile in the customer’s loafers."]],
  [/influenc|creator|personal brand|linkedin|social media/i, ["The creator economy meets cyber.", "Fame, followers and what they’re worth.", "People with audiences, and how to work with them."]],
  [/rebrand|brand/i, ["A brand story, warts and all.", "Standing out without shouting.", "What makes a company unforgettable."]],
  [/positioning|messaging|category|narrative|story/i, ["Words that make a product make sense.", "Finding the sentence that sells it.", "Saying what you do so people get it."]],
  [/pipeline|demand|abm|intent|signal|funnel|attribution|ads?\b/i, ["Following the signals back to pipeline.", "Where the leads really come from.", "Turning interest into revenue.", "Numbers that make the CFO smile."]],
  [/partner|channel|alliances?/i, ["Allies, alliances and who really brings the deals.", "Friends in useful places.", "Growing through other people’s customers."]],
  [/swag|booth|event|field marketing|show floor/i, ["Life on the show floor, and what pays off.", "Lanyards, booths and lessons learned.", "Making in-person worth the plane ticket."]],
  [/community|customer|advoca|ugc/i, ["Turning customers into a chorus.", "When your fans do the talking.", "Building a room people want to be in."]],
  [/sales|enablement|demo/i, ["Peace talks with the sales team.", "Marketing and sales, finally on speaking terms.", "Helping the closers close."]],
  [/startup|founder|plg|scrappy|seed/i, ["Scrappy growth, startup style.", "Big results on a small budget.", "Early days, bold moves."]],
  [/cmo|leader|team|operating|roadmap|org\b|budget/i, ["How the people in charge run the show.", "Notes from the corner office.", "Running a team without losing the plot."]],
  [/book|publish/i, ["Ink, pages and a plan.", "From blank page to bookshelf."]]
];
const FORMAT_HINT = {
  Networking: "Find your people. Bring business cards.",
  Social: "Fun is happening in here. Details classified.",
  Workshop: "Bring a laptop. You’ll leave with something built.",
  Keynote: "Everyone will be talking about this one.",
  Break: "Snacks may be involved.",
  Talk: "Someone who’s been in the trenches, sharing what worked."
};
function hintFor(e, used = new Set(), seen = new Map()){
  const fromDesc = signals[e.id]?.h || [];
  const inTitle = HINTS.filter(([re]) => re.test(e.title));
  const inDesc = HINTS.filter(([re], i) => !re.test(e.title) && fromDesc.includes(i));
  const found = [...inTitle, ...inDesc];
  // Title matches first, then description. Each session starts from its own variant,
  // and skips any line a neighbouring door already uses.
  const h = hash(e.id);
  const options = found.flatMap(([, variants]) => variants.map((_, i) => variants[(h + i) % variants.length]));
  options.push(FORMAT_HINT[formatOf(e)] || FORMAT_HINT.Talk);
  if (formatOf(e) === "Workshop") options.unshift(options.length > 1 ? `Hands-on: ${options[0].charAt(0).toLowerCase()}${options[0].slice(1)}` : FORMAT_HINT.Workshop);
  // Prefer a line no neighbouring door uses, and the one seen least so far this game.
  const free = options.filter(x => !used.has(x));
  const pick = (free.length ? free : options).reduce((best, x) => (seen.get(x) || 0) < (seen.get(best) || 0) ? x : best);
  seen.set(pick, (seen.get(pick) || 0) + 1);
  return pick;
}

function clues(e, edition){
  const n = (e.speakers || []).filter(([name]) => name).length;
  const who = n === 0 ? "No speakers" : n === 1 ? "Solo speaker" : n === 2 ? "Duo" : `Panel of ${n}`;
  const list = [formatOf(e), `${e.end - e.start} min`, who];
  const v = VIBE[cat(e)];
  if (v) list.push(v);
  if (edition === "online" && e.livestream) list.push("Livestream");
  return list;
}

/* ---------- State ---------- */

const fresh = () => ({edition: null, answers: [], tracks: [], picks: [], extras: [], dropped: [], step: 0, open: null, skipped: []});
let state = fresh();
try { state = {...state, ...JSON.parse(localStorage.getItem(KEY))}; } catch {}
const resetRun = () => Object.assign(state, {picks: [], extras: [], dropped: [], passed: [], step: 0, open: null, skipped: [], swap: null});
let screen = "cover";
let feedback = "";

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
const profile = () => profileFrom(state.answers);
let questCache = null;
const attendsSunday = () => state.edition !== "austin" || state.sunday !== false;
const myTracks = () => state.edition === "austin" ? (state.tracks || []).filter(k => TRACKS[k]) : [];
const suggestedTracks = () => Object.keys(TRACKS).filter(k => TRACKS[k].badge === state.answers[0]);
function quest(){
  const k = state.edition + state.answers.join("") + myTracks().join() + attendsSunday();
  if (questCache?.k !== k) questCache = {k, ...buildQuest(state.edition, profile(), myTracks(), attendsSunday())};
  return questCache.slots;
}
const autos = () => (quest(), questCache.autos.filter(id => !state.dropped.includes(id)));
const byTime = (a, b) => a.day - b.day || a.start - b.start;
// Highlights, summit sessions and your door picks. These always win a clash.
const corePicks = () => [...new Set([...autos(), ...state.picks, ...(state.extras || [])])].map(id => byId[id]).filter(Boolean);
// Matching easy calls that fit around the core picks (and each other), within a realistic day:
// up to 6 daytime sessions (3 on Sunday's half day) and one easy evening event per night.
const DAY_LIMIT = day => day === 1 ? 3 : 6;
const isEvening = e => e.start >= 1110;
function easyAdds(core = corePicks()){
  quest();
  const taken = [...core];
  const out = [];
  for (const id of questCache.easy) {
    const e = byId[id];
    if (state.dropped.includes(id) || taken.includes(e)) continue;
    if (taken.some(p => p.day === e.day && overlap(p, e) > 10)) continue;
    const sameDay = taken.filter(p => p.day === e.day);
    if (isEvening(e) ? out.some(p => p.day === e.day && isEvening(p)) : sameDay.filter(p => !isEvening(p)).length >= DAY_LIMIT(e.day)) continue;
    taken.push(e); out.push(e);
  }
  return out;
}
// Clear winners, picked for you. They yield to your own door picks and to a realistic day.
function calledAdds(core = corePicks()){
  quest();
  const taken = [...core];
  const out = [];
  for (const c of [...questCache.called].sort((a, b) => b.strength - a.strength)) {
    const e = byId[c.top];
    if (state.dropped.includes(e.id) || (state.passed || []).includes(c.key) || taken.includes(e)) continue;
    if (state.picks.some(id => inSlot(id, c))) continue;
    if (taken.some(p => p.day === e.day && overlap(p, e) > 10)) continue;
    if (taken.filter(p => p.day === e.day && !isEvening(p)).length >= DAY_LIMIT(e.day)) continue;
    taken.push(e); out.push(e);
  }
  return out;
}
const allPicks = () => { const core = corePicks(); const called = calledAdds(core); return {core, called, easy: easyAdds([...core, ...called])}; };
const isCalled = id => !state.picks.includes(id) && calledAdds().some(e => e.id === id);
const isAuto = id => { if (state.picks.includes(id)) return false; const a = allPicks(); return autos().includes(id) || a.called.some(e => e.id === id) || a.easy.some(e => e.id === id); };
const picks = () => { const a = allPicks(); return [...a.core, ...a.called, ...a.easy].sort(byTime); };
const slotOf = id => questCache.called.find(c => inSlot(id, c));
const esc = v => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const timeRange = e => `${dayLabel(e.day, true)} · ${clock(e.start)}–${clock(e.end)} CT`;
const speakerLine = e => (e.speakers || []).map(s => s.filter(Boolean).join(" · ")).join("; ");

const inSlot = (id, slot) => byId[id]?.day === slot.day && byId[id]?.start === slot.start;
function blockedBy(slot){
  const lead = byId[slot.top];
  return corePicks().find(p => p.day === slot.day && !inSlot(p.id, slot) && overlap(p, lead) > 10);
}
const ROMAN = ["I", "II", "III", "IV"];
const DAY_LINE = {1: "Arrival day. Badges, workshops and first hellos.", 2: "The doors swing open.", 3: "Deep in the conference now.", 4: "The final stretch."};
const dayFull = slot => corePicks().filter(e => e.day === slot.day && !isEvening(e) && !inSlot(e.id, slot)).length >= DAY_LIMIT(slot.day);
// Why a slot gets passed over automatically, if it does.
function passReason(slot){
  if (state.picks.some(id => inSlot(id, slot))) return null;
  const b = blockedBy(slot);
  if (b) return `You’re already in “${b.title}” then, so we passed a door.`;
  return null;
}

/* ---------- Screens ---------- */

const isFinished = () => Boolean(state.edition) && state.answers.length >= QUIZ.length && state.step >= quest().length;
function cover(){
  return `<section class="page narrow cover" aria-labelledby="t">
    <p class="pill">Choose your own Cyber Marketing Con</p>
    <h1 id="t" tabindex="-1">The Case of the Double-Booked Marketer</h1>
    <p class="edition">November 2026 · Austin &amp; online</p>
    <div class="cover-art"><img src="assets/cover-path.webp" width="540" height="684" alt="Painted view from above of a marketer in a hallway, with a hand drawing a dotted gold path that forks toward four doors, one of them glowing"></div>
    <p class="lede">A free choose-your-own-adventure game that suggests sessions for Cyber Marketing Con 2026. Answer five questions, open the doors that call to you, and leave with session recommendations.</p>
    <div class="actions"><button class="btn primary" data-go="edition">${isFinished() ? "See your results" : state.edition ? "Continue your game" : "Begin"}</button><button class="btn" data-page="characters">Meet the characters</button></div>
    <ol class="how">
      <li><strong>Find your character</strong>Five quick questions.</li>
      <li><strong>Open mystery doors</strong>When there’s too much to choose from.</li>
      <li><strong>Take it home</strong>Session recommendations, weighted toward your goals.</li>
    </ol>
  </section>`;
}

function editionScreen(){
  const opt = (key, label, detail, img, alt) => `<button class="choice edition-choice" data-edition="${key}" aria-pressed="${state.edition === key}">
    <img src="assets/${img}" alt="${alt}" width="720" height="480"><span><strong>${label}</strong><small>${detail}</small></span></button>`;
  return `<section class="page narrow" aria-labelledby="t">
    <p class="eyebrow">Chapter 1</p><h1 id="t" tabindex="-1">How are you attending?</h1>
    <p class="lede">Online players only see livestreamed sessions.</p>
    <div class="choices">
      ${opt("austin", "In person", "Austin Marriott Downtown · Nov 15–18", "austin.webp", "Painted Austin skyline at dusk")}
      ${opt("online", "Online", "VirtualPro livestream · Nov 16–18", "online.webp", "A marketer in bunny slippers at a purple 1980s computer")}
    </div>
    ${state.edition === "austin" ? `<label class="arrival">Arriving
      <select id="arrival">
        <option value="yes"${attendsSunday() ? " selected" : ""}>Sunday, Nov 15 (workshops and welcome reception)</option>
        <option value="no"${attendsSunday() ? "" : " selected"}>Monday, Nov 16 (skip Sunday)</option>
      </select></label>` : ""}
    <div class="actions"><button class="btn primary" data-continue ${state.edition ? "" : "disabled"}>Continue</button></div>
  </section>`;
}

function charactersScreen(){
  const mine = state.answers.length >= QUIZ.length ? characterFor(state.answers).key : null;
  return `<section class="page" aria-labelledby="t">
    <p class="eyebrow">The cast</p>
    <h1 id="t" tabindex="-1">Meet the characters</h1>
    <p class="lede">Nine marketers walk into a conference. Your quiz answers decide which one you are, and that shapes which doors glow for you.</p>
    <section class="stat-guide" aria-labelledby="stat-guide-t">
      <h2 id="stat-guide-t">The four stats</h2>
      <p class="subtle">Every character card rates you on four things, based on your quiz answers.</p>
      <dl class="stat-key">${Object.entries(STAT_KEY).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    </section>
    <ul class="cast">${Object.entries(CHARACTERS).map(([key, [name, line, draws, how]]) => `<li class="cast-card${key === mine ? " mine" : ""}">
      <div class="sigil" aria-hidden="true">${ICONS[key]}</div>
      <div><h2>${esc(name)}${key === mine ? ` <span class="you">That’s you</span>` : ""}</h2>
        <p class="cast-line">${esc(line)}</p>
        <p>${esc(draws)}</p>
        <p class="cast-how"><span>How to get this character</span>${esc(how)}</p></div>
    </li>`).join("")}</ul>
    <div class="actions"><button class="btn primary" data-go="edition">${mine ? "Back to my game" : state.edition ? "Continue your game" : "Find out who you are"}</button></div>
  </section>`;
}

function quizScreen(){
  const i = Math.min(state.answers.length, QUIZ.length - 1);
  const {q, options} = QUIZ[i];
  return `<section class="page narrow" aria-labelledby="t">
    <div class="quiz-progress" aria-hidden="true">${QUIZ.map((_, n) => `<i class="${n < i ? "done" : n === i ? "now" : ""}"></i>`).join("")}</div>
    <p class="eyebrow">Character quiz · ${i + 1} of ${QUIZ.length}</p>
    <h1 id="t" tabindex="-1">${esc(q)}</h1>
    <div class="choices">${options.map(([label, sub], n) => {
      const track = i === 0 && state.edition === "austin" ? Object.values(TRACKS).find(t => t.badge === n && t.sessions.length) : null;
      return `<button class="choice${track ? " summit-choice" : ""}" data-answer="${n}"><strong>${esc(label)}</strong><small>${esc(sub)}</small>${track ? `<small class="track-tip">Joins the ${esc(track.name)} track · ${esc(track.when)}</small>` : ""}</button>`;
    }).join("")}</div>
    <div class="actions"><button class="btn quiet small" data-back-quiz>${i ? "← Previous question" : "← Change attendance"}</button></div>
  </section>`;
}

// One line icon per character, drawn in the sigil colour (currentColor).
const SVG = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const ICONS = {
  lore: SVG('<path d="M4 5.5C6 4.5 8.5 4.5 12 6.5c3.5-2 6-2 8 -1v13c-2-1-4.5-1-8 1-3.5-2-6-2-8-1z"/><path d="M12 6.5v13"/>'),
  pipeline: SVG('<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>'),
  spotlight: SVG('<path d="M12 3.5l2.5 5.2 5.6.8-4 3.9.95 5.6L12 16.5l-5.05 2.5.95-5.6-4-3.9 5.6-.8z"/>'),
  road: SVG('<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M9 8V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2"/><path d="M9 13h6"/>'),
  guild: SVG('<circle cx="12" cy="8" r="2.8"/><circle cx="6.5" cy="15" r="2.2"/><circle cx="17.5" cy="15" r="2.2"/><path d="M3.5 20c.6-2.2 1.7-3.3 3-3.3s2.4 1.1 3 3.3M14.5 20c.6-2.2 1.7-3.3 3-3.3s2.4 1.1 3 3.3"/>'),
  strategist: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  founder: SVG('<path d="M12 3c3 2.5 4.5 6 4.5 9.5L12 17l-4.5-4.5C7.5 9 9 5.5 12 3z"/><circle cx="12" cy="10" r="1.6"/><path d="M8 13.5L5.5 16v3l2.5-1.5M16 13.5l2.5 2.5v3L16 17"/><path d="M10.5 17.5v2.5h3v-2.5"/>'),
  federal: SVG('<path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>'),
  connector: SVG('<circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="17" r="2.5"/><path d="M8.2 8.4l2.6 6.6M15.8 8.4l-2.6 6.6M8.5 7h7"/>'),
};
const STAT_KEY = {
  Strategy: "Big-picture thinking: leadership, go-to-market and where the company is headed.",
  Story: "Brand, messaging and content: how you make people care.",
  Signal: "Demand, data and the field: what’s actually bringing in pipeline.",
  Social: "People and community: the hallway track, mixers and the friends you make."
};
function characterScreen(){
  const ch = characterFor(state.answers);
  const slots = quest();
  const days = [...new Set(slots.map(s => s.day))].map(d => dayLabel(d, true).split(",")[0]);
  return `<section class="page" aria-labelledby="t">
    <p class="eyebrow">Your character</p>
    <div class="character">
      <div class="char-card">
        <div class="sigil" aria-hidden="true">${ICONS[ch.key]}</div>
        <h1 id="t" tabindex="-1">${esc(ch.name)}</h1>
        <p>${esc(ch.line)}</p>
        <div class="stats">${Object.entries(ch.stats).map(([k, v]) => `<div class="stat"><span>${k}</span><span class="pips" role="img" aria-label="${v} of 5">${[1,2,3,4,5].map(n => `<i class="${n <= v ? "on" : ""}"></i>`).join("")}</span></div>`).join("")}</div>
      </div>
      <div>
        <h2>Your quest</h2>
        <div class="quest"><p>Your adventure has <strong>${slots.length} ${slots.length === 1 ? "hallway" : "hallways"}</strong> across ${days.join(", ")}: the moments where the choice is closest for you.</p>
          <ul><li>Sessions that are an easy call for your character are recommended for you and already on your agenda. You can swap or remove them at the end.</li>
          <li>Each day is an act, from morning to evening.</li>
          <li>Each hallway has a few doors with a hint taped on. The one that glows suits you best.</li>
          <li>Purple doors are wildcards.</li>
          ${myTracks().map(k => `<li>Your badge puts you in the <strong>${esc(TRACKS[k].name)}</strong> (${esc(TRACKS[k].when)}). Its sessions are already on your agenda, so you won’t see doors while it runs.</li>`).join("")}
          <li>Open a door to see what’s behind it, then keep it or back away.</li></ul></div>
        <div class="actions">
          <button class="btn primary" data-go="doors">Enter the conference</button>
          ${state.edition === "austin" ? `<button class="btn" data-toggle-sunday>${attendsSunday() ? "Skip Sunday" : "Add Sunday back"}</button>` : ""}
          ${state.edition === "austin" && suggestedTracks().length ? `<button class="btn" data-toggle-summit>${myTracks().length ? "Skip the summit track" : `Rejoin the ${esc(TRACKS[suggestedTracks()[0]].name)}`}</button>` : ""}
          <button class="btn quiet" data-retake>Retake the quiz</button>
          <button class="btn quiet" data-page="characters">Meet all 9 characters</button>
        </div>
        <p class="subtle">${state.picks.length ? `Your ${state.picks.length} door ${state.picks.length === 1 ? "pick stays" : "picks stay"} if you retake the quiz.` : ""}</p>
        <div hidden>
        </div>
      </div>
    </div>
  </section>`;
}


function doorCard(d, n, slot, currentId = null){
  const e = byId[d.id];
  const current = d.id === currentId;
  const label = d.wild ? "Wildcard" : d.gold ? "Main stage" : `Room ${n + 1}`;
  const tags = d.wild ? [formatOf(e), "???"] : clues(e, state.edition).filter(c => !Object.values(VIBE).includes(c));
  return `<div class="door-slot${current ? " current" : ""}">
    ${current ? `<span class="current-tag">Your current pick</span>` : ""}
    <div class="plaque"><strong>${label}</strong></div>
    <button class="door${d.gold ? " gold" : ""}${d.wild ? " wild" : ""}${d.glow ? " glow" : ""}" data-door="${esc(d.id)}" aria-label="${label}${current ? ", your current pick" : ""}${d.glow ? ", glowing: your most compatible door" : ""}. Sign on the door: ${esc(d.wild ? "Something else is happening at this hour." : d.hint)} ${esc(tags.join(", "))}. Open the door.">
      <span class="leaf" aria-hidden="true">
        <span class="note"><span class="hint">${esc(d.wild ? "Something else is happening at this hour." : d.hint)}</span><span class="note-tags">${tags.map(esc).join(" · ")}</span></span>
        <span class="handle"></span>
      </span>
    </button>
  </div>`;
}

function revealCard(e, slot){
  const sp = (e.speakers || []).filter(([n]) => n);
  const door = slot.doors.find(x => x.id === e.id);
  const why = door?.wild ? "A wildcard. Fortune favors the curious." : door?.glow ? `The glowing door. Very ${characterFor(state.answers).name.replace(/^The /, "")} of you.` : ["Off the beaten path. Nice.", "A bold choice.", "Ooh, interesting pick."][hash(e.id) % 3];
  return `<article class="reveal" aria-labelledby="reveal-t">
    <p class="eyebrow">Behind the door…</p>
    <h2 id="reveal-t" tabindex="-1">${esc(e.title)}</h2>
    <p class="why">${esc(why)}</p>
    <ul class="reveal-meta">
      <li><b>When</b><span>${esc(timeRange(e))}</span></li>
      ${sp.length ? `<li><b>${sp.length > 1 ? "Speakers" : "Speaker"}</b><span>${sp.map(s => esc(s.filter(Boolean).join(" · "))).join("<br>")}</span></li>` : ""}
      ${e.sponsor ? `<li><b>Sponsor</b><span>${esc(e.sponsor)}</span></li>` : ""}
    </ul>
    <div class="actions">
      <button class="btn primary" data-keep="${esc(e.id)}">Keep it and move on</button>
      <button class="btn" data-close>Close the door</button>
    </div>
  </article>`;
}

const dayShort = day => dayLabel(day, true).split(",")[0];
function actBar(slots, slot){
  const days = [...new Set(slots.map(x => x.day))];
  return `<ol class="acts" aria-label="Progress by day">${days.map(day => {
    const inDay = slots.filter(x => x.day === day);
    const done = inDay.filter(x => slots.indexOf(x) < state.step).length;
    const now = slot?.day === day;
    return `<li class="${now ? "now" : done === inDay.length ? "done" : ""}"${now ? ' aria-current="step"' : ""}><span>${dayShort(day)}</span><i><b style="width:${Math.round(100 * done / inDay.length)}%"></b></i></li>`;
  }).join("")}</ol>`;
}

function swapView(slot){
  const open = state.open && slot.doors.some(d => d.id === state.open) ? byId[state.open] : null;
  const current = picks().find(e => inSlot(e.id, slot));
  return `<section class="page" aria-labelledby="t">
    <div class="door-top"><p class="eyebrow">Swap a pick</p></div>
    <h1 id="t" tabindex="-1">${esc(slot.title)}</h1>
    ${open ? revealCard(open, slot) : `<p class="lede">${current ? `Right now you have “${esc(current.title)}”, behind the door marked as your current pick. ` : ""}Open a different door, or head back.</p>
      <div class="hallway swap-hall"><div class="door-row">${slot.doors.map((d, n) => doorCard(d, n, slot, current?.id)).join("")}</div></div>`}
    <div class="door-tools"><button class="btn quiet small" data-swap-cancel>← Back to my agenda</button></div>
  </section>`;
}

function doorsScreen(){
  const slots = quest();
  if (state.swap) {
    const swapping = questCache.called.find(c => c.key === state.swap);
    if (swapping) return swapView(swapping);
    state.swap = null;
  }
  // Pass doors you can't make because you're already in another session then.
  let reason;
  while (state.step < slots.length && (reason = passReason(slots[state.step]))) {
    feedback = reason;
    state.skipped.push(slots[state.step].key);
    state.step++;
  }
  if (state.step >= slots.length) return endingScreen();
  const slot = slots[state.step];
  const open = state.open && slot.doors.some(d => d.id === state.open) ? byId[state.open] : null;
  const left = slots.length - state.step;
  const leftToday = slots.filter((x, i) => i >= state.step && x.day === slot.day).length;
  const firstOfDay = slots.findIndex(x => x.day === slot.day) === state.step;
  // Chapters count only the hallways you actually reach, so the numbers never skip.
  const chapterNo = 1 + slots.slice(0, state.step).filter(x => !state.skipped.includes(x.key)).length;
  const crowded = dayFull(slot);
  return `<section class="page" aria-labelledby="t">
    <div class="door-top"><p class="eyebrow">Act ${ROMAN[slot.act - 1]} · ${dayShort(slot.day)}</p><span class="slot-meter">${leftToday} ${leftToday === 1 ? "door" : "doors"} left today · ${left} left in all</span></div>
    ${actBar(slots, slot)}
    <div class="layout"><div>
      ${firstOfDay && !open ? `<p class="act-intro">${DAY_LINE[slot.day] || ""}</p>` : ""}
      <h1 id="t" tabindex="-1">Chapter ${chapterNo}: ${esc(slot.title)}</h1>
      ${slot.subtitle && !open ? `<p class="chapter-sub">${esc(slot.subtitle)}</p>` : ""}
      ${feedback ? `<p class="feedback">${esc(feedback)}</p>` : ""}
      ${crowded && !open ? `<p class="feedback">Your ${dayShort(slot.day)} is already pretty full. Skipping this one is totally fine.</p>` : ""}
      ${open ? revealCard(open, slot) : `<div class="hallway"><div class="door-row">${slot.doors.map((d, n) => doorCard(d, n, slot)).join("")}</div></div>`}
      <div class="door-tools">
        <button class="btn quiet small" data-prev ${state.step ? "" : "disabled"}>← Previous door</button>
        <button class="btn quiet small" data-skip>Skip this one →</button>
      </div>
    </div></div>
  </section>`;
}

// Results: one "page" per session, grouped into the acts (days) of the conference.
// The reasons for a recommendation live in a tooltip on its label, keeping every card the same height.
function sessionCard(e){
  const auto = isAuto(e.id);
  const why = auto ? whyList(e, profile(), characterFor(state.answers).name.replace(/^The /, "")) : [];
  const who = (e.speakers || []).filter(([n]) => n).map(([n, , company]) => company ? `${n} (${company})` : n);
  const swap = slotOf(e.id);
  const tip = `why-${e.id}`;
  const tag = auto
    ? `<span class="tip-wrap"><button type="button" class="scard-tag auto" aria-describedby="${tip}">Recommended for you</button>
        <span role="tooltip" id="${tip}" class="scard-tip"><strong>Why it’s on your list</strong>${why.length ? `<ul>${why.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}</span></span>`
    : `<span class="scard-tag">Your pick</span>`;
  return `<li class="scard${auto ? "" : " mine"}">
    <div class="scard-top">${tag}<span class="scard-time">${clock(e.start)}–${clock(e.end)}</span></div>
    <h4 class="scard-title">${esc(e.title)}</h4>
    ${who.length ? `<p class="scard-who">${esc(who.slice(0, 3).join(", "))}${who.length > 3 ? ` +${who.length - 3}` : ""}</p>` : ""}
    <div class="scard-actions">${swap ? `<button class="btn small" data-swap="${esc(swap.key)}" aria-label="Swap ${esc(e.title)} for another session at that time">Swap</button>` : ""}<button class="btn quiet small" data-remove="${esc(e.id)}" aria-label="Remove ${esc(e.title)}">Remove</button></div>
  </li>`;
}
function agendaList(list){
  const days = [...new Set(list.map(e => e.day))];
  return days.map((day, i) => {
    const mine = list.filter(e => e.day === day);
    return `<section class="act-day" aria-labelledby="act-day-${day}">
      <header><p class="eyebrow">Act ${ROMAN[i]}</p><h3 id="act-day-${day}">${dayLabel(day, true)}</h3><span class="act-count">${mine.length} ${mine.length === 1 ? "session" : "sessions"}</span></header>
      <ul class="scards">${mine.map(sessionCard).join("")}</ul>
    </section>`;
  }).join("");
}

function endingScreen(){
  const list = picks();
  const ch = characterFor(state.answers);
  return `<section class="page" aria-labelledby="t">
    <p class="eyebrow">The end… of planning</p>
    <h1 id="t" tabindex="-1">${esc(ch.name)}’s Cyber Marketing Con</h1>
    <p class="lede">${list.length ? `${list.length} ${list.length === 1 ? "session" : "sessions"} on your agenda: ${state.picks.length} from behind doors, ${list.length - state.picks.length} recommended for you. All times are Central.` : "You walked past every door. Replay to give them another look."}</p>
    ${agendaList(list)}
    <div class="actions">
      ${list.length ? `<button class="btn primary" data-copy>Copy agenda</button>` : ""}
      <button class="btn quiet" data-replay>Clear door picks and replay</button>
    </div>
    <p class="status" id="status" role="status"></p>
    <p class="subtle">Check the <a href="${virtualPro}" target="_blank" rel="noopener">Hubilo app</a> for rooms and schedule updates. This list is your personal picks, so it leaves out the general sessions everyone attends, like the opening keynote and the closing celebration.</p>
  </section>`;
}

const SCREENS = {about: aboutScreen, privacy: privacyScreen, terms: termsScreen, cover, edition: editionScreen, characters: charactersScreen, quiz: quizScreen, character: characterScreen, doors: doorsScreen, ending: endingScreen};
const navBar = document.querySelector("#game-nav");
function render(focus = true){
  restartButton.hidden = !state.edition;
  const ready = state.edition && state.answers.length >= QUIZ.length;
  navBar.hidden = !ready;
  for (const b of document.querySelectorAll("header [data-page]")) screen === b.dataset.page ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current");
  app.innerHTML = SCREENS[screen]();
  // Once every hallway is done, the Doors tab becomes Results (until you reset).
  const finished = Boolean(ready) && state.step >= quest().length;
  for (const b of navBar.querySelectorAll("[data-nav]")) {
    const target = b.dataset.nav;
    if (target === "doors") b.hidden = finished;
    if (target === "results") b.hidden = !finished;
    const here = target === screen || (screen === "doors" && target === (finished ? "results" : "doors"));
    here ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current");
  }
  if (focus) { window.scrollTo(0, 0); app.querySelector("#reveal-t, h1")?.focus({preventScroll: true}); }
  record();
}
function go(next){ screen = next; feedback = ""; render(); }

/* ---------- Undo, redo and the browser's Back button ---------- */

// Every screen change or action leaves a snapshot on a trail. Undo and Redo step along it,
// and each snapshot is also a browser history entry, so the Back and Forward buttons do the same.
const trail = [];
let at = -1;
let restoring = false;
const PAGE_TOOLS = `<div class="page-tools" role="group" aria-label="Undo and redo">
  <button type="button" class="btn quiet small" data-undo aria-label="Undo: go back one step"><span aria-hidden="true">↶</span> Undo</button>
  <button type="button" class="btn quiet small" data-redo aria-label="Redo: go forward one step"><span aria-hidden="true">↷</span> Redo</button>
</div>`;
function record(){
  const snap = JSON.stringify({state, screen});
  if (!restoring && snap !== trail[at]) {
    trail.splice(at + 1);
    trail.push(snap);
    at = trail.length - 1;
    try { at === 0 ? history.replaceState({cmc: at}, "") : history.pushState({cmc: at}, ""); } catch {}
  }
  // The Undo and Redo buttons sit at the top of the current page of the book.
  const page = app.querySelector(".page");
  if (page && trail.length > 1) {
    if (!page.querySelector(".page-tools")) page.insertAdjacentHTML("afterbegin", PAGE_TOOLS);
    page.querySelector("[data-undo]").disabled = at <= 0;
    page.querySelector("[data-redo]").disabled = at >= trail.length - 1;
  }
}
function restore(i){
  if (!Number.isInteger(i) || i < 0 || i >= trail.length || i === at) return;
  const back = i < at;
  at = i;
  ({state, screen} = JSON.parse(trail[i]));
  feedback = "";
  restoring = true;
  save();
  render();
  restoring = false;
  record();
  announce.textContent = back ? "Went back one step." : "Went forward one step.";
}
// The buttons step along the trail directly. (Asking the browser to go "back" is unreliable:
// browsers may skip history entries that weren't created by a real click.)
app.addEventListener("click", ev => {
  if (ev.target.closest("[data-undo]")) restore(at - 1);
  else if (ev.target.closest("[data-redo]")) restore(at + 1);
});
window.addEventListener("popstate", ev => restore(ev.state?.cmc));
document.addEventListener("keydown", ev => {
  if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== "z" || ev.target.closest("input, textarea, select")) return;
  ev.preventDefault();
  restore(ev.shiftKey ? at + 1 : at - 1);
});

/* ---------- Take it home ---------- */

function copyAgenda(){
  const status = app.querySelector("#status");
  const list = picks();
  const label = state.edition === "online" ? "Online" : "In person";
  const text = [`Cyber Marketing Con 2026 · ${label} · Central time`, ...[...new Set(list.map(e => e.day))].map(d => [dayLabel(d, true), ...list.filter(e => e.day === d).map(e => `${clock(e.start)}–${clock(e.end)}  ${e.title}`)].join("\n"))].join("\n\n");
  return navigator.clipboard.writeText(text).then(() => status.textContent = "Agenda copied. Paste it into your notes or calendar.", () => status.textContent = "Clipboard access is unavailable. Select the agenda above to copy it.");
}

/* ---------- About, privacy and terms ---------- */

const contact = '<a href="https://www.linkedin.com/in/cassidykei" target="_blank" rel="noopener">contact Cassidy Trowbridge on LinkedIn</a>';
const conferenceResources = `<ul>
  <li><a href="https://www.cybermarketingconference.com/" target="_blank" rel="noopener">CyberMarketingCon website</a></li>
  <li><a href="https://www.cybermarketingconference.com/agenda" target="_blank" rel="noopener">Official conference agenda</a></li>
  <li><a href="${virtualPro}" target="_blank" rel="noopener">Hubilo event app (VirtualPro)</a></li>
  <li><a href="https://www.cybersecuritymarketingsociety.com/" target="_blank" rel="noopener">Cybersecurity Marketing Society</a></li>
</ul>
<p>CyberMarketingCon is hosted by the Cybersecurity Marketing Society, a community I have deep respect and gratitude for.</p>`;
const creatorLinks = [
  ["linkedin.png", "https://www.linkedin.com/in/cassidykei", "Cassidy Trowbridge on LinkedIn", "Connect with the game’s creator."],
  ["github.svg", "https://github.com/cybergtm/skills", "Free Claude Skills for Cyber Marketers", "Browse the GitHub repository."],
  ["cybersynapse.png", "https://www.cybersynapse.io/", "CyberSynapse.io", "Cybersecurity buyer intelligence."],
  ["cybernest.svg", "https://app.cybersynapse.io/", "The CyberNest", "A peer community for cybersecurity and IT professionals."],
  ["cooking-with-cisos.png", "https://www.cookingwithcisos.com/", "Cooking with CISOs", "Conversations with security leaders in the kitchen."]
];
function aboutScreen(){
  return `<article class="page reading about-page" aria-labelledby="t">
    <header><h1 id="t" tabindex="-1">About</h1><p class="lede">Choose Your Own CMC is an independent, paperback-inspired game for planning your CyberMarketingCon 2026.</p></header>
    <section class="story">
      <h2>What this is</h2>
      <p>CyberMarketingCon 2026 has about 150 sessions and events across four days, with up to seven happening at the same time. That is a wonderful problem and a slightly overwhelming one. This game turns the agenda into a choose-your-own-adventure paperback: you find your character, walk down a hallway of doors and leave with a schedule that fits you.</p>
      <p>It is a fan project. It isn’t run by the conference, and it doesn’t replace the Hubilo app. Hubilo is where the official schedule, rooms and updates live.</p>
      <h2>What it’s meant to do</h2>
      <p>The game only stops you where a few choices are all valid options based on your preferences: the handful of moments when several sessions collide and it’s a close call for your character. When one session is clearly the best match, the game recommends it and moves on.</p>
      <p>The details are hidden on purpose. A hint on the door keeps you from picking the famous name or the cleverest title, and nudges you toward what you’re curious about. I find big plans easier when they are broken into small choices, so the game asks for one small choice at a time.</p>
      <h2>How it was made</h2>
      <p>I love games. Board games, video games, anything with a good choice in it. So when I sat down to plan my own conference schedule, turning it into one was too tempting to pass up, and it made this a really fun project to vibe code.</p>
      <p>I’m a marketer, not a developer. I built this in the days before the conference by directing AI tools: the first version was made with ChatGPT Sites, then later refined in Claude. I supplied the agenda export, the idea, the audience and a lot of opinions. The AI wrote the code, sorted the sessions and drafted the hints.</p>
      <p>What moved it forward was specific feedback after playing each version. “The doors don’t read as doors.” “The italic text is hard to read.” “Make it more fun and less scientific.” “Why does the player need to do this step at all?” Early versions ranked every session with stars and scores. Playing it showed that people don’t want to be graded, they want to be tempted, so the stars became a single glowing door.</p>
      <h2>Why a marketer made a game</h2>
      <p>This is the part of AI-enabled marketing I find most exciting. AI didn’t have the idea, and it didn’t know what a tired attendee needs on a Tuesday afternoon. That came from knowing the audience. What AI changed was the cost of trying: an idea that would have needed a developer, a designer and a budget became something one marketer could prototype, play, critique and reshape in a matter of days.</p>
      <p>The lessons carried over from everyday marketing work:</p>
      <ul>
        <li><strong>Start with the decision your audience has to make.</strong> Everything in the game exists to make one choice easier.</li>
        <li><strong>Give AI feedback it can act on.</strong> “Make it better” goes nowhere. “These should look like doors in a hotel hallway” gets you doors.</li>
        <li><strong>Taste is still your job.</strong> The AI will happily build the wrong thing beautifully. Creative direction, editing and knowing when something isn’t fun yet stay with the human.</li>
      </ul>
    </section>
    <section class="story faq" aria-labelledby="faq-t">
      <h2 id="faq-t">Questions marketers ask</h2>
      <details>
        <summary>Is this an official conference tool?</summary>
        <p>No. It’s an independent fan project by Cassidy Trowbridge. The conference and the Cybersecurity Marketing Society didn’t build it or review it. The session list comes from the public agenda snapshot dated November 12, 2026. For rooms, times and updates, use the Hubilo app.</p>
      </details>
      <details>
        <summary>Do I need an account, and what does it collect?</summary>
        <p>No account, no sign-in and no analytics. Your answers and door picks are saved in your own browser’s local storage and never leave it. Reset removes them, and so does clearing this site’s data in your browser.</p>
      </details>
      <details>
        <summary>How does it decide what to recommend?</summary>
        <p>Your quiz answers set a topic, a preferred format, a side quest and an evening preference. Each session gets a score from how well its topic and format match, whether its title or description keeps returning to your side quest, and whether it runs in the evening. When several sessions collide, the game compares your best match with the runner-up. If one clearly wins, it’s recommended for you. If they’re close, you get a hallway to choose from. General sessions everyone attends, such as the keynotes, the opening and the closing, are left off your agenda. No more than six daytime sessions a day are added automatically (three on Sunday), so the plan stays doable.</p>
      </details>
      <details>
        <summary>Why only seven hallways?</summary>
        <p>Most collisions aren’t close calls for any one person. In the agenda there are 17 moments where three or more sessions run at once, and for a given character most of them have a clear favourite. Seven hallways keep the choices meaningful. The rest are decided by the scoring, and you can swap or remove any recommendation at the end. The trade-off is that you give up some control.</p>
      </details>
      <details>
        <summary>Why isn’t a session I’d enjoy showing up?</summary>
        <p>The game scores fit to your answers, not quality or how much anyone else will enjoy a talk. If a session is far from your topic and format, it won’t be recommended. Your own picks always win a clash, and you can swap a recommendation for another session at the same time.</p>
      </details>
      <details>
        <summary>Can I trust the hints on the doors?</summary>
        <p>Treat them as a nudge, not a summary. Each hint is a short, deliberately vague line written from a session’s title and description, so it can be wrong or incomplete. Read the full details in Hubilo before you commit.</p>
      </details>
      <details>
        <summary>Will two people get the same agenda?</summary>
        <p>Only if they answer the same way. The agenda follows from your answers, so different badges and interests lead to different sessions. That’s intended. The point is to show each person what fits them.</p>
      </details>
      <details>
        <summary>What did the AI do, and what did you do?</summary>
        <p>I set the concept, the audience, the character system and what the game should do. I also decided what to keep, cut or change after playing it. AI tools wrote most of the code and drafted many of the hints and sentences. I checked the results against the agenda and reworked anything that read wrong.</p>
      </details>
      <details>
        <summary>Has it been tested with attendees?</summary>
        <p>I’ve tested it by working through many combinations of answers and playing it on desktop and phone. I haven’t run a study with attendees yet. Feedback from people planning to go is the most useful thing you could send.</p>
      </details>
      <details>
        <summary>Can the approach be reused for another event?</summary>
        <p>The structure can: the quiz, the hallways, the scoring and the reasons. The session data, characters and wording are specific to this conference, so a new event would need its own agenda and rewrites.</p>
      </details>
    </section>

    <section class="story" aria-labelledby="lessons-t">
      <h2 id="lessons-t">What marketers can take from it</h2>
      <ul>
        <li><strong>Start with the decision, not the feature list.</strong> Every part of the game exists to make one choice easier. Ask what the person is trying to decide before you design anything.</li>
        <li><strong>Limits can be the feature.</strong> Showing seven choices instead of seventeen didn’t reduce the value. It made the value easier to see.</li>
        <li><strong>Personalise without tracking.</strong> The game learns what you want from five questions and a few clicks, and keeps it on your device.</li>
        <li><strong>Reveal in layers.</strong> A hint on each door invites curiosity without giving the whole story away. Think about how much a reader needs before they choose.</li>
        <li><strong>Test by playing, not only by planning.</strong> The biggest changes came from watching what happened when someone actually used the game.</li>
        <li><strong>Keep your judgement in the loop.</strong> AI made building this possible in a few days. Knowing the audience, deciding what matters and noticing what feels wrong still came from the marketer.</li>
      </ul>
    </section>

    <section class="story" aria-labelledby="limits-t">
      <h2 id="limits-t">Limits and open questions</h2>
      <ul>
        <li><strong>The schedule is a snapshot.</strong> Times, speakers and rooms may change. Hubilo is the source of truth.</li>
        <li><strong>Hints and reasons are approximate.</strong> They come from short descriptions, so they can miss nuance.</li>
        <li><strong>Recommendations are a starting point.</strong> They’re built from simple rules, not from attendee outcomes.</li>
        <li><strong>English only, and it needs a modern browser.</strong> Keyboard use, phone layouts and reduced-motion settings were all considered, but not formally audited.</li>
      </ul>
      <p>If something here is unclear, or you find a session that’s mis-tagged, use the contact link below. Feedback makes the next version better.</p>
    </section>

    <div class="about-plan">
      <section><h2>How this works</h2>
        <ol>
          <li>Choose In person or Online. In person, pick the day you arrive.</li>
          <li>Answer five quick questions to find your character. <button class="linklike" data-page="characters">Meet all nine</button>.</li>
          <li>Each day is an act. When several sessions collide and it’s a close call, you get a hallway of doors with a hint on each. The door that glows suits your character best.</li>
          <li>Open a door to see what’s behind it, then keep it or close it. The clear winners are recommended for you, and you can swap or remove them at the end.</li>
          <li>At the end you get a draft of a potential agenda, weighted toward your goals and preferences. Check Hubilo for locations and updates.</li>
        </ol>
        <p class="subtle">Your choices save in this browser. Use Reset to retake the quiz, clear your door picks or start over.</p>
        <div class="actions"><button class="btn primary" data-go="edition">${state.edition ? "Continue your game" : "Play"}</button></div>
      </section>
      <section><h2>Official conference links</h2>
        <p>Agenda data last imported ${agendaSnapshot}. Use Hubilo for the latest schedule.</p>
        ${conferenceResources}
      </section>
    </div>
    <section class="creator-profile" aria-labelledby="creator-name">
      <img src="assets/cassidy.webp" alt="Ink illustration of Cassidy Trowbridge" width="200" height="200" loading="lazy">
      <div><h2 id="creator-name">Cassidy Trowbridge</h2>
        <p>I’m a cybersecurity marketer and Head of Insights and Growth at CyberSynapse. I’ve led in-house marketing for security service providers and advised early-stage cybersecurity companies. I vibe coded this because I was inspired by <a href="https://www.cybermarketingconference.com/2026-cybermarketingcon-theme" target="_blank" rel="noopener">this year’s theme, Create Your Own Adventure</a>.</p>
      </div>
    </section>
    <section class="creator-links"><h2>Cassidy’s Links</h2>
      <ul class="resource-list">${creatorLinks.map(([logo, url, label, description]) => `<li>
        <a href="${url}" target="_blank" rel="noopener"><img src="assets/${logo}" alt="" width="34" height="34" loading="lazy"><span>${label}</span></a>
        <p>${description}</p>
      </li>`).join("")}</ul>
    </section>
  </article>`;
}
function privacyScreen(){
  return `<article class="page reading" aria-labelledby="t">
    <header><h1 id="t" tabindex="-1">Privacy Policy</h1>
    <p class="lede">This policy explains how Choose Your Own CMC, an independent conference game by Cassidy Trowbridge, handles information.</p></header>
    <h2>What the game saves</h2>
    <p>The game uses your browser’s local storage to remember how you’re attending, your quiz answers, your door picks and your progress, so you can resume on the same browser. This information stays on your device. The game has no account form or payment form.</p>
    <h2>Copying your agenda</h2>
    <p>Copying the agenda puts it on your device’s clipboard. Anyone you share it with can see the sessions it lists.</p>
    <h2>Hosting and external services</h2>
    <p>GitHub hosts this site through GitHub Pages and may log technical information, such as your IP address, to deliver and protect it. The site loads fonts from Google Fonts, which means your browser connects to Google to request them. The game has no analytics or tracking scripts.</p>
    <ul><li><a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">GitHub Privacy Statement</a></li>
    <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</a></li></ul>
    <p>If you follow a link to another website, that website’s privacy policy applies.</p>
    <h2>Your choices</h2>
    <p>Saved game data remains in your browser until you use <strong>Reset</strong>, clear this site’s browser data, or your browser removes it. For privacy questions or to report a correction, ${contact}.</p>
  </article>`;
}
function termsScreen(){
  return `<article class="page reading" aria-labelledby="t">
    <header><h1 id="t" tabindex="-1">Terms of Service</h1>
    <p class="lede">Choose Your Own CMC is a free, independent game by Cassidy Trowbridge for building a personal CyberMarketingCon agenda.</p></header>
    <h2>Planning and attendance</h2>
    <p>Use the game to organize your own schedule. A pick is a personal reminder. Registration, admission, capacity, and session access are handled by the conference organizers.</p>
    <h2>Schedule accuracy</h2>
    <p>The game uses a dated agenda snapshot and is provided as available. Session times, speakers, and availability may change. Confirm details with the <a href="${virtualPro}" target="_blank" rel="noopener">official event app on Hubilo</a> before relying on your agenda.</p>
    <h2>Conference materials and links</h2>
    <p>Conference names, trademarks, and materials belong to their respective rights holders. These terms cover this game. The conference website, Hubilo, and other external services have their own terms.</p>
    <h2>Changes and questions</h2>
    <p>The game may be updated or taken offline. These terms do not limit rights you have under applicable law. For questions or to report an issue, ${contact}.</p>
    <p><button class="btn quiet small" data-page="privacy">Read the Privacy Policy</button></p>
  </article>`;
}

/* ---------- Events ---------- */

app.addEventListener("click", ev => {
  const t = ev.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (d.go === "edition") return go(state.edition && state.answers.length >= QUIZ.length ? (isFinished() || state.step > 0 || state.picks.length ? "doors" : "character") : state.edition ? "quiz" : "edition");
  if (d.go) return go(d.go);
  if (d.edition) {
    if (state.edition !== d.edition) state = {...fresh(), edition: d.edition, answers: state.answers.slice(0, 0)};
    save(); render(false);
    app.querySelector(`[data-edition="${d.edition}"]`)?.focus();
    return;
  }
  if ("continue" in d) return go(state.answers.length >= QUIZ.length ? "character" : "quiz");
  if ("toggleSunday" in d) {
    state.sunday = !attendsSunday(); state.open = null; save(); render(false);
    app.querySelector("[data-toggle-sunday]")?.focus();
    announce.textContent = attendsSunday() ? "Sunday added." : "Sunday skipped.";
    return;
  }
  if (d.answer !== undefined) {
    state.answers = [...state.answers.slice(0, Math.min(state.answers.length, QUIZ.length - 1)), Number(d.answer)];
    state.open = null;
    const done = state.answers.length >= QUIZ.length;
    if (done) state.tracks = suggestedTracks();
    save();
    return go(done ? "character" : "quiz");
  }
  if ("toggleSummit" in d) {
    state.tracks = myTracks().length ? [] : suggestedTracks();
    state.open = null; save();
    render(false);
    app.querySelector("[data-toggle-summit]")?.focus();
    announce.textContent = state.tracks.length ? "Summit track rejoined." : "Summit track skipped.";
    return;
  }
  if ("backQuiz" in d) {
    if (!state.answers.length) return go("edition");
    state.answers.pop(); save(); return render();
  }
  if ("retake" in d) { resetCharacter(); return go("quiz"); }
  if (d.door) {
    state.open = d.door; save(); render();
    announce.textContent = `Door opened: ${byId[d.door].title}`;
    return;
  }
  if ("close" in d) {
    const id = state.open; state.open = null; save(); render(false);
    app.querySelector(`[data-door="${CSS.escape(id)}"]`)?.focus();
    return;
  }
  if (d.keep && state.swap) {
    quest();
    const slot = questCache.called.find(c => c.key === state.swap);
    state.picks = state.picks.filter(id => !inSlot(id, slot)).concat(d.keep);
    state.dropped = state.dropped.filter(id => id !== d.keep);
    state.open = null; state.swap = null; save();
    feedback = ""; announce.textContent = `Swapped in ${byId[d.keep].title}.`;
    return render();
  }
  if (d.swap) { state.swap = d.swap; state.open = null; save(); return go("doors"); }
  if ("swapCancel" in d) { state.swap = null; state.open = null; save(); return go("doors"); }
  if (d.keep) {
    const slot = quest()[state.step];
    state.picks = state.picks.filter(id => !inSlot(id, slot)).concat(d.keep);
    state.open = null; state.step++; save();
    feedback = `Kept “${byId[d.keep].title}”.`;
    announce.textContent = feedback;
    return render();
  }
  if ("skip" in d) {
    const slot = quest()[state.step];
    state.picks = state.picks.filter(id => !inSlot(id, slot));   // skipping means no session here
    state.open = null; state.step++; save(); feedback = "Skipped. Enjoy the breather."; return render();
  }
  if ("prev" in d) {
    const slots = quest();
    feedback = "";
    state.open = null;
    do { state.step--; } while (state.step > 0 && state.skipped.includes(slots[state.step].key) && passReason(slots[state.step]));
    state.skipped = state.skipped.filter(k => k !== slots[state.step].key);
    // Show what you kept here (if anything) so you can keep it or swap it.
    state.open = state.picks.find(id => slots[state.step].doors.some(x => x.id === id)) || null;
    if (!state.open && state.picks.some(id => inSlot(id, slots[state.step]))) feedback = `Your pick here: “${byId[state.picks.find(id => inSlot(id, slots[state.step]))].title}”. Keep a door to replace it.`;
    save(); return render();
  }
  if ("copy" in d) return copyAgenda();
  if (d.page) return go(d.page);
  if ("replay" in d) { resetRun(); save(); return go("doors"); }

  if (d.nav) return go(d.nav);
  if (d.remove) {
    const id = d.remove;
    state.picks = state.picks.filter(x => x !== id);
    state.extras = (state.extras || []).filter(x => x !== id);
    if (questCache?.autos.includes(id) || questCache?.easy.includes(id) || questCache?.called.some(c => c.doors.some(x => x.id === id))) state.dropped = [...new Set([...state.dropped, id])];
    save(); render(false); announce.textContent = `Removed ${byId[id].title}.`; app.querySelector("#t")?.focus({preventScroll: true}); return;
  }
});

app.addEventListener("change", ev => {
  if (ev.target.id !== "arrival") return;
  state.sunday = ev.target.value === "yes"; save();
  announce.textContent = state.sunday ? "Sunday included." : "Sunday skipped.";
});
document.querySelector("#home").addEventListener("click", ev => { ev.preventDefault(); go("cover"); });
function resetCharacter(){
  state.answers = []; state.tracks = []; state.open = null; save();
}
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-page]");
  if (b && !app.contains(b)) go(b.dataset.page);
});
navBar.addEventListener("click", ev => { const b = ev.target.closest("[data-nav]"); if (b) go(b.dataset.nav === "results" ? "doors" : b.dataset.nav); });
const restartDialog = document.querySelector("#restart-dialog");
restartButton.addEventListener("click", () => {
  restartDialog.querySelector('[value="doors"]').disabled = !(state.picks.length || (state.extras || []).length || state.dropped.length || state.step);
  restartDialog.querySelector('[value="character"]').disabled = !state.answers.length;
  restartDialog.showModal();
});
restartDialog.addEventListener("close", () => {
  const choice = restartDialog.returnValue;
  restartDialog.returnValue = "";
  if (choice === "character") { resetCharacter(); go("quiz"); announce.textContent = "Character cleared. Your door picks are kept."; }
  if (choice === "doors") { resetRun(); save(); go(state.answers.length >= QUIZ.length ? "doors" : "quiz"); announce.textContent = "Door picks cleared. Your character is kept."; }
  if (choice === "all") { state = fresh(); save(); go("cover"); announce.textContent = "New game started."; }
});

render(false);
