import { useMemo } from 'react';
import { useAppState } from '../App';
import { getMonthLabel } from '../utils/date';

export function UpcomingGamesPage() {
  const { data } = useAppState();
  const store = data!;


  const grouped = useMemo(() => {
    const sorted = [...store.events].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return sorted.reduce<Record<string, typeof sorted>>((acc, event) => {
      const month = getMonthLabel(event.date);
      acc[month] = acc[month] ?? [];
      acc[month].push(event);
      return acc;
    }, {});
  }, [store.events]);

  return (
    <section>
      <h2>Upcoming Games & Sessions</h2>
      {Object.entries(grouped).map(([month, events]) => (
        <div key={month} className="month-group">
          <h3>{month}</h3>
          {events.map((event) => (
            <article key={event.id} className={`card event-card ${event.isNextUp ? 'next-up' : ''}`}>
              <strong>{event.eventType}</strong>
              <p>{new Date(event.date).toLocaleDateString()} • {event.dayOfWeek}</p>
              {event.eventType === 'Game' ? (
                <>
                  <p>{event.homeAway} Game vs {event.opponent}</p>
                  <p>Duties: {event.duties}</p>
                </>
              ) : (
                <p>{event.occasion}</p>
              )}
              <p>{event.location}</p>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
