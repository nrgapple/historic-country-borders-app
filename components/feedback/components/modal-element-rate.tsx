import React from "react";
import cx from "classnames";

export default function FeedbackModalElementRate({
  children,
  selected,
  onChange = () => {},
  value,
}: {
  children: React.ReactElement;
  selected: string;
  onChange: any;
  value: string;
}) {
  const isSelected = selected === value;

  return (
    <label
      className={cx(
        "feedback-widget-form-rate-label",
        isSelected && "selected"
      )}
    >
      <input
        className="feedback-widget-form-rate-control"
        type="radio"
        name="rate"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {children}
    </label>
  );
}
