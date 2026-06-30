const MS = { SECOND: 1000, MINUTE: 60000, HOUR: 3600000, DAY: 86400000, WEEK: 604800000 };

class CognitiveClock {
  constructor() {
    this._startedAt = Date.now();
    this._epoch = this._startedAt;
    this._timezones = { default: 'UTC' };
  }

  now() { return Date.now(); }
  uptime() { return Date.now() - this._startedAt; }

  today() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  thisWeek() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff).getTime();
  }

  thisMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }

  hoursAgo(n) { return Date.now() - n * MS.HOUR; }
  daysAgo(n) { return Date.now() - n * MS.DAY; }
  minutesAgo(n) { return Date.now() - n * MS.MINUTE; }

  isToday(ts) { return ts >= this.today(); }
  isThisWeek(ts) { return ts >= this.thisWeek(); }
  isThisMonth(ts) { return ts >= this.thisMonth(); }

  hoursSince(ts) { return Math.floor((Date.now() - ts) / MS.HOUR); }
  daysSince(ts) { return Math.floor((Date.now() - ts) / MS.DAY); }
  minutesSince(ts) { return Math.floor((Date.now() - ts) / MS.MINUTE); }

  timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < MS.MINUTE) return 'à l\'instant';
    if (diff < MS.HOUR) return `il y a ${Math.floor(diff / MS.MINUTE)} min`;
    if (diff < MS.DAY) return `il y a ${Math.floor(diff / MS.HOUR)}h`;
    if (diff < MS.WEEK) return `il y a ${Math.floor(diff / MS.DAY)}j`;
    return `il y a ${Math.floor(diff / MS.WEEK)}sem`;
  }

  relativeLabel(ts) {
    if (this.isToday(ts)) return 'aujourd\'hui';
    if (this.isThisWeek(ts)) return 'cette semaine';
    if (this.isThisMonth(ts)) return 'ce mois';
    if (this.daysSince(ts) < 3) return 'depuis 3 jours';
    if (this.daysSince(ts) < 48) return 'depuis 48h';
    return 'plus ancien';
  }

  nextInterval(label) {
    if (label === 'lundi') return this._nextWeekday(1);
    if (label === 'mardi') return this._nextWeekday(2);
    if (label === 'mercredi') return this._nextWeekday(3);
    if (label === 'jeudi') return this._nextWeekday(4);
    if (label === 'vendredi') return this._nextWeekday(5);
    if (label === 'samedi') return this._nextWeekday(6);
    if (label === 'dimanche') return this._nextWeekday(0);
    return null;
  }

  _nextWeekday(targetDay) {
    const now = new Date();
    const currentDay = now.getDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff).getTime();
  }

  format(ts, locale = 'fr-FR') {
    return new Date(ts).toLocaleString(locale, {
      dateStyle: 'medium', timeStyle: 'short',
    });
  }

  MS = MS;
}

export const clock = new CognitiveClock();
export default clock;
