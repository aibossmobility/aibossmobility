function reportDates(date, period) {
  const selected = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(selected.getTime()) || selected.toISOString().slice(0, 10) !== date) return [];
  const start = new Date(selected);
  const end = new Date(selected);
  if (period === "week") {
    const daysFromMonday = (selected.getUTCDay() + 6) % 7;
    start.setUTCDate(selected.getUTCDate() - daysFromMonday);
    end.setUTCDate(selected.getUTCDate() + 6 - daysFromMonday);
  }
  if (period === "month") {
    start.setUTCDate(1);
    end.setUTCMonth(selected.getUTCMonth() + 1, 0);
  }
  const dates = [];
  for (const day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}

module.exports = { reportDates };
