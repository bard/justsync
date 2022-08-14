import { createSyncClient } from "./client";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("client", () => {
  test("signals pull start and finish", async () => {
    const link = { push: jest.fn(), pull: jest.fn() };
    const handlers = {
      onError: jest.fn(),
      onPullStarted: jest.fn(),
      onPullFinished: jest.fn(),
    };

    const client = createSyncClient({
      pushExecution: { type: "manual" },
      link,
      schemaVersion: 0,
    });
    client.subscribe(handlers);

    link.pull.mockResolvedValueOnce({
      _schemaVersion: 0,
      _rev: 0,
      foo: "world",
    });

    await client.pull();

    expect(handlers.onPullStarted).toHaveBeenCalledWith();

    expect(handlers.onPullFinished).toHaveBeenCalledWith({
      _schemaVersion: 0,
      _rev: 0,
      foo: "world",
    });
  });

  test("signals error when remote revision is lower than local (i.e. client getting remote updates before pushing pending local updates)", async () => {
    const link = { push: jest.fn(), pull: jest.fn() };
    const handlers = { onError: jest.fn() };

    const client = createSyncClient({
      pushExecution: { type: "manual" },
      link,
      schemaVersion: 0,
    });

    client.subscribe(handlers);

    client.enqueueUpdate({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });

    link.pull.mockResolvedValueOnce({
      _schemaVersion: 0,
      _rev: 0,
      foo: "world",
    });

    await client.pull();

    expect(handlers.onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Server state is older than client state.",
      })
    );
  });

  test.todo("signal error on schema version mismatch");

  test.todo("can sync (i.e. push pending local updates, then fetch )");

  test("can push updates manually", async () => {
    const link = { push: jest.fn(), pull: jest.fn() };

    const client = createSyncClient({
      pushExecution: { type: "manual" },
      link,
      schemaVersion: 0,
    });

    client.enqueueUpdate({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });

    expect(link.push).not.toHaveBeenCalled();

    await client.pushPendingUpdates();

    expect(link.push).toHaveBeenCalledWith({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });
  });

  test("can force a manual push even when the synchronization is periodic", async () => {
    const link = { push: jest.fn(), pull: jest.fn() };

    const client = createSyncClient({
      pushExecution: { type: "periodic", intervalMs: 500 },
      link,
      schemaVersion: 0,
    });

    client.start();

    client.enqueueUpdate({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });

    await sleep(100);

    expect(link.push).not.toHaveBeenCalled();

    await client.pushPendingUpdates();

    expect(link.push).toHaveBeenCalledWith({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });

    client.stop();
  });

  test("can push updates periodically", async () => {
    const link = { push: jest.fn(), pull: jest.fn() };

    const client = createSyncClient({
      pushExecution: { type: "periodic", intervalMs: 500 },
      link,
      schemaVersion: 0,
    });

    client.start();

    client.enqueueUpdate({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });

    expect(link.push).not.toHaveBeenCalled();

    await sleep(100);

    expect(link.push).not.toHaveBeenCalled();

    await sleep(400);

    expect(link.push).toHaveBeenCalledWith({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });

    client.stop();
  });

  test("can report whether there are updates waiting to be pushed", async () => {
    const link = {
      push: jest.fn().mockResolvedValue(undefined),
      pull: jest.fn(),
    };

    const client = createSyncClient({
      pushExecution: { type: "periodic", intervalMs: 500 },
      link,
      schemaVersion: 0,
    });

    client.start();

    expect(client.isPushPending()).toBe(false);

    client.enqueueUpdate({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });

    expect(client.isPushPending()).toBe(true);

    await sleep(500);

    expect(client.isPushPending()).toBe(false);

    client.stop();
  });

  test("pushes update via link", async () => {
    const link = { push: jest.fn(), pull: jest.fn() };

    const client = createSyncClient({
      pushExecution: { type: "asap" },
      link,
      schemaVersion: 0,
    });

    client.enqueueUpdate({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });

    expect(link.push).toHaveBeenCalledWith({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });

    client.enqueueUpdate({
      _schemaVersion: 0,
      _baseRev: 1,
      _rev: 2,
      foo: "world",
    });

    expect(link.push).toHaveBeenCalledWith({
      _schemaVersion: 0,
      _baseRev: 1,
      _rev: 2,
      foo: "world",
    });
  });

  test.skip("throws if attempting an update while another update is in progress", async () => {
    let finishUpdating: () => void;
    const link = {
      push: jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishUpdating = resolve;
          })
      ),
      pull: jest.fn(),
    };

    const client = createSyncClient({
      pushExecution: { type: "asap" },
      link,
      schemaVersion: 0,
    });

    client.enqueueUpdate({
      _schemaVersion: 0,
      _baseRev: null,
      _rev: 1,
      foo: "hello",
    });
  });

  test.todo("allows registering and unregistering handlers");

  test.todo("subscribe function returns unsubscribe function");
});
