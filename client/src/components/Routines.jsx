import { useState } from 'react';
import { api } from '../api';
import HistoryPanel from './HistoryPanel.jsx';

const blank = () => ({ name: '', tagsText: '', exercises: [{ name: '', targetSets: 3, targetReps: 10 }] });

export default function Routines({ items, reload, notify }) {
  const [form, setForm] = useState(null);
  const [history, setHistory] = useState(null);

  const edit = (r) => setForm({ id: r.id, name: r.name, tagsText: (r.tags || []).join(', '), exercises: r.exercises.map((e) => ({ ...e })) });

  const setEx = (i, patch) => setForm((f) => ({ ...f, exercises: f.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));

  const save = async (e) => {
    e.preventDefault();
    const body = {
      name: form.name.trim(),
      tags: form.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      exercises: form.exercises
        .filter((x) => x.name.trim())
        .map((x) => ({ name: x.name.trim(), targetSets: Number(x.targetSets) || 1, targetReps: Number(x.targetReps) || 1 })),
    };
    try {
      form.id ? await api.update('routines', form.id, body) : await api.create('routines', body);
      notify(form.id ? 'Routine saved' : 'Routine created');
      setForm(null);
      reload();
    } catch (err) { notify(err.message, 'error'); }
  };

  const del = async (r) => {
    if (!window.confirm(`Delete "${r.name}"? Scheduled entries keep their name.`)) return;
    try { await api.remove('routines', r.id); notify('Routine deleted'); reload(); }
    catch (err) { notify(err.message, 'error'); }
  };

  return (
    <section>
      <div className="row between head">
        <h2>Routines</h2>
        <button onClick={() => setForm(blank())}>New routine</button>
      </div>

      {items.length === 0 && <p className="empty">No routines yet. Create one, then drag it onto a day in the calendar.</p>}
      <div className="grid">
        {items.map((r) => (
          <article key={r.id} className="card">
            <h3>{r.name}</h3>
            <div className="tags">{(r.tags || []).map((t) => <span key={t}>{t}</span>)}</div>
            <ul className="plain">
              {r.exercises.map((x, i) => <li key={i}>{x.name} <span className="muted">{x.targetSets} × {x.targetReps}</span></li>)}
            </ul>
            <div className="row">
              <button className="ghost" onClick={() => edit(r)}>Edit</button>
              <button className="ghost" onClick={() => setHistory(r)}>History</button>
              <button className="ghost danger" onClick={() => del(r)}>Delete</button>
            </div>
          </article>
        ))}
      </div>

      {form && (
        <div className="overlay" onClick={() => setForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{form.id ? 'Edit routine' : 'New routine'}</h2>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Tags (comma separated)<input value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} placeholder="push, upper" /></label>
            <h3>Exercises</h3>
            {form.exercises.map((x, i) => (
              <div className="ex-row" key={i}>
                <input aria-label="Exercise name" placeholder="Exercise" value={x.name} onChange={(e) => setEx(i, { name: e.target.value })} />
                <input aria-label="Target sets" type="number" min="1" value={x.targetSets} onChange={(e) => setEx(i, { targetSets: e.target.value })} />
                <span className="muted">×</span>
                <input aria-label="Target reps" type="number" min="1" value={x.targetReps} onChange={(e) => setEx(i, { targetReps: e.target.value })} />
                <button type="button" className="ghost danger" onClick={() => setForm({ ...form, exercises: form.exercises.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <button type="button" className="ghost" onClick={() => setForm({ ...form, exercises: [...form.exercises, { name: '', targetSets: 3, targetReps: 10 }] })}>Add exercise</button>
            <div className="row end">
              <button type="button" className="ghost" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit">Save routine</button>
            </div>
          </form>
        </div>
      )}

      {history && (
        <HistoryPanel
          path={`routines/${history.id}.json`}
          title={history.name}
          onClose={() => setHistory(null)}
          onRestore={async (sha) => { await api.restore('routines', history.id, sha); notify('Routine restored'); reload(); }}
        />
      )}
    </section>
  );
}
