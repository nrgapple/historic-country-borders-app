import { ChangeEvent, useState } from 'react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
}

const DateInput = ({ value, onChange }: DateInputProps) => {
  const formatDate = (input: string) => {
    if (input.length === 2) {
      input += '/';
    }
  };

  return (
    <input
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        formatDate(e.target.value)
      }
      placeholder={'  /  /    '}
    />
  );
};

export default DateInput;
