import { Link, PersistableState } from "../types";

export const createHttpLink = ({
  endPoint,
  fetch: customFetch,
}: {
  endPoint: string;
  fetch?: typeof global.fetch;
}): Link => {
  const fetch = customFetch ?? global.fetch;

  const push = async (data: PersistableState) => {
    const res = await fetch(endPoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const message = await res.text();
      throw new Error(
        `Server returned error when trying to synchronize state: ${res.status} - ${message}`
      );
    }
  };

  const pull = async () => {
    const res = await fetch(endPoint);

    if (!res.ok) {
      const message = await res.text();
      throw new Error(`Error retrieving state: ${res.status} - ${message}`);
    }

    const serverAppState = (await res.json()) as PersistableState; // XXX should validate and migrate?
    return serverAppState;
  };

  return { push, pull };
};
