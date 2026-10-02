const TZ = 'Europe/Madrid';

function madridParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value])) as Record<string, string>;
}

// Instante (ISO/UTC guardado en la base de datos) -> valor de un <input type="datetime-local">
// expresado en hora de Madrid, con independencia del huso del navegador.
export function isoToMadridInput(iso: string) {
  const p = madridParts(new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Valor de un datetime-local entendido como hora de Madrid -> ISO (UTC) para guardar.
// Se itera para acertar el desfase (+1 h invierno, +2 h verano) en la fecha concreta.
export function madridInputToIso(value: string) {
  const [day, time] = value.split('T');
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wallAsUtc;
  for (let i = 0; i < 2; i += 1) {
    const p = madridParts(new Date(guess));
    const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    guess = wallAsUtc - (shown - guess);
  }
  return new Date(guess).toISOString();
}
