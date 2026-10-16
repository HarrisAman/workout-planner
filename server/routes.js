import { Router } from 'express';
import { col } from './db.js';
import * as gh from './github.js';
import { newId, isoWeek } from './util.js';

const router = Router();

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

const out = ({ _id, ...rest }) => ({ id: _id, ...rest });
const strip = ({ id, _id, createdAt, ...rest }) => rest;
const now = () => new Date().toISOString();
const okPath = (p) => /^(workouts|routines|schedule)\/[A-Za-z0-9._-]+\.json$/.test(p);

router.get('/status', (req, res) => res.json({ mongo: true, github: gh.enabled(), repo: gh.repoName() }));

// ---------- GitHub history (shared by all collections) ----------
router.get('/history', wrap(async (req, res) => {
  const path = String(req.query.path || '');
  if (!okPath(path)) return res.status(400).json({ error: 'Invalid path' });
  res.json(await gh.history(path));
}));

router.get('/version', wrap(async (req, res) => {
  const path = String(req.query.path || '');
  if (!okPath(path)) return res.status(400).json({ error: 'Invalid path' });
  res.json(await gh.getVersion(path, String(req.query.sha || '')));
}));

// ---------- Workouts + routines (same CRUD shape) ----------
function crud(name, label, pathOf, idPrefix) {
  const c = () => col(name);

  router.get(`/${name}`, wrap(async (req, res) => {
    const sort = name === 'workouts' ? { date: -1 } : { name: 1 };
    res.json((await c().find().sort(sort).toArray()).map(out));
  }));

  router.post(`/${name}`, wrap(async (req, res) => {
    const body = strip(req.body);
    if (!body.name) return res.status(400).json({ error: 'A name is required.' });
    const _id = newId(idPrefix(body), body.name);
    const doc = { _id, ...body, createdAt: now(), updatedAt: now() };
    await c().insertOne(doc);
    gh.snapshot(pathOf(_id), out(doc), `Add ${label}: ${body.name}`);
    res.status(201).json(out(doc));
  }));

  router.put(`/${name}/:id`, wrap(async (req, res) => {
    const body = strip(req.body);
    const doc = await c().findOneAndUpdate(
      { _id: req.params.id },
      { $set: { ...body, updatedAt: now() } },
      { returnDocument: 'after' }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    gh.snapshot(pathOf(doc._id), out(doc), `Update ${label}: ${doc.name}`);
    res.json(out(doc));
  }));

  router.delete(`/${name}/:id`, wrap(async (req, res) => {
    const doc = await c().findOneAndDelete({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    gh.remove(pathOf(doc._id), `Delete ${label}: ${doc.name}`);
    res.json({ ok: true });
  }));

  // "Pull": load an old commit's version back into Mongo, then commit the restore
  router.post(`/${name}/:id/restore`, wrap(async (req, res) => {
    const old = await gh.getVersion(pathOf(req.params.id), String(req.body.sha || ''));
    const { id, _id, ...rest } = old;
    const doc = { _id: req.params.id, ...rest, updatedAt: now() };
    await c().replaceOne({ _id: req.params.id }, doc, { upsert: true });
    gh.snapshot(pathOf(doc._id), out(doc), `Restore ${label}: ${doc.name} (from ${req.body.sha.slice(0, 7)})`);
    res.json(out(doc));
  }));
}

crud('workouts', 'workout', (id) => `workouts/${id}.json`, (b) => b.date);
crud('routines', 'routine', (id) => `routines/${id}.json`, () => '');

// ---------- Schedule (one GitHub file per ISO week) ----------
async function snapshotWeek(week, message) {
  const entries = await col('schedule').find({ week }).sort({ date: 1 }).toArray();
  return gh.snapshot(`schedule/${week}.json`, { week, entries: entries.map(out) }, message);
}

router.get('/schedule', wrap(async (req, res) => {
  const { from, to } = req.query;
  const q = from && to ? { date: { $gte: String(from), $lte: String(to) } } : {};
  res.json((await col('schedule').find(q).sort({ date: 1 }).toArray()).map(out));
}));

router.post('/schedule', wrap(async (req, res) => {
  const { routineId, date } = req.body;
  if (!routineId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'routineId and date (YYYY-MM-DD) are required.' });
  const routine = await col('routines').findOne({ _id: routineId });
  if (!routine) return res.status(404).json({ error: 'Routine not found' });
  const doc = {
    _id: newId('e', routine.name),
    routineId,
    routineName: routine.name, // snapshot, so deleting a routine never breaks the schedule
    date,
    week: isoWeek(date),
    status: 'planned',
  };
  await col('schedule').insertOne(doc);
  snapshotWeek(doc.week, `Schedule ${doc.routineName} on ${date}`);
  res.status(201).json(out(doc));
}));

router.patch('/schedule/:id', wrap(async (req, res) => {
  const before = await col('schedule').findOne({ _id: req.params.id });
  if (!before) return res.status(404).json({ error: 'Not found' });
  const { date, status, workoutId } = req.body;
  const set = {};
  if (date) { set.date = date; set.week = isoWeek(date); }
  if (status) set.status = status;
  if (workoutId !== undefined) set.workoutId = workoutId;
  const after = await col('schedule').findOneAndUpdate({ _id: before._id }, { $set: set }, { returnDocument: 'after' });

  let message = `Update ${before.routineName} on ${after.date}`;
  if (date && date !== before.date) message = `Move ${before.routineName} from ${before.date} to ${date}`;
  else if (status && status !== before.status) message = `Mark ${before.routineName} ${status} on ${after.date}`;
  snapshotWeek(after.week, message);
  if (before.week !== after.week) snapshotWeek(before.week, message);
  res.json(out(after));
}));

router.delete('/schedule/:id', wrap(async (req, res) => {
  const doc = await col('schedule').findOneAndDelete({ _id: req.params.id });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  snapshotWeek(doc.week, `Remove ${doc.routineName} from ${doc.date}`);
  res.json({ ok: true });
}));

router.post('/schedule/restore', wrap(async (req, res) => {
  const { week, sha } = req.body;
  if (!/^\d{4}-W\d{2}$/.test(week || '')) return res.status(400).json({ error: 'Invalid week' });
  const old = await gh.getVersion(`schedule/${week}.json`, String(sha || ''));
  await col('schedule').deleteMany({ week });
  if (old.entries?.length) {
    await col('schedule').insertMany(old.entries.map(({ id, ...rest }) => ({ _id: id, ...rest, week })));
  }
  snapshotWeek(week, `Restore week ${week} (from ${sha.slice(0, 7)})`);
  res.json({ ok: true });
}));

export default router;
