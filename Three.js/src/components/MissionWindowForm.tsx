import { type FormEvent, useState } from "react";

import { assertMissionWindow, type MissionWindow } from "../domain/missionWindow";

export function MissionWindowForm({ value, onChange }: { value: MissionWindow; onChange: (window: MissionWindow) => void }) {
  const [start, setStart] = useState(value.start_utc);
  const [duration, setDuration] = useState(String(value.duration_hours));
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const next = assertMissionWindow({ start_utc: start, duration_hours: Number(duration) });
      setError(null);
      onChange(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Enter a valid UTC mission window."); }
  }
  return <form className="window-form" onSubmit={submit} noValidate>
    <label>Mission start (UTC)<input value={start} onChange={(event) => setStart(event.target.value)} aria-describedby={error ? "window-error" : undefined} /></label>
    <label>Duration (hours)<input value={duration} inputMode="numeric" onChange={(event) => setDuration(event.target.value)} aria-describedby={error ? "window-error" : undefined} /></label>
    <button type="submit">Save mission window</button>
    {error && <p id="window-error" role="alert" className="form-error">{error}</p>}
  </form>;
}
