import createDebug from "debug";
import { Link, PersistableState } from "../types";

const debug = createDebug("syncer");

export interface SyncConfig {
  pushExecution?:
    | { type: "asap" }
    | { type: "manual" }
    | { type: "periodic"; intervalMs?: number };
  link: Link;
  schemaVersion: number;
}

export interface SyncHandlers {
  onPushStarted?: () => void;
  onPushFinished?: () => void;
  onPullStarted?: () => void;
  onPullFinished?: (serverState: PersistableState) => void;
  onError?: (err: unknown) => void;
}

export interface SyncClient {
  isPushPending: () => boolean;
  pushPendingUpdates: () => Promise<void>;
  pull: () => Promise<void>;
  enqueueUpdate: (updatedStateSnapshot: PersistableState) => Promise<void>;
  start: () => void;
  stop: () => void;
  sync: () => Promise<void>;
  subscribe: (handlers: SyncHandlers) => void;
}

export const createSyncClient = (config: SyncConfig): SyncClient => {
  const { schemaVersion, link } = config;
  const updateExecution = config.pushExecution
    ? config.pushExecution.type === "periodic"
      ? { intervalMs: 5000, ...config.pushExecution }
      : config.pushExecution
    : { type: "periodic", intervalMs: 5000 };

  let serverState: PersistableState | null = null;
  let clientState: PersistableState | null = null;
  let intervalId: ReturnType<typeof setInterval>;
  let handlers: SyncHandlers | null = null;

  const subscribe = (handlers_: SyncHandlers): (() => void) => {
    handlers = handlers_;
    const unsubscribe = () => (handlers = null);
    return unsubscribe;
  };

  const getStateUpdate = () => {
    if (
      (clientState !== null && serverState === null) ||
      (clientState !== null &&
        serverState !== null &&
        clientState._rev !== serverState._rev)
    ) {
      return clientState;
    } else {
      return null;
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", (event) => {
      if (getStateUpdate()) {
        event.returnValue = "Pending work";
      }
    });
  }

  const pushPendingUpdates = async () => {
    const stateUpdate = getStateUpdate();
    if (stateUpdate) {
      debug("updating", serverState?._rev, "->", stateUpdate._rev);

      try {
        handlers?.onPushStarted?.();

        await link.push(stateUpdate);

        serverState = clientState;
        clientState = null;
      } catch (err) {
        console.error(err);
        if (err instanceof Error && handlers?.onError !== undefined) {
          handlers.onError(err);
        }
      } finally {
        handlers?.onPushFinished?.();
      }
    }
  };

  const isPushPending = () => {
    return clientState !== null && clientState._rev !== clientState._baseRev;
  };

  const pull = async (): Promise<void> => {
    try {
      handlers?.onPullStarted?.();

      serverState = await link.pull();

      if (serverState !== null) {
        if (!("_rev" in serverState)) {
          handlers?.onError?.(new Error("Remote state missing _rev"));
        }

        if (!("_schemaVersion" in serverState)) {
          handlers?.onError?.(new Error("Remote state missing _schemaVersion"));
        }

        if (serverState._schemaVersion !== schemaVersion) {
          handlers?.onError?.(
            new Error(
              "Server schema does not match client schema, please reload."
            )
          );
        }

        if (clientState !== null && clientState._rev > serverState._rev) {
          handlers?.onError?.(
            new Error("Server state is older than client state.")
          );
        }
      }

      handlers?.onPullFinished?.(serverState);
    } catch (err) {
      handlers?.onError?.(err);
    }
  };

  const enqueueUpdate = async (state: PersistableState): Promise<void> => {
    clientState = state;

    if (config.pushExecution?.type === "asap") {
      pushPendingUpdates();
    }
  };

  const start = () => {
    if (updateExecution.type !== "periodic") {
      throw new Error(
        'Can only call start() with updateExecution.type === "periodic"'
      );
    }

    intervalId = setInterval(pushPendingUpdates, updateExecution.intervalMs);
  };

  const sync = async () => {
    if (isPushPending()) {
      await pushPendingUpdates();
    } else {
      await pull();
    }
  };

  const stop = () => {
    clearInterval(intervalId);
  };

  return {
    isPushPending,
    pushPendingUpdates,
    pull,
    enqueueUpdate,
    start,
    stop,
    sync,
    subscribe,
  };
};
