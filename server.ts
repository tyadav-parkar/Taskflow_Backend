import express from "express";
import type { Request, Response } from "express";
import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import bodyParser from 'body-parser';
import connectDB from './config/db.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
connectDB();
// app.get("/", (_req: Request, res: Response) => {
//   res.send("ok");
// });

import userRouter from './routes/user.route.js';
app.use("/api/user", userRouter);


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});