function toDateKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function daysBetween(from, to) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86400000);
}

function dateRange(days) {
  const today = new Date();
  const dates = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    dates.push(toDateKey(addDays(today, -i)));
  }
  return dates;
}

function monthRange(date = new Date()) {
  const cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const dates = [];

  while (cursor.getUTCMonth() === date.getUTCMonth()) {
    dates.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

module.exports = {
  toDateKey,
  addDays,
  daysBetween,
  dateRange,
  monthRange
};
