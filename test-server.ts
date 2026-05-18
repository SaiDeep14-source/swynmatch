import express from "express";

const app = express();

app.use("/api", (req, res, next) => {
  console.log("Middleware executed, Path:", req.path, "URL:", req.url);
  next();
});

app.get("/api/sources", (req, res) => {
  res.json({ route: "matched GET /api/sources" });
});

app.post("/api/sources", (req, res) => {
  res.json({ route: "matched POST /api/sources" });
});

app.listen(3002, () => console.log("Test server ready on 3002"));
