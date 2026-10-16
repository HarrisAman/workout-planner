import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import WeekCalendar from './components/WeekCalendar.jsx';
import Workouts from './components/Workouts.jsx';
import Routines from './components/Routines.jsx';

const TABS = [
  ['calendar', 'Calendar'],
  ['workouts', 'Workouts'],
  ['routines', 'Routines'],
];

export default function App() {
  const [tab, setTab] = useState('calendar');
  const [status, setStatus] = useState(null);
  const [routines, setRoutines] = useState([]);
  const [draft, setDraft] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadRoutines = useCallback(
    () => api.list('routines').then(setRoutines).catch((e) => notify(e.message, 'error')),
    [notify]
  );

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus({ offline: true }));
    loadRoutines();
  }, [loadRoutines]);

  // "Start workout" from the calendar: prefill a new workout from the routine
  const startWorkout = (entry) => {
    const routine = routines.find((r) => r.id === entry.routineId);
    setDraft({
      name: entry.routineName,
      date: entry.date,
      tags: routine?.tags ?? [],
      notes: '',
      entryId: entry.id,
      exercises: (routine?.exercises ?? []).map((ex) => ({
        name: ex.name,
        sets: Array.from({ length: ex.targetSets || 1 }, () => ({ reps: ex.targetReps ?? '', weight: '', rpe: '' })),
      })),
    });
    setTab('workouts');
  };

  return (
    <div className="shell">
      <header className="top">
        <h1>Workout Planner</h1>
        <nav className="tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className={`pill ${status?.offline ? 'bad' : status?.github ? 'good' : ''}`}>
          {!status ? 'Connecting…' : status.offline ? 'API offline' : status.github ? `History: ${status.repo}` : 'GitHub history off'}
        </div>
      </header>

      <main>
        {tab === 'calendar' && <WeekCalendar routines={routines} notify={notify} onStart={startWorkout} />}
        {tab === 'workouts' && <Workouts draft={draft} clearDraft={() => setDraft(null)} notify={notify} />}
        {tab === 'routines' && <Routines items={routines} reload={loadRoutines} notify={notify} />}
      </main>

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.msg}</div>}
    </div>
  );
}
