const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app, Call } = require("../app");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Call.init(); // make sure the unique index exists
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Call.deleteMany({});
});

test("repeated request does not create a second record", async () => {
  const payload = { call_id: "abc123", status: "answered", duration_secs: 42 };

  const first = await request(app).post("/call-ended").send(payload);
  const second = await request(app).post("/call-ended").send(payload);

  expect(first.status).toBe(201);
  expect(second.status).toBe(200); // still a success
  expect(second.body.duplicate).toBe(true);
  expect(await Call.countDocuments({ call_id: "abc123" })).toBe(1); // only one record
});

test("missing call_id is rejected with a clear message", async () => {
  const res = await request(app).post("/call-ended").send({ status: "answered" });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/call_id/);
});

test("GET returns the record, or 404 if unknown", async () => {
  await request(app).post("/call-ended").send({ call_id: "abc123", status: "answered", duration_secs: 42 });
  const found = await request(app).get("/calls/abc123");
  expect(found.status).toBe(200);
  expect(found.body.duration_secs).toBe(42);
  expect((await request(app).get("/calls/nope")).status).toBe(404);
});
