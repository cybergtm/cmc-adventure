// Character quiz. Each option is [label, subtitle, session weights, character votes].
// Session weights steer which doors you see; character votes decide who you are.
// Your badge casts 3 votes, and the other answers cast 1–2, so they can outvote it.

export const QUIZ = [
  {q: "Check your badge. What does it say under your name?", options: [
    ["Product marketing or content", "Positioning, launches, research", {PR:4}, {lore:3}],
    ["Demand gen or MOps", "Pipeline, campaigns, attribution", {DG:4}, {pipeline:3}],
    ["Brand, comms or social", "Story, voice, PR, creators", {BR:4}, {spotlight:3}],
    ["Field, events or partners", "Booths, channel, alliances", {FI:4}, {road:3}],
    ["Community or customer marketing", "Advocates, members, feedback", {CO:4, NW:1}, {guild:3}],
    ["Marketing leader or CMO", "Team, budget, board slides", {GT:3}, {strategist:3}],
    ["Founder, CEO or investor", "Building the company itself", {GT:2}, {founder:3}],
    ["Public sector or GovCon", "Federal, regulated, critical infrastructure", {GT:2}, {federal:3}]
  ]},
  {q: "Your boss texts: “So what did you learn?” You want to reply with…", options: [
    ["A tactic I can ship Monday", "Practical, hands-on, specific", {Workshop:2, DG:1}, {pipeline:1, road:1}],
    ["A story that made the whole room laugh", "Memorable beats comprehensive", {BR:1, Social:2, NW:1}, {spotlight:2}],
    ["A market insight nobody else has", "Analysts, research, buyer data", {GT:1, PR:1, kw:"research"}, {strategist:1, lore:1}],
    ["Three new names in my phone", "The hallway track is the conference", {Networking:3, MX:2}, {connector:2}]
  ]},
  {q: "Pick your conference energy.", options: [
    ["Front row, notebook open", "Keynotes and talks", {Talk:2, Keynote:1}, {lore:1, strategist:1}],
    ["Laptop open, hands on keyboard", "Workshops and roundtables", {Workshop:3}, {pipeline:1, founder:1}],
    ["Hallway track forever", "Mixers and meetups", {Networking:3, MX:1}, {connector:2}],
    ["A little of everything", "Keep me guessing", {Talk:1, Workshop:1, Networking:1}, {road:1, guild:1}]
  ]},
  {q: "Choose a side quest.", options: [
    ["Make AI actually useful", "Agents, Claude, GPTs, AI search", {kw:"ai"}, {pipeline:1, founder:1}],
    ["Decode what buyers really want", "CISOs, buying journeys, win/loss", {kw:"buyer"}, {lore:1, federal:1}],
    ["Get famous (or at least followed)", "Influencers, creators, personal brand", {kw:"social", BR:1}, {spotlight:2}],
    ["Win over sales and partners", "Enablement, channel, pipeline", {kw:"sales", FI:1}, {road:2}]
  ]},
  {q: "It’s 7 PM. Where are you?", options: [
    ["Wherever the party is", "Receptions, outings, karaoke", {evening:4, Social:1}, {connector:1, spotlight:1}],
    ["Somewhere low-key", "A movie or mocktails sounds right", {evening:2}, {guild:1}],
    ["Room service and recharge", "Tomorrow-me will thank me", {evening:-8}, {federal:1}]
  ]}
];

// [name, tagline, what draws them in, how you become one]
export const CHARACTERS = {
  lore: ["The Lore Keeper", "You turn dense products into stories buyers believe.", "Drawn to positioning, messaging, research and anything that makes a complicated product click.", "Starts with a product marketing or content badge."],
  pipeline: ["The Pipeline Whisperer", "You hear signal in the noise and follow it to revenue.", "Drawn to demand gen, campaigns, attribution and whatever the data says is working.", "Starts with a demand gen or MOps badge."],
  spotlight: ["The Spotlight Thief", "People notice your brand, and you’re here for the next trick.", "Drawn to brand, PR, social, creators and the talks everyone quotes afterward.", "Starts with a brand, comms or social badge. Can also be earned by chasing laughs, fame and a good party."],
  road: ["The Road Warrior", "Booths, partners, field events. You’ve packed this suitcase before.", "Drawn to events, channel, alliances and what actually pays off on the show floor.", "Starts with a field, events or partners badge. Can also be earned by siding with sales and partners."],
  guild: ["The Guild Builder", "You know the best marketing is a community that talks for you.", "Drawn to community, customer marketing, advocacy and the people behind the logos.", "Starts with a community or customer marketing badge."],
  strategist: ["The Strategist", "You came for the big picture and the people who draw it.", "Drawn to leadership, GTM strategy and how the best teams run. Joins the CyberCMO Summit in person.", "Starts with a marketing leader or CMO badge."],
  founder: ["The Founder in Disguise", "Building the company and the category at the same time.", "Drawn to go-to-market, fundraising and founder stories. Joins the Cyber CEO, VC & Founder Summit in person.", "Starts with a founder, CEO or investor badge."],
  federal: ["The Federal Agent", "Fluent in compliance, procurement and patience.", "Drawn to public sector, regulated industries and the long game. Joins the GovCon track in person.", "Starts with a public sector or GovCon badge."],
  connector: ["The Connector", "You collect people, not swag.", "Drawn to mixers, meetups and the hallway track. The sessions are a bonus.", "The hidden character. No badge unlocks it: you have to play like the hallway is the conference."]
};

// Session-matching weights (categories, formats, keywords, evening preference).
export function profileFrom(answers){
  const p = {kw: []};
  answers.forEach((a, i) => {
    const w = QUIZ[i]?.options[a]?.[2];
    if (!w) return;
    for (const [k, v] of Object.entries(w)) {
      if (k === "kw") p.kw.push(v);
      else p[k] = (p[k] || 0) + v;
    }
  });
  return p;
}

export function characterFor(answers){
  const votes = Object.fromEntries(Object.keys(CHARACTERS).map(k => [k, 0]));
  answers.forEach((a, i) => {
    for (const [k, v] of Object.entries(QUIZ[i]?.options[a]?.[3] || {})) votes[k] += v;
  });
  const badge = Object.keys(QUIZ[0].options[answers[0]]?.[3] || {})[0];
  const best = Math.max(...Object.values(votes));
  // Ties go to your badge, then to the order above.
  const key = votes[badge] === best ? badge : Object.keys(votes).find(k => votes[k] === best);
  const [name, line] = CHARACTERS[key];
  const raw = {
    Strategy: votes.strategist + votes.founder + votes.federal,
    Story: votes.spotlight + votes.lore,
    Signal: votes.pipeline + votes.road,
    Social: votes.connector + votes.guild
  };
  const max = Math.max(1, ...Object.values(raw));
  const stats = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.max(1, Math.round(5 * v / max))]));
  return {key, name, line, stats};
}
