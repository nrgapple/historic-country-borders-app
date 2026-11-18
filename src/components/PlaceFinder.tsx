import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import Icon from './Icon';
import './PlaceFinder.css';
import { searchPlaces, type PlaceOption } from '../lib/places';

interface PlaceFinderProps {
  options: readonly PlaceOption[];
  onSelect: (option: PlaceOption) => void;
  label?: string;
  /** Visible hint in the empty field, e.g. "Find a place in 1492". */
  placeholder?: string;
  /** Collapse to a search button on narrow screens. */
  collapsible?: boolean;
}

/**
 * "Find a place": an ARIA 1.2 combobox with a list popup. Arrow keys move
 * through results, Enter chooses (the first result when none is active), and
 * Escape closes the list, then clears the text, then collapses the field.
 */
export default function PlaceFinder({
  options,
  onSelect,
  label = 'Find a place',
  placeholder = label,
  collapsible = false,
}: PlaceFinderProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [expanded, setExpanded] = useState(false);
  const [chosen, setChosen] = useState<string>();

  const results = useMemo(
    () => (query === chosen ? [] : searchPlaces(options, query)),
    [options, query, chosen],
  );
  const showList = open && query.trim() !== '' && query !== chosen;

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({
      block: 'nearest',
    });
    // optionId is derived from the stable id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const collapse = useCallback(() => {
    setExpanded(false);
    setOpen(false);
    setActive(-1);
    // Return focus to the button that opened the field.
    requestAnimationFrame(() => toggleRef.current?.focus());
  }, []);

  const choose = useCallback(
    (option: PlaceOption) => {
      setQuery(option.label);
      setChosen(option.label);
      setOpen(false);
      setActive(-1);
      // On narrow screens the open field covers the toolbar; fold it away.
      if (collapsible && expanded) collapse();
      onSelect(option);
    },
    [onSelect, collapsible, expanded, collapse],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = results.length;
    // Arrow keys reopen the list, including after a result was chosen.
    const reopen = (pick: (count: number) => number) => {
      const available = searchPlaces(options, query).length;
      setChosen(undefined);
      setOpen(true);
      setActive(available ? pick(available) : -1);
    };
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!showList) {
          reopen(() => 0);
        } else if (count) {
          setActive((current) => (current + 1) % count);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!showList) {
          reopen((available) => available - 1);
        } else if (count) {
          setActive((current) => (current <= 0 ? count - 1 : current - 1));
        }
        break;
      case 'Enter':
        if (showList && count) {
          event.preventDefault();
          choose(results[active >= 0 ? active : 0]);
        }
        break;
      case 'Escape': {
        let handled = true;
        if (showList) {
          setOpen(false);
          setActive(-1);
        } else if (query) {
          setQuery('');
          setChosen(undefined);
        } else if (collapsible && expanded) {
          collapse();
        } else {
          handled = false;
        }
        // Keep a handled Escape from also closing the details panel.
        if (handled) event.nativeEvent.stopPropagation();
        break;
      }
    }
  };

  const handleBlur = () => {
    setOpen(false);
    setActive(-1);
    // The text is kept for the next time the field opens.
    if (collapsible) setExpanded(false);
  };

  const status = showList
    ? results.length
      ? `${results.length} ${results.length === 1 ? 'place' : 'places'} found`
      : 'No places match'
    : '';

  return (
    <div
      className="place-finder"
      data-collapsible={collapsible || undefined}
      data-expanded={expanded || undefined}
    >
      {collapsible && !expanded && (
        <button
          ref={toggleRef}
          type="button"
          className="icon-button place-finder__toggle"
          aria-label={label}
          title={label}
          onClick={() => setExpanded(true)}
        >
          <Icon name="search" />
        </button>
      )}
      <div className="place-finder__field">
        <Icon name="search" size={16} className="place-finder__icon" />
        <label className="visually-hidden" htmlFor={inputId}>
          {label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="place-finder__input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={
            showList && active >= 0 ? optionId(active) : undefined
          }
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setChosen(undefined);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        {collapsible && expanded && (
          <button
            type="button"
            className="icon-button place-finder__close"
            aria-label="Close search"
            // Keep focus in the input until the click lands.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery('');
              setChosen(undefined);
              collapse();
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={`${label} results`}
        className="place-finder__list"
        hidden={!showList || results.length === 0}
        // Keep focus in the input while a result is clicked.
        onMouseDown={(event) => event.preventDefault()}
      >
        {showList &&
          results.map((option, index) => (
            <li
              key={option.name}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              className="place-finder__option"
              onMouseMove={() => setActive(index)}
              onClick={() => choose(option)}
            >
              <span className="place-finder__name">{option.label}</span>
              {option.detail && (
                <span className="place-finder__detail">{option.detail}</span>
              )}
            </li>
          ))}
      </ul>
      {showList && results.length === 0 && (
        <p className="place-finder__empty">No places match “{query.trim()}”.</p>
      )}
      <span className="visually-hidden" role="status">
        {status}
      </span>
    </div>
  );
}
