import "cross-fetch/polyfill";
import { createHttpLink } from "./http-link";
import { rest } from "msw";
import { setupServer } from "msw/node";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("http link", () => {
  test("pulls from server", async () => {
    const link = createHttpLink({ endPoint: "https://api/sync" });

    server.use(
      rest.get("https://api/sync", (_req, res, ctx) => {
        return res(ctx.json({ _schemaVersion: 0, _rev: 0, foo: "bar" }));
      })
    );

    const result = await link.pull();

    expect(result).toEqual({ _schemaVersion: 0, _rev: 0, foo: "bar" });
  });
});
