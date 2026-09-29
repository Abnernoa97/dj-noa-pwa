import { useRef, useState } from 'react';
import { DatabaseBackup, Download, ShieldCheck, Upload, X } from 'lucide-react';
import { downloadDjNoaBackup, restoreDjNoaBackup } from './dataBackup';

export default function DataSafetyPanel() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const exportBackup = async () => {
    setBusy(true);
    setMessage('Preparando copia completa…');
    try {
      await downloadDjNoaBackup();
      setMessage('Backup completo creado.');
    } catch {
      setMessage('No pude crear el backup.');
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    if (!window.confirm('Esto reemplazará los datos actuales de DJ NOA por los del backup. ¿Continuar?')) return;
    setBusy(true);
    setMessage('Restaurando…');
    try {
      const result = await restoreDjNoaBackup(file);
      setMessage(`Restaurado: ${result.events} eventos · ${result.reminders} tareas · ${result.rows} filas · ${result.photos} fotos.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setMessage('Ese archivo no es un backup válido de DJ NOA.');
      setBusy(false);
    }
  };

  return (
    <>
      <button className="dj-data-safety-trigger" onClick={() => setOpen(true)} aria-label="Backup y restauración">
        <ShieldCheck size={16} />
      </button>
      {open && (
        <div className="dj-data-safety-backdrop" onClick={() => !busy && setOpen(false)}>
          <section className="dj-data-safety-panel" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>DATOS LOCALES</span><strong>Protección DJ NOA</strong></div>
              <button onClick={() => !busy && setOpen(false)} aria-label="Cerrar"><X size={18} /></button>
            </header>
            <div className="dj-data-safety-copy">
              <DatabaseBackup size={22} />
              <p>La copia incluye eventos, calendario, tareas, Excel, campos personalizados, fotos e historial.</p>
            </div>
            <div className="dj-data-safety-actions">
              <button onClick={() => void exportBackup()} disabled={busy}><Download size={17} /> Exportar backup</button>
              <button onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={17} /> Restaurar backup</button>
            </div>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; void importBackup(file); event.currentTarget.value = ''; }} />
            {message && <div className="dj-data-safety-message">{message}</div>}
          </section>
        </div>
      )}
    </>
  );
}
