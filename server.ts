import express from "express";
import type { Request, Response } from "express";

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
//   res.json({msg: "server is running"});
  res.send("ok");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});