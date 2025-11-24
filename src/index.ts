import express from "express";
import type { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_req: Request, res: Response) => {
//   res.json({msg: "server is running"});
  res.send("ok");
});
// Learning Branching 
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});