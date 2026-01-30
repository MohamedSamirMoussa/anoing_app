import express from "express";
import type { Express } from "express";
import bootstrap from "./app.controller";
const app: Express = express();

bootstrap(app)
export default app;