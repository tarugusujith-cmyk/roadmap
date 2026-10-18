// Generates db.json (the JSON Server database) with demo records.
// Run `npm run seed` to reset all data to the demo state.
import { writeFileSync } from 'node:fs';

const now = Date.now();
const iso = (daysAgo, hours = 0) => new Date(now - daysAgo * 864e5 - hours * 36e5).toISOString();
let s = 7;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const shuffle = (a) => a.map((v) => [rnd(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

const db = {
  users: [], workspaces: [], workspaceMembers: [], categories: [], tags: [], feedback: [], votes: [],
  comments: [], roadmapItems: [], releaseNotes: [], subscriptionPlans: [], workspaceSubscriptions: [], activityLogs: [],
};
const add = (k, o) => { const id = db[k].length + 1; db[k].push({ id, ...o }); return id; };
const logo = (letter, color) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="43" font-family="Arial" font-size="32" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`,
  );

// ---- Plans ----
db.subscriptionPlans.push(
  { id: 'free', name: 'Free', price: 0, description: 'For small teams getting started.', limits: { members: 5, feedback: 15, roadmapItems: 6 } },
  { id: 'pro', name: 'Pro', price: 49, description: 'For growing product teams.', limits: { members: 50, feedback: 1000, roadmapItems: 200 } },
);

// ---- Users (password for every demo account: demo123) ----
const people = [
  ['Aarav Mehta', 'owner@demo.com'], ['Neha Kapoor', 'admin@demo.com'], ['Rohan Iyer', 'pm@demo.com'],
  ['Sara Khan', 'customer@demo.com'], ['Kabir Singh', 'kabir@demo.com'], ['Meera Nair', 'meera@demo.com'],
  ['Vikram Rao', 'vikram@demo.com'], ['Ananya Das', 'ananya@demo.com'], ['Tom Becker', 'tom@demo.com'],
  ['Liam Ortiz', 'liam@demo.com'], ['Zoe Park', 'zoe@demo.com'],
];
people.forEach(([name, email]) => add('users', { name, email, password: 'demo123' }));
const uname = (id) => db.users[id - 1].name;

const workspaces = [
  {
    name: 'Northwind CRM', letter: 'N', color: '#4F46E5', publicRoadmap: true, plan: 'pro', age: 90,
    description: 'A CRM for small sales teams that want a clear pipeline without the admin overhead.',
    members: [[1, 'owner', 'active'], [2, 'admin', 'active'], [3, 'product_manager', 'active'], [4, 'customer', 'active'], [5, 'customer', 'active'], [6, 'customer', 'active'], [7, 'customer', 'active'], [8, 'customer', 'active'], [9, 'customer', 'active'], [10, 'customer', 'invited'], [11, 'customer', 'suspended']],
    cats: [['Reporting', '#4F46E5'], ['Integrations', '#0891B2'], ['Mobile', '#D97706'], ['Usability', '#059669'], ['Performance', '#DB2777']],
    tags: ['enterprise', 'quick-win', 'bug', 'api', 'design'],
    feedback: [
      { t: 'Scheduled weekly pipeline report', d: 'Let managers schedule a pipeline summary that lands in their inbox every Monday morning.', c: 0, tg: [0, 1], p: 'high', st: 'planned', u: 4, ago: 40, v: 9 },
      { t: 'Salesforce two-way sync', d: 'We keep contacts in both systems. A two-way sync would remove the manual imports we do every week.', c: 1, tg: [0, 3], p: 'critical', st: 'in_progress', u: 5, ago: 35, v: 8 },
      { t: 'Native iOS app', d: 'Reps need to log calls from the road. The mobile web experience is slow on cellular networks.', c: 2, tg: [0], p: 'high', st: 'under_review', u: 6, ago: 30, v: 7 },
      { t: 'Bulk edit deal owners', d: 'Reassigning twenty deals one by one is painful when someone leaves the team.', c: 3, tg: [1], p: 'medium', st: 'completed', u: 4, ago: 60, v: 6 },
      { t: 'Dashboard loads slowly with 50k contacts', d: 'The home dashboard takes close to eight seconds to render for our largest account.', c: 4, tg: [2], p: 'high', st: 'in_progress', u: 5, ago: 20, v: 6 },
      { t: 'Slack notifications for won deals', d: 'Post a message to a Slack channel when a deal moves to Closed Won.', c: 1, tg: [1, 3], p: 'medium', st: 'open', u: 6, ago: 18, v: 5 },
      { t: 'Dark mode', d: 'Late-night pipeline reviews would be easier on the eyes with a dark theme.', c: 3, tg: [1, 4], p: 'low', st: 'open', u: 4, ago: 15, v: 4 },
      { t: 'Email the pipeline report on a schedule', d: 'I want the pipeline report emailed automatically every week.', c: 0, tg: [], p: 'medium', st: 'open', u: 5, ago: 12, v: 0, dup: 0 },
      { t: 'Custom fields on contacts', d: 'We track contract renewal dates and need a place to store them on the contact record.', c: 3, tg: [0], p: 'high', st: 'planned', u: 6, ago: 25, v: 5 },
      { t: 'Mobile push reminders for follow-ups', d: 'Send a push notification when a follow-up task is due.', c: 2, tg: [1], p: 'medium', st: 'open', u: 4, ago: 9, v: 3 },
      { t: 'Duplicate contact detection', d: 'Warn me when I create a contact whose email already exists.', c: 3, tg: [2], p: 'medium', st: 'under_review', u: 5, ago: 8, v: 3 },
      { t: 'Export reports to PDF', d: 'Executives ask for a PDF version of the quarterly forecast report.', c: 0, tg: [1], p: 'low', st: 'open', u: 6, ago: 6, v: 2 },
      { t: 'Public API rate limits are too strict', d: 'Our nightly sync hits the rate limit after about 30 minutes.', c: 1, tg: [3], p: 'medium', st: 'closed', u: 4, ago: 5, v: 2 },
      { t: 'iPhone app please', d: 'Is there any plan to build an iPhone app? I would use it every day.', c: 2, tg: [], p: 'medium', st: 'open', u: 5, ago: 3, v: 0, dup: 2 },
    ],
    roadmap: [
      { t: 'Scheduled reports', d: 'Weekly and monthly pipeline reports delivered by email.', stage: 'planned', pub: true, fb: [0, 7] },
      { t: 'Salesforce sync', d: 'Two-way contact and deal sync with Salesforce.', stage: 'in_progress', pub: true, fb: [1] },
      { t: 'Dashboard performance overhaul', d: 'Faster dashboards for accounts with large contact lists.', stage: 'in_progress', pub: true, fb: [4] },
      { t: 'Bulk edit for deals', d: 'Select many deals and change owner, stage or close date at once.', stage: 'completed', pub: true, fb: [3] },
      { t: 'Mobile app research', d: 'Interviewing customers to decide between native and PWA.', stage: 'under_review', pub: true, fb: [2, 13] },
      { t: 'Custom contact fields', d: 'Add your own fields to contact records.', stage: 'planned', pub: false, fb: [8] },
    ],
    releases: [
      { v: '2.5.0', date: 10, summary: 'Draft notes for the upcoming dashboard performance work.', rm: [], st: 'draft' },
      { v: '2.4.0', date: 21, summary: 'Bulk edit for deals is here. Select multiple deals and update owner, stage or close date in one step.', rm: [3], st: 'published' },
      { v: '2.3.0', date: 70, summary: 'Improved CSV import with column mapping and better error messages.', rm: [], st: 'archived' },
    ],
    comments: [[0, 5, 'We would use this every Monday for our pipeline review.', 38], [0, 3, 'Thanks! We are looking at delivery formats now.', 36], [1, 4, 'This would save our ops team hours every week.', 33], [4, 6, 'Same here with around 80k contacts.', 18], [2, 4, 'PWA would be enough for us as long as push works.', 28], [5, 5, 'Would love a per-pipeline channel setting.', 16]],
  },
  {
    name: 'Lumen Notes', letter: 'L', color: '#0D9488', publicRoadmap: true, plan: 'free', age: 60,
    description: 'A calm notes app for people who think in Markdown.',
    members: [[1, 'owner', 'active'], [2, 'admin', 'active'], [3, 'product_manager', 'active'], [4, 'customer', 'active']],
    cats: [['Editor', '#0D9488'], ['Sync', '#2563EB'], ['Sharing', '#7C3AED'], ['Import/Export', '#EA580C']],
    tags: ['offline', 'markdown', 'teams', 'bug'],
    feedback: [
      { t: 'Offline mode for mobile', d: 'I lose access to my notes on flights. Please cache notebooks for offline use.', c: 1, tg: [0], p: 'high', st: 'planned', u: 4, ago: 33, v: 4 },
      { t: 'Markdown tables', d: 'Support pipe tables with a visual editor for rows and columns.', c: 0, tg: [1], p: 'medium', st: 'in_progress', u: 4, ago: 30, v: 3 },
      { t: 'Share notebooks with read-only links', d: 'Let me send a link to a notebook that others can read but not edit.', c: 2, tg: [2], p: 'high', st: 'open', u: 4, ago: 27, v: 4 },
      { t: 'Import from Evernote', d: 'Moving my 2,000 notes from Evernote by hand is not realistic.', c: 3, tg: [], p: 'medium', st: 'under_review', u: 3, ago: 24, v: 3 },
      { t: 'Sync conflicts overwrite my edits', d: 'Editing on phone and laptop at once silently drops changes.', c: 1, tg: [3], p: 'critical', st: 'in_progress', u: 4, ago: 21, v: 4 },
      { t: 'Slash commands', d: 'Type / to insert headings, lists, code blocks and tables.', c: 0, tg: [1], p: 'low', st: 'completed', u: 2, ago: 50, v: 3 },
      { t: 'Pin notes to the top', d: 'Keep the three notes I use daily at the top of the list.', c: 0, tg: [], p: 'low', st: 'open', u: 4, ago: 17, v: 2 },
      { t: 'Export a notebook as a ZIP of Markdown files', d: 'I want a plain-files backup that works with any editor.', c: 3, tg: [1], p: 'medium', st: 'open', u: 3, ago: 14, v: 2 },
      { t: 'Team workspaces with shared tags', d: 'Our team needs shared notebooks and a common tag list.', c: 2, tg: [2], p: 'medium', st: 'under_review', u: 4, ago: 12, v: 2 },
      { t: 'Web clipper for Firefox', d: 'The Chrome clipper is great. Please ship a Firefox version.', c: 3, tg: [], p: 'low', st: 'open', u: 4, ago: 9, v: 1 },
      { t: 'Version history', d: 'Let me restore an older version of a note after a bad edit.', c: 0, tg: [2], p: 'high', st: 'under_review', u: 3, ago: 7, v: 3 },
      { t: 'Offline reading on Android', d: 'Android users cannot open notes without a connection.', c: 1, tg: [0], p: 'medium', st: 'open', u: 4, ago: 4, v: 0, dup: 0 },
      { t: 'Comment threads on shared notes', d: 'Allow readers to leave comments on a shared note.', c: 2, tg: [2], p: 'medium', st: 'open', u: 4, ago: 2, v: 1 },
    ],
    roadmap: [
      { t: 'Offline mode', d: 'Cache notebooks on iOS and Android for offline reading and editing.', stage: 'planned', pub: true, fb: [0, 11] },
      { t: 'Markdown tables', d: 'Table syntax and a visual table editor.', stage: 'in_progress', pub: true, fb: [1] },
      { t: 'Sync conflict resolver', d: 'Merge edits made on two devices instead of overwriting.', stage: 'in_progress', pub: true, fb: [4] },
      { t: 'Slash commands', d: 'Quickly insert blocks by typing a slash.', stage: 'completed', pub: true, fb: [5] },
      { t: 'Version history', d: 'Browse and restore earlier versions of any note.', stage: 'under_review', pub: true, fb: [10] },
    ],
    releases: [
      { v: '1.9.0', date: 5, summary: 'Draft notes for tables and the sync conflict resolver.', rm: [], st: 'draft' },
      { v: '1.8.0', date: 30, summary: 'Slash commands make writing faster. Type / anywhere to insert headings, lists and code blocks.', rm: [3], st: 'published' },
    ],
    comments: [[0, 3, 'Offline mode is our top priority this quarter.', 30], [4, 4, 'Happened to me twice this week.', 20], [2, 2, 'We are scoping read-only links alongside permissions.', 25]],
  },
  {
    name: 'Harbor Analytics', letter: 'H', color: '#BE123C', publicRoadmap: false, plan: 'free', age: 30,
    description: 'Product analytics for maritime logistics teams.',
    members: [[1, 'owner', 'active'], [4, 'customer', 'active'], [5, 'customer', 'active']],
    cats: [['Dashboards', '#BE123C'], ['Data sources', '#2563EB']],
    tags: ['beta', 'api'],
    feedback: [
      { t: 'Live vessel position widget', d: 'Add a map widget that shows live vessel positions on dashboards.', c: 0, tg: [0], p: 'high', st: 'planned', u: 4, ago: 12, v: 3 },
      { t: 'Connect to PostgreSQL', d: 'We store port call data in Postgres and want to query it directly.', c: 1, tg: [1], p: 'high', st: 'open', u: 5, ago: 10, v: 3 },
      { t: 'Scheduled dashboard snapshots', d: 'Send a PDF snapshot of a dashboard every morning.', c: 0, tg: [], p: 'medium', st: 'open', u: 4, ago: 6, v: 2 },
      { t: 'Row level permissions', d: 'Limit what each customer can see in shared dashboards.', c: 1, tg: [0], p: 'medium', st: 'under_review', u: 5, ago: 4, v: 2 },
      { t: 'Custom colour themes', d: 'Match charts to our corporate palette.', c: 0, tg: [], p: 'low', st: 'open', u: 4, ago: 2, v: 1 },
    ],
    roadmap: [
      { t: 'Live vessel map', d: 'Real-time vessel positions in dashboards.', stage: 'planned', pub: false, fb: [0] },
      { t: 'Postgres connector', d: 'Query Postgres databases directly.', stage: 'under_review', pub: false, fb: [1] },
    ],
    releases: [{ v: '0.3.0', date: 14, summary: 'Initial beta of shareable dashboards.', rm: [], st: 'published' }],
    comments: [[0, 5, 'Would help our dispatchers a lot.', 9]],
  },
];

for (const w of workspaces) {
  const wid = add('workspaces', { name: w.name, description: w.description, logoUrl: logo(w.letter, w.color), brandColor: w.color, publicRoadmap: w.publicRoadmap, ownerId: 1, createdAt: iso(w.age) });
  w.members.forEach(([userId, role, status], i) => add('workspaceMembers', { workspaceId: wid, userId, role, status, joinedAt: iso(w.age - i) }));
  add('workspaceSubscriptions', { workspaceId: wid, planId: w.plan, startedAt: iso(w.age) });
  const catIds = w.cats.map(([name, color]) => add('categories', { workspaceId: wid, name, color }));
  const tagIds = w.tags.map((name) => add('tags', { workspaceId: wid, name }));
  const active = w.members.filter((m) => m[2] === 'active').map((m) => m[0]);
  const fbIds = [];
  w.feedback.forEach((f) => {
    const id = add('feedback', {
      workspaceId: wid, title: f.t, description: f.d, categoryId: catIds[f.c], submitterId: f.u, tagIds: f.tg.map((x) => tagIds[x]),
      priority: f.p, status: f.st, duplicateOf: f.dup !== undefined ? fbIds[f.dup] : null, createdAt: iso(f.ago), updatedAt: iso(f.ago),
    });
    fbIds.push(id);
    shuffle(active).slice(0, Math.min(f.v, active.length)).forEach((userId, k) => add('votes', { workspaceId: wid, feedbackId: id, userId, createdAt: iso(Math.max(f.ago - k, 0)) }));
    add('activityLogs', { workspaceId: wid, userId: f.u, message: `${uname(f.u)} submitted feedback "${f.t}"`, createdAt: iso(f.ago) });
  });
  w.comments.forEach(([fi, userId, body, ago]) => add('comments', { workspaceId: wid, feedbackId: fbIds[fi], userId, body, createdAt: iso(ago) }));
  const rmIds = w.roadmap.map((r, i) => {
    const id = add('roadmapItems', { workspaceId: wid, title: r.t, description: r.d, stage: r.stage, published: r.pub, feedbackIds: r.fb.map((x) => fbIds[x]), createdAt: iso(w.age - 5 - i), updatedAt: iso(5 + i) });
    add('activityLogs', { workspaceId: wid, userId: 1, message: `Roadmap item "${r.t}" is ${r.stage.replace('_', ' ')}`, createdAt: iso(4 + i) });
    return id;
  });
  w.releases.forEach((r) => {
    add('releaseNotes', { workspaceId: wid, version: r.v, releaseDate: iso(r.date).slice(0, 10), summary: r.summary, roadmapItemIds: r.rm.map((x) => rmIds[x]), status: r.st, createdAt: iso(r.date) });
    if (r.st === 'published') add('activityLogs', { workspaceId: wid, userId: 1, message: `Release ${r.v} published`, createdAt: iso(r.date) });
  });
}

writeFileSync(new URL('../db.json', import.meta.url), JSON.stringify(db, null, 2));
console.log('db.json created:', Object.entries(db).map(([k, v]) => `${k}=${v.length}`).join(', '));
