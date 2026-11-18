import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import Icon, { BrandMark } from './Icon';
import {
  FindArt,
  ProjectorArt,
  ShareArt,
  SymbolsArt,
  TimeArt,
} from './WelcomeArt';
import type { WelcomeView } from '../atlas/store';
import './Welcome.css';

/** Release notes: what shipped in the 2026 rebuild, in plain language. */
export const RELEASE_NOTES: Array<{ title: string; text: string }> = [
  {
    title: 'A new atlas look',
    text: 'Hand-tinted territories, coastlines, rivers and relief, drawn like a printed school atlas.',
  },
  {
    title: 'Colonies tinted by their empire',
    text: 'A colony or protectorate takes a lighter, hatched tint of its ruler.',
  },
  {
    title: 'Find a place',
    text: 'Type a few letters to jump to any territory on the current map.',
  },
  {
    title: 'Links to an exact view',
    text: 'A shared link opens the same year, map position and selected place.',
  },
  {
    title: 'Projector mode',
    text: 'Hide the controls for class, and switch on larger, easy-to-read text.',
  },
  {
    title: 'Capitals, rulers and what changed',
    text: 'Many territories list their capital and ruler from Wikidata, and each map lists what changed since the one before.',
  },
];

export interface TourCard {
  id: string;
  title: string;
  text: string;
  Art: ComponentType<{ className?: string }>;
}

/** The quick tour, one card per thing a class can do. */
export const TOUR_CARDS: TourCard[] = [
  {
    id: 'share',
    title: 'Share a place link',
    text: 'Select a territory, then choose Copy link. Whoever opens the link sees the same year, view and place, ready for a lesson or an assignment.',
    Art: ShareArt,
  },
  {
    id: 'find',
    title: 'Find any territory by name',
    text: 'Use Find a place at the top of the page, or the magnifier on a phone. Type a few letters, choose a name, and the map frames it.',
    Art: FindArt,
  },
  {
    id: 'time',
    title: 'Step through time',
    text: 'Drag along the timeline, choose a printed year, or use the year buttons. When the map itself is not focused, the ← and → keys move one map at a time.',
    Art: TimeArt,
  },
  {
    id: 'projector',
    title: 'Projector mode for class',
    text: 'Present to class hides everything except the map, the year and the selected place. Projector text, in Map settings, sets every label in larger type.',
    Art: ProjectorArt,
  },
  {
    id: 'symbols',
    title: 'Reading the map',
    text: 'A star in a circle marks a capital, and a dot marks a city. Three dots (∴) mark ruins. Hatching over a lighter tint marks a colony; its ruler has the same tint at full strength.',
    Art: SymbolsArt,
  },
];

const SWIPE_PX = 40;

interface WelcomeProps {
  view: WelcomeView;
  onViewChange: (view: WelcomeView) => void;
  onClose: () => void;
  /** Move focus to the card's heading (when the visitor opened it). */
  autoFocus?: boolean;
}

/**
 * The "Historic Borders is back" card: release notes, then a short tour.
 *
 * Non-modal on purpose: it sits in a corner of the map (a bottom sheet on
 * phones), never blocks the page, and never takes focus on its own. It is
 * first in the map's tab order, closes on Escape, and keeps the map's arrow
 * keys for the timeline except inside the tour.
 */
