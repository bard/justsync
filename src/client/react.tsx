import { useEffect, useContext, createContext } from "react";
import { usePageVisibility } from "react-page-visibility";
import { SyncClient } from "./client";

const SyncContext = createContext<SyncClient | null>(null);

interface SyncProviderProps {
  client: SyncClient;
  children: React.ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({
  client,
  children,
}) => {
  const isPageVisible = usePageVisibility();

  useEffect(() => {
    client.start();

    return () => {
      client.stop();
    };
  }, [client]);

  useEffect(() => {
    if (isPageVisible) {
      client.sync();
    }
  }, [client, isPageVisible]);

  return <SyncContext.Provider value={client}>{children}</SyncContext.Provider>;
};

export const useSync = () => {
  const client = useContext(SyncContext);
  if (client === null) throw new Error("SyncClient not set");
  return client;
};
