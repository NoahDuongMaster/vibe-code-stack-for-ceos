export type TId = string;

export type TTimestamps = {
  createdAt: string;
  updatedAt: string;
};

export type TWithId = { id: TId };

export type TWithTimestamps = TWithId & TTimestamps;

export type TSelectOption<T = string> = {
  label: string;
  value: T;
  disabled?: boolean;
};

export type TChildren = { children: React.ReactNode };

export type TClassName = { className?: string };

export type TOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