export default function Welcome({
  view,
  onViewChange,
  onClose,
  autoFocus = false,
}: WelcomeProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [card, setCard] = useState(0);
  const focusOnView = useRef(autoFocus);

  useEffect(() => {
    if (!focusOnView.current) return;
    focusOnView.current = false;
    titleRef.current?.focus();
    // Opened from About: the closing modal <dialog> hands focus back to its
    // opener in the same commit, so focus the heading again after it.
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [view]);

  const showView = (next: WelcomeView) => {
    focusOnView.current = true;
    if (next === 'tour') setCard(0);
    onViewChange(next);
  };

  return (
    <section
      className="welcome paper-grain"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-view={view}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="welcome__header">
        <BrandMark size={30} />
        <div className="welcome__heading">
          <p className="welcome__eyebrow">
            {view === 'notes' ? 'What’s new in this edition' : 'Quick tour'}
          </p>
          <h2
            className="welcome__title"
            id={titleId}
            ref={titleRef}
            tabIndex={-1}
          >
            {view === 'notes'
              ? 'Historic Borders is back'
              : 'Things to try in class'}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button welcome__close"
          onClick={onClose}
          aria-label="Close welcome"
          title="Close"
        >
          <Icon name="close" />
        </button>
      </header>

      {view === 'notes' ? (
        <>
          <div className="welcome__body">
            <p className="welcome__lede">
              The atlas is online again, still free, with all 53 maps from
              123,000 BC to 2010. Here is what is new.
            </p>
            <ul className="welcome__notes">
              {RELEASE_NOTES.map((note) => (
                <li key={note.title}>
                  <strong>{note.title}.</strong> {note.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="welcome__actions">
            <button type="button" className="button" onClick={onClose}>
              Start exploring
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => showView('tour')}
            >
              Take a quick tour
            </button>
          </div>
        </>
      ) : (
        <Tour
          index={card}
          onIndexChange={setCard}
          onBack={() => showView('notes')}
          onDone={onClose}
        />
      )}
    </section>
  );
}

interface TourProps {
  index: number;
  onIndexChange: (index: number) => void;
  onBack: () => void;
  onDone: () => void;
}

/**
 * A plain carousel: one card at a time, Previous and Next buttons, arrow
 * keys (and Home/End) anywhere inside it, and a horizontal swipe on touch.
 * It never advances on its own. The slide animation runs only when the
 * visitor has not asked for reduced motion.
 */
export function Tour({ index, onIndexChange, onBack, onDone }: TourProps) {
  const count = TOUR_CARDS.length;
  const card = TOUR_CARDS[index];
  const last = index === count - 1;
  const [direction, setDirection] = useState<'next' | 'previous'>('next');
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      if (clamped === index) return;
      setDirection(clamped > index ? 'next' : 'previous');
      onIndexChange(clamped);
    },
    [count, index, onIndexChange],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => void> = {
      ArrowRight: () => go(index + 1),
      ArrowLeft: () => go(index - 1),
      Home: () => go(0),
      End: () => go(count - 1),
    };
    const move = moves[event.key];
    if (!move || event.altKey || event.ctrlKey || event.metaKey) return;
    // Keeps the timeline's page-wide arrow keys from changing the year.
    event.preventDefault();
    event.stopPropagation();
    move();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? index + 1 : index - 1);
  };

  return (
    <div
      className="tour"
      role="group"
      aria-roledescription="carousel"
      aria-label="Quick tour"
      onKeyDown={onKeyDown}
    >
      <div
        className="tour__viewport"
        aria-live="polite"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        <div
          key={card.id}
          className="tour__slide"
          data-direction={direction}
          role="group"
          aria-roledescription="slide"
          aria-label={`Card ${index + 1} of ${count}`}
          data-card={card.id}
        >
          <figure className="tour__art">
            <card.Art className="tour__svg" />
          </figure>
          <p className="tour__count">
            Card {index + 1} of {count}
          </p>
          <h3 className="tour__title">{card.title}</h3>
          <p className="tour__text">{card.text}</p>
        </div>
      </div>

      <div className="tour__controls">
        <button
          type="button"
          className="button tour__step"
          onClick={() => (index === 0 ? onBack() : go(index - 1))}
        >
          <Icon name="chevronLeft" />
          {index === 0 ? 'What’s new' : 'Previous'}
        </button>
        <ol className="tour__dots" aria-hidden="true">
          {TOUR_CARDS.map((c, i) => (
            <li key={c.id} data-current={i === index || undefined} />
          ))}
        </ol>
        {last ? (
          <button
            type="button"
            className="button button--primary tour__step"
            onClick={onDone}
          >
            Start exploring
          </button>
        ) : (
          <button
            type="button"
            className="button button--primary tour__step"
            onClick={() => go(index + 1)}
          >
            Next
            <Icon name="chevronRight" />
          </button>
        )}
      </div>
    </div>
  );
}
