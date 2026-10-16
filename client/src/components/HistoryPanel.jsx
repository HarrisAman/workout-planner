import { useEffect, useState } from 'react';
import { api } from '../api';

export default function HistoryPanel({ path, title, onRestore, onClose }) {
  const [commits, setCommits] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.history(path).then(setCommits).catch((e) => setError(e.message));
  }, [path]);

  const show = async (sha) => {
    setError('');
    try { setPreview({ sha, data: await api.version(path, sha) }); }
    catch (e) { setPreview(null); setError(e.message); }
  };

  const restore = async (sha) => {
    if (!window.confirm('Restore this version? It will be saved as a new commit.')) return;
    try { await onRestore(sha); onClose(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label={`History for ${title}`}>
        <div className="row between">
          <h2>History: {title}</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <p className="muted small">{path}</p>
        {error && <p className="error">{error}</p>}
        {!commits && !error && <p className="muted">Loading commits…</p>}
        {commits?.length === 0 && <p className="muted">No commits yet. Make a change and it will show up here (GitHub history must be configured on the server).</p>}
        <ul className="commits">
          {commits?.map((c, i) => (
            <li key={c.sha} className={preview?.sha === c.sha ? 'sel' : ''}>
              <div>
                <strong>{c.message}</strong>
                <div className="muted small">{c.author} · {new Date(c.date).toLocaleString()} · <a href={c.url} target="_blank" rel="noreferrer">{c.sha.slice(0, 7)}</a></div>
              </div>
              <div className="row">
                <button className="ghost" onClick={() => show(c.sha)}>View</button>
                {i > 0 && <button onClick={() => restore(c.sha)}>Restore</button>}
              </div>
            </li>
          ))}
        </ul>
        {preview && <pre className="preview">{JSON.stringify(preview.data, null, 2)}</pre>}
      </aside>
    </div>
  );
}
