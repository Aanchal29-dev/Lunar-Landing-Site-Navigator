import { type FormEvent, useState } from "react";

import { assertCoordinate, type LunarCoordinate } from "../domain/coordinates";

export function CoordinateForm({ onSelect }: { onSelect: (coordinate: LunarCoordinate) => void }) {
  const [latitude, setLatitude] = useState("-85.2");
  const [longitude, setLongitude] = useState("32.5");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (!latitude.trim() || !longitude.trim()) throw new Error("Enter both latitude and longitude.");
      const coordinate = assertCoordinate({ latitude_deg: Number(latitude), longitude_deg: Number(longitude) });
      setError(null);
      onSelect(coordinate);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enter valid lunar coordinates.");
    }
  }

  return (
    <form className="coordinate-form" onSubmit={submit} noValidate>
      <label>Latitude <input value={latitude} inputMode="decimal" onChange={(event) => setLatitude(event.target.value)} aria-describedby={error ? "coordinate-error" : undefined} /></label>
      <label>Longitude, east-positive <input value={longitude} inputMode="decimal" onChange={(event) => setLongitude(event.target.value)} aria-describedby={error ? "coordinate-error" : undefined} /></label>
      <button type="submit">Use these coordinates</button>
      {error && <p id="coordinate-error" role="alert" className="form-error">{error}</p>}
    </form>
  );
}
