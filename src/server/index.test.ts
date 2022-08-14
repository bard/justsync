import { createSyncServer } from "./server";

describe("server", () => {
  test("accepts update", async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce({ _schemaVersion: 0, _rev: null });
    const saver = jest.fn();
    const server = createSyncServer({
      loadDocument: loader,
      saveDocument: saver,
    });

    await server.write("user123", {
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });

    expect(loader).toHaveBeenCalledWith("user123");
    expect(saver).toHaveBeenCalledWith("user123", {
      _schemaVersion: 0,
      _rev: 1,
      foo: "hello",
    });
  });

  test("rejects update based on a revision different than what's on disk", async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce({ _schemaVersion: 0, _rev: 2 });
    const saver = jest.fn();
    const server = createSyncServer({
      loadDocument: loader,
      saveDocument: saver,
    });

    expect.assertions(1);
    try {
      await server.write("user123", {
        _schemaVersion: 0,
        _baseRev: 1,
        _rev: 2,
        foo: "hello",
      });
    } catch (err) {
      expect(err).toMatchObject({
        message: "Existing state revision: 2. New state based on revision: 1",
      });
    }
  });

  test("returns state", async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce({ _schemaVersion: 0, _rev: 2 });
    const saver = jest.fn();
    const server = createSyncServer({
      loadDocument: loader,
      saveDocument: saver,
    });

    const data = await server.read("user123");
    expect(data).toEqual({ _schemaVersion: 0, _rev: 2 });
  });

  test("returns null when client rev matches current rev", async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce({ _schemaVersion: 0, _rev: 2 });
    const saver = jest.fn();
    const server = createSyncServer({
      loadDocument: loader,
      saveDocument: saver,
    });

    const data = await server.read("user123");
    expect(data).toEqual({ _schemaVersion: 0, _rev: 2 });
  });
});
