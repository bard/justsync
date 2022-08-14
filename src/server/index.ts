import { Conflict } from "http-errors";

export const createSyncServer = ({
  loadDocument,
  saveDocument,
}: {
  loadDocument: (username: string) => Promise<unknown>;
  saveDocument: (
    username: string,
    appState: { _schemaVersion: number; _rev: number }
  ) => Promise<void>;
}) => {
  const read = async (
    username: string
  ): Promise<{ _rev: number; _schemaVersion: number } | null> => {
    const data = (await loadDocument(username)) as any;

    if (data._rev !== null && typeof data._rev !== "number") {
      throw new Error("Missing _rev from stored data");
    }

    if (typeof data._schemaVersion !== "number") {
      throw new Error("Missing _schemaVersion from stored data");
    }

    return data;
  };

  const write = async (username: string, proposedAppState: any) => {
    const existingAppState = await read(username);

    if (existingAppState === null) {
      // Should never happen. read() can only return null when the `clientRev`
      // option is provided
      throw new Error("State is null");
    }

    if (typeof proposedAppState._rev !== "number") {
      throw new Error("Missing _rev");
    }

    if (
      proposedAppState._baseRev !== null &&
      typeof proposedAppState._baseRev !== "number"
    ) {
      throw new Error("Missing _baseRev");
    }

    if (typeof proposedAppState._schemaVersion !== "number") {
      throw new Error("Missing or invalid _schemaVersion");
    }

    const { _baseRev, ...proposedAppStateData } = proposedAppState;

    if (proposedAppState._schemaVersion !== existingAppState._schemaVersion) {
      throw new Conflict(
        `Existing state schema version: ${existingAppState._schemaVersion}. New state schema version: ${proposedAppState._schemaVersion}`
      );
    }

    if (proposedAppState._baseRev !== existingAppState._rev) {
      throw new Conflict(
        `Existing state revision: ${existingAppState._rev}. New state based on revision: ${proposedAppState._baseRev}`
      );
    }

    await saveDocument(username, proposedAppStateData);
  };

  return { read, write };
};

// export async function sync<T extends CoreValidator<unknown>>(
//   username: string,
//   data: any,
//   persistableAppStateSchema: T
// ) {
//   const versionedPersistableAppStateSchema = v.object({
//     version: v.number().required(),
//     data: persistableAppStateSchema,
//   });

//   const existingAppState = ensure(
//     versionedPersistableAppStateSchema,
//     await loadAppState(username)
//   );
//   const proposedAppState = ensure(proposedAppStateUpdateSchema, data);
//   if (proposedAppState.base !== existingAppState.version) {
//     throw new Conflict(
//       `Existing state version: ${existingAppState.version}. New state based on version: ${proposedAppState.base} `
//     );
//   }
//   await persistAppState(username, {
//     version: proposedAppState.version,
//     data: proposedAppState.data,
//   });
// }
