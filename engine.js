// EquiStories Shows — scoring engine v2 (no DOM)
//
// Two ideas do the anti-bias work here:
//   1. A judge never types a number. They pick a band with a written descriptor,
//      or tick a box. Vague "quality" has nowhere to hide.
//   2. Criteria are aggregated across judges by MEDIAN, not mean, so a single
//      inflating friend (or a single rival) cannot move the result.
//
// Neither fixes a captured panel. Only blind judging does. See blindOrder().

const DISCIPLINES = {
  "Fox Hunting":                 {stats:["boldness","stamina","harmony"],  mode:"scored"},
  "Hunter O/F & U/S":            {stats:["balance","gaits","harmony"],     mode:"scored"},
  "Handy Hunter / Hunter Derby": {stats:["handiness","scope","balance"],   mode:"scored"},
  "Equitation Flat & O/F":       {stats:["harmony","balance","gaits"],     mode:"scored"},
  "Dressage":                    {stats:["balance","gaits","strength"],    mode:"scored", ranking:"percent"},
  "Show Jumping":                {stats:["boldness","scope","handiness"],  mode:"scored"},
  "Cross Country":               {stats:["stamina","boldness","speed"],    mode:"scored"},
  "Conformation / Liberty":      {stats:["gaits","harmony","balance"],     mode:"scored"},
  "Western Pleasure":            {stats:["harmony","balance","gaits"],     mode:"scored"},
  "Reining":                     {stats:["balance","gaits","strength"],    mode:"scored"},
  "Cutting":                     {stats:["harmony","boldness","handiness"],mode:"scored"},
  "Racing":                      {stats:["speed","stamina","balance"],     mode:"timed"},
  "Steeplechase":                {stats:["speed","stamina","strength"],    mode:"timed"},
};

const RACE_TYPES = {
  "5f Sprint":[55,10], "7f Sprint":[75,10], "1 Mile":[90,20],
  "1.25 Miles":[110,20], "1.5 Miles":[130,20], "Steeplechase":[140,20],
};

const DEFAULT_TIERS = [{min:20,pts:10},{min:15,pts:8},{min:11,pts:5},{min:0,pts:0}];

// The community mailbox, baked in so hosts never paste it and it stays out of the
// invite link. NOT a secret — it lives in the page source and is meant to be public
// (deployed "Anyone"); it's a write-only drop box, so exposure costs nothing.
const DEFAULT_MAILBOX = "https://script.google.com/macros/s/AKfycbxJDhhM0OaHB8-BvHuGLs0XByWnYIiuMLqzRkAVo50TBg4sfazthu25QdoqwCBKUSFM/exec";

