import React from 'react';

interface ProjectorCaptionProps {
  /** Large heading, e.g. "1492 AD". */
  title?: string;
  /** The selected place, if any. */
  place?: string;
}

/**
 * Shown while controls are hidden so a projected map still tells the class
 * which year it shows and which place is being discussed.
 */
export default function ProjectorCaption({
  title,
  place,
}: ProjectorCaptionProps) {
  if (!title && !place) return null;
  return (
    <div className="projector-caption" data-testid="projector-caption">
      {title && <p className="projector-caption__title">{title}</p>}
      {place && <p className="projector-caption__place">{place}</p>}
    </div>
  );
}
