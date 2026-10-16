import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { api } from '../api';
import { addDays, dayNum, fmt, isoWeek, monthDay, shortDay, startOfWeek, today, weekDays } from '../dates';
import HistoryPanel from './HistoryPanel.jsx';

function RoutineChip({ routine }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `routine-${routine.id}`,
    data: { type: 'routine', routine },
  });
  return (
    <div
      ref={setNodeRef}
      className={`chip ${isDragging ? 'dragging' : ''}`}
      style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }}
      {...listeners}
      {...attributes}
    >
      {routine.name}
      <span className="muted small">{routine.exercises.length} exercises</span>
    </div>
  );
}

function Entry({ entry, days, onStart, onStatus, onRemove, onMove }) {
  const pending = entry.id.startsWith('tmp-');
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { type: 'entry', entry },
    disabled: pending,
  });
  return (
    <div
      ref={setNodeRef}
      className={`entry ${entry.status} ${isDragging ? 'dragging' : ''} ${pending ? 'pending' : ''}`}
      style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }}
      {...listeners}
      {...attributes}
    >
      <div className="row between">
        <strong>{entry.routineName}</strong>
        <span className={`badge ${entry.status}`}>{entry.status}</span>
      </div>
      {!pending && (
        <div className="entry-actions">
          {entry.status === 'planned' && <button onClick={() => onStart(entry)}>Start</button>}
          {entry.status === 'planned' && <button className="ghost" onClick={() => onStatus(entry, 'skipped')}>Skip</button>}
          {entry.status !== 'planned' && <button className="ghost" onClick={() => onStatus(entry, 'planned')}>Reset</button>}
          <select aria-label={`Move ${entry.routineName}`} value="" onChange={(e) => e.target.value && onMove(entry, e.target.value)}>
            <option value="">Move to…</option>
            {days.filter((d) => d !== entry.date).map((d) => <option key={d} value={d}>{shortDay(d)} {monthDay(d)}</option>)}
          </select>
          <button className="ghost danger" aria-label="Remove from day" onClick={() => onRemove(entry)}>×</button>
        </div>
      )}
    </div>
  );
}

function Day({ date, entries, routines, days, handlers }) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const isToday = date === today();
  return (
    <div ref={setNodeRef} className={`day ${isOver ? 'over' : ''} ${isToday ? 'today' : ''}`}>
      <div className="day-head">
        <span className="num">{dayNum(date)}</span>
        <span className="dow">{shortDay(date)}</span>
      </div>
      {entries.length === 0 && <p className="rest">Rest</p>}
      {entries.map((e) => <Entry key={e.id} entry={e} days={days} {...handlers} />)}
      <select
        className="add"
        aria-label={`Add routine on ${date}`}
        value=""
        onChange={(e) => e.target.value && handlers.onAssign(routines.find((r) => r.id === e.target.value), date)}
      >
        <option value="">+ Add routine</option>
        {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    </div>
  );
}

export default function WeekCalendar({ routines, notify, onStart }) {
  const [start, setStart] = useState(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const days = useMemo(() => weekDays(start), [start]);
  const week = isoWeek(days[0]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } })
  );

  const load = useCallback(
    () => api.schedule.list(days[0], days[6]).then(setEntries).catch((e) => notify(e.message, 'error')),
    [days, notify]
  );
  useEffect(() => { load(); }, [load]);

  // Every change updates the screen first, then saves. On failure we reload the truth from the server.
  const assign = async (routine, date) => {
    const tmp = { id: `tmp-${Date.now()}`, routineId: routine.id, routineName: routine.name, date, status: 'planned' };
    setEntries((es) => [...es, tmp]);
    try {
      const saved = await api.schedule.add(routine.id, date);
      setEntries((es) => es.map((e) => (e.id === tmp.id ? saved : e)));
    } catch (err) { notify(err.message, 'error'); load(); }
  };

  const move = async (entry, date) => {
    if (entry.date === date) return;
    setEntries((es) => es.map((e) => (e.id === entry.id ? { ...e, date } : e)));
    try { await api.schedule.patch(entry.id, { date }); }
    catch (err) { notify(err.message, 'error'); load(); }
  };

  const setStatus = async (entry, status) => {
    setEntries((es) => es.map((e) => (e.id === entry.id ? { ...e, status } : e)));
    try { await api.schedule.patch(entry.id, { status }); }
    catch (err) { notify(err.message, 'error'); load(); }
  };

  const remove = async (entry) => {
    setEntries((es) => es.filter((e) => e.id !== entry.id));
    try { await api.schedule.remove(entry.id); }
    catch (err) { notify(err.message, 'error'); load(); }
  };

  const onDragEnd = ({ active, over }) => {
    if (!over) return;
    const data = active.data.current;
    if (data.type === 'routine') assign(data.routine, over.id);
    else move(data.entry, over.id);
  };

  const handlers = { onStart, onStatus: setStatus, onRemove: remove, onMove: move, onAssign: assign };
  const done = entries.filter((e) => e.status === 'done').length;

  return (
    <section>
      <div className="row between head">
        <div>
          <h2>{monthDay(days[0])} – {monthDay(days[6])}</h2>
          <p className="muted small">{week} · {done} of {entries.length} done</p>
        </div>
        <div className="row">
          <button className="ghost" onClick={() => setStart(addDays(start, -7))}>Previous</button>
          <button className="ghost" onClick={() => setStart(startOfWeek(new Date()))}>Today</button>
          <button className="ghost" onClick={() => setStart(addDays(start, 7))}>Next</button>
          <button className="ghost" onClick={() => setShowHistory(true)}>Week history</button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="cal-layout">
          <aside className="routine-bar">
            <h3>Routines</h3>
            <p className="muted small">Drag onto a day.</p>
            {routines.length === 0 && <p className="empty small">Create a routine first (Routines tab).</p>}
            {routines.map((r) => <RoutineChip key={r.id} routine={r} />)}
          </aside>
          <div className="week">
            {days.map((d) => (
              <Day key={d} date={d} days={days} routines={routines} handlers={handlers} entries={entries.filter((e) => e.date === d)} />
            ))}
          </div>
        </div>
      </DndContext>

      {showHistory && (
        <HistoryPanel
          path={`schedule/${week}.json`}
          title={`Week ${week}`}
          onClose={() => setShowHistory(false)}
          onRestore={async (sha) => { await api.schedule.restore(week, sha); notify('Week restored'); load(); }}
        />
      )}
    </section>
  );
}
