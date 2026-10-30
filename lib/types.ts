// One saved round, as stored in localStorage and in backups.
export type Game = {
  version: number;
  id: string;
  answer: string;
  guesses: string[];
  draft: string;
  gaveUp?: boolean;
  hints?: boolean;
  hard?: boolean;
};
export type Status =
  | 'correct'
  | 'present'
  | 'near-correct'
  | 'near-present'
  | 'absent';
