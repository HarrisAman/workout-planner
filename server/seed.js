// Adds demo routines, a workout, and this week's schedule. Skips if routines already exist.
import 'dotenv/config';
import { connect, col } from './db.js';
import * as gh from './github.js';
import { newId, isoWeek } from './util.js';

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monday = new Date();
monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
const day = (n) => { const d = new Date(monday); d.setDate(d.getDate() + n); return fmt(d); };
const stamp = () => new Date().toISOString();
const toFile = ({ _id, ...rest }) => ({ id: _id, ...rest });

await connect();
if ((await col('routines').countDocuments()) > 0) {
  console.log('Database already has routines. Skipping seed.');
  process.exit(0);
}

const routineDefs = [
  { name: 'Push Day', tags: ['push'], exercises: [
    { name: 'Bench Press', targetSets: 4, targetReps: 8 },
    { name: 'Overhead Press', targetSets: 3, targetReps: 10 },
    { name: 'Tricep Pushdown', targetSets: 3, targetReps: 12 } ] },
  { name: 'Pull Day', tags: ['pull'], exercises: [
    { name: 'Deadlift', targetSets: 3, targetReps: 5 },
    { name: 'Barbell Row', targetSets: 4, targetReps: 8 },
    { name: 'Bicep Curl', targetSets: 3, targetReps: 12 } ] },
  { name: 'Leg Day', tags: ['legs'], exercises: [
    { name: 'Squat', targetSets: 4, targetReps: 6 },
    { name: 'Romanian Deadlift', targetSets: 3, targetReps: 8 },
    { name: 'Calf Raise', targetSets: 4, targetReps: 15 } ] },
  { name: 'Easy Cardio', tags: ['cardio'], exercises: [
    { name: 'Treadmill Jog (minutes)', targetSets: 1, targetReps: 30 } ] },
];

const routines = routineDefs.map((r) => ({ _id: newId('', r.name), ...r, createdAt: stamp(), updatedAt: stamp() }));
await col('routines').insertMany(routines);
for (const r of routines) await gh.snapshot(`routines/${r._id}.json`, toFile(r), `Add routine: ${r.name}`);

const workout = {
  _id: newId(day(0), 'Push Day'), name: 'Push Day', date: day(0), tags: ['push'], notes: 'Felt strong.',
  exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 135, rpe: 7 }, { reps: 6, weight: 155, rpe: 8 }] }],
  createdAt: stamp(), updatedAt: stamp(),
};
await col('workouts').insertOne(workout);
await gh.snapshot(`workouts/${workout._id}.json`, toFile(workout), `Add workout: ${workout.name}`);

const plan = [[0, 0, 'done'], [1, 1, 'planned'], [3, 2, 'planned'], [5, 3, 'planned']];
const entries = plan.map(([d, r, status]) => ({
  _id: newId('e', routines[r].name), routineId: routines[r]._id, routineName: routines[r].name,
  date: day(d), week: isoWeek(day(d)), status, ...(status === 'done' ? { workoutId: workout._id } : {}),
}));
await col('schedule').insertMany(entries);
await gh.snapshot(`schedule/${isoWeek(day(0))}.json`, { week: isoWeek(day(0)), entries: entries.map(toFile) }, "Seed this week's schedule");

console.log(`Seeded ${routines.length} routines, 1 workout, ${entries.length} scheduled entries.`);
process.exit(0);
