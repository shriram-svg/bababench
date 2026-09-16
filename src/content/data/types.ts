export type WorldSummary = {
  case_id: string;
  title: string;
  brief: string;
  parties: number;
  contacts: string[];
};

export type World = {
  case_id: string;
  title: string;
  brief: string;
  entities: { id: string; name: string; day_one: boolean }[];
  documents: { id: string; title: string; day_one: boolean }[];
};
