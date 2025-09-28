export type CategoryOption = {
  label: string;
  value: string;
  availableDifficulties: Array<"easy" | "medium" | "hard">;
};

export type HostSession = {
  code: string;
  hostSecret: string;
};
