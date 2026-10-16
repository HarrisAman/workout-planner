import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { today } from '../dates';
import HistoryPanel from './HistoryPanel.jsx';

const blankSet = () => ({ reps: '', weight: '', rpe: '' });
const blank = () => ({ name: '', date: today(), tagsText: '', notes: '', exercises: [{ name: '', sets: [blankSet()] }] });
const num = (v) => (v === '' || v == null ? null : Number(v));
const totals = (w) => {
  const sets = w.exercises.flatMap((e) => e.sets);
  return { sets: sets.length, volume: sets.reduce((s, x) => s + (Number(x.reps) || 0) * (Number(x.weight) || 0), 0) };
};

export default function Workouts({ draft, clearDraft, notify }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [history, setHistory] = useState(null);

  const load = () => api.list('workouts').then(setItems).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(); }, []);

  // A draft arrives when "Start workout" is clicked on the calendar
  useEffect(() => {
    if (draft) setForm({ ...draft, tagsText: (draft.tags || []).join(', ') });
  }, [draft]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((w) => w.name.toLowerCase().includes(s) || (w.tags || []).some((t) => t.toLowerCase().includes(s)) || w.exercises.some((e) => e.name.toLowerCase().includes(s)));
  }, [items, q]);

  const edit = (w) => setForm({ ...w, tagsText: (w.tags || []).join(', ') });
  const close = () => { setForm(null); clearDraft(); };

  const setEx = (i, patch) => setForm((f) => ({ ...f, exercises: f.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));
  const setSet = (i, k, patch) => setEx(i, { sets: form.exercises[i].sets.map((s, j) => (j === k ? { ...s, ...patch } : s)) });

  const save = async (e) => {
    e.preventDefault();
    const { entryId, tagsText, id, ...rest } = form;
    const body = {
      ...rest,
      name: rest.name.trim(),
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      exercises: rest.exercises
        .filter((x) => x.name.trim())
        .map((x) => ({ name: x.name.trim(), sets: x.sets.map((s) => ({ reps: num(s.reps), weight: num(s.weight), rpe: num(s.rpe) })) })),
    };
    try {
      const saved = id ? await api.update('workouts', id, body) : await api.create('workouts', body);
      if (entryId) await api.schedule.patch(entryId, { status: 'done', workoutId: saved.id });
      notify(id ? 'Workout saved' : entryId ? 'Workout logged and marked done' : 'Workout logged');
      close();
      load();
    } catch (err) { notify(err.message, 'error'); }
  };

  const del = async (w) => {
    if (!window.confirm(`Delete "${w.name}" from ${w.date}?`)) return;
    try { await api.remove('workouts', w.id); notify('Workout deleted'); load(); }
    catch (err) { notify(err.message, 'error'); }
  };

  return (
    <section>
      <div className="row between head">
        <h2>Workouts</h2>
        <div className="row">
          <input className="search" type="search" placeholder="Search name, tag or exercise" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={() => setForm(blank())}>Log workout</button>
        </div>
      </div>

      {items.length === 0 && <p className="empty">Nothing logged yet. Log a workout, or hit Start on a scheduled routine.</p>}
      <div className="grid">
        {shown.map((w) => {
          const t = totals(w);
          return (
            <article key={w.id} className="card">
              <div className="row between"><h3>{w.name}</h3><span className="muted">{w.date}</span></div>
              <div className="tags">{(w.tags || []).map((x) => <span key={x}>{x}</span>)}</div>
              <p className="stat"><b>{t.sets}</b> sets <b>{t.volume.toLocaleString()}</b> volume</p>
              <ul className="plain">
                {w.exercises.map((x, i) => <li key={i}>{x.name} <span className="muted">{x.sets.map((s) => `${s.reps ?? '–'}×${s.weight ?? '–'}`).join('  ')}</span></li>)}
              </ul>
              {w.notes && <p className="muted small">{w.notes}</p>}
              <div className="row">
                <button className="ghost" onClick={() => edit(w)}>Edit</button>
                <button className="ghost" onClick={() => setHistory(w)}>History</button>
                <button className="ghost danger" onClick={() => del(w)}>Delete</button>
              </div>
            </article>
          );
        })}
      </div>

      {form && (
        <div className="overlay" onClick={close}>
          <form className="modal wide" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{form.id ? 'Edit workout' : 'Log workout'}</h2>
            <div className="two">
              <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Date<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            </div>
            <label>Tags (comma separated)<input value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} /></label>
            {form.exercises.map((x, i) => (
              <fieldset key={i}>
                <div className="row between">
                  <input aria-label="Exercise name" placeholder="Exercise" value={x.name} onChange={(e) => setEx(i, { name: e.target.value })} />
                  <button type="button" className="ghost danger" onClick={() => setForm({ ...form, exercises: form.exercises.filter((_, j) => j !== i) })}>Remove exercise</button>
                </div>
                {x.sets.map((s, k) => (
                  <div className="set-row" key={k}>
                    <span className="muted">Set {k + 1}</span>
                    <input aria-label="Reps" type="number" min="0" placeholder="Reps" value={s.reps ?? ''} onChange={(e) => setSet(i, k, { reps: e.target.value })} />
                    <input aria-label="Weight" type="number" min="0" step="any" placeholder="Weight" value={s.weight ?? ''} onChange={(e) => setSet(i, k, { weight: e.target.value })} />
                    <input aria-label="RPE" type="number" min="1" max="10" step="0.5" placeholder="RPE" value={s.rpe ?? ''} onChange={(e) => setSet(i, k, { rpe: e.target.value })} />
                    <button type="button" className="ghost danger" aria-label="Remove set" onClick={() => setEx(i, { sets: x.sets.filter((_, j) => j !== k) })}>×</button>
                  </div>
                ))}
                <button type="button" className="ghost" onClick={() => setEx(i, { sets: [...x.sets, blankSet()] })}>Add set</button>
              </fieldset>
            ))}
            <button type="button" className="ghost" onClick={() => setForm({ ...form, exercises: [...form.exercises, { name: '', sets: [blankSet()] }] })}>Add exercise</button>
            <label>Notes<textarea rows="2" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="row end">
              <button type="button" className="ghost" onClick={close}>Cancel</button>
              <button type="submit">Save workout</button>
            </div>
          </form>
        </div>
      )}

      {history && (
        <HistoryPanel
          path={`workouts/${history.id}.json`}
          title={history.name}
          onClose={() => setHistory(null)}
          onRestore={async (sha) => { await api.restore('workouts', history.id, sha); notify('Workout restored'); load(); }}
        />
      )}
    </section>
  );
}
