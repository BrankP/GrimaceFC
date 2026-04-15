import { makeExportBundle, readLocalChanges } from '../utils/storage';

export function ExportChangesCard() {
  const handleExport = () => {
    const text = makeExportBundle(readLocalChanges());
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `grimacefc-local-changes-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card subtle-card">
      <h3>Maintainer Sync</h3>
      <p>Export local-only changes for a maintainer to merge into repo JSON.</p>
      <button type="button" className="secondary" onClick={handleExport}>
        Export Changes
      </button>
    </section>
  );
}
