import express from "express";
const app = express();
const port = process.env.PORT || 4000;
app.use(express.json());
app.get("/", (_req, res) => {
    //   res.json({msg: "server is running"});
    res.send("ok");
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map