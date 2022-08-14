export interface PersistableState {
  _baseRev: null | number; // XXX should this be here?
  _rev: number;
  _schemaVersion: number;
  [prop: string]: any;
}

export interface Link {
  push: (data: PersistableState) => Promise<void>;
  pull: () => Promise<PersistableState>;
}