/* ---------------- deterministic RNG ---------------- */
function cyrb53(str, seed=0){
  let h1=0xdeadbeef^seed, h2=0x41c6ce57^seed;
  for(let i=0;i<str.length;i++){
    const ch=str.charCodeAt(i);
    h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677);
  }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return 4294967296*(2097151&h2)+(h1>>>0);
}
function mulberry32(a){
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
function raceSeed(show, entries){
  const ids = entries.map(e=>e.id).slice().sort().join(",");
  return cyrb53(show.id + "|" + ids + "|" + show.closesAt);
}

// Judging order is shuffled and stable. Position in the list carries no
// information about who entered when, and it doesn't change between sessions.
function blindOrder(show, entries){
  const rng = mulberry32(cyrb53(show.id + "|blind"));
  return entries
    .slice().sort((a,b)=> a.id<b.id ? -1 : a.id>b.id ? 1 : 0)  // canonical order first,
    .map(e=>({e, k:rng()}))                                     // so keys are stable
    .sort((a,b)=> a.k-b.k)
    .map(({e},i)=> ({...e, blindNo:i+1}));
}

/* ---------------- the art rubric ---------------- */
// Bands are written, not numeric. A judge chooses a description.
// Craft is one criterion of five: raw drawing skill is 20% of the art score.
const ART_RUBRIC = [
  { key:"required", label:"Required elements", max:10, kind:"checklist",
    help:"Objective. Present or absent. No skill required to score full marks.",
    items:[
      {key:"horse",   label:"The entered horse is depicted",       pts:2},
      {key:"disc",    label:"The discipline is being performed",   pts:2},
      {key:"setting", label:"The setting matches the show",        pts:2},
      {key:"tack",    label:"Tack and turnout suit the discipline",pts:2},
      {key:"rider",   label:"Rider or handler present (if required)", pts:2},
    ]},

  { key:"accuracy", label:"Discipline accuracy", max:10, kind:"anchored",
    help:"Knowledge of the sport, not drawing ability.",
    bands:[
      {pts:0,  label:"Absent",      desc:"The discipline isn't depicted at all."},
      {pts:3,  label:"Attempted",   desc:"Named but contradicted — wrong tack, an impossible gait, the wrong kind of obstacle."},
      {pts:5,  label:"Meets",       desc:"Recognisably this sport. Tack and movement broadly correct."},
      {pts:8,  label:"Strong",      desc:"Correct tack, and a moment that could only come from this discipline."},
      {pts:10, label:"Exceptional", desc:"A knowledgeable viewer could name the phase or movement with no caption."},
    ]},

  { key:"story", label:"Storytelling & atmosphere", max:10, kind:"anchored",
    help:"Does the scene say where, when, and what is happening?",
    bands:[
      {pts:0,  label:"Absent",      desc:"No setting. The horse floats on blank ground."},
      {pts:3,  label:"Generic",     desc:"A setting exists but could be anywhere, any season."},
      {pts:5,  label:"Legible",     desc:"Time, weather and place are clear."},
      {pts:8,  label:"Acting on the subject", desc:"The environment affects the horse — light, footing, cold, wind."},
      {pts:10, label:"Before and after", desc:"Something is happening, not being posed. The moment implies what came before it."},
    ]},

  { key:"composition", label:"Composition & readability", max:10, kind:"anchored",
    help:"Staging is a choice, not a talent. A simple drawing can score 10 here.",
    bands:[
      {pts:0,  label:"Unreadable", desc:"No discernible focal point."},
      {pts:3,  label:"Default",    desc:"Subject centred by habit; elements compete for attention."},
      {pts:5,  label:"Clear",      desc:"The eye lands where it was meant to."},
      {pts:8,  label:"Deliberate", desc:"Framing, negative space or leading lines move the eye on purpose."},
      {pts:10, label:"Carries the story", desc:"The composition itself does narrative work."},
    ]},

  { key:"craft", label:"Craft & finish", max:10, kind:"anchored",
    help:"The only criterion that rewards raw execution. Worth 20% of the art score.",
    bands:[
      {pts:0,  label:"Unfinished", desc:"Placeholder or abandoned."},
      {pts:3,  label:"Loose",      desc:"Forms read; proportions wander."},
      {pts:5,  label:"Finished",   desc:"Clean linework or paint. Anatomy broadly correct."},
      {pts:8,  label:"Confident",  desc:"Sound anatomy, consistent light source."},
      {pts:10, label:"Controlled", desc:"Command of edge, value and gesture throughout."},
    ]},
];

const RUBRIC_PRESETS = {
  "Brief-weighted (recommended)": ART_RUBRIC,
  "Craft-weighted": ART_RUBRIC.map(c => c.key==="craft" ? {...c, max:20, bands:c.bands.map(b=>({...b,pts:b.pts*2}))} : c),
  "Requirements only": [ART_RUBRIC[0]],
};

/* ---------------- stats ---------------- */
const statsFor = (e,show)=> show.statSource==="effective" ? e.effectiveStats : e.baseStats;

function statTierPoints(v, tiers=DEFAULT_TIERS){
  for(const t of tiers){ if(v >= t.min) return t.pts; }
  return 0;
}
function statScore(entry, show){
  const src = statsFor(entry, show);
  return DISCIPLINES[show.discipline].stats
    .reduce((n,s)=> n + statTierPoints(src[s]||0, show.statTiers||DEFAULT_TIERS), 0);
}

/* ---------------- aggregation across judges ---------------- */
function median(list){
  if(!list.length) return 0;
  const s = [...list].sort((a,b)=>a-b), m = s.length>>1;
  return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
}

// A judge who owns the horse cannot score it. Their card is skipped, not zeroed.
const conflicted = (judge, entry) => (judge.owns||[]).includes(entry.id);

function criterionScore(entry, crit, judges){
  const vals = judges
    .filter(j => !conflicted(j, entry))
    .map(j => entry.scores?.[j.id]?.[crit.key])
    .filter(v => typeof v === "number");
  return median(vals);
}

// Judges who were allowed to score this entry and actually did.
function judgeCoverage(entry, judges){
  const eligible = judges.filter(j=>!conflicted(j,entry));
  const scored = eligible.filter(j => entry.scores?.[j.id] && Object.keys(entry.scores[j.id]).length);
  return { eligible:eligible.length, scored:scored.length };
}

function judgedScore(entry, show){
  const judges = show.judges?.length ? show.judges : [{id:"host", name:"Host", owns:[]}];
  return (show.criteria||[]).reduce((n,c)=> n + criterionScore(entry, c, judges), 0);
}

/* ---------------- scored shows ---------------- */
function scoreEntry(entry, show){
  const ss = statScore(entry, show);
  const judged = judgedScore(entry, show);
  const earned = ss + judged;
  if(show.ranking === "percent"){
    const possible = DISCIPLINES[show.discipline].stats.length*10
                   + (show.criteria||[]).reduce((n,c)=> n+Number(c.max||0), 0);
    return { statScore:ss, judged:+judged.toFixed(2), total:+((earned/(possible||1))*100).toFixed(3) };
  }
  return { statScore:ss, judged:+judged.toFixed(2), total:+earned.toFixed(2) };
}

function rankScored(show, entries){
  const sorted = entries.map(e=>({...e, ...scoreEntry(e,show)}))
    .sort((a,b)=> b.total-a.total || a.name.localeCompare(b.name));
  let placement = 0;
  return sorted.map((e,i)=>{
    if(i===0 || e.total !== sorted[i-1].total) placement = i+1;
    return {...e, placement};
  });
}

/* ---------------- timed shows ---------------- */
function runRace(show, entries){
  const [min, spread] = RACE_TYPES[show.raceType];
  const stats = DISCIPLINES[show.discipline].stats;
  const ceil = show.statCeil ?? 20;
  const rng = mulberry32(raceSeed(show, entries));
  return entries
    .slice().sort((a,b)=> a.id<b.id ? -1 : a.id>b.id ? 1 : 0)
    .map(e=>{
      const src = statsFor(e, show);
      const bonus = stats.reduce((n,s)=> n + Math.min(src[s]||0, ceil), 0) * 0.2;
      return {...e, bonus:+bonus.toFixed(3), finalSec:+(min + rng()*spread - bonus).toFixed(3)};
    })
    .sort((a,b)=> a.finalSec-b.finalSec)
    .map((e,i)=>({...e, placement:i+1}));
}

function clock(sec){
  const m=Math.floor(sec/60), s=sec-m*60;
  return m + ":" + s.toFixed(3).padStart(6,"0");
}

function runShow(show, entries){
  return DISCIPLINES[show.discipline].mode === "timed"
    ? {mode:"timed", seed:raceSeed(show,entries), results:runRace(show,entries)}
    : {mode:"scored", results:rankScored(show,entries)};
}

/* ---------------- sharing: shows travel as links, entries come back as codes ----------------

   A show is encoded into a url fragment. An entrant opens it, attaches their horse
   and art, and gets back a short code to send the host.

   The code deliberately carries NO STATS. It carries the horse's link. The host's app
   fetches the stats from that horse's own stable, so an entrant cannot inflate their
   own numbers by editing the code. What the entrant's browser *saw* is recorded as a
   fingerprint, so if the horse trains between entering and judging, the host is told.

   These are exactly the rows a backend would store. Swapping paste-a-code for POST
   changes the transport and nothing else.
------------------------------------------------------------------------------------------- */

function b64encode(obj){
  const json = JSON.stringify(obj);
  const bytes = typeof TextEncoder!=="undefined"
    ? new TextEncoder().encode(json)
    : Buffer.from(json,"utf8");
  let bin=""; for(const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa!=="undefined" ? btoa(bin) : Buffer.from(json,"utf8").toString("base64");
  return b64.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function b64decode(str){
  const b64 = str.replace(/-/g,"+").replace(/_/g,"/");
  if(typeof atob!=="undefined"){
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c=>c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  return JSON.parse(Buffer.from(b64,"base64").toString("utf8"));
}

// Only the fields a show needs to be re-created. Presets live in code, so we send a name.
function encodeShow(show){
  return b64encode({
    v:1, i:show.id, t:show.title, d:show.discipline, c:show.closesAt,
    s:show.statSource, l:show.statCeil, r:show.raceType, b:show.blind ? 1 : 0,
    p:show.preset, m:(show.mailbox && show.mailbox !== DEFAULT_MAILBOX) ? show.mailbox : undefined,
    x: RUBRIC_PRESETS[show.preset] === show.criteria ? undefined : show.criteria,
  });
}
function decodeShow(code){
  const d = b64decode(code);
  if(d.v !== 1) throw new Error("This invite was made by a different version of Shows.");
  const preset = d.p in RUBRIC_PRESETS ? d.p : Object.keys(RUBRIC_PRESETS)[0];
  const show = {
    id:d.i, title:d.t, discipline:d.d, closesAt:d.c,
    statSource:d.s, statCeil:d.l, raceType:d.r, blind:!!d.b,
    preset, criteria: d.x || RUBRIC_PRESETS[preset],
    mailbox: d.m || DEFAULT_MAILBOX,
    judges:[{id:"j_host", name:"Host", owns:[]}],
  };
  show.ranking = DISCIPLINES[show.discipline]?.ranking || "sum";
  return show;
}

// A short, order-independent signature of the stats this show actually scores.
function statsFingerprint(stats, discipline){
  const keys = DISCIPLINES[discipline].stats;
  return cyrb53(keys.map(k=> k+":"+(stats[k]||0)).join("|"));
}

function encodeEntry(show, {horseId, stable, artUrl, litUrl, litWords, seenStats}){
  return b64encode({
    v:1, s:show.id, h:horseId, u:stable,
    a:artUrl||"", w:litUrl||"", c:Number(litWords)||0,
    t:new Date().toISOString(),
    k: seenStats ? statsFingerprint(seenStats, show.discipline) : null,
  });
}
function decodeEntry(code, show){
  const d = b64decode(code.trim());
  if(d.v !== 1) throw new Error("This entry code was made by a different version of Shows.");
  if(show && d.s !== show.id) throw new Error("That code is for a different show.");
  return {showId:d.s, horseId:d.h, stable:d.u, artUrl:d.a, litUrl:d.w,
          litWords:d.c, submittedAt:d.t, seenFingerprint:d.k};
}

// Did the horse change between entering and judging?
function entryTampered(entry, decoded, show){
  if(decoded.seenFingerprint == null) return false;
  return statsFingerprint(entry.baseStats, show.discipline) !== decoded.seenFingerprint;
}

/* ---------------- evidence ---------------- */
function trainingEvidence(horse, stats){
  return (horse.artLog||[])
    .filter(e=> e.statsDelta && stats.some(s=> e.statsDelta[s]))
    .map(e=>({
      label: e.label || "Training entry",
      link:  e.link || e.image || null,
      raised: stats.filter(s=> e.statsDelta[s]).map(s=> s + " +" + e.statsDelta[s])
    }));
}

if(typeof module !== "undefined") module.exports = {
  DISCIPLINES, RACE_TYPES, DEFAULT_TIERS, DEFAULT_MAILBOX, ART_RUBRIC, RUBRIC_PRESETS,
  cyrb53, mulberry32, raceSeed, blindOrder, median, conflicted,
  criterionScore, judgeCoverage, judgedScore,
  b64encode, b64decode, encodeShow, decodeShow, encodeEntry, decodeEntry,
  statsFingerprint, entryTampered,
  statTierPoints, statScore, scoreEntry, rankScored, runRace, clock,
  runShow, trainingEvidence
};
