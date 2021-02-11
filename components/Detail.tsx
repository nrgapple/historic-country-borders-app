import { ChangeEvent, useMemo, useState } from 'react';
import { mapEventPropertiesType } from '../util/types';

interface DetailProps {
  id?: number;
  title?: string;
  content?: string;
  author?: string;
  flagged?: boolean;
  actualDate?: Date;
  onFlag?: (id: number, active: boolean) => void;
  onClose: () => void;
  onSubmit: (title: string, actualDate: Date, content: string) => void;
  isCreate: boolean;
}

const Detail = ({
  id,
  title,
  content,
  author,
  flagged,
  actualDate,
  onFlag,
  onClose,
  isCreate = false,
}: DetailProps) => {
  const [currTitle, setCurrTitle] = useState(title);
  const [currContent, setCurrContent] = useState(content);
  const [currActualDate, setCurrActualDate] = useState(actualDate);

  const renderDate = useMemo(() => {
    return currActualDate && new Date(currActualDate).toDateString();
  }, [currActualDate]);
  return (
    <div className="details">
      <div className="details-nav">
        <div className="noselect" onClick={() => onClose()}>
          ╳
        </div>
      </div>
      <div className="details-body">
        {isCreate ? (
          <>
            <input
              value={currTitle}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setCurrTitle(e.target.value)
              }
            />
            <textarea
              value={currTitle}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setCurrTitle(e.target.value)
              }
            />
          </>
        ) : (
          <>
            <h1>{currTitle}</h1>
            <h3>{renderDate}</h3>
            <p>{currContent}</p>
            <footer>Created by {author}</footer>
          </>
        )}
      </div>
    </div>
  );
};

export default Detail;
